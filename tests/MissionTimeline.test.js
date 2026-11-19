import { describe, expect, it } from 'vitest';
import { MISSIONS, MISSION_ORDER } from '../src/data/HistoricalMissions.js';
import { J2000_EPOCH_MS, MS_PER_DAY } from '../src/math/AstroScale.js';
import {
  daysSinceEpochToMissionProgress,
  formatMissionColorHex,
  formatMissionOffset,
  formatTargetLabel,
  formatWindowBoundHours,
  getActiveMilestoneIndex,
  getMissionWindowBounds,
  missionUToDaysSinceEpoch,
  missionUToDeltaHours
} from '../src/math/MissionTimeline.js';

describe('MissionTimeline math and formatting', () => {
  it('round-trips normalized mission time u and daysSinceEpoch for every Jovian mission', () => {
    for (const key of MISSION_ORDER.JUPITER) {
      const mission = MISSIONS.JUPITER[key];
      const eventDays = (Date.parse(mission.timestamp) - J2000_EPOCH_MS) / MS_PER_DAY;

      // Periapsis peakT maps directly to the historical mission timestamp.
      expect(missionUToDaysSinceEpoch(mission, mission.peakT)).toBeCloseTo(
        eventDays,
        10
      );

      for (const sampleU of [0, 0.2, 0.5, 0.78, 1]) {
        const days = missionUToDaysSinceEpoch(mission, sampleU);
        const progress = daysSinceEpochToMissionProgress(mission, days);
        expect(progress.u).toBeCloseTo(sampleU, 10);
        expect(progress.rawU).toBeCloseTo(sampleU, 10);
        expect(progress.inWindow).toBe(true);
      }
    }
  });

  it('computes exact milestone relative hours and UTC epochs', () => {
    const juno = MISSIONS.JUPITER.juno; // 2016-08-27T12:51:00Z, 8h window, peakT 0.5
    expect(missionUToDeltaHours(juno, juno.milestones[0].t)).toBeCloseTo(-2.4, 8);
    expect(missionUToDeltaHours(juno, juno.milestones[1].t)).toBeCloseTo(0, 8);
    expect(missionUToDeltaHours(juno, juno.milestones[2].t)).toBeCloseTo(2.8, 8);

    const northPoleDays = missionUToDaysSinceEpoch(juno, juno.milestones[0].t);
    const northPoleDate = new Date(J2000_EPOCH_MS + northPoleDays * MS_PER_DAY);
    expect(northPoleDate.toISOString()).toBe('2016-08-27T10:27:00.000Z');

    const bounds = getMissionWindowBounds(juno);
    expect(bounds).toEqual({
      startHours: -4,
      endHours: 4,
      windowHours: 8,
      peakT: 0.5
    });
  });

  it('clamps progress cleanly and flags epochs outside the flight window', () => {
    const voyager1 = MISSIONS.JUPITER.voyager1; // 48h window (-24h .. +24h)
    const eventDays =
      (Date.parse(voyager1.timestamp) - J2000_EPOCH_MS) / MS_PER_DAY;

    const beforeWindow = daysSinceEpochToMissionProgress(voyager1, eventDays - 2);
    expect(beforeWindow.u).toBe(0);
    expect(beforeWindow.rawU).toBeLessThan(0);
    expect(beforeWindow.inWindow).toBe(false);
    expect(beforeWindow.deltaHours).toBeCloseTo(-48, 8);

    const afterWindow = daysSinceEpochToMissionProgress(voyager1, eventDays + 2);
    expect(afterWindow.u).toBe(1);
    expect(afterWindow.rawU).toBeGreaterThan(1);
    expect(afterWindow.inWindow).toBe(false);
    expect(afterWindow.deltaHours).toBeCloseTo(48, 8);
  });

  it('resolves the active milestone index matching optical milestone progression', () => {
    const milestones = MISSIONS.JUPITER.voyager1.milestones; // t: 0.25, 0.55, 0.78

    expect(getActiveMilestoneIndex(milestones, 0.0)).toBe(0);
    expect(getActiveMilestoneIndex(milestones, 0.25)).toBe(0);
    expect(getActiveMilestoneIndex(milestones, 0.54)).toBe(0);
    expect(getActiveMilestoneIndex(milestones, 0.55)).toBe(1);
    expect(getActiveMilestoneIndex(milestones, 0.77)).toBe(1);
    expect(getActiveMilestoneIndex(milestones, 0.78)).toBe(2);
    expect(getActiveMilestoneIndex(milestones, 1.0)).toBe(2);
    expect(getActiveMilestoneIndex([], 0.5)).toBe(-1);
  });

  it('formats mission offsets, bounds, target labels, and hex accent colors', () => {
    expect(formatMissionOffset(0)).toBe('T+00:00');
    expect(formatMissionOffset(-2.4)).toBe('T-02:24');
    expect(formatMissionOffset(2.8)).toBe('T+02:48');
    expect(formatMissionOffset(-24)).toBe('T-24:00');
    expect(formatMissionOffset(120)).toBe('T+5.0d');

    expect(formatWindowBoundHours(-24)).toBe('-24h');
    expect(formatWindowBoundHours(4)).toBe('+4h');
    expect(formatWindowBoundHours(-2.5)).toBe('-2.5h');

    expect(formatTargetLabel('JUPITER')).toBe('Jupiter');
    expect(formatTargetLabel('JUPITER_RINGS')).toBe('Rings');
    expect(formatTargetLabel('IO')).toBe('Io');
    expect(formatTargetLabel('EUROPA')).toBe('Europa');

    expect(formatMissionColorHex(0x9df4c7)).toBe('#9df4c7');
    expect(formatMissionColorHex(0x0044ff)).toBe('#0044ff');
  });
});
