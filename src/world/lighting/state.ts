/** Current lighting values, written by the lighting system and read by anything that glows with the night. */
export const lightingState = {
  /** 0 by day, 1 at night. */
  night: 0,
  /** In-world hours since midnight. */
  hours: 12,
};

/** Whether the name billboard's letters are flickering right now (its buzz plays only then). */
export const billboardState = { flickering: false };
