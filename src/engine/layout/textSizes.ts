// Text sizes that more than one layout module must agree on. A leaf — it
// imports nothing — so both the tab staff and the lyric rows can read it
// without closing the tabStaff → spacing → lyricRuns import loop.

/**
 * The fret digit's em size, in staff spaces. Lyric syllables are drawn at the
 * same size (`LYRIC_SIZE_SP`), so the words under a tab staff read at the
 * weight of the digits above them. Staff spaces are the currency the staff
 * scale multiplies, so the two stay equal at every zoom.
 */
export const FRET_FONT_SIZE_SP = 1.25;
