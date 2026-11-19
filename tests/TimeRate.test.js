import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CONSTANTS } from '../src/math/AstroScale.js';
import { JupiterSimulator } from '../src/core/JupiterSimulator.js';
import {
  RATE_PRESETS,
  SECONDS_PER_DAY,
  advanceSimulationDays,
  formatRate
} from '../src/math/TimeRate.js';

describe('simulation time rate', () => {
  it('advances one simulated second per real second at rate 1', () => {
    expect(SECONDS_PER_DAY).toBe(86400);
    expect(advanceSimulationDays(1, 1)).toBeCloseTo(1 / 86400, 12);
    expect(advanceSimulationDays(3600, 1)).toBeCloseTo(1 / 24, 12);
    expect(advanceSimulationDays(86400, 1)).toBeCloseTo(1, 12);
  });

  it('formats preset readouts and paused state', () => {
    expect(formatRate(1, false)).toContain('real');
    expect(formatRate(3600, false)).toContain('1 h/s');
    expect(formatRate(86400, false)).toContain('1 d/s');
    expect(formatRate(3600, true)).toBe('PAUSED');
  });

  it('keeps rate presets ordered and unique', () => {
    const rates = RATE_PRESETS.map((preset) => preset.rate);

    expect(rates).toEqual([1, 60, 3600, 86400]);
    expect(new Set(rates).size).toBe(rates.length);
  });

  it('derives Jupiter spin from elapsed days without a separate rotation speed', () => {
    const scene = new THREE.Scene();
    const assets = {
      jupiterColor: null,
      jupiterNormal: null,
      jupiterClouds: null
    };
    const jupiter = new JupiterSimulator(scene, assets);

    jupiter.update(CONSTANTS.JUPITER.ROTATION_PERIOD_DAYS / 2);
    expect(jupiter.spinGroup.rotation.y).toBeCloseTo(Math.PI, 6);

    jupiter.update(CONSTANTS.JUPITER.ROTATION_PERIOD_DAYS);
    expect(jupiter.spinGroup.rotation.y).toBeCloseTo(0, 6);

    jupiter.update(advanceSimulationDays(10, 1));
    const tenSecondDegrees = THREE.MathUtils.radToDeg(jupiter.spinGroup.rotation.y);
    expect(tenSecondDegrees).toBeGreaterThan(0.09);
    expect(tenSecondDegrees).toBeLessThan(0.11);
  });
});
