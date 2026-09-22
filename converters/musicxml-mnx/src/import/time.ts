import type { MnxGlobalMeasure } from '../common/types.js';
import type { Element } from '../common/xml.js';
import { findDirectChild } from './musicxml.js';

export type TimeSignature = NonNullable<MnxGlobalMeasure['time']>;
const units = new Set([1n, 2n, 4n, 8n, 16n, 32n, 64n, 128n]);
const safe = BigInt(Number.MAX_SAFE_INTEGER);
const gcd = (a: bigint, b: bigint): bigint => { while (b) [a, b] = [b, a % b]; return a; };
const positive = (text: string): bigint | null => /^\d+$/.test(text) && BigInt(text) > 0n ? BigInt(text) : null;

/** Exact metrical total, with each lost display/scope instruction made explicit. */
export function readTimeSignature(time: Element, warn: (message: string) => void): TimeSignature | null {
  if (time.getAttribute('number') !== null) warn('staff-local time scope is not represented; the selected meter is applied globally.');
  if (time.getAttribute('print-object') === 'no') warn('time print-object="no" is not represented; the meter remains visible when time signatures are shown.');
  if (time.getAttribute('separator') !== null) warn('time separator style is not represented.');
  if (findDirectChild(time, 'interchangeable')) warn('interchangeable meter and its relation/enclosure are not represented; retaining the primary meter.');
  const unmetered = findDirectChild(time, 'senza-misura');
  if (unmetered) {
    warn(`unmetered time (senza-misura ${JSON.stringify(unmetered.textContent.trim())}) is not represented; previous/default meter retained.`);
    return null;
  }
  const symbol = time.getAttribute('symbol');
  if (symbol && !['normal', 'common', 'cut'].includes(symbol)) warn(`time symbol ${symbol} is not represented; using a numeric meter.`);
  const children = time.childNodes.filter(n => n.nodeType === 1 && ['beats', 'beat-type'].includes((n as Element).tagName)) as Element[];
  const failed = (reason: string): null => { warn(`${reason}; previous/default meter retained.`); return null; };
  if (!children.length || children.length % 2) return failed('incomplete time beats/beat-type pairs');
  let numerator = 0n, denominator = 1n;
  let grouped = children.length > 2;
  for (let i = 0; i < children.length; i += 2) {
    if (children[i].tagName !== 'beats' || children[i + 1].tagName !== 'beat-type') return failed('misordered time beats/beat-type pairs');
    const pieces = children[i].textContent.trim().split('+').map(s => positive(s.trim()));
    const unit = positive(children[i + 1].textContent.trim());
    if (!unit || pieces.some(n => n === null)) return failed('invalid positive integers in time signature');
    grouped ||= pieces.length > 1;
    const count = (pieces as bigint[]).reduce((a, b) => a + b, 0n);
    const common = denominator / gcd(denominator, unit) * unit;
    numerator = numerator * (common / denominator) + count * (common / unit);
    denominator = common;
  }
  // Keep 6/8 as 6/8, etc. Reduce only when the unreduced spelling cannot be
  // expressed safely using published MNX's numeric count and denominator enum.
  if (!units.has(denominator) || numerator > safe) {
    const divisor = gcd(numerator, denominator);
    numerator /= divisor; denominator /= divisor;
    if (!units.has(denominator) || numerator > safe) return failed(`time total ${numerator}/${denominator} has no safely representable published MNX meter`);
    warn(`time spelling normalized to equivalent ${numerator}/${denominator}.`);
  }
  const result: TimeSignature = { count: Number(numerator), unit: Number(denominator) };
  if (grouped) warn(`additive/compound time grouping is not represented; retaining equivalent total ${numerator}/${denominator}.`);
  if (symbol === 'common' || symbol === 'cut') {
    const compatible = symbol === 'common' ? result.count === 4 && result.unit === 4 : result.count === 2 && result.unit === 2;
    if (compatible) result.display = symbol;
    else warn(`incompatible time symbol ${symbol} for ${result.count}/${result.unit}; retaining numeric meter.`);
  }
  return result;
}
