import { SECONDS_PER_DAY } from './AstroScale.js';

export { SECONDS_PER_DAY };

export const RATE_PRESETS = [
  { rate: 1, label: 'Real', readout: '1× · real time' },
  { rate: 60, label: '1 min/s', readout: '60× · 1 min/s' },
  { rate: 3600, label: '1 h/s', readout: '3600× · 1 h/s' },
  { rate: 86400, label: '1 d/s', readout: '86400× · 1 d/s' }
];

export function advanceSimulationDays(deltaSeconds, rate) {
  return (deltaSeconds * rate) / SECONDS_PER_DAY;
}

export function formatRate(rate, paused) {
  if (paused) return 'PAUSED';

  const preset = RATE_PRESETS.find((entry) => entry.rate === rate);
  return preset?.readout ?? `${rate.toLocaleString('en-US')}× · custom rate`;
}
