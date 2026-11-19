#!/usr/bin/env node
/**
 * Boot performance budget.
 *
 * Serves the production build, opens it in headless Chrome under a fixed
 * network profile, and fails when the first frame, the initial payload or the
 * lazy-model contract regress. Requires Node 22+ (global WebSocket) and a
 * Chrome/Chromium/Edge binary (override with CHROME_PATH).
 */

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import {
  createReadStream,
  existsSync,
  mkdtempSync,
  rmSync,
  statSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');

const BUDGETS = {
  firstFrameMs: Number(process.env.PERF_FIRST_FRAME_MS ?? 5_000),
  initialTransferBytes: Number(process.env.PERF_TRANSFER_BYTES ?? 4_000_000),
  glbsBeforeFirstFrame: Number(process.env.PERF_GLBS_BEFORE_FRAME ?? 0)
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2'
};

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg']);

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function startServer() {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    const filePath = resolve(DIST, `.${pathname}`);
    if (!filePath.startsWith(`${DIST}${sep}`)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    const extension = extname(filePath);
    const headers = {
      'content-type': MIME_TYPES[extension] ?? 'application/octet-stream',
      'cache-control': 'no-store'
    };

    if (
      COMPRESSIBLE.has(extension) &&
      (request.headers['accept-encoding'] ?? '').includes('gzip')
    ) {
      headers['content-encoding'] = 'gzip';
      headers.vary = 'Accept-Encoding';
      response.writeHead(200, headers);
      createReadStream(filePath).pipe(createGzip()).pipe(response);
      return;
    }

    response.writeHead(200, headers);
    createReadStream(filePath).pipe(response);
  });

  return new Promise((resolveServer, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolveServer(server));
  });
}

function resolveChrome() {
  const candidates = [process.env.CHROME_PATH];

  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    );
  } else {
    candidates.push(
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser'
    );
  }

  for (const candidate of candidates.filter(Boolean)) {
    if (isAbsolute(candidate)) {
      if (existsSync(candidate)) return candidate;
      continue;
    }

    const probe = spawnSync(
      process.platform === 'win32' ? 'where' : 'which',
      [candidate],
      { stdio: 'ignore' }
    );
    if (probe.status === 0) return candidate;
  }

  throw new Error(
    'Chrome not found. Set CHROME_PATH to a Chrome, Chromium or Edge executable.'
  );
}

