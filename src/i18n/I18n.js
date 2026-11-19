export const SUPPORTED_LANGUAGES = ['en', 'es'];
export const DEFAULT_LANGUAGE = 'en';
export const LANG_STORAGE_KEY = 'jovian-observatory:lang';

const TRANSLATIONS = {
  en: {
    docTitle: 'Jovian Observatory · Jupiter & Galilean Moons',
    canvasAria: 'Simulation of Jupiter and the moons Io, Europa, Ganymede and Callisto',
    brandEyebrow: 'JOVIAN SYSTEM / SOL V',
    brandTitle: 'Jupiter',
    brandSubtitle: 'Galilean observatory · 5.20 AU',
    clockEyebrow: 'SIMULATION EPOCH',
    statusLive: 'LIVE',
    statusPaused: 'PAUSED',
    clockRateLabel: 'TIME RATE',
    targetsTitle: 'Targets',
    closeOrbit: 'Close orbit',
    surfaceView: 'Surface view',
    cloudTopView: 'Cloud-top view',
    exitSurface: 'Exit surface',
    missionsTitle: 'Missions',
    historicalFlight: 'Historical flight',
    selectMission: 'Select a mission',
    saturnUnavailable: 'The Saturnian system is not loaded in this build.',
    followProbe: 'Follow probe',
    instrumentView: 'Instrument view',
    lensLabel: 'Lens: WAC / NAC',
    stateOn: 'ON',
    stateOff: 'OFF',
    viewTitle: 'View',
    orbitPaths: 'Orbit paths',
    css2dLabels: 'CSS2D labels',
    jupiterRings: 'Jupiter rings · Halo / Gossamer',
    ringBacklight: 'Ring backlight',
    hintDragKey: 'DRAG',
    hintDragAction: 'orbit camera',
    hintScrollKey: 'SCROLL',
    hintScrollAction: 'zoom',
    hintEscKey: 'ESC',
    hintEscAction: 'leave surface',
    timeRateTitle: 'Time Rate',
    pause: 'Pause',
    resume: 'Resume',
    rateReal: 'Real',
    rate1Min: '1 min/s',
    rate1Hour: '1 h/s',
    rate1Day: '1 d/s',
    timeMachineLabel: 'Time machine',
    dateInputAria: 'Select simulation date',
    jump: 'Jump',
    now: 'Now',
    equinoxHintBefore: 'Try ',
    equinoxHintAfter: ' near the equinox and use 1 h/s or 1 d/s to watch transit shadows.',
    telemetryTitle: 'Telemetry',
    activeBody: 'ACTIVE BODY',
    meanRadius: 'Mean radius',
    orbitRadius: 'Orbit radius',
    orbitalPeriod: 'Orbital period',
    eccentricity: 'Eccentricity',
    sunDistance: 'Sun distance',
    axialTilt: 'Axial tilt',
    viewOrbital: 'ORBITAL',
    viewSurface: 'SURFACE',
    viewInstrument: 'INSTRUMENT',
    footerScale: 'PHYSICAL SCALE · 1 UNIT = 1,000 KM',
    footerKepler: 'J2000 KEPLERIAN PROPAGATION',
    footerShadows: 'ANALYTICAL TRANSIT / ECLIPSE SHADOWS',
    instrumentLabel: 'INSTRUMENT',
    targetDistLabel: 'TARGET DIST',
    relVelocityLabel: 'REL VELOCITY',
    hideInterface: 'Hide interface',
    showInterface: 'Show interface',
    loaderEyebrow: 'JOVIAN OBSERVATORY',
    loaderHeading: 'Assembling the system',
    loaderAssets: 'Loading assets',
    loaderError: 'Unable to load the simulation. Check the console.',
    missionWindow: '{hours}h window',
    missionPeriapsis: 'Periapsis · T+00:00',
    missionOutsideWindow: 'Outside window',
    missionScrubberAria: 'Mission flight timeline',
    missionMarkersAria: 'Mission milestone markers',
    missionMilestonesAria: 'Mission milestones',
    markerJumpAria: 'Jump to milestone {index}: {title} ({offset}, FOV {fov})',
    langGroupAria: 'Interface language',
    rateReadoutReal: '1× · real time',
    rateReadoutCustom: '{rate}× · custom rate',
    millionKm: 'M km',
    planetJupiterMissions: 'Jupiter Missions',
    planetSaturnMissions: 'Saturn Missions',
    touchHintOrbitKey: '1 FINGER',
    touchHintOrbitAction: 'orbit',
    touchHintPinchKey: '2 FINGERS',
    touchHintPinchAction: 'zoom / pan',
    touchHintTapKey: '2× TAP',
    touchHintTapAction: 'focus',
    mobileControlsOpen: 'Controls',
    mobileControlsClose: 'Close',
    mobileSheetHandleAria: 'Drag or tap to collapse controls',
    mobileDockAria: 'Quick mobile navigation',
    mobileBodiesAria: 'Select celestial body',
    exitInstrument: 'Exit instrument',
    surfaceTouchHint: 'Drag 1 finger to look · 2× tap to exit',
    instrumentTouchHint: 'Pinch to zoom · 2× tap WAC / NAC'
  },
  es: {
    docTitle: 'Observatorio Joviano · Júpiter y Lunas Galileanas',
    canvasAria: 'Simulación de Júpiter y las lunas Ío, Europa, Ganímedes y Calisto',
    brandEyebrow: 'SISTEMA JOVIANO / SOL V',
    brandTitle: 'Júpiter',
    brandSubtitle: 'Observatorio galileano · 5.20 UA',
    clockEyebrow: 'ÉPOCA DE SIMULACIÓN',
    statusLive: 'EN VIVO',
    statusPaused: 'PAUSA',
    clockRateLabel: 'VELOCIDAD',
    targetsTitle: 'Objetivos',
    closeOrbit: 'Órbita cercana',
    surfaceView: 'Vista superficie',
    cloudTopView: 'Sobre las nubes',
    exitSurface: 'Salir superficie',
    missionsTitle: 'Misiones',
    historicalFlight: 'Vuelo histórico',
    selectMission: 'Selecciona una misión',
    saturnUnavailable: 'El sistema de Saturno no está cargado en esta versión.',
    followProbe: 'Seguir sonda',
    instrumentView: 'Vista instrumento',
    lensLabel: 'Lente: WAC / NAC',
    stateOn: 'SÍ',
    stateOff: 'NO',
    viewTitle: 'Vista',
    orbitPaths: 'Órbitas',
    css2dLabels: 'Etiquetas CSS2D',
    jupiterRings: 'Anillos de Júpiter · Halo / Gossamer',
    ringBacklight: 'Contraluz anillos',
    hintDragKey: 'ARRASTRAR',
    hintDragAction: 'orbitar cámara',
    hintScrollKey: 'RUEDA',
    hintScrollAction: 'zoom',
    hintEscKey: 'ESC',
    hintEscAction: 'salir superficie',
    timeRateTitle: 'Velocidad',
    pause: 'Pausar',
    resume: 'Reanudar',
    rateReal: 'Real',
    rate1Min: '1 min/s',
    rate1Hour: '1 h/s',
    rate1Day: '1 d/s',
    timeMachineLabel: 'Máquina del tiempo',
    dateInputAria: 'Seleccionar fecha de simulación',
    jump: 'Ir',
    now: 'Ahora',
    equinoxHintBefore: 'Prueba ',
    equinoxHintAfter: ' cerca del equinoccio y usa 1 h/s o 1 d/s para ver las sombras de los tránsitos.',
    telemetryTitle: 'Telemetría',
    activeBody: 'CUERPO ACTIVO',
    meanRadius: 'Radio medio',
    orbitRadius: 'Radio orbital',
    orbitalPeriod: 'Periodo orbital',
    eccentricity: 'Excentricidad',
    sunDistance: 'Distancia al Sol',
    axialTilt: 'Inclinación axial',
    viewOrbital: 'ORBITAL',
    viewSurface: 'SUPERFICIE',
    viewInstrument: 'INSTRUMENTO',
    footerScale: 'ESCALA FÍSICA · 1 UNIDAD = 1,000 KM',
    footerKepler: 'PROPAGACIÓN KEPLERIANA J2000',
    footerShadows: 'SOMBRAS ANALÍTICAS DE TRÁNSITO / ECLIPSE',
    instrumentLabel: 'INSTRUMENTO',
    targetDistLabel: 'DIST. OBJETIVO',
    relVelocityLabel: 'VEL. RELATIVA',
    hideInterface: 'Ocultar interfaz',
    showInterface: 'Mostrar interfaz',
    loaderEyebrow: 'OBSERVATORIO JOVIANO',
    loaderHeading: 'Ensamblando el sistema',
    loaderAssets: 'Cargando recursos',
    loaderError: 'No se pudo cargar la simulación. Revisa la consola.',
    missionWindow: 'Ventana de {hours}h',
    missionPeriapsis: 'Periapsis · T+00:00',
    missionOutsideWindow: 'Fuera de ventana',
    missionScrubberAria: 'Línea de tiempo de la misión',
    missionMarkersAria: 'Marcadores de hitos de la misión',
    missionMilestonesAria: 'Hitos de la misión',
    markerJumpAria: 'Ir al hito {index}: {title} ({offset}, FOV {fov})',
    langGroupAria: 'Idioma de la interfaz',
    rateReadoutReal: '1× · tiempo real',
    rateReadoutCustom: '{rate}× · velocidad manual',
    millionKm: 'M km',
    planetJupiterMissions: 'Misiones a Júpiter',
    planetSaturnMissions: 'Misiones a Saturno',
    touchHintOrbitKey: '1 DEDO',
    touchHintOrbitAction: 'orbitar',
    touchHintPinchKey: '2 DEDOS',
    touchHintPinchAction: 'zoom / mover',
    touchHintTapKey: '2× TOQUE',
    touchHintTapAction: 'enfocar',
    mobileControlsOpen: 'Controles',
    mobileControlsClose: 'Cerrar',
    mobileSheetHandleAria: 'Desliza o toca para cerrar controles',
    mobileDockAria: 'Navegación rápida móvil',
    mobileBodiesAria: 'Seleccionar cuerpo celeste',
    exitInstrument: 'Salir instrumento',
    surfaceTouchHint: 'Arrastra 1 dedo para mirar · 2× toque para salir',
    instrumentTouchHint: 'Pellizca para zoom · 2× toque WAC / NAC'
  }
};

