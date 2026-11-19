import { J2000_EPOCH_MS, MS_PER_DAY } from './AstroScale.js';

export const MS_PER_HOUR = 3600000;

const TARGET_LABELS = {
  JUPITER: 'Jupiter',
  JUPITER_RINGS: 'Rings',
  IO: 'Io',
  EUROPA: 'Europa',
  GANYMEDE: 'Ganymede',
  CALLISTO: 'Callisto',
  SATURN: 'Saturn'
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getMissionTiming(mission) {
  const eventMs = Date.parse(mission.timestamp);
  const windowHours = mission.windowHours > 0 ? mission.windowHours : 48;
  const peakT =
    typeof mission.peakT === 'number' && Number.isFinite(mission.peakT)
      ? mission.peakT
      : 0.5;
  return { eventMs, windowHours, peakT };
}

/**
 * Convert a normalized mission parameter u in [0, 1] into hours relative to
 * periapsis (mission.timestamp).
 */
export function missionUToDeltaHours(mission, u) {
  if (!mission) return 0;
  const { windowHours, peakT } = getMissionTiming(mission);
  const clampedU = clamp(u, 0, 1);
  return (clampedU - peakT) * windowHours;
}

/**
 * Convert a normalized mission parameter u in [0, 1] into days since J2000.
 */
export function missionUToDaysSinceEpoch(mission, u) {
  if (!mission) return 0;
  const { eventMs } = getMissionTiming(mission);
  const deltaHours = missionUToDeltaHours(mission, u);
  const targetMs = eventMs + deltaHours * MS_PER_HOUR;
  return (targetMs - J2000_EPOCH_MS) / MS_PER_DAY;
}

/**
 * Compute live mission window progress from daysSinceEpoch.
 * Returns clamped u in [0, 1], unclamped rawU, relative deltaHours, and inWindow flag.
 */
export function daysSinceEpochToMissionProgress(mission, daysSinceEpoch) {
  if (!mission) {
    return { u: 0, rawU: 0, deltaHours: 0, inWindow: false };
  }

  const { eventMs, windowHours, peakT } = getMissionTiming(mission);
  const nowMs = J2000_EPOCH_MS + daysSinceEpoch * MS_PER_DAY;
  const deltaHours = (nowMs - eventMs) / MS_PER_HOUR;
  const rawU = peakT + deltaHours / windowHours;
  const u = clamp(rawU, 0, 1);
  const inWindow = rawU >= -1e-4 && rawU <= 1 + 1e-4;

  return { u, rawU, deltaHours, inWindow };
}

/**
 * Return the start/end relative hours of the mission window (e.g. -4h to +4h).
 */
export function getMissionWindowBounds(mission) {
  if (!mission) return { startHours: 0, endHours: 0, windowHours: 0, peakT: 0.5 };
  const { windowHours, peakT } = getMissionTiming(mission);
  return {
    startHours: -peakT * windowHours,
    endHours: (1 - peakT) * windowHours,
    windowHours,
    peakT
  };
}

/**
 * Resolve the active milestone index matching MissionSimulator.getActiveOpticalConfig.
 */
export function getActiveMilestoneIndex(milestones, u) {
  if (!Array.isArray(milestones) || milestones.length === 0) return -1;
  let activeIndex = 0;
  for (let i = 0; i < milestones.length; i += 1) {
    if (milestones[i].t <= u + 1e-6) {
      activeIndex = i;
    }
  }
  return activeIndex;
}

/**
 * Format hours relative to periapsis in JPL mission elapsed time notation (e.g. T-02:24, T+00:00).
 */
export function formatMissionOffset(deltaHours) {
  if (!Number.isFinite(deltaHours)) return 'T+00:00';
  const totalMinutes = Math.round(deltaHours * 60);
  const sign = totalMinutes < 0 ? '-' : '+';
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;

  if (hours >= 100) {
    const days = (absMinutes / 1440).toFixed(1);
    return `T${sign}${days}d`;
  }

  return `T${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Format short boundary labels for the timeline ends (e.g. "-24h", "+4h").
 */
export function formatWindowBoundHours(hours) {
  if (!Number.isFinite(hours)) return '0h';
  const sign = hours > 0 ? '+' : '';
  const rounded = Math.round(hours * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${sign}${label}h`;
}

/**
 * Convert an internal targetKey (e.g. JUPITER_RINGS) into a concise UI label.
 */
export function formatTargetLabel(targetKey) {
  if (!targetKey) return 'Jupiter';
  return TARGET_LABELS[targetKey] ?? targetKey;
}

/**
 * Convert a numeric hex color (e.g. 0x9df4c7) into a CSS hex string.
 */
export function formatMissionColorHex(colorInt) {
  if (typeof colorInt !== 'number' || !Number.isFinite(colorInt)) {
    return '#e2b476';
  }
  const safe = Math.max(0, Math.min(0xffffff, Math.round(colorInt)));
  return `#${safe.toString(16).padStart(6, '0')}`;
}