function waitForDevTools(child) {
  return new Promise((resolveEndpoint, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      reject(new Error('Chrome did not expose a DevTools endpoint within 15 s.'));
    }, 15_000);

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      buffer += chunk;
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolveEndpoint(match[1]);
      }
    });

    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited before DevTools was ready (code ${code}).`));
    });
  });
}

function connectCdp(wsEndpoint) {
  return new Promise((resolveClient, reject) => {
    const socket = new WebSocket(wsEndpoint);
    const pending = new Map();
    const consoleMessages = [];
    const exceptions = [];
    let nextId = 0;

    const send = (method, params = {}) =>
      new Promise((resolveSend) => {
        const id = (nextId += 1);
        pending.set(id, resolveSend);
        socket.send(JSON.stringify({ id, method, params }));
      });

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
        return;
      }

      if (message.method === 'Runtime.consoleAPICalled') {
        consoleMessages.push({
          type: message.params.type,
          text: message.params.args
            .map((argument) => argument.value ?? argument.description ?? '')
            .join(' ')
        });
      }

      if (message.method === 'Runtime.exceptionThrown') {
        exceptions.push(
          message.params.exceptionDetails.exception?.description ??
            message.params.exceptionDetails.text
        );
      }
    });

    socket.addEventListener(
      'open',
      () => {
        const evaluate = async (expression) => {
          const response = await send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
          });
          if (response.result.exceptionDetails) {
            throw new Error(response.result.exceptionDetails.text);
          }
          return response.result.result.value;
        };

        resolveClient({ socket, send, evaluate, consoleMessages, exceptions });
      },
      { once: true }
    );

    socket.addEventListener(
      'error',
      () => reject(new Error('Could not connect to the Chrome DevTools endpoint.')),
      { once: true }
    );
  });
}

function killChrome(child) {
  return new Promise((resolveKill) => {
    if (!child || child.exitCode !== null) {
      resolveKill();
      return;
    }

    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore'
      });
      setTimeout(resolveKill, 400);
      return;
    }

    child.kill('SIGKILL');
    child.once('exit', resolveKill);
    setTimeout(resolveKill, 2_000);
  });
}

async function main() {
  if (typeof WebSocket === 'undefined') {
    throw new Error('This script requires Node.js 22+ (global WebSocket).');
  }

  if (!existsSync(join(DIST, 'index.html'))) {
    throw new Error('dist/index.html is missing. Run `npm run build` first.');
  }

  const server = await startServer();
  const serverPort = server.address().port;
  const profile = mkdtempSync(join(tmpdir(), 'jovian-perf-'));
  const chrome = resolveChrome();

  const args = [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--window-size=1440,900',
    'about:blank'
  ];
  if (process.platform !== 'win32') {
    args.push('--no-sandbox', '--disable-dev-shm-usage');
  }

  const child = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let client = null;

  try {
    const endpoint = await waitForDevTools(child);
    const debugPort = new URL(endpoint).port;
    const targets = await (
      await fetch(`http://127.0.0.1:${debugPort}/json`)
    ).json();
    const page = targets.find((target) => target.type === 'page');
    if (!page) throw new Error('Chrome exposed no page target.');

    client = await connectCdp(page.webSocketDebuggerUrl);
    const { socket, send, evaluate, consoleMessages, exceptions } = client;

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 40,
      downloadThroughput: (20 * 1024 * 1024) / 8,
      uploadThroughput: (5 * 1024 * 1024) / 8
    });
    await send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/` });

    let firstFrameMs = null;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      firstFrameMs = await evaluate(
        `performance.getEntriesByName('jovian:first-frame')[0]?.startTime ?? null`
      );
      if (firstFrameMs !== null) break;
      await sleep(250);
    }

    await sleep(1_500);

    const raw = await evaluate(`JSON.stringify({
      resources: performance.getEntriesByType('resource').map((entry) => ({
        name: entry.name,
        start: entry.startTime,
        end: entry.responseEnd,
        transfer: entry.transferSize
      }))
    })`);
    const { resources } = JSON.parse(raw);
    const glbs = resources.filter((entry) => entry.name.endsWith('.glb'));
    const glbsBeforeFirstFrame = glbs.filter(
      (entry) => firstFrameMs !== null && entry.start < firstFrameMs
    );
    const initialTransferBytes = resources.reduce(
      (sum, entry) => sum + (entry.transfer || 0),
      0
    );
    const clockWarnings = consoleMessages.filter(
      (message) =>
        /THREE\.Clock/.test(message.text) ||
        /Clock:.*deprecated/i.test(message.text)
    );

    const failures = [];
    if (firstFrameMs === null) {
      failures.push('first-frame mark is missing');
    } else if (firstFrameMs > BUDGETS.firstFrameMs) {
      failures.push(
        `first frame ${Math.round(firstFrameMs)} ms > ${BUDGETS.firstFrameMs} ms`
      );
    }
    if (glbsBeforeFirstFrame.length > BUDGETS.glbsBeforeFirstFrame) {
      failures.push(
        `${glbsBeforeFirstFrame.length} GLB request(s) before the first frame`
      );
    }
    if (initialTransferBytes > BUDGETS.initialTransferBytes) {
      failures.push(
        `initial transfer ${initialTransferBytes} B > ${BUDGETS.initialTransferBytes} B`
      );
    }
    if (exceptions.length > 0) {
      failures.push(`${exceptions.length} uncaught exception(s)`);
    }
    if (clockWarnings.length > 0) {
      failures.push('THREE.Clock deprecation warning is present');
    }

    console.log('Boot performance budget');
    console.log(
      `  first frame       ${firstFrameMs === null ? 'missing' : `${Math.round(firstFrameMs)} ms`} (budget ${BUDGETS.firstFrameMs} ms)`
    );
    console.log(
      `  initial transfer  ${initialTransferBytes} B (budget ${BUDGETS.initialTransferBytes} B)`
    );
    console.log(
      `  GLBs before frame ${glbsBeforeFirstFrame.length} (budget ${BUDGETS.glbsBeforeFirstFrame})`
    );
    console.log(`  exceptions        ${exceptions.length}`);
    console.log(`  Clock warnings    ${clockWarnings.length}`);

    if (failures.length > 0) {
      console.error('\nPERF BUDGET FAILED');
      for (const failure of failures) console.error(`  - ${failure}`);
      process.exitCode = 1;
      return;
    }

    console.log('\nPERF BUDGET OK');
    socket.close();
  } finally {
    await killChrome(child);
    server.closeAllConnections?.();
    await new Promise((resolveClose) => server.close(resolveClose));
    await sleep(200);
    try {
      rmSync(profile, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200
      });
    } catch {
      // Chrome can still hold the profile on Windows; the OS temp cleaner wins.
    }
  }
}

main().catch((error) => {
  console.error(`PERF BUDGET ERROR: ${error.message}`);
  process.exitCode = 1;
});
