// Musical positions/durations are whole-note fractions. Only the clock adapter
// converts them to approximate numbers. No MIDI ticks or transport rate here.
import { durationBaseValue } from './durations.ts';
import type { MnxEvent, MnxTuplet } from './mnx.ts';

export interface Rational { readonly num: bigint; readonly den: bigint }
export interface RationalJSON { num: string; den: string }
export interface TimingDiagnostic {
  code: 'invalid-time' | 'unsafe-number' | 'resource-limit' | 'missing-grace-neighbour';
  message: string;
}
/** The compiler must catch this at its outer boundary and return diagnostics
 * without a partial performance. Resource exhaustion never falls back to floats. */
export class TimingError extends Error {
  constructor(readonly diagnostic: TimingDiagnostic) {
    super(diagnostic.message);
    this.name = 'TimingError';
  }
}
export const TIME_LIMITS = Object.freeze({ bits: 512, tupletDepth: 32, dots: 32 });
function fail(code: TimingDiagnostic['code'], message: string): never {
  throw new TimingError({ code, message });
}
const abs = (n: bigint) => n < 0n ? -n : n;
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a); b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
function checkBits(n: bigint, limit: number) {
  if (abs(n).toString(2).length > limit) fail('resource-limit', `Exact time exceeds ${limit} bits.`);
}
/** Up to twice the canonical bit budget for arithmetic intermediates. */
export function rational(num: bigint, den = 1n): Rational {
  if (den === 0n) fail('invalid-time', 'A rational denominator cannot be zero.');
  checkBits(num, TIME_LIMITS.bits * 2); checkBits(den, TIME_LIMITS.bits * 2);
  if (den < 0n) { num = -num; den = -den; }
  const divisor = gcd(num, den);
  num /= divisor; den /= divisor;
  checkBits(num, TIME_LIMITS.bits); checkBits(den, TIME_LIMITS.bits);
  return Object.freeze({ num, den });
}
export const ZERO = rational(0n);
export const ONE = rational(1n);
export const QUARTER = rational(1n, 4n);
export function add(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den + b.num * a.den, a.den * b.den);
}
export function subtract(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den - b.num * a.den, a.den * b.den);
}
export function multiply(a: Rational, b: Rational): Rational {
  return rational(a.num * b.num, a.den * b.den);
}
export function divide(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den, a.den * b.num);
}
export function compare(a: Rational, b: Rational): -1 | 0 | 1 {
  const delta = a.num * b.den - b.num * a.den;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}
export const min = (a: Rational, b: Rational): Rational => compare(a, b) <= 0 ? a : b;
export const max = (a: Rational, b: Rational): Rational => compare(a, b) >= 0 ? a : b;
export function toRationalJSON(value: Rational): RationalJSON {
  const canonical = rational(value.num, value.den);
  return { num: String(canonical.num), den: String(canonical.den) };
}
export function fromRationalJSON(value: RationalJSON): Rational {
  if (typeof value.num !== 'string' || typeof value.den !== 'string'
      || !/^(0|-?[1-9][0-9]*)$/.test(value.num) || !/^[1-9][0-9]*$/.test(value.den))
    fail('invalid-time', 'Expected canonical decimal numerator and positive denominator strings.');
  if (value.num.length > TIME_LIMITS.bits || value.den.length > TIME_LIMITS.bits)
    fail('resource-limit', 'Serialized exact time exceeds the input budget.');
  const result = rational(BigInt(value.num), BigInt(value.den));
  if (String(result.num) !== value.num || String(result.den) !== value.den)
    fail('invalid-time', 'Serialized exact time must be reduced; zero is 0/1.');
  return result;
}
/** Structural adapter for the editor Onset and MNX fractions; no edit-layer import. */
export function fromSafeFraction(value: { num: number; den: number }): Rational {
  if (!Number.isSafeInteger(value.num) || !Number.isSafeInteger(value.den))
    fail('unsafe-number', 'Fraction components must be safe integers.');
  return rational(BigInt(value.num), BigInt(value.den));
}
export function toSafeFraction(value: Rational): { num: number; den: number } {
  if (abs(value.num) > BigInt(Number.MAX_SAFE_INTEGER) || value.den > BigInt(Number.MAX_SAFE_INTEGER))
    fail('unsafe-number', 'Exact time cannot be represented by a number-based fraction.');
  return { num: Number(value.num), den: Number(value.den) };
}
/** Exact interpretation of a finite number's decimal spelling (e.g. BPM 72.5).
 * This cannot recover precision already lost before the number reached us. */