const BODY_META_LOCALIZED = {
  en: {
    jupiter: {
      name: 'Jupiter',
      labelName: 'JUPITER',
      labelSub: '5.20 AU · 3.13°',
      shortMeta: 'Gas giant · 71,492 km',
      type: 'Gas giant',
      radius: '71,492 km',
      orbit: '5.20 AU',
      period: '0.414 d (spin)',
      eccentricity: '0.0489',
      tilt: '3.13°'
    },
    io: {
      name: 'Io',
      labelName: 'IO',
      labelSub: '1.769 d',
      shortMeta: 'Volcanic moon · 1,821.6 km',
      type: 'Galilean moon',
      radius: '1,821.6 km',
      orbit: '421,700 km',
      period: '1.769 d',
      eccentricity: '0.0041',
      tilt: '0.00° (locked)'
    },
    europa: {
      name: 'Europa',
      labelName: 'EUROPA',
      labelSub: '3.551 d',
      shortMeta: 'Ocean moon · 1,560.8 km',
      type: 'Galilean moon',
      radius: '1,560.8 km',
      orbit: '671,034 km',
      period: '3.551 d',
      eccentricity: '0.0090',
      tilt: '0.00° (locked)'
    },
    ganymede: {
      name: 'Ganymede',
      labelName: 'GANYMEDE',
      labelSub: '7.155 d',
      shortMeta: 'Largest moon · 2,634.1 km',
      type: 'Galilean moon',
      radius: '2,634.1 km',
      orbit: '1,070,412 km',
      period: '7.155 d',
      eccentricity: '0.0013',
      tilt: '0.00° (locked)'
    },
    callisto: {
      name: 'Callisto',
      labelName: 'CALLISTO',
      labelSub: '16.689 d',
      shortMeta: 'Ancient moon · 2,410.3 km',
      type: 'Galilean moon',
      radius: '2,410.3 km',
      orbit: '1,882,709 km',
      period: '16.689 d',
      eccentricity: '0.0074',
      tilt: '0.00° (locked)'
    }
  },
  es: {
    jupiter: {
      name: 'Júpiter',
      labelName: 'JÚPITER',
      labelSub: '5.20 UA · 3.13°',
      shortMeta: 'Gigante gaseoso · 71,492 km',
      type: 'Gigante gaseoso',
      radius: '71,492 km',
      orbit: '5.20 UA',
      period: '0.414 d (rot.)',
      eccentricity: '0.0489',
      tilt: '3.13°'
    },
    io: {
      name: 'Ío',
      labelName: 'ÍO',
      labelSub: '1.769 d',
      shortMeta: 'Luna volcánica · 1,821.6 km',
      type: 'Luna galileana',
      radius: '1,821.6 km',
      orbit: '421,700 km',
      period: '1.769 d',
      eccentricity: '0.0041',
      tilt: '0.00° (síncrona)'
    },
    europa: {
      name: 'Europa',
      labelName: 'EUROPA',
      labelSub: '3.551 d',
      shortMeta: 'Luna oceánica · 1,560.8 km',
      type: 'Luna galileana',
      radius: '1,560.8 km',
      orbit: '671,034 km',
      period: '3.551 d',
      eccentricity: '0.0090',
      tilt: '0.00° (síncrona)'
    },
    ganymede: {
      name: 'Ganímedes',
      labelName: 'GANÍMEDES',
      labelSub: '7.155 d',
      shortMeta: 'Mayor luna · 2,634.1 km',
      type: 'Luna galileana',
      radius: '2,634.1 km',
      orbit: '1,070,412 km',
      period: '7.155 d',
      eccentricity: '0.0013',
      tilt: '0.00° (síncrona)'
    },
    callisto: {
      name: 'Calisto',
      labelName: 'CALISTO',
      labelSub: '16.689 d',
      shortMeta: 'Luna antigua · 2,410.3 km',
      type: 'Luna galileana',
      radius: '2,410.3 km',
      orbit: '1,882,709 km',
      period: '16.689 d',
      eccentricity: '0.0074',
      tilt: '0.00° (síncrona)'
    }
  }
};

