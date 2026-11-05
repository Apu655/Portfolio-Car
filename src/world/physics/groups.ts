// Rapier collision groups. Everything else keeps the default (member of every group, colliding with every group).
// A knocked-over lamp or tree flies free of the car (KTD2 of the knock-overs and boost plan): the car's body and
// its wheel rays pass through thrown copies, which still land on the ground and bump into the city. On foot
// (KTD3 of the walking character plan) the walker has its own group the car ignores, and lamps, trees and the
// robot, which the car drives through, get thin blockers that only the walker feels.
import { interactionGroups } from '@react-three/rapier';

const ALL = Array.from({ length: 16 }, (_, i) => i);
const CAR = 1;
const THROWN = 2;
const WALKER = 3;
const WALKER_BLOCKER = 4;

/** The car's body: in its own group, colliding with everything that accepts it. */
export const CAR_GROUPS = interactionGroups([CAR], ALL.filter((g) => g !== WALKER && g !== WALKER_BLOCKER));
/** The car's wheel rays: they skip thrown copies, so a fallen tree never lifts a wheel. */
export const WHEEL_RAY_GROUPS = interactionGroups([CAR], ALL.filter((g) => g !== THROWN && g !== WALKER && g !== WALKER_BLOCKER));
/** A thrown lamp or tree: it collides with everything except the car. */
export const THROWN_GROUPS = interactionGroups([THROWN], ALL.filter((g) => g !== CAR));
/** The walker's capsule: never touched by the car's body or wheels. */
export const WALKER_GROUPS = interactionGroups([WALKER], ALL.filter((g) => g !== CAR));
/** Thin solids beside lamps, trees and the robot that stop the walker and nothing else. */
export const WALKER_BLOCKER_GROUPS = interactionGroups([WALKER_BLOCKER], [WALKER]);
/** What the walker's movement query tests: the city and its blockers, but not thrown copies or the car's group. */
export const WALKER_QUERY_GROUPS = interactionGroups([WALKER], ALL.filter((g) => g !== THROWN && g !== CAR));
