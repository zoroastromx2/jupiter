export const DOUBLE_TAP_MAX_DELAY_MS = 320;
export const DOUBLE_TAP_MAX_DISTANCE_PX = 36;
export const INSTRUMENT_MIN_FOV = 8;
export const INSTRUMENT_MAX_FOV = 55;
export const SURFACE_MAX_YAW_RAD = Math.PI * 0.72;
export const SURFACE_MAX_PITCH_RAD = Math.PI * 0.34;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function computeTouchDistance(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.hypot(dx, dy);
}

export function computeTouchMidpoint(p1, p2, out = { x: 0, y: 0 }) {
  if (!p1 || !p2) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  out.x = (p1.x + p2.x) * 0.5;
  out.y = (p1.y + p2.y) * 0.5;
  return out;
}

export function isDoubleTap({
  firstTime,
  secondTime,
  firstX,
  firstY,
  secondX,
  secondY,
  maxDelayMs = DOUBLE_TAP_MAX_DELAY_MS,
  maxDistancePx = DOUBLE_TAP_MAX_DISTANCE_PX
}) {
  if (
    !Number.isFinite(firstTime) ||
    !Number.isFinite(secondTime) ||
    secondTime < firstTime
  ) {
    return false;
  }
  const dt = secondTime - firstTime;
  if (dt > maxDelayMs) return false;
  const dist = Math.hypot(secondX - firstX, secondY - firstY);
  return dist <= maxDistancePx;
}

/**
 * Computes optical camera FOV during a two-finger pinch gesture.
 * Spreading fingers apart (ratio > 1) narrows FOV to zoom in;
 * pinching fingers together (ratio < 1) widens FOV to zoom out.
 */
export function computePinchFov(
  baseFov,
  initialDistance,
  currentDistance,
  { minFov = INSTRUMENT_MIN_FOV, maxFov = INSTRUMENT_MAX_FOV } = {}
) {
  if (
    !Number.isFinite(baseFov) ||
    !Number.isFinite(initialDistance) ||
    !Number.isFinite(currentDistance) ||
    initialDistance <= 1 ||
    currentDistance <= 1
  ) {
    return clamp(Number.isFinite(baseFov) ? baseFov : 32, minFov, maxFov);
  }
  const ratio = currentDistance / initialDistance;
  return clamp(baseFov / ratio, minFov, maxFov);
}

/**
 * Converts a single-finger drag delta (in CSS pixels) into clamped
 * yaw/pitch offsets for looking around in surface view.
 */
export function applySurfaceLookDelta(
  currentYaw,
  currentPitch,
  deltaX,
  deltaY,
  viewportWidth,
  viewportHeight,
  {
    maxYaw = SURFACE_MAX_YAW_RAD,
    maxPitch = SURFACE_MAX_PITCH_RAD,
    sensitivity = 1.65
  } = {}
) {
  const safeW = Math.max(1, viewportWidth || 390);
  const safeH = Math.max(1, viewportHeight || 844);

  const yawDelta = (deltaX / safeW) * Math.PI * sensitivity;
  const pitchDelta = (deltaY / safeH) * Math.PI * (sensitivity * 0.72);

  return {
    yaw: clamp(currentYaw + yawDelta, -maxYaw, maxYaw),
    pitch: clamp(currentPitch + pitchDelta, -maxPitch, maxPitch)
  };
}

/**
 * Resolves whether a vertical swipe on the mobile bottom sheet
 * should open, close, or keep the current state.
 */
export function resolveSwipeSheetAction(
  deltaY,
  velocityY,
  isExpanded,
  { thresholdPx = 44, velocityThreshold = 0.35 } = {}
) {
  if (!Number.isFinite(deltaY)) return 'keep';
  const safeVel = Number.isFinite(velocityY) ? velocityY : 0;

  if (isExpanded) {
    if (deltaY >= thresholdPx || safeVel >= velocityThreshold) return 'close';
    return 'keep';
  }
  if (deltaY <= -thresholdPx || safeVel <= -velocityThreshold) return 'open';
  return 'keep';
}

/**
 * Returns tuned OrbitControls response parameters for touch/narrow screens
 * versus desktop mouse navigation.
 */
export function getTouchControlProfile(isCoarsePointer, viewportWidth = 1440) {
  const isTouchLike = Boolean(isCoarsePointer) || viewportWidth <= 900;
  if (isTouchLike) {
    return {
      rotateSpeed: 0.92,
      zoomSpeed: 1.15,
      panSpeed: 0.85,
      dampingFactor: 0.08
    };
  }
  return {
    rotateSpeed: 0.55,
    zoomSpeed: 0.8,
    panSpeed: 0.7,
    dampingFactor: 0.06
  };
}
