/** Discretionary score whitespace, in staff spaces. No glyph or spring scaling. */
export const DEFAULT_CLEARANCE = 2;
const TIGHT_MARGIN_SP = 0.1;

/** API values snap to the same nine levels as the UI; ties round upwards. */
export function normalizeClearance(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(Math.max(0, Math.min(4, value)) * 2) / 2
    : DEFAULT_CLEARANCE;
}

/** Legacy public multiplier, retained independently of the level control. */
export function clampPadDensity(value: number | undefined | null): number {
  if (value === undefined || value === null || !Number.isFinite(value)) return 1;
  return Math.min(2, Math.max(0, value));
}

/** Explicit legacy densityPad wins wholesale, never compounds with Clearance. */
export function clearanceSpacing(level?: number, densityPad?: number | null) {
  const value = normalizeClearance(level);
  const legacy = densityPad !== undefined && densityPad !== null;
  const multiplier = clampPadDensity(densityPad);
  const interpolate = (tight: number, normal: number, spacious: number): number => {
    // The default must preserve the exact original arithmetic, including floats.
    if (value === 2) return normal;
    return value < 2
      ? tight + (normal - tight) * (value / 2)
      : normal + (spacious - normal) * ((value - 2) / 2);
  };
  const gap = (normal: number, tight: number, legacyFloor: number, spacious = normal * 3) =>
    legacy ? Math.max(legacyFloor, normal * multiplier) : interpolate(tight, normal, spacious);
  return {
    /** Browser views crop reserved headroom; retain their historical 0.5sp at 2. */
    cropMargin: legacy ? 0.5 : interpolate(TIGHT_MARGIN_SP, 0.5, 6),
    horizontalMargin: gap(2, TIGHT_MARGIN_SP, 0.5, 6),
    /** Adjust only the spare tail of existing clef/time slots; keep legacy slots. */
    prefixGroupExtra: legacy ? 0 : interpolate(-0.15, 0, 1.2),
    prefixPad: (normal: number) => gap(normal, 0.15, 0.2),
    pairedInk: gap(2, 0.5, 1, 6),
    pairedLines: gap(3, 0.75, 1, 9),
    staffInk: gap(3, 0.75, 1, 9),
    staffLines: gap(4, 1, 1, 12),
    // Row attribution has a 0.95sp tolerance around its midpoint for content
    // that hangs into a gap. A 1.5sp request therefore leaves at least 0.5sp
    // between independently measured row ink at the tight endpoint.
    systemInk: gap(3, 1.5, 1, 10),
    /** Preserve the old reserved margin at 2; remove only its spare air at 0. */
    verticalMargin(reserved: number, inkReach: number): number {
      const normal = Math.max(inkReach + 0.5, reserved);
      if (legacy) return Math.max(inkReach + 0.5, reserved * multiplier);
      return interpolate(inkReach + TIGHT_MARGIN_SP, normal, inkReach + Math.max(6, (normal - inkReach) * 3));
    },
    /** Tab's composed layout historically keeps 2sp above and 5sp below ink. */
    tabOuterMargin(normal: number): number {
      return legacy ? normal : interpolate(TIGHT_MARGIN_SP, normal, normal * 3);
    }
  };
}

export type ClearanceSpacing = ReturnType<typeof clearanceSpacing>;
