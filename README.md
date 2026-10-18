# Apu Islam: the Career District

An interactive 3D portfolio. Drive a classic coupe through a golden-hour miniature district, seen from a fixed
isometric-style camera high above, and discover the career inside it:

- **Career Tower**: experience (Software Engineer – AI at MetLife, Nov 2023 – Jul 2026). An original
  contemporary corporate tower; MetLife is named only in the panel text.
- **Research, Projects, Education, and Contact kiosks**: signposts along the north promenade.
- **The APU ISLAM billboard**: flickers to life when you arrive, then glows steadily.

Pull into a glowing zone and press **E** to open its panel. Along the way, knock over cones, crates, barrels,
signs, and benches, smash through the brick wall, and splash across the pond. The sky follows a day cycle that
starts at your local time and runs a full day in about 12 minutes: golden sunset, blue hour, then a quiet night
with lit windows, streetlights, and headlights. A conventional **quick view** has the same content, is always one
click away, and keeps your place when you switch.

Content marked "Placeholder" is waiting for yours.

## Run it locally

Requires Node.js 18+ (developed on Node 26).

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:5173>. Add `?time=21:30` to the URL to start the clock at another time, for example
<http://localhost:5173/?time=21:30#/3d>.

| Command | What it does |
|---|---|
| `npm run build` | Type-checks and builds the production site into `dist/` |
| `npm run preview` | Serves the production build at <http://localhost:4173> |
| `npm test` | Unit, physics (real Rapier), and UI integration tests (Vitest, jsdom) |
| `npm run test:e2e` | Builds, serves, and drives the site in your installed Google Chrome (Playwright) |
| `npm run assets:build` | Rebuilds every 3D model with Blender (see below); `npm run assets:build -- car props` rebuilds some |
| `npm run budget` | Checks download budgets: models ≤ 3 MB, audio ≤ 2.5 MB, total 3D download ≤ 8 MB (after a build) |
| `npm run resume:placeholder` | Regenerates the placeholder `public/resume.pdf` |

### Rebuilding the 3D models

The models in `public/models/*.glb` are generated, not hand-modelled: Python scripts drive Blender headlessly.

1. Install [Blender](https://www.blender.org/download/) (developed and tested on 5.2).
2. Run `npm run assets:build`. It exports the district layout to `assets/build/layout.json`, runs
   `assets/blender/build_all.py`, compresses each model with meshopt, and checks the model budget.

The layout in `src/world/district/layout.ts` is the single source of truth: roads, zones, props, trees, the pond,
and colliders all come from it, so Blender and the runtime always agree.

## Controls

| Input | Action |
|---|---|
| `W` / `↑` | Accelerate |
| `S` / `↓` | Brake, then reverse |
| `A` `D` / `←` `→` | Steer |
| `Space` | Handbrake |
| `R` | Recover: put the car back on its wheels (it also happens on its own after a flip) |
| `E` | Open the stop whose glowing zone you're in |
| `Esc` | Close the menu, then the panel (pressing `W` again also closes the panel and drives off) |
| `M` | Fast-travel menu (keyboard and screen-reader friendly) |
| Click or tap the Career Tower or a kiosk | Fast travel there and open its panel |
| Scroll · pinch | Zoom in and out (the camera angle itself is fixed) |
| Touch | Push the joystick toward where you want to drive; Brake, Recover, and an "Open" button inside a zone |
| Any key or tap during the opening fly-over | Skip it |

**Day dial** (top bar): pause or resume the day cycle and drag to any time. On phones it collapses to a time chip.

**Sound** (top bar): a mute toggle and a volume slider, both remembered. Nothing plays until your first click,
tap, or key press, as browsers require.

## How it fits together

```
src/
  content/portfolio.ts   ← the only file to edit for your content (role, papers, projects, education, contact)
  state/                 URL hash routing (#/3d/research, #/basic/education…), store, view switching
  lib/capabilities.ts    WebGL / reduced-motion / software-renderer detection → which view opens first
  world/district/        the layout as data (roads, zones, props, pond, billboard) and the static colliders
  world/physics/         Rapier raycast vehicle tuning, pond drag and grip, prop masses and reset rules
  world/scene/           React Three Fiber components: district, car, props, water, billboard, labels
  world/camera/          fixed-view follow camera, zoom, panel framing, the opening, and see-through buildings
  world/lighting/        day clock, time-of-day keyframes, sky, night glow, quality tiers, post-processing
  world/audio/           synthesized soundscape: engine and tires, impacts, splashes, ambience, voice limiter
  world/events.ts        event bus and telemetry: physics publishes, audio, effects, and HUD listen
  ui/                    HUD, day dial, sound controls, welcome card, E prompt, menu, info panel, touch controls
  basic/BasicSite.tsx    the conventional quick view
assets/blender/          Python model scripts (car, tower, district, kiosks, billboard, buildings, props)
e2e/                     Playwright smoke tests (drive to the tower, pond, cones, fast travel, fps report)
```

- **Every place has a URL**, and Back/Forward work across views.
- **3D opens first**, except without WebGL (quick view, with a note), or with reduced motion on or a software-only
  GPU (quick view first; the district is one click away). Reduced motion also skips the fly-over and the
  billboard flicker.
- **Physics** runs on a fixed 60 Hz step. The car is a Rapier raycast vehicle with suspension; props are dynamic
  bodies that sleep until hit and quietly tidy themselves up once you've driven away.
- **Performance:**
  - The quick view never downloads three.js, physics, models, or sounds; the district is a lazily loaded chunk.
  - Three quality tiers (shadows, resolution, ambient occlusion and bloom); the site steps down a tier if the
    frame rate stays low.
  - Current 3D download: about 2.7 MB in total (1.4 MB of models).

## Replacing placeholders

1. Edit `src/content/portfolio.ts`.
2. Replace `public/resume.pdf` with your résumé.
3. Update the name and description in `index.html` if needed.

## Known limitations

- All sounds are synthesized in the browser; recorded CC0 samples can replace individual sounds later
  (list them in `public/audio/LICENSES.md`).
- Only the Career Tower is a full landmark in this slice; Research, Projects, Education, and Contact are kiosks.
- No traffic or pedestrians.
- The quick view renders in the browser, so search engines may index it poorly (no prerendering yet).
