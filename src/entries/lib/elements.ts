// mnx-lab/elements — the embeddable custom elements. Importing registers
// them (Lit @customElement side effect); shadow DOM is the embeddability
// story, so styles never leak either way.
export { DocumentViewer, type ViewMode } from '../../elements/DocumentViewer.ts';
export type { PlaybackState, SelectionContext } from '../../elements/mnxContext.ts';