const TARGET_LABELS_LOCALIZED = {
  en: {
    JUPITER: 'Jupiter',
    JUPITER_RINGS: 'Rings',
    IO: 'Io',
    EUROPA: 'Europa',
    GANYMEDE: 'Ganymede',
    CALLISTO: 'Callisto',
    SATURN: 'Saturn'
  },
  es: {
    JUPITER: 'Júpiter',
    JUPITER_RINGS: 'Anillos',
    IO: 'Ío',
    EUROPA: 'Europa',
    GANYMEDE: 'Ganímedes',
    CALLISTO: 'Calisto',
    SATURN: 'Saturno'
  }
};

const MISSION_COPY = {
  pioneer10: {
    description: {
      en: 'First spacecraft to traverse the asteroid belt and fly past Jupiter, imaging the Galilean moons and crossing the planet’s shadow cone.',
      es: 'Primera nave en cruzar el cinturón de asteroides y sobrevolar Júpiter, fotografiando las lunas galileanas y atravesando su cono de sombra.'
    },
    milestones: {
      en: [
        'Galilean moon crossing (Callisto, Ganymede, Europa)',
        'Closest approach (132,252 km) and occultation behind Io',
        'Shadow cone entry and departure toward outer space'
      ],
      es: [
        'Cruce de lunas galileanas (Calisto, Ganímedes, Europa)',
        'Máxima aproximación (132,252 km) y ocultación tras Ío',
        'Entrada al cono de sombra y salida hacia el espacio exterior'
      ]
    }
  },
  pioneer11: {
    description: {
      en: 'High-inclination retrograde corkscrew beneath Jupiter’s South Pole, skimming the radiation belts before being deflected north toward Saturn.',
      es: 'Trayectoria retrógrada de gran inclinación bajo el Polo Sur de Júpiter, rozando los cinturones de radiación antes de desviarse rumbo a Saturno.'
    },
    milestones: {
      en: [
        'South polar dive and close-ups of the Great Red Spot',
        'Extreme periapsis (42,828 km) inside the radiation belts',
        'Gravity assist over the North Pole bound for Saturn'
      ],
      es: [
        'Descenso polar sur y primeros planos de la Gran Mancha Roja',
        'Periapsis extremo (42,828 km) dentro de los cinturones de radiación',
        'Impulso gravitatorio sobre el Polo Norte rumbo a Saturno'
      ]
    }
  },
  voyager1: {
    description: {
      en: 'Equatorial flyby through the Jovian system, revealing Io’s volcanoes and the ring plane before departing toward Saturn.',
      es: 'Sobrevuelo ecuatorial por el sistema joviano que reveló los volcanes activos de Ío y el plano de anillos antes de partir hacia Saturno.'
    },
    milestones: {
      en: [
        'Discovery of Jupiter’s Main Ring',
        'Jovian periapsis (348,890 km) and Amalthea pass',
        'Io flyby (20,570 km): Discovery of active volcanoes'
      ],
      es: [
        'Descubrimiento del Anillo Principal de Júpiter',
        'Periapsis joviano (348,890 km) y paso por Amaltea',
        'Sobrevuelo a Ío (20,570 km): Descubrimiento de volcanes activos'
      ]
    }
  },
  voyager2: {
    description: {
      en: 'Wide Jovian flyby with close Ganymede and Europa encounters, ending in high-phase observations of the Halo and Main rings.',
      es: 'Amplio sobrevuelo joviano con encuentros cercanos en Ganímedes y Europa, cerrando con observaciones a contraluz de los anillos Halo y Principal.'
    },
    milestones: {
      en: [
        'Callisto and Ganymede flybys (62,130 km)',
        'Europa encounter (205,720 km): Fractured ice crust',
        'Backlit observation of the Halo and Main rings'
      ],
      es: [
        'Sobrevuelos de Calisto y Ganímedes (62,130 km)',
        'Encuentro con Europa (205,720 km): Corteza de hielo fracturado',
        'Observación a contraluz de los anillos Halo y Main'
      ]
    }
  },
  galileo: {
    description: {
      en: 'Dual spacecraft event: the orbiter performs the 49-minute Jupiter Orbit Insertion burn while the atmospheric probe enters the northern clouds at 170,000 km/h.',
      es: 'Evento doble: el orbitador ejecuta el encendido de inserción orbital de 49 minutos mientras la sonda atmosférica entra en las nubes del norte a 170,000 km/h.'
    },
    milestones: {
      en: [
        'Atmospheric Probe separation and approach',
        'Probe atmospheric entry (170,000 km/h) and radio relay',
        'Main engine burn (JOI): First orbiter of Jupiter'
      ],
      es: [
        'Separación y aproximación de la Sonda Atmosférica',
        'Entrada atmosférica de la sonda (170,000 km/h) y enlace de radio',
        'Encendido de motor principal (JOI): Primer orbitador de Júpiter'
      ]
    }
  },
  juno: {
    description: {
      en: 'Ninety-degree polar plunge over the north pole, skimming 4,200 km above the clouds at 208,000 km/h before climbing out over the south pole.',
      es: 'Inmersión polar a 90° sobre el polo norte, rozando 4,200 km sobre las nubes a 208,000 km/h antes de ascender sobre el polo sur.'
    },
    milestones: {
      en: [
        'North Pole flyby: Circumpolar cyclones and aurorae',
        'Perijove 1 (4,200 km above clouds) at 208,000 km/h',
        'South Pole departure and magnetosphere mapping'
      ],
      es: [
        'Sobrevuelo del Polo Norte: Ciclones circumpolares y auroras',
        'Perijove 1 (4,200 km de las nubes) a 208,000 km/h',
        'Salida sobre el Polo Sur y mapeo de la magnetósfera'
      ]
    }
  }
};

