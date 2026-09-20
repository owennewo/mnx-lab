/** Plain-DOM sibling wiring. The common ancestor owns this provider. */
import { ContextProvider } from '@lit/context';
import { playbackStateContext, initialPlaybackState, type PlaybackUpdate } from './mnxContext.ts';
import { linearizePasses } from '../model/passes.ts';
import {
  activeIteration,
  chooseOrdinal,
  resolveIteration,
  withPlaybackOrdinal,
  inspectIteration,
  followPlayback,
  verseForIteration,
} from '../model/playback.ts';
import { documentLyricLineIds } from '../engine/layout/lyricRuns.ts';
import { compilePerformance } from '../audio/performance.ts';
import { beatOfKey } from './scoreSeek.ts';
import type { MnxDocument } from '../model/mnx.ts';
import type { Player } from './Player.ts';
import type { DocumentViewer } from './DocumentViewer.ts';

export function bindPlayback(host: HTMLElement, viewer: DocumentViewer, player: Player) {
  let state = initialPlaybackState();
  let model: ReturnType<typeof linearizePasses> | undefined;
  let document: MnxDocument | undefined;
  let lastKey = '';
  const provider = new ContextProvider(host, {
    context: playbackStateContext,
    initialValue: state,
  });
  provider.addCallback(
    (value) => {
      viewer.playbackState = value;
    },
    viewer,
    true,
  );
  provider.hostConnected();
  const publish = () => {
    provider.setValue(state);
    if (document)
      viewer.selectedVerse = verseForIteration(documentLyricLineIds(document.mnxJson), state);
  };
  const update = (event: Event) => {
    const detail = (event as CustomEvent<PlaybackUpdate>).detail;
    if (!model || detail.documentId !== player.documentId) return;
    state = { ...withPlaybackOrdinal(state, model, detail.ordinal), playing: detail.playing ?? false, highlight: detail.highlight,
      recordingBookends: detail.recordingBookends ?? null, mediaPhase: detail.mediaPhase ?? null };
    publish();
  };
  const select = (event: Event) => {
    const detail = (event as CustomEvent<{ noteId?: string; ordinal?: number }>).detail,
      key = detail.noteId;
    if (!key || !player.performance) return;
    const candidates = player.performance.written
      .filter((w) => w.noteKey === key)
      .map((w) => w.ordinal);
    const ordinal = detail.ordinal ?? chooseOrdinal(candidates, state.ordinal, {
      explicitSeek: true,
      cycle: lastKey === key,
    });
    lastKey = key;
    // THE NOTE'S OWN BEAT, not its bar's first. A press names a moment, and
    // seeking to the barline instead reads as the scrubber ignoring a press
    // that was already inside the bar it is playing.
    if (ordinal !== null) {
      player.seek(ordinal, beatOfKey(player.performance, document?.mnxJson, key, ordinal) ?? undefined);
    }
  };
  /**
   * A click that landed on EMPTY space still seeks — to the bar it fell in
   * (core-editor-pointer-placement.md), so the playhead and the edit cursor
   * stay together until the reader presses play. A click on ink is already a
   * seek through `note-selected` above and is ignored here, or the two would
   * race for the same click.
   *
   * Which pass of a repeated bar: the one being inspected or played, exactly
   * as the chip reads it — never bar 9's first visit when the reader is
   * looking at its second.
   */
  const place = (event: Event) => {
    const detail = (event as CustomEvent<
      { measureIndex?: number; noteKey?: string; columnKey?: string }
    >).detail;
    if (!model || !detail || detail.noteKey !== undefined || detail.measureIndex === undefined) return;
    const { ordinals } = resolveIteration(model, detail.measureIndex, activeIteration(state));
    const candidates = ordinals.length > 0
      ? ordinals
      : model.entries.filter(entry => entry.measureIndex === detail.measureIndex).map(entry => entry.ordinal);
    const ordinal = chooseOrdinal(candidates, state.ordinal, { explicitSeek: true });
    if (ordinal === null) return;
    // The drawn moment the press was nearest to — a rest, or a neighbour's
    // notehead on the same beat. It is the same column the edit cursor lands
    // on, so the playhead and the cursor arrive at one place rather than at
    // the beat and the barline respectively.
    const beat = detail.columnKey === undefined
      ? null
      : beatOfKey(player.performance, document?.mnxJson, detail.columnKey, ordinal);
    player.seek(ordinal, beat ?? undefined);
  };
  // The viewer must not know about the player: it reports a two-finger tap and
  // the host decides what that means, exactly as `note-selected` becomes a seek
  // above. With no player bound the gesture is a no-op, never an error.
  const toggle = () => player.toggle();
  player.addEventListener('playback-state-changed', update);
  viewer.addEventListener('note-selected', select);
  viewer.addEventListener('position-selected', place);
  viewer.addEventListener('transport-toggle', toggle);
  return {
    get state() {
      return state;
    },
    setDocument(next: MnxDocument) {
      // An edit — the same document, a new revision — keeps the player's session, its
      // source and its place (core-player-live-edit); only another document stops the
      // player and starts the playback state over.
      const edit = document !== undefined && next.id === document.id;
      if (!edit) {
        player.stop();
        player.performance = null;
        state = {
          ...initialPlaybackState(),
          inspectionIteration: state.inspectionIteration,
          followPlayback: state.followPlayback,
        };
        publish();
      }
      document = next;
      model = linearizePasses(next.mnxJson);
      lastKey = '';
      viewer.mnxDoc = next;
      player.documentId = next.id;
      player.document = next.mnxJson;
      const result = compilePerformance(next.mnxJson, model);
      player.writtenBarDurations = result.ok ? result.writtenBarDurations : undefined;
      player.performance = result.ok ? result.performance : null;
      // The traversal may have changed under the ordinal it holds; the player's next frame corrects it.
      if (edit) state = withPlaybackOrdinal(state, model, state.ordinal);
      publish();
      return result;
    },
    inspect(iteration: number) {
      state = inspectIteration(state, iteration);
      publish();
    },
    follow() {
      state = followPlayback(state);
      publish();
    },
    dispose() {
      player.stop();
      player.performance = null;
      state = initialPlaybackState();
      publish();
      player.removeEventListener('playback-state-changed', update);
      viewer.removeEventListener('note-selected', select);
      viewer.removeEventListener('position-selected', place);
      viewer.removeEventListener('transport-toggle', toggle);
      provider.clearCallbacks();
      host.removeEventListener('context-request', provider.onContextRequest);
      host.removeEventListener('context-provider', provider.onProviderRequest);
    },
  };
}
