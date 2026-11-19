# Jovian Observatory

A physically scaled WebGL observatory for Jupiter, Io, Europa, Ganymede and Callisto. The
simulation couples real Jovian radii, System III rotation, Keplerian Galilean orbits, analytical
transit/eclipse shadows, forward-scattering dust rings, custom GLSL cloud and aurora shaders, and a
glassmorphism HUD. Historical mission playback adds Pioneer 10/11, Voyager 1/2, Galileo and Juno
trajectories with onboard optical-instrument views.

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Vite (default `http://localhost:3000`).

Other scripts:

```bash
npm test       # Vitest unit tests
npm run build  # production build
```

## Controls

- Click a target to focus it; use **Close orbit** or **Surface view** for camera modes.
- **Time Dilation**: ×1 advances one simulated hour per real second; ×10 and ×100 accelerate it.
- **Time Machine**: enter any calendar date and press **Jump**, or use **Now**.
- **CSS2D labels**, **orbit paths** and the **Halo/Gossamer ring volume** toggle independently.
- **Ring backlight** moves the camera behind Jupiter's night side to a ~165° phase angle for
  forward-scattered dust and the nested gossamer silhouettes.
- **Historical flight** selects a mission, jumps to its UTC epoch, and loads its 3D spacecraft and
  spline. **Follow probe** tracks it; **Instrument view** uses the onboard WAC/NAC camera and the
  matching Pioneer, Voyager, Galileo SSI or JunoCam optical emulation. **Lens** alternates WAC/NAC.
- Drag to orbit, scroll to zoom, and press **Esc** to leave a surface view.

Galilean transits are seasonal. Jump to **2030-04-01** (near Jupiter's equinox), select Jupiter,
and run at ×100 to watch moon shadows cross the cloud belts.

## Physical model

- Jupiter is rendered as an oblate spheroid with `R_eq = 71,492 km`, `R_pol = 66,854 km`, a
  System III sidereal rotation of `0.41354 d`, and its IAU J2000 pole.
- Galilean moon radii, semi-major axes, periods, inclinations and eccentricities match the supplied
  NASA/JPL values. A nested LAN/inclination pivot hierarchy places them in Jupiter's equatorial
  frame; eccentric anomalies are solved with Newton-Raphson each frame.
- Sun direction is derived from a Keplerian Jupiter heliocentric orbit, so the subsolar latitude
  follows Jupiter's real seasonal cycle.
- Transit shadows are ray-sphere tests in the cloud-top fragment shader, with distance-scaled
  penumbrae from the Sun's angular radius. Eclipse shadows on moons are ray/oblate-ellipsoid tests.
- The Jovian shader adds latitude-dependent zonal shear, eddy turbulence, a swirling Great Red Spot,
  HDR polar aurorae and the Io magnetic footprint.
- The ring system uses the measured `R_J`-scaled Halo, Main, Amalthea Gossamer and Thebe Gossamer
  boundaries. A back-side bounding cylinder runs a single-pass, 10-step jittered raymarch with a
  Henyey-Greenstein silicate phase function (`g = 0.86`), analytical Jupiter shadowing, day-side
  planetshine and tiny shepherd markers for Metis, Adrastea, Amalthea and Thebe.
- Historical mission splines use Jupiter-equatorial-radius control points and Catmull-Rom
  kinematics. Mission selection jumps the shared `daysSinceEpoch` clock, updates the Jovian moons
  and transit shadows, and remaps each path so the scripted periapsis lands at its milestone time.
  The onboard optics pass provides Pioneer Vidicon, Voyager reseau, Galileo SSI and JunoCam
  push-frame looks. Saturn mission keys remain grouped in the catalogue for multi-planet scoping,
  but are disabled in this Jovian build.
- Scene scale: `1 world unit = 1,000 km`. Per-frame update paths use preallocated vectors and no
  array allocation.

## Texture credits

- Jupiter albedo: [Solar System Scope](https://www.solarsystemscope.com/textures/), CC BY 4.0.
- Io albedo: colorized from the public-domain USGS
  [`Io_Voyager_GalileoSSI_Global_Mosaic`](https://astrogeology.usgs.gov/search/map/io_voyager_galileo_ssi_global_mosaic_1km).
- Europa albedo: *Moon Europa color map* by Seek9750, CC0,
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Moon_Europa_color_map.jpg).
- Ganymede albedo: *Ganymede map by Askaniy* by Askaniy Anpilogov, USGS, Björn Jónsson,
  NASA/JPL-Caltech/SwRI/MSSS/Brian Swift, CC BY-SA 3.0,
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Ganymede_map_by_Askaniy.png).
- Callisto albedo: *Callisto map by Askaniy* by Askaniy Anpilogov and John van Vliet, CC BY-SA 3.0,
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Callisto_map_by_Askaniy.png).
- Normal and cloud-detail maps are procedural derivatives of the corresponding albedo maps.
- Pioneer 11 model: "Pioneer 11" by Danny.Gallegos, CC BY 4.0,
  [Sketchfab](https://skfb.ly/otrXX).
- Voyager 1 model: "Voyager 1" by Sidharth1, CC BY 4.0,
  [Sketchfab](https://skfb.ly/o6uwE).
- Voyager 2 model: "Crusader 5 probe No.2" by Epicfaceball, CC BY 4.0,
  [Sketchfab](https://skfb.ly/pBHXJ).
