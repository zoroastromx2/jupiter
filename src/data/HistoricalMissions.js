/**
 * Historical mission catalogue, grouped by planetary system.
 * Jupiter control points are in Jupiter equatorial radii (R_J = 1.0).
 * Saturn keys are retained for the multi-planet scoping contract.
 */

const SATURN_MISSION_KEYS = [
  'pioneer11',
  'voyager1',
  'voyager2',
  'cassiniInsertion',
  'huygens',
  'cassiniGrandFinale'
];

const SATURN_MISSION_META = {
  pioneer11: {
    name: 'Pioneer 11',
    timestamp: '1979-09-01T16:29:00Z',
    opticsMode: 1
  },
  voyager1: {
    name: 'Voyager 1',
    timestamp: '1980-11-12T23:46:00Z',
    opticsMode: 2
  },
  voyager2: {
    name: 'Voyager 2',
    timestamp: '1981-08-25T03:24:00Z',
    opticsMode: 2
  },
  cassiniInsertion: {
    name: 'Cassini-Huygens',
    timestamp: '2004-07-01T01:12:00Z',
    opticsMode: 3
  },
  huygens: {
    name: 'Huygens Probe',
    timestamp: '2005-01-14T10:13:00Z',
    opticsMode: 3
  },
  cassiniGrandFinale: {
    name: 'Cassini · Grand Finale',
    timestamp: '2017-09-15T11:55:00Z',
    opticsMode: 3
  }
};