export function fromDecimal(value: number): Rational {
  if (!Number.isFinite(value)) fail('invalid-time', 'Expected a finite decimal number.');
  const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
  const [integer, fraction = ''] = mantissa!.split('.');
  const scale = fraction.length - Number(exponent);
  if (Math.abs(scale) > 308) fail('resource-limit', 'Decimal exponent exceeds the time budget.');
  const digits = BigInt(integer! + fraction);
  return scale >= 0 ? rational(digits, 10n ** BigInt(scale)) : rational(digits * 10n ** BigInt(-scale));
}
export function positive(value: Rational, label: string): Rational {
  if (value.num <= 0n) fail('invalid-time', `${label} must be positive.`);
  return value;
}
export function nonnegative(value: Rational, label: string): Rational {
  if (value.num < 0n) fail('invalid-time', `${label} must not be negative.`);
  return value;
}
export function noteDuration(value: MnxEvent['duration']): Rational {
  const base = durationBaseValue(value.base);
  if (base === undefined) fail('invalid-time', `Unknown note value: ${value.base}.`);
  const dots = value.dots ?? 0;
  if (!Number.isSafeInteger(dots) || dots < 0) fail('invalid-time', 'Dots must be a nonnegative integer.');
  if (dots > TIME_LIMITS.dots) fail('resource-limit', `At most ${TIME_LIMITS.dots} dots are supported.`);
  return multiply(fromDecimal(base), rational((1n << BigInt(dots + 1)) - 1n, 1n << BigInt(dots)));
}
export type TupletRatio = Pick<MnxTuplet, 'inner' | 'outer'>;
export function tupletScale(tuplet: TupletRatio): Rational {
  const span = (value: TupletRatio['inner']) => multiply(noteDuration(value.duration),
    positive(fromSafeFraction({ num: value.multiple, den: 1 }), 'Tuplet multiple'));
  return divide(span(tuplet.outer), span(tuplet.inner));
}
/** The compiler supplies the enclosing container path; recursive model migration
 * is item 5. Arithmetic already supports every level up to the declared budget. */
export function durationInTuplets(value: MnxEvent['duration'], path: readonly TupletRatio[]): Rational {
  if (path.length > TIME_LIMITS.tupletDepth)
    fail('resource-limit', `Tuplet depth exceeds ${TIME_LIMITS.tupletDepth}.`);
  return path.reduce((duration, tuplet) => multiply(duration, tupletScale(tuplet)), noteDuration(value));
}

export interface TempoChange<T = Rational> { position: T; quarterBpm: T }
export const DEFAULT_QUARTER_BPM = rational(120n);
/** Inverse clock conversion rounds half-up to 1/2^20 whole note. Exact events
 * are never snapped to this grid. At 120 BPM this is about 1.9 microseconds. */
export const CLOCK_RESOLUTION = rational(1n, 1n << 20n);
export function quarterBpm(bpm: number, value: MnxEvent['duration']): Rational {
  return multiply(positive(fromDecimal(bpm), 'Tempo'), multiply(noteDuration(value), rational(4n)));
}
export interface TempoMap {
  readonly changes: readonly TempoChange[];
  secondsAt(position: Rational): number;
  positionAt(seconds: number): Rational;
}
export function createTempoMap(input: readonly TempoChange[] = []): TempoMap {
  const sorted = [{ position: ZERO, quarterBpm: DEFAULT_QUARTER_BPM }, ...input]
    .map(change => ({ position: nonnegative(rational(change.position.num, change.position.den), 'Tempo position'),
      quarterBpm: positive(rational(change.quarterBpm.num, change.quarterBpm.den), 'Tempo') }))
    .sort((a, b) => compare(a.position, b.position));
  // Stable sort: the last declared mark at a shared position wins.
  const changes: TempoChange[] = [];
  for (const change of sorted) {
    if (changes.length && compare(changes[changes.length - 1]!.position, change.position) === 0) changes.pop();
    changes.push(Object.freeze(change));
  }
  const elapsed = [ZERO];
  const secondsFor = (duration: Rational, bpm: Rational) => divide(multiply(duration, rational(240n)), bpm);
  for (let i = 1; i < changes.length; i++) elapsed.push(add(elapsed[i - 1]!,
    secondsFor(subtract(changes[i]!.position, changes[i - 1]!.position), changes[i - 1]!.quarterBpm)));
  const exactSecondsAt = (position: Rational) => {
    nonnegative(position, 'Clock position');
    let i = changes.length - 1;
    while (compare(changes[i]!.position, position) > 0) i--;
    return add(elapsed[i]!, secondsFor(subtract(position, changes[i]!.position), changes[i]!.quarterBpm));
  };
  return {
    changes: Object.freeze(changes),
    secondsAt(position) {
      const seconds = exactSecondsAt(position);
      return Number(seconds.num) / Number(seconds.den);
    },
    positionAt(seconds) {
      const time = nonnegative(fromDecimal(seconds), 'Clock seconds');
      let i = elapsed.length - 1;
      while (compare(elapsed[i]!, time) > 0) i--;
      const position = add(changes[i]!.position,
        divide(multiply(subtract(time, elapsed[i]!), changes[i]!.quarterBpm), rational(240n)));
      const units = divide(position, CLOCK_RESOLUTION);
      const rounded = (units.num * 2n + units.den) / (units.den * 2n);
      return multiply(rational(rounded), CLOCK_RESOLUTION);
    }
  };
}
