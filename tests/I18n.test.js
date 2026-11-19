import { describe, expect, it } from 'vitest';
import { MISSIONS, MISSION_ORDER } from '../src/data/HistoricalMissions.js';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  detectInitialLanguage,
  formatLocalizedRate,
  getBodyMeta,
  getMilestoneTitle,
  getMissionDescription,
  getMissionPlanetLabel,
  getTargetLabel,
  getTranslationKeys,
  normalizeLanguage,
  t
} from '../src/i18n/I18n.js';

describe('I18n bilingual dictionary (EN / ES)', () => {
  it('maintains 100% key parity between English and Spanish', () => {
    const enKeys = getTranslationKeys('en').sort();
    const esKeys = getTranslationKeys('es').sort();
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'es']);
    expect(esKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(40);
  });

  it('normalizes and detects initial language safely', () => {
    expect(normalizeLanguage('es')).toBe('es');
    expect(normalizeLanguage('es-MX')).toBe('es');
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('fr-FR')).toBe(DEFAULT_LANGUAGE);
    expect(normalizeLanguage(null)).toBe(DEFAULT_LANGUAGE);

    expect(detectInitialLanguage({ stored: 'es', navigatorLanguage: 'en-US' })).toBe('es');
    expect(detectInitialLanguage({ stored: 'en', navigatorLanguage: 'es-ES' })).toBe('en');
    expect(detectInitialLanguage({ stored: null, navigatorLanguage: 'es-MX' })).toBe('es');
    expect(detectInitialLanguage({ stored: null, navigatorLanguage: 'en-GB' })).toBe('en');
    expect(detectInitialLanguage({})).toBe('en');
  });

  it('provides localized descriptions and all milestone titles for every Jovian mission', () => {
    for (const key of MISSION_ORDER.JUPITER) {
      const mission = MISSIONS.JUPITER[key];
      const descEn = getMissionDescription(key, 'en');
      const descEs = getMissionDescription(key, 'es');
      expect(descEn.length).toBeGreaterThan(20);
      expect(descEs.length).toBeGreaterThan(20);
      expect(descEn).not.toBe(descEs);

      for (let i = 0; i < mission.milestones.length; i += 1) {
        const titleEn = getMilestoneTitle(key, i, 'en');
        const titleEs = getMilestoneTitle(key, i, 'es');
        expect(titleEn.length).toBeGreaterThan(5);
        expect(titleEs.length).toBeGreaterThan(5);
        expect(titleEn).not.toBe(titleEs);
      }
    }
  });

  it('localizes body metadata, target labels, mission optgroups, and time rates', () => {
    expect(getBodyMeta('jupiter', 'en').name).toBe('Jupiter');
    expect(getBodyMeta('jupiter', 'es').name).toBe('Júpiter');
    expect(getBodyMeta('io', 'es').name).toBe('Ío');
    expect(getBodyMeta('ganymede', 'es').name).toBe('Ganímedes');

    expect(getTargetLabel('JUPITER_RINGS', 'en')).toBe('Rings');
    expect(getTargetLabel('JUPITER_RINGS', 'es')).toBe('Anillos');
    expect(getMissionPlanetLabel('JUPITER', 'en')).toBe('Jupiter Missions');
    expect(getMissionPlanetLabel('JUPITER', 'es')).toBe('Misiones a Júpiter');

    expect(formatLocalizedRate(1, false, 'en')).toBe('1× · real time');
    expect(formatLocalizedRate(1, false, 'es')).toBe('1× · tiempo real');
    expect(formatLocalizedRate(3600, true, 'en')).toBe('PAUSED');
    expect(formatLocalizedRate(3600, true, 'es')).toBe('PAUSA');
    expect(t('es', 'missionWindow', { hours: 8 })).toBe('Ventana de 8h');
  });
});