export const MISSIONS = {
  SATURN: Object.fromEntries(
    SATURN_MISSION_KEYS.map((key) => [
      key,
      {
        key,
        planet: 'SATURN',
        available: false,
        ...SATURN_MISSION_META[key]
      }
    ])
  ),

  JUPITER: {
    pioneer10: {
      key: 'pioneer10',
      planet: 'JUPITER',
      available: true,
      name: 'Pioneer 10',
      timestamp: '1973-12-04T02:26:00Z',
      dateLabel: '1973-12-04 02:26 UTC',
      description:
        'First spacecraft to traverse the asteroid belt and fly past Jupiter, imaging the Galilean moons and crossing the planet’s shadow cone.',
      color: 0xffc46b,
      opticsMode: 1,
      model: 'pioneer_glb',
      peakT: 0.5,
      windowHours: 48,
      controlPoints: [
        [-16.0, 2.2, -11.0],
        [-11.0, 1.6, -7.0],
        [-6.8, 0.9, -4.2],
        [-4.2, 0.4, -2.2],
        [-3.2, 0.3, -0.8],
        [-2.85, 0.1, 0.0],
        [-2.9, -0.1, 0.9],
        [-4.2, -0.4, 2.2],
        [-6.8, -0.9, 4.2],
        [-11.0, -1.6, 7.0],
        [-16.0, -2.2, 11.0]
      ],
      milestones: [
        {
          t: 0.25,
          title: 'Cruce de lunas galileanas (Calisto, Ganímedes, Europa)',
          targetKey: 'JUPITER',
          instrumentName: 'Pioneer IPP - Imaging Photopolarimeter',
          defaultFov: 32
        },
        {
          t: 0.5,
          title: 'Máxima aproximación (132,252 km) y ocultación tras Ío',
          targetKey: 'IO',
          instrumentName: 'Pioneer IPP - Narrow Field',
          defaultFov: 14
        },
        {
          t: 0.85,
          title: 'Entrada al cono de sombra y salida hacia el espacio exterior',
          targetKey: 'JUPITER',
          instrumentName: 'Pioneer IPP - Imaging Photopolarimeter',
          defaultFov: 35
        }
      ]
    },

    pioneer11: {
      key: 'pioneer11',
      planet: 'JUPITER',
      available: true,
      name: 'Pioneer 11',
      timestamp: '1974-12-03T05:21:19Z',
      dateLabel: '1974-12-03 05:21 UTC',
      description:
        'High-inclination retrograde corkscrew beneath Jupiter’s South Pole, skimming the radiation belts before being deflected north toward Saturn.',
      color: 0xff9a62,
      opticsMode: 1,
      model: 'pioneer_glb',
      peakT: 0.5,
      windowHours: 48,
      controlPoints: [
        [8.0, -9.0, 4.0],
        [5.0, -6.0, 2.4],
        [3.0, -3.4, 1.4],
        [1.6, -1.6, 0.8],
        [0.8, -1.2, 0.7],
        [0.5, 1.5, -0.4],
        [2.4, 3.2, -1.0],
        [5.0, 8.0, -2.8],
        [10.0, 15.0, -6.0],
        [17.0, 23.0, -10.0]
      ],
      milestones: [
        {
          t: 0.2,
          title: 'Descenso polar sur y primeros planos de la Gran Mancha Roja',
          targetKey: 'JUPITER',
          instrumentName: 'Pioneer IPP - Imaging Photopolarimeter',
          defaultFov: 24
        },
        {
          t: 0.5,
          title: 'Periapsis extremo (42,828 km) dentro de los cinturones de radiación',
          targetKey: 'JUPITER',
          instrumentName: 'Pioneer IPP - Wide Field',
          defaultFov: 35
        },
        {
          t: 0.85,
          title: 'Impulso gravitatorio sobre el Polo Norte rumbo a Saturno',
          targetKey: 'JUPITER',
          targetOffset: [0, 0.9, 0],
          instrumentName: 'Pioneer IPP - Imaging Photopolarimeter',
          defaultFov: 28
        }
      ]
    },

    voyager1: {
      key: 'voyager1',
      planet: 'JUPITER',
      available: true,
      name: 'Voyager 1',
      timestamp: '1979-03-05T12:05:26Z',
      dateLabel: '1979-03-05 12:05 UTC',
      description:
        'Equatorial flyby through the Jovian system, revealing Io’s volcanoes and the ring plane before departing toward Saturn.',
      color: 0x62d9ff,
      opticsMode: 2,
      model: 'voyager',
      peakT: 0.5,
      windowHours: 48,
      controlPoints: [
        [18.0, 1.2, -11.0],
        [12.0, 0.8, -8.0],
        [8.0, 0.4, -5.4],
        [5.9, 0.2, -3.6],
        [4.8, 0.05, -2.6],
        [4.8, 0.0, -1.2],
        [4.88, 0.0, 0.0],
        [5.2, 0.15, 0.8],
        [7.2, 0.4, 2.4],
        [10.0, 0.8, 4.5],
        [14.0, 1.5, 7.0]
      ],
      milestones: [
        {
          t: 0.25,
          title: 'Descubrimiento del Anillo Principal de Júpiter',
          targetKey: 'JUPITER_RINGS',
          instrumentName: 'Voyager ISS - Narrow Angle (NAC)',
          defaultFov: 12
        },
        {
          t: 0.55,
          title: 'Periapsis joviano (348,890 km) y paso por Amaltea',
          targetKey: 'JUPITER',
          instrumentName: 'Voyager ISS - Wide Angle (WAC)',
          defaultFov: 20
        },
        {
          t: 0.78,
          title: 'Sobrevuelo a Ío (20,570 km): Descubrimiento de volcanes activos',
          targetKey: 'IO',
          instrumentName: 'Voyager ISS - Narrow Angle (NAC)',
          defaultFov: 10
        }
      ]
    },

    voyager2: {
      key: 'voyager2',
      planet: 'JUPITER',
      available: true,
      name: 'Voyager 2',
      timestamp: '1979-07-09T22:29:00Z',
      dateLabel: '1979-07-09 22:29 UTC',
      description:
        'Wide Jovian flyby with close Ganymede and Europa encounters, ending in high-phase observations of the Halo and Main rings.',
      color: 0x7eb6ff,
      opticsMode: 2,
      model: 'voyager',
      peakT: 0.5,
      windowHours: 48,
      controlPoints: [
        [27.0, -2.0, -12.0],
        [20.0, -1.4, -8.8],
        [14.0, -0.9, -5.8],
        [10.5, -0.5, -3.4],
        [10.3, -0.2, -1.8],
        [10.1, 0.1, 0.0],
        [10.8, 0.5, 2.0],
        [13.0, 1.2, 4.2],
        [18.0, 2.0, 7.0],
        [24.0, 3.0, 10.0]
      ],
      milestones: [
        {
          t: 0.2,
          title: 'Sobrevuelos de Calisto y Ganímedes (62,130 km)',
          targetKey: 'GANYMEDE',
          instrumentName: 'Voyager ISS - Narrow Angle (NAC)',
          defaultFov: 12
        },
        {
          t: 0.5,
          title: 'Encuentro con Europa (205,720 km): Corteza de hielo fracturado',
          targetKey: 'EUROPA',
          instrumentName: 'Voyager ISS - Narrow Angle (NAC)',
          defaultFov: 10
        },
        {
          t: 0.85,
          title: 'Observación a contraluz de los anillos Halo y Main',
          targetKey: 'JUPITER_RINGS',
          instrumentName: 'Voyager ISS - Wide Angle (WAC)',
          defaultFov: 28
        }
      ]
    },

    galileo: {
      key: 'galileo',
      planet: 'JUPITER',
      available: true,
      name: 'Galileo — Orbiter + Atmospheric Probe',
      timestamp: '1995-12-07T22:04:00Z',
      dateLabel: '1995-12-07 22:04 UTC',
      description:
        'Dual spacecraft event: the orbiter performs the 49-minute Jupiter Orbit Insertion burn while the atmospheric probe enters the northern clouds at 170,000 km/h.',
      color: 0xf0a33c,
      opticsMode: 3,
      model: 'galileo',
      peakT: 0.5,
      windowHours: 24,
      probeFadeT: 0.65,
      probeColor: 0xff6a2a,
      controlPoints: [
        [14.0, -0.7, -8.0],
        [9.5, -0.5, -5.5],
        [6.4, -0.3, -3.2],
        [4.6, -0.15, -1.8],
        [4.0, 0.0, -0.2],
        [4.4, 0.05, 1.0],
        [6.4, 0.15, 2.4],
        [9.0, 0.3, 4.0],
        [12.0, 0.5, 6.0]
      ],
      probeControlPoints: [
        [2.98, 0.34, 0.0],
        [2.50, 0.285, 0.0],
        [2.05, 0.233, 0.0],
        [1.55, 0.176, 0.0],
        [1.12, 0.127, 0.0],
        [1.005, 0.114, 0.0]
      ],
      milestones: [
        {
          t: 0.25,
          title: 'Separación y aproximación de la Sonda Atmosférica',
          targetKey: 'JUPITER',
          instrumentName: 'Galileo SSI - Solid State Imaging',
          defaultFov: 25
        },
        {
          t: 0.5,
          title: 'Entrada atmosférica de la sonda (170,000 km/h) y enlace de radio',
          targetKey: 'JUPITER',
          instrumentName: 'Galileo SSI - Solid State Imaging',
          defaultFov: 14
        },
        {
          t: 0.85,
          title: 'Encendido de motor principal (JOI): Primer orbitador de Júpiter',
          targetKey: 'IO',
          instrumentName: 'Galileo SSI - Solid State Imaging',
          defaultFov: 20
        }
      ]
    },

    juno: {
      key: 'juno',
      planet: 'JUPITER',
      available: true,
      name: 'Juno — Polar Perijove 1',
      timestamp: '2016-08-27T12:51:00Z',
      dateLabel: '2016-08-27 12:51 UTC',
      description:
        'Ninety-degree polar plunge over the north pole, skimming 4,200 km above the clouds at 208,000 km/h before climbing out over the south pole.',
      color: 0x9df4c7,
      opticsMode: 4,
      model: 'juno',
      peakT: 0.5,
      windowHours: 8,
      controlPoints: [
        [4.0, 9.0, 2.0],
        [2.8, 6.2, 1.4],
        [1.7, 3.2, 0.8],
        [1.13, 0.8, 0.4],
        [1.06, 0.0, 0.0],
        [1.18, -1.2, -0.3],
        [1.7, -3.8, -0.8],
        [3.0, -7.0, -1.5],
        [6.0, -12.0, -3.0]
      ],
      milestones: [
        {
          t: 0.2,
          title: 'Sobrevuelo del Polo Norte: Ciclones circumpolares y auroras',
          targetKey: 'JUPITER',
          targetOffset: [0, 0.95, 0],
          instrumentName: 'JunoCam - Push-Frame RGB',
          defaultFov: 42
        },
        {
          t: 0.5,
          title: 'Perijove 1 (4,200 km de las nubes) a 208,000 km/h',
          targetKey: 'JUPITER',
          instrumentName: 'JunoCam - Push-Frame Wide Angle',
          defaultFov: 52
        },
        {
          t: 0.85,
          title: 'Salida sobre el Polo Sur y mapeo de la magnetósfera',
          targetKey: 'JUPITER',
          targetOffset: [0, -0.95, 0],
          instrumentName: 'JunoCam - Push-Frame RGB',
          defaultFov: 42
        }
      ]
    }
  }
};

export const MISSION_ORDER = {
  SATURN: SATURN_MISSION_KEYS,
  JUPITER: ['pioneer10', 'pioneer11', 'voyager1', 'voyager2', 'galileo', 'juno']
};

export const MISSION_PLANET_LABELS = {
  SATURN: 'Misiones a Saturno',
  JUPITER: 'Misiones a Júpiter'
};
