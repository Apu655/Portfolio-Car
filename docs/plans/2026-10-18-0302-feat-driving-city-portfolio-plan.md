---
title: Driving City Portfolio - Plan
type: feat
date: 2026-10-18
topic: driving-city-portfolio
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Driving City Portfolio - Plan

## Goal Capsule

- **Objective:** Research and industry visitors explore the owner's career by driving a car through a modern 3D city, and can reach any portfolio content (career, research, projects, education, contact, résumé) within seconds by pressing E at a tower, clicking it, using fast travel, or switching to the conventional quick view.
- **Product authority:** This Product Contract, built from the 2026-10-18 brainstorm. It replaces the space/spaceship concept of the uncommitted v0.1 prototype on branch `feat/3d-portfolio-prototype`.
- **Open blockers:** None. The owner's real content for everything except the Career role's title and dates is still missing. Placeholders stand in (R25).

---

## Product Contract

### Summary

Replace the space world with a ground-level modern city explored by driving a procedural retro coupe in third person. A scenic boulevard loop passes five distinctive towers in a fixed order, with a realistic downtown grid inside it. Pressing E at a tower's entrance, clicking the tower, or using the fast-travel menu opens a readable portfolio panel. Lighting follows the visitor's local time. The existing quick view, shareable URLs, and place-keeping view switch carry over.

### Problem Frame

The v0.1 prototype proved the two-view model (3D first, quick view always available, place kept when switching), but its space theme read as a game around a portfolio. Visitors had to fly between distant stations, and the spaceship metaphor didn't connect to the owner's work. The owner wants a setting that feels polished and professional while still showing a sense for gamification: a city they can drive through, where every landmark is a part of their career. Research and industry readers still have little time, so the setting must never stand between them and the content.

### Key Decisions

- **Ground-level city replaces all space content.** No spaceship, planets, stations, or space backdrop remain. Governs R1, R2.
- **Boulevard loop around a downtown grid.** A first-timer who simply drives forward passes all five towers. (session-settled: user-directed — chosen over a compact grid and themed districts: guarantees discovery without a tutorial.) Governs R3, R4.
- **The Career Tower is a single entry, with no floors.** The owner has one role to show; the tower is a landmark with one panel. (session-settled: user-directed — chosen over floors per achievement and floors per role.) Governs R7.
- **Retro coupe, procedural.** A rounder, characterful car that nods to gamification. (session-settled: user-directed — chosen over a modern EV, a futuristic concept car, and a free CC0 model.) Governs R12.
- **Lighting follows the visitor's local clock.** Midnight shows a night city, around 1 PM full daylight, with smooth blends in between. (session-settled: user-directed — chosen over fixed golden hour, fixed night, fixed day, and a manual toggle.) Governs R19, R20.
- **Touch devices drive with an on-screen joystick.** (session-settled: user-directed — chosen over tap-to-travel only and quick-view-first on phones.) Governs R16.
- **Clicking or tapping a tower fast-travels there.** Time-pressed visitors skip the drive; E stays the "game" path. (session-settled: user-approved — proposed with the trade-off shown; the owner accepted the recommendation.) Governs R10.
- **Real content for the Career role only; placeholders elsewhere.** (session-settled: user-directed — chosen over placeholders everywhere and all real content now.) Governs R25.
- **3D first, two complete versions, place kept when switching, fallback devices start in the quick view.** Carried from the v0.1 brainstorm. (session-settled: user-directed — chosen over a choice screen and a basic-first landing: capable visitors land straight in the experience.) Governs R21, R22, R23.
- **No About tower.** The About content becomes a welcome card at the spawn point and the hero of the quick view; the five towers stay the ones the owner named. Governs R6.
- **Fast travel is a short camera sweep plus a teleport, not a long autopilot drive.** It's instant with reduced motion on. Governs R11.

### Requirements

**World**

