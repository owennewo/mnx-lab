// Text sizes that more than one layout module must agree on. A leaf — it
// imports nothing — so both the tab staff and the lyric rows can read it
// without closing the tabStaff → spacing → lyricRuns import loop.

/**
 * The fret digit's em size, in staff spaces: 1.2 string gaps (the gap is
 * `TAB_STRING_SPACING_SP`, 8/7 sp, so 1.371 — kept a terminating decimal so
 * the grace digit's 0.6 of it survives the goldens' rounding exactly). Set by
 * eye against Soundslice on 2026-10-16, whose digits are 1.2 of their own
 * string gap; at the old 1.25 sp (1.09 gaps) a tab read thin beside it. Staff
 * spaces are the currency the staff scale multiplies, so the digit keeps this
 * proportion at every zoom.
 */
export const FRET_FONT_SIZE_SP = 1.37;
