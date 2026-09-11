// mnx-lab/elements — the embeddable custom elements. Importing registers
// them (Lit @customElement side effect); shadow DOM is the embeddability
// story, so styles never leak either way.
export { DocumentViewer, type ViewMode } from '../../elements/DocumentViewer.ts';
export { playbackStateContext, initialPlaybackState, type PlaybackState, type PlaybackOccurrence, type PlaybackUpdate, type SelectionContext } from '../../elements/mnxContext.ts';

export { Player } from '../../elements/Player.ts';
export { bindPlayback } from '../../elements/playbackHost.ts';

// The score chrome both shells share (roadmap/inprogress/core-score-frame.md).
export { ZoomPad, type ZoomPadChange, type ZoomAxis } from '../../elements/ZoomPad.ts';
export { SettingsPad } from '../../elements/SettingsPad.ts';
export { DEFAULT_DISPLAY_PREFERENCES } from '../../elements/displayDefaults.ts';
