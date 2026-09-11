/** Plain-DOM sibling wiring. The common ancestor owns this provider. */
import { ContextProvider } from '@lit/context';
import { playbackStateContext, initialPlaybackState, type PlaybackUpdate } from './mnxContext.ts';
import { linearizePasses } from '../model/passes.ts';
import {
  chooseOrdinal,
  withPlaybackOrdinal,
  inspectIteration,
  followPlayback,
  verseForIteration,
} from '../model/playback.ts';
import { documentLyricLineIds } from '../engine/layout/lyricRuns.ts';
import { compilePerformance } from '../audio/performance.ts';
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
    state = { ...withPlaybackOrdinal(state, model, detail.ordinal), highlight: detail.highlight };
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
    if (ordinal !== null) player.seek(ordinal);
  };
  // The viewer must not know about the player: it reports a two-finger tap and
  // the host decides what that means, exactly as `note-selected` becomes a seek
  // above. With no player bound the gesture is a no-op, never an error.
  const toggle = () => player.toggle();
  player.addEventListener('playback-state-changed', update);
  viewer.addEventListener('note-selected', select);
  viewer.addEventListener('transport-toggle', toggle);
  return {
    get state() {
      return state;
    },
    setDocument(next: MnxDocument) {
      player.stop();
      player.performance = null;
      state = {
        ...initialPlaybackState(),
        inspectionIteration: state.inspectionIteration,
        followPlayback: state.followPlayback,
      };
      publish();
      document = next;
      model = linearizePasses(next.mnxJson);
      lastKey = '';
      viewer.mnxDoc = next;
      player.documentId = next.id;
      player.document = next.mnxJson;
      const result = compilePerformance(next.mnxJson, model);
      player.performance = result.ok ? result.performance : null;
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
      viewer.removeEventListener('transport-toggle', toggle);
      provider.clearCallbacks();
      host.removeEventListener('context-request', provider.onContextRequest);
      host.removeEventListener('context-provider', provider.onProviderRequest);
    },
  };
}
