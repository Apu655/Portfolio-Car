---
title: District Showcase - Plan
type: feat
date: 2026-10-18
topic: district-showcase
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# District Showcase - Plan

## Goal Capsule

- **Objective:** Visitors driving through the district can see, at a glance, what each section holds: real logos, project screenshots, and one-line descriptions on gates, with details one click away. A lettered map gets them anywhere, and the drive feels calm and polished.
- **Product authority:** Apu Islam. Content comes from Apu's CV and project list.
- **Open blockers:** None. LinkedIn and Google Scholar URLs are not in the CV and stay placeholders until supplied.

---

## Product Contract

### Summary

Real CV content replaces the placeholders. Each section gets a gate across its approach road, carrying a lettered header sign and two screens that cycle through the section's items. A corner minimap shows the district with lettered markers to travel to. A small pitch near the start holds tech-stack footballs the car can knock around. Driving gets smoother, the soundscape quieter, and a gentle generated ambient score plays underneath.

### Problem Frame

The district's stops held placeholder content, and nothing along the roads said what a stop contained until a visitor opened its panel. Apu's real work (four roles, eight papers, seven projects, two degrees) and logos and screenshots in `assets/My Items/` were not shown. Visitors also had no overview of where things are, and Apu found the drive slightly twitchy and the sound too busy.

### Key Decisions

- **Gates carry cycling screens rather than rows of static billboards.** The kiosks are 30 m apart and Projects alone has seven items, so two screens per gate cycle through the section's items. (session-settled: user-directed — Apu chose billboards at each section's gate, with section name signs as well.) Governs R5, R6.
- **Billboard text is written from Apu's CV and project list.** Apu supplied the project names and stacks and asked for short descriptions to be written from them. (session-settled: user-directed — Apu asked for descriptions to be added.) Governs R1.
- **A corner minimap with lettered markers, not a full-screen map.** (session-settled: user-directed — chosen over a full-screen map only.) Governs R9, R10.
- **Footballs react to the car only.** (session-settled: user-directed — chosen over mouse drag-and-fling.) Governs R11.
- **The background music is generated in the browser.** It is copyright-free by construction and adds nothing to the download, matching the existing all-synthesized soundscape.
- **Section letters:** W Work experience, R Research, P Projects, E Education, C Contact. Governs R6, R9.
- **The phone number from the CV is not published.** The email address and GitHub handle are; the site is public.

### Requirements

**Content**

- R1. Experience lists MetLife (featured), Sysonex Development, George Mason University (research intern), and BRAC University (teaching assistant); Research lists the six publications and three current projects; Projects lists the seven projects with screenshots; Education lists Monash University and BRAC University; Contact shows the email, GitHub, LinkedIn and Google Scholar (placeholders until supplied), and the résumé.
- R2. Project, experience, and education entries show their screenshot or logo in the panels and the quick view where one exists.
- R3. Opening a stop's panel shows the featured or selected item first; selecting an item from a billboard opens that item.

**Gates and billboards**

- R4. Each of the five sections has a gate across its approach road, readable from the fixed camera.
- R5. Each gate has two screens that cycle through the section's items, showing the logo or screenshot, the title, and a one-line description.
- R6. Each gate's header sign shows the section letter and name.
- R7. Clicking or tapping a screen opens the details of the item it is showing.
- R8. Gates are solid to the car, dissolve when they hide the car, and glow at night.

**Map**

- R9. A corner minimap shows the roads, the car, and lettered markers for the five sections, in the same orientation as the screen.
- R10. Clicking a marker travels there and opens its panel; N toggles a larger map; the map is keyboard and screen-reader reachable.

**Footballs**

- R11. A small pitch near the start holds eight footballs, each carrying a tech label (Python, JavaScript, TypeScript, Java, SQL, React, FastAPI, TensorFlow), that the car can push and knock; they reset like the other props.

**Feel and sound**

- R12. Driving is smoother: throttle and steering ease in, and the car settles faster after turns and bumps.
- R13. The soundscape is quieter and less harsh, and the default volume is lower.
- R14. A soft generated ambient score plays under the scene, with its own on/off switch that is remembered.