export function normalizeLanguage(value) {
  if (typeof value !== 'string') return DEFAULT_LANGUAGE;
  const lowered = value.trim().toLowerCase();
  if (lowered === 'es' || lowered.startsWith('es-')) return 'es';
  if (lowered === 'en' || lowered.startsWith('en-')) return 'en';
  return DEFAULT_LANGUAGE;
}

export function detectInitialLanguage({ stored = null, navigatorLanguage = null } = {}) {
  if (stored === 'en' || stored === 'es') return stored;
  if (typeof navigatorLanguage === 'string' && navigatorLanguage.trim().length > 0) {
    return normalizeLanguage(navigatorLanguage);
  }
  return DEFAULT_LANGUAGE;
}

export function t(lang, key, params = null) {
  const safeLang = normalizeLanguage(lang);
  const template = TRANSLATIONS[safeLang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, token) =>
    params[token] !== undefined ? String(params[token]) : match
  );
}

export function getBodyMeta(bodyId, lang = DEFAULT_LANGUAGE) {
  const safeLang = normalizeLanguage(lang);
  return BODY_META_LOCALIZED[safeLang]?.[bodyId] ?? BODY_META_LOCALIZED.en[bodyId] ?? null;
}

export function getTargetLabel(targetKey, lang = DEFAULT_LANGUAGE) {
  const safeLang = normalizeLanguage(lang);
  if (!targetKey) return TARGET_LABELS_LOCALIZED[safeLang].JUPITER;
  return (
    TARGET_LABELS_LOCALIZED[safeLang]?.[targetKey] ??
    TARGET_LABELS_LOCALIZED.en[targetKey] ??
    targetKey
  );
}

