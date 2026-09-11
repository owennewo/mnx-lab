// Small shared vocabulary for the library shell: how a dimension is named in
// the rail, which ones the rail hides, and how a time reads to a person.
export const DIMENSION_LABELS: Record<string, string> = {
  artist: 'Artist', 'tuning-name': 'Tuning', capo: 'Capo', list: 'List', title: 'Title', tuning: 'Tuning (pitches)', genre: 'Genre',
};
/** Rail order for the dimensions that have a fixed place; anything else follows, alphabetically. */
export const RAIL_ORDER = ['artist', 'tuning-name', 'capo', 'list'];
/** Not lines in the rail: the title is the row itself, the pitches duplicate the tuning name, and favourites have their own line. */
export const RAIL_HIDDEN = new Set(['title', 'tuning', 'favourite']);
export const FAVOURITE = { dimension: 'favourite', value: 'yes' };

export function dimensionLabel(dimension: string): string {
  return DIMENSION_LABELS[dimension] ?? dimension.charAt(0).toUpperCase() + dimension.slice(1);
}
export function chipText(dimension: string, value: string): string {
  return dimension === 'capo' ? `capo ${value}` : value;
}
export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 14) return 'last week';
  if (days < 60) return `${Math.round(days / 7)}w ago`;
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
/** `dimension:value` typed by a person, or null when it is plain words. */
export function parseTag(text: string): { dimension: string; value: string } | null {
  const colon = text.indexOf(':');
  if (colon <= 0) return null;
  const dimension = text.slice(0, colon).trim().toLowerCase(); const value = text.slice(colon + 1).trim();
  return dimension && value ? { dimension, value } : null;
}