### Scope Boundaries

- Dragging footballs with the mouse is out (car only).
- Real LinkedIn and Scholar URLs, the Monash and George Mason logos, and a downloaded music track are out until supplied or approved.
- Considered and not built: a CV phone number on the site.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Gate data lives in the district layout,** so colliders, occluders, the minimap, and the scene all read one source. The decorative city gate is replaced by the section gates and removed from the kiosks model.
- KTD2. **Screens are canvas textures drawn at runtime** from the content and resized screenshots, emissive so they glow at night. No new Blender assets.
- KTD3. **Showcase images are resized once by a script** (`sips` on macOS) into `public/showcase/`, keeping each under about 150 KB.
- KTD4. **Footballs reuse the props reset and impact rules** with their own runtime-drawn textures.
- KTD5. **Music is a separate Web Audio bus** under the existing master volume, with slow pad chords and sparse pentatonic notes through a soft delay.

### Implementation Units

### U1. CV content, images, and panels

**Goal:** Replace placeholders with CV content, add images, and render multiple roles.
**Requirements:** R1, R2, R3.
**Files:** `src/content/portfolio.ts`, `src/content/showcase.ts`, `src/ui/PanelContent.tsx`, `src/basic/BasicSite.tsx`, `src/state/route.ts`, `scripts/build-showcase.mjs`, `public/showcase/*`, `src/App.test.tsx`, `src/state/route.test.ts`.
**Test scenarios:** experience deep link to a role opens that role; the Career panel title stays the featured role; quick view lists every role and project with images.

### U2. Section gates with cycling screens

**Goal:** Build the five gates with header signs and cycling, clickable screens.
**Requirements:** R4–R8.
**Files:** `src/world/district/layout.ts`, `src/world/district/colliders.ts`, `src/world/district/occluders.ts`, `src/world/scene/SectionGates.tsx`, `src/world/scene/gateScreens.ts`, `assets/blender/models/kiosks.py`, `public/models/kiosks.glb`, tests in `src/world/district/`.
**Test scenarios:** every gate sits across a road and off the parking spots; every gate faces the camera; screen cycling order covers every item; a gate between the camera and the car is reported as blocking.

### U3. Lettered minimap

**Goal:** Corner minimap with lettered travel markers.
**Requirements:** R9, R10.
**Files:** `src/ui/Minimap.tsx`, `src/ui/minimapProjection.ts`, `src/ui/Hud.tsx`, `src/styles.css`, `src/world/events.ts` (car heading in telemetry), tests.
**Test scenarios:** world-to-map projection puts north-east at the top; clicking the R marker travels to Research; N toggles the larger map.

### U4. Tech footballs

**Goal:** A pitch with eight tech footballs and two goals.
**Requirements:** R11.
**Files:** `src/world/district/layout.ts`, `src/world/scene/Footballs.tsx`, `src/world/physics/props.ts`, `assets/blender/models/district.py`, `public/models/district.glb`, tests.
**Test scenarios:** no tree stands on the pitch; balls start on the pitch; a car hit moves a ball (physics test).

### U5. Smoother driving, quieter sound, ambient music

**Goal:** Ease the controls, soften the mix, add the generated score.
**Requirements:** R12, R13, R14.
**Files:** `src/world/physics/vehicle.ts`, `src/world/scene/Car.tsx`, `src/world/audio/*`, `src/ui/AudioControls.tsx`, tests.
**Test scenarios:** existing vehicle handling tests still pass; throttle easing reaches full within about a quarter second; the music setting persists.

### U6. Browser checks and docs

**Goal:** Prove the gates, map, and footballs in Chrome and update the README.
**Files:** `e2e/smoke.spec.ts`, `README.md`.

---

## Verification Contract

| Gate | Command |
| --- | --- |
| Types | `npm run typecheck` |
| Unit | `npm test` |
| Browser | `npm run test:e2e` |
| Models | `npm run assets:build -- kiosks district` |
| Budget | `npm run build` then `npm run budget` |

## Definition of Done

- Every requirement holds and all gates pass.
- No placeholder text remains except the LinkedIn and Scholar links.
- Each unit lands as its own commit.