export function getMissionPlanetLabel(planetKey, lang = DEFAULT_LANGUAGE) {
  if (planetKey === 'SATURN') return t(lang, 'planetSaturnMissions');
  if (planetKey === 'JUPITER') return t(lang, 'planetJupiterMissions');
  return planetKey;
}

export function getMissionDescription(missionKey, lang = DEFAULT_LANGUAGE, fallback = '') {
  const safeLang = normalizeLanguage(lang);
  return MISSION_COPY[missionKey]?.description?.[safeLang] ?? fallback;
}

export function getMilestoneTitle(
  missionKey,
  milestoneIndex,
  lang = DEFAULT_LANGUAGE,
  fallback = ''
) {
  const safeLang = normalizeLanguage(lang);
  return (
    MISSION_COPY[missionKey]?.milestones?.[safeLang]?.[milestoneIndex] ??
    fallback
  );
}

export function formatLocalizedRate(rate, paused, lang = DEFAULT_LANGUAGE) {
  const safeLang = normalizeLanguage(lang);
  if (paused) return t(safeLang, 'statusPaused');
  if (rate === 1) return t(safeLang, 'rateReadoutReal');
  if (rate === 60) return '60× · 1 min/s';
  if (rate === 3600) return '3600× · 1 h/s';
  if (rate === 86400) return '86400× · 1 d/s';

  const locale = safeLang === 'es' ? 'es-ES' : 'en-US';
  return t(safeLang, 'rateReadoutCustom', {
    rate: rate.toLocaleString(locale)
  });
}

export function getTranslationKeys(lang = DEFAULT_LANGUAGE) {
  const safeLang = normalizeLanguage(lang);
  return Object.keys(TRANSLATIONS[safeLang]);
}