- R1. The 3D view is a ground-level modern city. All space elements from v0.1 are removed: spaceship, flight, planets, stars, stations, and the floating island.
- R2. The city has roads with lane markings, intersections, sidewalks, street trees, streetlights, and filler buildings, generated procedurally without paid assets.
- R3. A boulevard loop passes the five towers in this order: Career, AI Research, Projects, Education, Contact.
- R4. A downtown grid of streets and intersections fills the area inside the loop, reachable from the loop.
- R5. Each tower has a silhouette distinct from the others and from the filler buildings, recognizable from a distance at any time of day:
  - Career: MetLife-inspired campanile with four clock faces and a gold pyramid roof.
  - AI Research: glass tower.
  - Projects: stepped tower with facade screens.
  - Education: classical base with a spire.
  - Contact: slim tower with a beacon.
- R6. The visitor spawns in the car on the boulevard facing the Career Tower, with a dismissible welcome card showing the owner's name, headline, and the core controls.

**Towers and content**

- R7. Career Tower panel: title, organization, dates, responsibilities, and achievements for the single role, Software Engineer – AI, November 2023 to July 2026.
- R8. Panels for the other towers:
  - AI Research: papers and publications grouped by theme (healthcare AI, NLP, LLM research), each with venue, year, and link.
  - Projects: projects with description, technologies, live-demo link, and GitHub link.
  - Education: qualifications with institution, dates, and achievements.
  - Contact: email, LinkedIn, GitHub, and a résumé download.

**Interaction**

- R9. Each tower has a visible entrance zone at the curb. While the car is inside it, a prompt names the tower and the key to press (E on keyboard, an on-screen button on touch). Pressing it opens that tower's panel.
- R10. Clicking or tapping a tower fast-travels the car to its entrance and opens its panel.
- R11. A fast-travel menu lists all five towers. Choosing one moves the car to that entrance with a short camera sweep, or instantly with reduced motion on, and opens the panel.
- R12. Opening a panel parks the car and frames the tower beside the panel; closing it with Escape, the close button, or by driving off returns full control.

**Driving and camera**

- R13. Third-person arcade driving: W/↑ accelerates, S/↓ brakes then reverses, A/←/D/→ steer, Space is a handbrake. The car is a procedural retro coupe.
- R14. Handling feels smooth and forgiving: gradual acceleration, steering that eases with speed, and no flipping or crash states. The car slides along buildings and the city edge instead of stopping dead or passing through.
- R15. The camera follows behind and above the car with smooth lag, keeps a clear view when reversing or turning sharply, and never ends up inside buildings.
- R16. Touch devices get an on-screen joystick for steering and throttle, plus buttons for brake and interact.
- R17. Flight-era bindings are gone. E only interacts; M toggles the menu; Escape closes the menu first, then the panel.

**Look and lighting**

- R18. The interface is clean and professional: readable panels, unobtrusive HUD, prompts that never cover the car or the road ahead.
- R19. Sun position, sky, ambient color, and fog follow the visitor's local time. Night has lit windows, streetlights, car headlights, and floodlit towers; day has a bright sky and crisp shadows. Dawn, golden hour, and dusk blend between them.
- R20. Lighting keeps tracking the clock during a visit, changing slowly enough that it never visibly jumps.

**Two versions and access**

- R21. The 3D view still opens first on capable devices. Devices without WebGL, and visitors with reduced motion on, start in the quick view with a note explaining why.
- R22. A HUD control is always present to leave driving mode for the quick view. Switching in either direction keeps the visitor's place (the tower they were at, or the section in view).
- R23. Every tower and section has a shareable URL, and browser Back/Forward work across places and views.
- R24. The quick view has the sections About, Experience, Research, Projects, Education, and Contact, with the résumé download in its header. The menu and quick view together give keyboard and screen-reader users the full content without driving.
- R25. The Career role uses the owner's real title and dates. Its responsibilities and achievements, and all other content, are realistic placeholders until the owner supplies them, all editable in one content source.

