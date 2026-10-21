// Rapier collision groups. Everything else keeps the default (member of every group, colliding with every group).
// A knocked-over lamp or tree flies free of the car (KTD2 of the knock-overs and boost plan): the car's body and
// its wheel rays pass through thrown copies, which still land on the ground and bump into the city.
import { interactionGroups } from '@react-three/rapier';

const ALL = Array.from({ length: 16 }, (_, i) => i);
const CAR = 1;
const THROWN = 2;

/** The car's body: in its own group, colliding with everything that accepts it. */
export const CAR_GROUPS = interactionGroups([CAR]);
/** The car's wheel rays: they skip thrown copies, so a fallen tree never lifts a wheel. */
export const WHEEL_RAY_GROUPS = interactionGroups([CAR], ALL.filter((g) => g !== THROWN));
/** A thrown lamp or tree: it collides with everything except the car. */
export const THROWN_GROUPS = interactionGroups([THROWN], ALL.filter((g) => g !== CAR));
