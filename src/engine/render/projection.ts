/** The two rendered spaces that can show one MNX selection. Kept below the
 * element layer because render entry points also report which projection a
 * source click came from. */
export type RenderedProjection = 'notation' | 'tab';

/** Source-bearing tab ink currently consists of the fret digit and its line
 * knock-out. Everything else clickable is notation ink. Classify from the
 * emitted SVG vocabulary so the combined renderer need not know layout rows. */
export function projectionForSourceClass(className: string): RenderedProjection {
  const classes = new Set(className.split(/\s+/).filter(Boolean));
  return classes.has('fret-number') || classes.has('fret-bg') ? 'tab' : 'notation';
}

export function isEchoProjection(
  projection: RenderedProjection,
  primary: RenderedProjection | null | undefined
): boolean {
  return primary !== null && primary !== undefined && projection !== primary;
}