### Key Flows

- F1. First visit, driving
  - **Trigger:** A visitor opens the site on a capable desktop.
  - **Steps:** They spawn facing the Career Tower and read the welcome card. They drive forward along the boulevard, enter the Career entrance zone, see the prompt, and press E. The panel opens and the car parks. Escape closes it, and they drive on toward AI Research.
  - **Covered by:** R3, R6, R9, R12, R13
- F2. Time-pressed visitor
  - **Trigger:** A recruiter wants the projects now.
  - **Steps:** They press M or click the Projects Tower. The car moves to its entrance and the panel opens within about two seconds. They switch to the quick view and land on the Projects section.
  - **Covered by:** R10, R11, R22
- F3. Phone visitor
  - **Trigger:** A visitor opens the site on a phone.
  - **Steps:** They land in 3D and drive with the joystick. At a tower's entrance an Interact button appears, and tapping it opens the panel as a bottom sheet.
  - **Covered by:** R9, R16, R21

### Acceptance Examples

- AE1. **Covers R9.** Given the car stops half inside the AI Research entrance zone, when E is pressed, the AI Research panel opens. Given the car is just outside every zone, pressing E does nothing and shows no prompt.
- AE2. **Covers R12, R17.** Given a panel is open and the menu is open, the first Escape closes the menu and the second closes the panel. Given a panel is open, pressing W closes it and the car starts moving.
- AE3. **Covers R19.** At local 00:30 the scene is night with lit windows and floodlit towers. At 13:00 it is full daylight. At 18:45 in October it is in a dusk blend. In all three the Career clock shows the visitor's local time.
- AE4. **Covers R22.** Given the car is at the Education entrance with its panel open, when the visitor switches to the quick view, it opens scrolled to Education. Switching back places the car at the Education entrance with its panel open.
- AE5. **Covers R11.** With reduced motion on, choosing Contact from the menu moves the car there instantly, with no camera sweep.

### Success Criteria

- A first-time desktop visitor who only holds W passes all five towers in about a minute.
- Any tower's content is readable within two seconds of choosing it from the menu or clicking it.
- At least 60 fps on a mid-range laptop at any time of day. The quick view still never downloads the 3D engine.

### Scope Boundaries

- **Deferred for later:**
  - A manual day/night override.
  - Traffic, pedestrians, and parked cars.
  - Engine and city audio.
  - Imported or hand-made 3D models; everything stays procedural for now.
  - A "buildings fold into cards" view transition.
  - Prerendering the quick view for search engines.
- **Outside this product's identity:**
  - Racing, scoring, collisions with damage, or any goal other than exploring the portfolio.

### Dependencies / Assumptions

- The owner will supply real content (role responsibilities and achievements, papers, projects, education, contact links, résumé PDF) after this build; placeholders must be easy to replace in one place.
- "Local time" means the visitor's device clock; no location or timezone lookup is involved.

### Outstanding Questions

- **Deferred to Planning:**
  - Which v0.1 modules carry over unchanged, which are adapted, and which are deleted.
  - Exact time-of-day keyframes and blend timings.
  - Car handling constants.
  - How entrance zones are shown visually.
  - Joystick layout.
  - The test suite that replaces the flight tests.

### Sources / Research

- v0.1 prototype on branch `feat/3d-portfolio-prototype` (uncommitted).
  - Reused as-is: content source `src/content/portfolio.ts`, URL routing `src/state/route.ts`, store `src/state/store.ts`, quick view `src/basic/BasicSite.tsx`, panel and menu in `src/ui/`, capability fallback `src/lib/capabilities.ts`, MetLife tower builder `src/models/tower.ts`, DOM label layer `src/world/labels.ts`.
  - Already established patterns: a camera view offset that keeps targets clear of the panel, and a lazily loaded 3D chunk.
- The v0.1 README records its known limitations, which this plan supersedes.
