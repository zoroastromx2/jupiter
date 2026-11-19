import { describe, expect, it } from 'vitest';
import {
  INSTRUMENT_MAX_FOV,
  INSTRUMENT_MIN_FOV,
  SURFACE_MAX_PITCH_RAD,
  SURFACE_MAX_YAW_RAD,
  applySurfaceLookDelta,
  computePinchFov,
  computeTouchDistance,
  computeTouchMidpoint,
  getTouchControlProfile,
  isDoubleTap,
  resolveSwipeSheetAction
} from '../src/input/TouchGestureMath.js';

describe('TouchGestureMath', () => {
  it('computes touch distance and midpoint between two pointers', () => {
    const p1 = { x: 100, y: 200 };
    const p2 = { x: 130, y: 240 };

    expect(computeTouchDistance(p1, p2)).toBeCloseTo(50, 6);
    expect(computeTouchMidpoint(p1, p2)).toEqual({ x: 115, y: 220 });
  });

  it('recognizes valid double-taps and rejects slow or distant taps', () => {
    expect(
      isDoubleTap({
        firstTime: 1000,
        secondTime: 1210,
        firstX: 180,
        firstY: 320,
        secondX: 192,
        secondY: 330
      })
    ).toBe(true);

    expect(
      isDoubleTap({
        firstTime: 1000,
        secondTime: 1500,
        firstX: 180,
        firstY: 320,
        secondX: 182,
        secondY: 322
      })
    ).toBe(false);

    expect(
      isDoubleTap({
        firstTime: 1000,
        secondTime: 1120,
        firstX: 100,
        firstY: 200,
        secondX: 180,
        secondY: 200
      })
    ).toBe(false);
  });

  it('maps pinch ratios to clamped optical instrument FOV', () => {
    // Spreading fingers apart (2x distance) halves FOV (zooms in)
    expect(computePinchFov(32, 100, 200)).toBeCloseTo(16, 5);
    // Extreme spread clamps at narrowest NAC FOV
    expect(computePinchFov(32, 100, 800)).toBe(INSTRUMENT_MIN_FOV);
    // Pinching together widens FOV and clamps at widest WAC FOV
    expect(computePinchFov(32, 200, 100)).toBe(INSTRUMENT_MAX_FOV);
    // Guard invalid inputs safely
    expect(computePinchFov(32, 0, 100)).toBe(32);
  });

  it('applies clamped surface look-around deltas from finger drags', () => {
    const gentle = applySurfaceLookDelta(0, 0, 39, -42, 390, 844);
    expect(gentle.yaw).toBeGreaterThan(0);
    expect(gentle.pitch).toBeLessThan(0);

    const extreme = applySurfaceLookDelta(0, 0, 2000, 2000, 390, 844);
    expect(extreme.yaw).toBe(SURFACE_MAX_YAW_RAD);
    expect(extreme.pitch).toBe(SURFACE_MAX_PITCH_RAD);

    const extremeNeg = applySurfaceLookDelta(0, 0, -2000, -2000, 390, 844);
    expect(extremeNeg.yaw).toBe(-SURFACE_MAX_YAW_RAD);
    expect(extremeNeg.pitch).toBe(-SURFACE_MAX_PITCH_RAD);
  });

  it('resolves mobile drawer swipe open/close thresholds', () => {
    expect(resolveSwipeSheetAction(60, 0.1, true)).toBe('close');
    expect(resolveSwipeSheetAction(15, 0.5, true)).toBe('close');
    expect(resolveSwipeSheetAction(12, 0.05, true)).toBe('keep');

    expect(resolveSwipeSheetAction(-60, -0.1, false)).toBe('open');
    expect(resolveSwipeSheetAction(-12, -0.5, false)).toBe('open');
    expect(resolveSwipeSheetAction(-10, -0.05, false)).toBe('keep');
  });

  it('selects responsive OrbitControls profiles for touch vs desktop', () => {
    const mobile = getTouchControlProfile(true, 390);
    const desktop = getTouchControlProfile(false, 1440);

    expect(mobile.rotateSpeed).toBeGreaterThan(desktop.rotateSpeed);
    expect(mobile.zoomSpeed).toBeGreaterThan(desktop.zoomSpeed);
    expect(mobile.dampingFactor).toBeGreaterThanOrEqual(desktop.dampingFactor);
  });
});
