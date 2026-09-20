import '../elements/Player.ts';
import type { Player } from '../elements/Player.ts';
import { beatOfKey } from '../elements/scoreSeek.ts';
import { compilePerformance } from '../audio/performance.ts';
import type { Performance } from '../audio/performanceTypes.ts';
import { chooseOrdinal } from '../model/playback.ts';
import { ContextProvider } from '@lit/context';
import { playbackStateContext, initialPlaybackState, type PlaybackState, type PlaybackUpdate } from '../elements/mnxContext.ts';
import { linearizePasses, hasRepeatStructure, type PassModel } from '../model/passes.ts';
import { resolveIteration, activeIteration, inspectIteration, followPlayback, withPlaybackOrdinal, nextInspectionIteration, verseForIteration } from '../model/playback.ts';
import { documentLyricLineIds } from '../engine/layout/lyricRuns.ts';
import { readDisplayPreferences, writeDisplayPreferences } from './displayPreferences.ts';
import type { DisplayOptions } from '../engine/displayOptions.ts';
// One workbench document: either a deep-linked corpus scenario or the shell's
// transient local file. Scenario-only provenance and compare chrome stay out
// of the local-file presentation.
// The compare view is the review surface — our render beside the spec's
// reference engraving (served by a dev-only middleware from the pinned
// vendor/mnx checkout; in a static deploy the reference pane degrades to a
// note). Rendering goes through the elements/ document viewer, property-driven.
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { corpus, type ScenarioEntry } from '../corpus/corpus.ts';
import { groupScenarios } from '../corpus/groups.ts';
import { classify } from './queue.ts';
import { designTokens, sharedChrome, scrollbars } from '../elements/tokens.ts';
import { scenarioHref, objectsHref } from './WorkbenchApp.ts';
import type { MnxDocument, MnxStructure } from '../model/mnx.ts';
import { resolvePinnedErrors, type PinnedError } from '../model/pinnedErrors.ts';
import type { DocumentViewer, ViewMode } from '../elements/DocumentViewer.ts';
import { EditorSession, replayIntents } from '../edit/session.ts';
import { elementKeys, runDestructWalk } from '../edit/destructWalk.ts';
import { constructTraceByTarget, type ConstructTrace } from './constructTraces.ts';
import type { SelectionLevel } from '../edit/selection.ts';
import type { EditorIntent } from '../edit/intents.ts';
import type { SelectionClipboardStore } from '../edit/selectionClipboard.ts';
import type { ClipboardNotice } from '../edit/clipboardFeedback.ts';
import type { TabSetup } from '../engine/tab/guitarPositions.ts';
import { cheatsheet } from '../edit/keymapDocs.ts';
import { buildHudParts, buildHudRows, LEVEL_BY_ROW, ROW_BY_LEVEL } from '../elements/hudRows.ts';
import { keyFifthsAt } from '../edit/staffSpace.ts';
import { buildJsonView } from '../model/jsonView.ts';
import { findNoteAddress } from '../model/noteWalk.ts';
import type { ShellAction } from '../edit/keymap.ts';
import {
  // Still consumed by the VIEWER's instrument-override overlay (TabSetup) —
  // presentation, not document editing; it outlived the tuning popover.
  parseTuning,
  TUNING_PRESET_NAMES
} from '../edit/setupGrammar.ts';
import { buildOpRow } from './opRows.ts';
import { bindEditor, type EditorBinding } from '../elements/editorHost.ts';
import {
  OVERLAY_EDGE_GAP,
  OVERLAY_SHAFT_H,
  type OverlayAnchor
} from '../elements/overlayPlacement.ts';
import '../elements/DocumentViewer.ts';
import type { InspectorView } from '../elements/inspectorRows.ts';
import { mirrorOverlayAt } from '../elements/inspectorMount.ts';
import '../elements/ScoreFrame.ts';
import type { ZoomPadChange } from '../elements/ZoomPad.ts';
import { DEFAULT_SPACE_SP, DEFAULT_SPACING_MODE, DEFAULT_STAFF_SP } from '../elements/zoomDefaults.ts';
import './ModelPickerDialog.ts';
import { modelDisplayName } from '../assist/modelCatalog.ts';
import { fetchKeyInfo, keyFingerprint, streamChat, type ChatMessage } from '../assist/openrouter.ts';
import { renderMarkdown } from './markdownLit.ts';
import {
  beginPkce,
  forgetApiKey,
  storeApiKey,
  storedApiKey,
  takeLanding
} from './assistCredentials.ts';
import {
  MIN_STAFF_SP,
  MAX_STAFF_SP,
  type RenderScale
} from '../engine/render/scale.ts';
import { MIN_SPACE_SP, MAX_SPACE_SP } from '../engine/layout/spacing.ts';
import type { LocalDocumentSource } from '../importers/localFile.ts';

/** The setup popovers, as data — one row per attribute rather than a ternary
 *  chain that grows a limb per campaign item. Label, placeholder and hint are
 *  the whole difference between them; parsing lives in edit/setupGrammar.ts. */
/** EVERY setup popover, as a palette row (workbench-score-panel.md, step C).
 *
 *  The `actions` tab used to be the only place several of these could be
 *  reached by mouse; the palette hard-coded four of the nine. Retiring the tab
 *  without closing that gap would have removed a working surface, so the two
 *  now come from ONE table — `WorkbenchApp` maps over this rather than keeping
 *  its own list, which is what stops them drifting apart again. */
export const SETUP_POPOVER_COMMANDS: {
  label: string;
  action: ShellAction;
  stroke: string;
}[] = [
  { label: 'lyrics: text editor…', action: 'lyricTextEditor', stroke: 'Shift+L' }
];

import './ScoreHud.ts';

/** The side panel's tabs (roadmap/inprogress/core-score-hud.md): the page's
 *  scattered chrome — description, badges/defs, the edit strip, the op
 *  queue (core-element-ops-exemplar.md), the HUD, the spec reference, the
 *  raw JSON — consolidated into one rail. */
type PanelTab = 'description' | 'ops' | 'hud' | 'assist' | 'compare' | 'json';

/** One part's override state — the HUD ensemble table's currency. */
interface PartOverride {
  instrument: string;
  capo: number | null;
}

/** Side panel width bounds and its remembered-per-browser preference key.
 *  Widened from 240/640/320 by the score-panel design
 *  (roadmap/proposed/workbench-score-panel.md): 420 is the width the five-band
 *  frame was drawn at, and the floor matters because the tab strip is flush
 *  left and MUST NOT WRAP — that is why the width change and the seven-to-five
 *  tab cut are one change and not two. */
/** How long the chip wears a refusal. Long enough to register as an answer,
 *  short enough that the next keypress is not waiting on it. */
const RUNG_REFUSAL_MS = 600;

const PANEL_WIDTH_KEY = 'mnx-lab.panel-width';
/** The floor and the tab set are one decision (the seven-to-five cut set 360
 *  for five tabs); the assist tab is the sixth, so the floor moves with it. */
const PANEL_MIN = 410;
const PANEL_MAX = 560;
const PANEL_DEFAULT = 420;

/** The assistant's model choice — per-browser preference, like the theme; the
 *  committed roster (worker/models.json) stays the reviewed default. The
 *  fallback id mirrors that roster's first row. */
const ASSIST_MODEL_KEY = 'mnx-lab.assist-model';
/** The runners-up the picker ranked below the choice, sent as OpenRouter's
 *  ordered `models: []` so a rate-limited or down provider costs a retry
 *  rather than the turn (core-assist-model-selector.md's second consumer).
 *  Same presentation tier as the choice itself. */
const ASSIST_FALLBACKS_KEY = 'mnx-lab.assist-fallbacks';
/** The conversation — sessionStorage, so it survives switching scenarios
 *  in this tab and dies with the tab; *clear* in the context bar wipes it. */
const ASSIST_CHAT_KEY = 'mnx-lab.assist-chat';

function storedChat(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(ASSIST_CHAT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (m): m is ChatMessage =>
            !!m && typeof m === 'object' && typeof (m as ChatMessage).content === 'string' &&
            ['user', 'assistant', 'system'].includes((m as ChatMessage).role)
        )
      : [];
  } catch {
    return [];
  }
}
const DEFAULT_ASSIST_MODEL = 'deepseek/deepseek-v4-flash';

function storedFallbacks(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ASSIST_FALLBACKS_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/* The zoom pad's two axes (core-zoom-density-pad.md). localStorage, not the
   document store: how big you like the staff is a property of you, not of the
   score — looking at a document must not modify it. Absence selects the shared
   product defaults; explicit stored values always win. */
const STAFF_SP_KEY = 'mnx-lab.staff-sp';
const RETIRED_STAFF_SCALE_KEY = 'mnx-lab.staff-scale';
const SPACING_MODE_KEY = 'mnx-lab.spacing-mode';
/* Space in staff spaces (core-space-units-sp.md, 2026-09-15). The multiplier
   it replaced lived under `mnx-lab.density-h`; a browser still carrying that
   key is tidied on load rather than converted — the value was a convenience. */
const SPACE_SP_KEY = 'mnx-lab.space-sp';
const RETIRED_DENSITY_H_KEY = 'mnx-lab.density-h';

function storedScale(key: string, min: number, max: number): number | null {
  localStorage.removeItem(RETIRED_DENSITY_H_KEY);
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const n = Number(raw);
  // CLAMP, don't reset — storedPanelWidth's rule, for the same reason: a value
  // saved under wider bounds means "as far as it goes", not "start over".
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
}

function storedStaffSp(): number | null {
  const current = localStorage.getItem(STAFF_SP_KEY);
  const legacy = localStorage.getItem(RETIRED_STAFF_SCALE_KEY);
  if (current === null && legacy !== null) localStorage.setItem(STAFF_SP_KEY, legacy);
  localStorage.removeItem(RETIRED_STAFF_SCALE_KEY);
  return storedScale(STAFF_SP_KEY, MIN_STAFF_SP, MAX_STAFF_SP);
}

function storedPanelWidth(): number {
  const n = Number(localStorage.getItem(PANEL_WIDTH_KEY));
  // CLAMP, don't reset: someone who deliberately dragged to 600 under the old
  // bounds means "as wide as it goes", so land them on the new ceiling rather
  // than snapping back to the default. The key is deliberately NOT bumped —
  // a new one would silently discard every stored preference for no gain.
  return Number.isFinite(n) && n > 0 ? Math.min(PANEL_MAX, Math.max(PANEL_MIN, n)) : PANEL_DEFAULT;
}

/** Fifths → the KEY SIGNATURE, for the description's stat strip.
 *
 *  Deliberately not a key NAME. MNX's `key` object carries `fifths` and
 *  nothing else — there is no mode — so one sharp is G major and E minor
 *  equally, and naming it "G major" would invent information the document
 *  does not contain. (The scenario this was first read against is
 *  twelve-bar-blues, which is E minor: the fabricated label was wrong on the
 *  very first document it rendered.) The signature is what the file actually
 *  says, so the signature is what the strip prints. */
function fmtKey(fifths: number): string {
  if (fifths === 0) return 'no sharps or flats';
  const n = Math.abs(fifths);
  return `${n}${fifths > 0 ? '♯' : '♭'}`;
}

/**
 * One JSON line, split into the design's THREE inks and nothing more: keys in
 * ink, numbers in the accent, everything else quiet. Explicitly not a
 * syntax-highlighting rainbow — the design's words are "only three inks" — and
 * explicitly not a tokenizer, because this pane is read-only and a regex over
 * one already-serialized line cannot meet input it did not produce.
 */
function jsonInk(line: string) {
  const parts: { text: string; cls: string }[] = [];
  // Key, string, number — in that order, so a key is never read as a string.
  const re = /("(?:[^"\\]|\\.)*")(\s*:)|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/g;
  let at = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > at) parts.push({ text: line.slice(at, m.index), cls: 'jp' });
    if (m[1]) {
      parts.push({ text: m[1], cls: 'jk' });
      parts.push({ text: m[2], cls: 'jp' });
    } else if (m[3]) {
      parts.push({ text: m[3], cls: 'js' });
    } else {
      parts.push({ text: m[4], cls: 'jn' });
    }
    at = m.index + m[0].length;
  }
  if (at < line.length) parts.push({ text: line.slice(at), cls: 'jp' });
  return parts.map(p => html`<span class=${p.cls}>${p.text}</span>`);
}

/** How many object tags to show before collapsing the tail into a count. */
const DEF_PREVIEW = 9;

@customElement('mnx-scenario-page')
export class ScenarioPage extends LitElement {
  @property({ type: String }) scenarioId = '';
  /** The stored staff-view preference ('' = unset ⇒ the document's hint) and
   *  repeats mode. Shell-owned: the settings pad's changes bubble up to it. */
  @property({ type: String }) view = '';
  @property({type:Boolean}) unrolled = false;
  /** The side-panel tab a link asked for (`?panel=compare|json`). */
  @property({ type: String }) panel = '';
  @property({attribute:false}) at: number | null=null;
  @state() private performance: Performance | null=null;
  private clickedPlaybackKey='';
  private performanceError='';
  private routeSeekConsumed=false;
  /** A one-shot local file supplied by the shell. It is never persisted and
   *  never becomes a corpus scenario. */
  @property({ attribute: false }) localDocument: LocalDocumentSource | null = null;
  /** Host-owned composition state: removes this page's persistent chrome but
   *  leaves the viewer and invoked editor overlays intact. */
  @property({ type: Boolean, reflect: true, attribute: 'document-focus' })
  documentFocus = false;
  /** App-lifetime transport injected by WorkbenchApp: route/session changes
   *  replace this page's document but deliberately retain the copied clip. */
  @property({ attribute: false }) selectionClipboard: SelectionClipboardStore | null = null;

  /** Per-part instrument overrides (roadmap/inprogress/core-score-hud.md),
   *  keyed by part index: 'document' = no strings override, else a tuning
   *  preset name from setupGrammar. Presentation only — never written back.
   *  Single-part scores edit entry 0 through the toolbar selector; the HUD's
   *  ensemble table edits any entry. */
  @state() private displayPreferences = readDisplayPreferences();

  @state() private partSetups = new Map<number, PartOverride>();

  @state() private doc: MnxDocument | null = null;
  @state() private rawDocument = '';
  @state() private pinnedErrors: PinnedError[] = [];
  /** Which pinned error the json tab is highlighting — workbench chrome, and
   *  since stage 3 of the viewer surface it lives here rather than on the
   *  element (docs/core-viewer-surface.md). */
  @state() private errorPointer: string | null = null;
  @state() private referenceFailed = false;
  // Three states, not two: the document arrives over a lazy import, so "nothing
  // on screen" is either still-in-flight or a dead fetch. Collapsing them
  // into one empty pane is how a stopped dev server reads as a render bug.
  @state() private loadState: 'loading' | 'ready' | 'failed' = 'loading';
  @state() private loadError = '';
  @state() private allDefs = false;
  /** The description footer's object filter — the design's tag filter. */
  @state() private defFilter = '';
  @state() private copiedId = false;
  @state() private copiedJson = false;
  /** The json tab's scope toggle and its find box. */
  @state() private jsonScope: 'selection' | 'whole' = 'whole';
  @state() private jsonFind = '';
  // The editor incubates here (roadmap/complete/core-editor-input-layer.md):
  // in-memory only — the workbench has no backend, and this page is a bench
  // for testing the editor, not for authoring corpus files.
  @state() private session: EditorSession | null = null;
  /** The editor's mount, bound to `session` and the viewer on screen (see `syncBinding`). */
  private editor: EditorBinding | null = null;
  private boundViewer: DocumentViewer | null = null;
  private boundOverlay: HTMLElement | null = null;
  /** How long the trace was when `copied` was last true of it. */
  private tracedIntents = 0;
  @state() private playback: PlaybackState = initialPlaybackState();
  private readonly playbackProvider = new ContextProvider(this, {
    context: playbackStateContext, initialValue: this.playback
  });
  private passDocument: MnxStructure | null = null;
  private passModel: PassModel | null = null;

  private setPlayback(state: PlaybackState) {
    this.playback = state;
    this.playbackProvider.setValue(state);
  }
  /**
   * AN EDIT IS NOT A NEW DOCUMENT (core-player-live-edit.md). The player tells
   * the two apart by `documentId` — unchanged here across a keystroke, changed
   * across a route — and replaces the performance in place, carrying the place
   * and the state, playing or paused, with it. This used to stop the transport
   * and null the ordinal on every edit, the path item 22 retired; only
   * `playbackHost.ts` was converted then, and the workbench kept the old one,
   * so a keystroke silently stopped playback. Worse, the stop published its own
   * frame AFTER the clear below and put the ordinal straight back, so the state
   * this method asked for never survived its own call.
   *
   * The ordinal is re-resolved rather than dropped: the traversal may have moved
   * under it, and the player's next frame corrects it either way. Inspection is
   * a preference and rides through untouched.
   */
  private refreshPassModel(document: MnxStructure) {
    if (this.passDocument === document) return;
    this.clickedPlaybackKey='';
    this.passDocument = document;
    this.passModel = linearizePasses(document);
    const compiled=compilePerformance(document,this.passModel);
    this.performance=compiled.ok?compiled.performance:null;
    this.performanceError=compiled.ok?'':compiled.diagnostics.map(d=>d.message).join('; ');
    this.setPlayback(withPlaybackOrdinal(this.playback, this.passModel, this.playback.ordinal));
  }
  private onPlaybackUpdate = (event: Event) => {
    const update = (event as CustomEvent<PlaybackUpdate>).detail;
    if (!this.passModel || update.documentId !== this.scenarioId) return;
    const state = withPlaybackOrdinal(this.playback, this.passModel, update.ordinal);
    this.setPlayback({ ...state, playing: update.playing ?? false,
      highlight: state.ordinal === null ? []
      : update.highlight.filter(occurrence => occurrence.ordinal === state.ordinal) });
  };
  private chooseInspection(iteration: number) {
    this.setPlayback(inspectIteration(this.playback, iteration));
  }

  @state() private copied = false;
  /** The clipboard's transient strip over the score (stage 6): clip kind,
   *  member count and detached references on success, the planner's precise
   *  sentence on a refusal. It names the last outcome and leaves — there is
   *  deliberately no clipboard panel. */
  /**
   * The rung a rail-crossing gesture is CONTINUING, carried across the route
   * change so the next session opens where the last one stood.
   *
   * Deliberately not a `@state`: it is a one-shot baton between
   * `escalateToRail` and the `loadDocument` it causes, not something a render
   * reads. It is set only by the gesture, so opening a scenario any other way
   * — a rail click, a deep link, a reload — still opens at the default rung,
   * which is what those mean. A link that inherited whatever rung the last
   * page happened to be on would be worse than the bug.
   */
  private railRung: SelectionLevel | null = null;

  @state() private clipboardNotice: ClipboardNotice | null = null;
  private clipboardNoticeTimer: ReturnType<typeof setTimeout> | undefined;
  /** The open setup popover (survey §6.2's Shift+letter tier), if any.
   *  (Named to dodge the DOM's built-in HTMLElement.popover property.) */
  /** The assist tab's model choice and its query dialog
   *  (core-assist-model-selector.md's picker surface). */
  @state() private assistModel: string =
    localStorage.getItem(ASSIST_MODEL_KEY) ?? DEFAULT_ASSIST_MODEL;
  @state() private assistFallbacks: string[] = storedFallbacks();
  /** Which model actually answered — OpenRouter names it in every frame, and
   *  it is not always the one you picked once a chain is in play. */
  @state() private servedModel = '';
  @state() private modelPickerOpen = false;
  /** The drawer's live render: the buffer's current diff applied to a
   *  SCRATCH document (the same lyricPlanOps the session would apply), shown
   *  by the viewer while the drawer is open. Never touches the session.
   *  The binding's `onPreview` sets it; null puts the real document back. */
  @state() private lyricPreviewDoc: MnxDocument | null = null;
  /** BYOK state (core-assist-byok.md): the key is read from the shell's
   *  store and re-read on its change event, so a PKCE landing in the app
   *  shell reaches this tab without a prop. */
  @state() private apiKey: string | null = storedApiKey();
  @state() private keyFingerprint = '';
  @state() private pasteDraft = '';
  @state() private connectNotice = '';
  @state() private chat: ChatMessage[] = storedChat();
  @state() private chatDraft = '';
  @state() private chatBusy = false;
  private chatAbort: AbortController | null = null;
  private onCredentialsChange = () => {
    this.apiKey = storedApiKey();
    void this.refreshFingerprint();
  };
  /** The side panel's active tab; falls back when the tab isn't available
   *  (hud/actions need a session). */
  @state() private panelTab: PanelTab = 'hud';
  private landingFocus = false;

  /** The zoom pad's two axes. Saved choices win; absence uses product defaults. */
  @state() private staffSp: number | null = storedStaffSp() ?? DEFAULT_STAFF_SP;
  @state() private spacingMode: 'natural' | 'fill' = localStorage.getItem(SPACING_MODE_KEY) === 'natural' ? 'natural' : DEFAULT_SPACING_MODE;
  @state() private densityH: number | null = storedScale(
    SPACE_SP_KEY,
    MIN_SPACE_SP,
    MAX_SPACE_SP
  ) ?? DEFAULT_SPACE_SP;
  /** What the viewer's last paint actually used, so a fitted readout can print
   *  a true number instead of assuming 100%. */
  @state() private effectiveStaffSp = 1;
  /** Previewed tab (row key), or null = the tab holding the selection. */
  /** The selection's box in `.main` coordinates, from `selection-anchored`. */
  @state() private trayAnchor: OverlayAnchor | null = null;

  /** The rung chip (workbench-rung-legibility.md): full strength on a rung
   *  change, settling to a whisper — the level named at the gaze point. */
  @state() private chipFresh = false;
  private chipLevel: SelectionLevel | null = null;
  private chipTimer: ReturnType<typeof setTimeout> | undefined;

  /** A rung was asked for by name and this document does not present it
   *  (core-rung-addressing.md 7). The chip says so for a beat, because an
   *  absolute key that silently does nothing is indistinguishable from one
   *  that is broken. */
  @state() private rungRefused = false;
  private rungRefusalTimer: number | undefined;

  /** A micro button under the pointer/focus: the rung it would move to, and
   *  which way it climbs. Drives the destination tag on the chip's far side —
   *  the label IS the affordance (workbench-selection-chip-ladder.md). */
  @state() private chipDest: { dir: 'up' | 'down'; label: string } | null = null;

  /** The side the tray hangs from, snapshotted when it opens and held until
   *  it closes: the spec forbids flipping mid-interaction, and the chip and
   *  the tray have to agree about the side because they are one object. */

  /** Side panel width in px — the drag bar on its left edge adjusts it. */
  @state() private panelWidth = storedPanelWidth();

  /**
   * The panel folds away, like the rail (`Ctrl+Alt+B`, or the chevron in the
   * app header) — the score takes the whole page. The SHELL owns this state
   * now, exactly as it owns the rail's and document focus's: the page head
   * that used to carry the fold chevron is retired, so the control moved to
   * the app header and the remembered preference moved with it
   * (`mnx-lab.panel-hidden`, same key, WorkbenchApp). The width stays here,
   * next to the drag bar that edits it.
   */
  @property({ attribute: false }) panelHidden = false;

  /** The drag bar: pointer capture keeps the gesture on the handle; width is
   *  measured from the body's right edge so the math is anchor-independent. */
  private onPanelDrag = (down: PointerEvent) => {
    const handle = down.currentTarget as HTMLElement;
    const body = this.renderRoot.querySelector('.body');
    if (!body) return;
    const right = body.getBoundingClientRect().right;
    handle.setPointerCapture(down.pointerId);
    const move = (e: PointerEvent) => {
      this.panelWidth = Math.round(
        Math.min(PANEL_MAX, Math.max(PANEL_MIN, right - e.clientX))
      );
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      localStorage.setItem(PANEL_WIDTH_KEY, String(this.panelWidth));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    down.preventDefault();
  };

  static styles = [
    designTokens,
    sharedChrome,
    scrollbars,
    css`
      /* The page head is RETIRED (2026-09-01): its view tabs became the
         settings pad in the score corner, its focus button was a duplicate of
         the cluster's, and its panel chevron moved to the app header beside
         its rail mirror. The page is the body alone now — and since 2026-09-12
         the score pane is the score frame, whose top strip carries the view
         and the pads, and whose focus mark IS document focus here
         (core-score-frame.md). */
      :host {
        display: grid;
        grid-template-rows: 1fr;
        height: 100%;
        overflow: hidden;
      }

      /* Title + id live in the description tab. */
      .panel-body h1 {
        font-family: var(--sans);
        font-weight: 500;
        font-size: 17px;
        line-height: 1.3;
        margin: 0 0 4px;
        text-wrap: pretty;
      }

      .panel-body .id {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        margin-bottom: 10px;
        overflow-wrap: anywhere;
      }

      .badges {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
        font-family: var(--mono);
        font-size: 10.5px;
      }

      .badge {
        border: 1px solid var(--line-strong);
        border-radius: var(--radius-pill);
        padding: 2px 9px;
        color: var(--ink-2);
      }

      /* The resting state of most of the corpus: it should not shout. */
      .badge.verified {
        color: var(--ink-2);
        border-color: currentColor;
      }

      .badge.attention {
        color: var(--accent-fg);
        border-color: currentColor;
      }

      .badge.muted {
        color: var(--ink-3);
        border-style: dashed;
      }

      .badge a {
        color: inherit;
        text-decoration: none;
      }

      .defs {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 9px;
      }

      .def {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--ink-2);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius-chip);
        padding: 1px 6px;
        text-decoration: none;
      }

      .def:hover {
        color: var(--accent);
        border-color: var(--accent);
      }

      button.def {
        cursor: pointer;
        color: var(--ink-3);
        font: inherit;
        font-family: var(--mono);
        font-size: 10px;
      }

      /* The actions tab — the former edit strip, stacked for the panel. */
      .actions {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-2);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .actions .action-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .actions .dirty {
        color: var(--accent);
      }

      /* An armed spanner anchor (campaign item 10): the gesture spans two
         presses, so the pending half must be visible between them. */
      .actions .span-anchor {
        color: var(--accent);
      }

      .actions button {
        font: inherit;
        color: var(--ink-2);
        background: transparent;
        border: 1px solid var(--line-strong);
        border-radius: var(--radius-chip);
        padding: 1px 8px;
        cursor: pointer;
      }

      .actions button:hover:not(:disabled) {
        color: var(--accent);
        border-color: var(--accent);
      }

      .actions button:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .actions .hint {
        margin: 0;
        color: var(--ink-3);
        line-height: 1.6;
      }

      /* Setup popovers (survey §6.2's Shift+letter tier): a typed prompt
         whose text parses into a setup intent. */
      .popover {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 10px;
        padding: 8px 12px;
        /* A full rule, and the accent: this is the one surface that owns the
           next keystroke, so it should look like it. */
        border: var(--rule-w) solid var(--accent);
        border-radius: var(--radius-control);
        background: var(--surface);
        box-shadow: var(--shadow);
        font-family: var(--mono);
        font-size: 11px;
        /* Bounded so the grammar hint wraps instead of running off the score
           pane — it used to sit in a ~320px panel where wrapping was forced. */
        max-width: min(560px, calc(100% - 32px));
      }

      .popover .pop-label {
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-size: 9.5px;
      }

      .popover input {
        font: inherit;
        color: var(--ink);
        background: transparent;
        border: none;
        border-bottom: 1px solid var(--line-strong);
        outline: none;
        padding: 2px 4px;
        min-width: 14ch;
        flex: 1;
      }

      .popover .pop-hint {
        color: var(--ink-3);
      }

      .popover .pop-error {
        color: var(--accent-fg);
      }

      /* Score pane + the side panel (columns set inline — the drag bar). */
      .body {
        display: grid;
        overflow: hidden;
        min-width: 0;
        min-height: 0;
      }

      .main {
        overflow: hidden;
        min-width: 0;
        /* The selection tray overlays the score and positions against this
           box (core-selection-tray-visuals.md). */
        position: relative;
      }

      /* The paper fills the pane now, so the gutter around it is the page's
         call rather than the element's 5px embed default (an outer rule beats
         the shadow root's own :host). 14px is the inset the zoom pad already
         sits at, which is why the two read as one decision. Horizontally it
         follows Space like the element's own padding does: the viewer sets
         --mnx-space-paper on itself with each paint, 0 at Space 0. */
      mnx-document-viewer {
        padding: 14px calc(14px * var(--mnx-space-paper, 1));
        box-sizing: border-box;
      }

      /* The clipboard's transient outcome strip (core-selection-clipboard.md
         stage 6): the last copy/cut/paste result said once, over the score,
         at the inset the zoom pad established. Read-only chrome — it must
         never take the pointer from the paper beneath it. */
      .clipboard-notice {
        position: absolute;
        left: 14px;
        bottom: 14px;
        max-width: min(70%, 60ch);
        padding: 4px 10px;
        border: var(--rule-w) solid var(--ink);
        background: var(--surface);
        color: var(--ink);
        font: 12px/1.5 var(--mono);
        pointer-events: none;
        z-index: 2;
      }

      .clipboard-notice.refused {
        border-color: var(--accent);
        color: var(--accent);
      }

      /* The rung chip (workbench-rung-legibility.md, restyled by
         workbench-selection-chip-ladder.md): the selection's level named at
         the selection itself. Full strength while fresh (the rung just
         changed), then a whisper — a settled screen stays quiet. It sits one
         tray-gap below the selection, exactly where the ladder's current rung
         will land, because it IS that rung: the same lowercase mono word, the
         same 5px/8px box, and on open it does not move. The one interactive
         exception to "chrome never takes the pointer" — only over its own
         small box. */
      .rung-chip {
        position: absolute;
        display: flex;
        align-items: stretch;
        border: 1px solid var(--line-strong);
        background: var(--surface);
        z-index: 2;
        opacity: 0.75;
        transition: opacity 260ms ease;
      }

      /* Near the score's right edge the whole object mirrors: the chip hangs
         off the selection's RIGHT edge and the ▲▼ pair crosses to the left of
         the word, so the pair never leaves the score. */
      .iteration-chip, .follow-playback, .playback-label {
        border: 0;
        border-left: 1px solid var(--line-strong);
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 11px;
        padding: 4px 7px;
        white-space: nowrap;
      }
      .iteration-chip, .follow-playback { cursor: pointer; }
      .iteration-chip.not-performed { color: var(--ink-3); }
      .follow-playback[aria-pressed="true"] { text-decoration: underline; }
      .iteration-chip:focus-visible, .follow-playback:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
      .rung-chip.mirrored {
        flex-direction: row-reverse;
      }

      /* Keyboard elsewhere: follow the enclosure's own inactive fade — the
         chip reads "where you were", not "where your next keystroke lands".
         Hover/focus outranks it below: the chip is still a door to the tray. */
      .rung-chip.inactive {
        opacity: 0.3;
      }

      .rung-chip.fresh,
      .rung-chip:hover,
      .rung-chip:focus-within {
        opacity: 1;
      }

      /* Asked for a rung this document has not got. Full strength so the key
         is visibly heard, and the border carries the refusal rather than the
         word — the word is still true, it just did not change. */
      .rung-chip.refused {
        opacity: 1;
        border-color: var(--danger-fg, var(--line-strong));
      }

      .chip-word {
        padding: 5px 8px;
        border: 0;
        background: none;
        color: var(--ink);
        font: 500 11px/1.2 var(--mono);
        white-space: nowrap;
        cursor: pointer;
      }

      /* Idle, the chip is JUST the word — the ▲▼ pair is drawn only when the
         chip is hovered or holds focus, so a settled score carries one lower-
         case word and nothing else. */
      .chip-mics {
        display: flex;
        flex-direction: column;
        border-left: 1px solid var(--line);
      }

      .rung-chip.mirrored .chip-mics {
        border-left: 0;
        border-right: 1px solid var(--line);
      }

      .rung-chip:not(:hover):not(:focus-within) .chip-mics {
        display: none;
      }

      .mic {
        width: 16px;
        height: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        background: none;
        color: var(--ink-2);
        cursor: pointer;
      }

      .mic + .mic {
        border-top: 1px solid var(--line);
      }

      .mic:hover:not(:disabled),
      .mic:focus-visible:not(:disabled) {
        background: var(--accent);
        color: var(--surface);
      }

      /* The exhausted end GREYS rather than disappearing, so the chip never
         changes width as the ladder is climbed. */
      .mic:disabled {
        opacity: 0.4;
        cursor: default;
      }

      .mic svg {
        display: block;
      }

      /* Hovering either micro button prints where it would take you, on the
         chip's far side — the label is the whole affordance, so nobody has to
         learn what a triangle means. */
      .chip-dest {
        position: absolute;
        top: 0;
        left: calc(100% + 6px);
        padding: 3px 5px;
        background: var(--ink);
        color: var(--surface);
        font: 600 8px/1.2 var(--sans);
        letter-spacing: 0.09em;
        text-transform: uppercase;
        white-space: nowrap;
        pointer-events: none;
      }

      .rung-chip.mirrored .chip-dest {
        left: auto;
        right: calc(100% + 6px);
      }

      @media (prefers-reduced-motion: reduce) {
        .rung-chip {
          transition: none;
        }
      }

      /* THE FIVE-BAND FRAME (roadmap/proposed/workbench-score-panel.md):
         ink border, tab strip, context bar, ONE scrolling body, footer. The
         border is a full rule rather than a hairline because in this system
         alignment and the strength of the dividers do the organising. */
      .panel {
        position: relative;
        border-left: var(--rule-w) solid var(--ink);
        background: var(--surface);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-height: 0;
        min-width: 0;
      }

      .panel-drag {
        position: absolute;
        left: -4px;
        top: 0;
        bottom: 0;
        width: 8px;
        cursor: col-resize;
        z-index: 1;
        touch-action: none;
      }

      .panel-drag:hover,
      .panel-drag:active {
        background: color-mix(in oklab, var(--accent) 25%, transparent);
      }

      /* Band 2. Flush left, and NO WRAP: five tabs at 360px+ fit on one line,
         which is exactly what the seven-to-five cut bought. If a sixth is ever
         added this row is where it shows up first. */
      .panel-tabs {
        display: flex;
        gap: 0;
        padding: 0;
        border-bottom: var(--rule-w) solid var(--ink);
        font-family: var(--sans);
        flex: none;
      }

      .panel-tabs button {
        font: 600 10px/1 var(--sans);
        letter-spacing: 0.11em;
        text-transform: uppercase;
        color: var(--ink-3);
        background: transparent;
        border: none;
        padding: 11px 12px;
        cursor: pointer;
        white-space: nowrap;
      }

      .panel-tabs button:hover[aria-current='false'] {
        color: var(--ink);
        background: var(--bg-context);
      }

      /* The active tab is the accent plus a 2px inset underline — the same
         marker the tray's scope tabs use, so the two panels read as one. */
      .panel-tabs button[aria-current='true'] {
        color: var(--accent-fg);
        box-shadow: inset 0 -2px 0 var(--accent);
      }

      /* Band 3: what you are looking at, pinned so it cannot scroll away. */
      .panel-context,
      .panel-foot {
        flex: none;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: var(--bg-context);
        font-size: 11.5px;
        min-height: 34px;
      }

      .panel-context {
        border-bottom: var(--rule-w) solid var(--ink);
      }

      /* Band 5. */
      .panel-foot {
        border-top: var(--rule-w) solid var(--ink);
      }

      .ctx-name {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ctx-dim {
        color: var(--ink-3);
        font-size: 11px;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ctx-actions {
        margin-left: auto;
        display: flex;
        gap: 4px;
        flex: none;
      }

      .ctx-actions button {
        font: 600 9.5px/1.2 var(--sans);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-2);
        border: 1px solid var(--line);
        background: var(--surface);
        padding: 4px 7px;
        cursor: pointer;
        white-space: nowrap;
      }

      .ctx-actions button:hover:not(:disabled) {
        border-color: var(--accent);
        color: var(--accent-fg);
      }

      .ctx-actions button:disabled {
        color: var(--line-strong);
        border-color: var(--line);
        cursor: not-allowed;
      }

      /* Band 4 — the ONLY scrolling region in the panel. */
      .panel-body {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
        padding: 12px 14px;
      }

      .assist-dim {
        color: var(--ink-3);
      }

      /* The fallback chain's depth, riding on the model name: a count, not a
         list — the list is the title, because a context bar has one line. */
      .assist-chain {
        margin-left: 3px;
        color: var(--ink-3);
      }

      .connect-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 8px 0 12px;
      }

      .connect-cta {
        font: 600 10px/1.2 var(--sans);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent-fg);
        background: var(--surface);
        border: 1px solid var(--accent);
        padding: 7px 10px;
        cursor: pointer;
        white-space: nowrap;
      }

      .connect-cta:disabled {
        color: var(--line-strong);
        border-color: var(--line);
        cursor: not-allowed;
      }

      .paste-key {
        flex: 1;
        min-width: 0;
        font-family: var(--mono);
        font-size: 12px;
        color: var(--ink);
        background: transparent;
        border: 1px solid var(--line);
        padding: 6px 8px;
        outline: none;
      }

      .connect-notice {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-2);
      }

      .chat {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .chat-msg {
        display: grid;
        grid-template-columns: 64px 1fr;
        gap: 8px;
        font-size: 12.5px;
        line-height: 1.45;
      }

      .chat-role {
        font: 600 10px/1.6 var(--sans);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
      }

      .chat-msg.user .chat-role {
        color: var(--accent-fg);
      }

      .chat-text {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      /* The assistant's markdown — compact, the panel's own type. */
      .chat-msg.assistant .chat-text {
        white-space: normal;
      }

      .chat-text p,
      .chat-text ul,
      .chat-text ol,
      .chat-text blockquote,
      .chat-text pre {
        margin: 0 0 8px;
      }

      .chat-text > :last-child {
        margin-bottom: 0;
      }

      .chat-text h1,
      .chat-text h2,
      .chat-text h3 {
        font: 600 12.5px/1.4 var(--sans);
        margin: 10px 0 4px;
      }

      .chat-text ul,
      .chat-text ol {
        padding-left: 18px;
      }

      .chat-text code {
        font-family: var(--mono);
        font-size: 11.5px;
        background: var(--bg-context);
        padding: 1px 4px;
      }

      .chat-text pre {
        background: var(--bg-context);
        border: 1px solid var(--line);
        padding: 8px 10px;
        overflow-x: auto;
        white-space: pre;
      }

      .chat-text pre code {
        background: none;
        padding: 0;
      }

      .chat-text blockquote {
        border-left: 2px solid var(--line-strong);
        padding-left: 10px;
        color: var(--ink-2);
      }

      .chat-text a {
        color: var(--accent-fg);
      }

      /* A table scrolls inside itself — the panel body must not go sideways. */
      .chat-text .md-table {
        overflow-x: auto;
        margin: 0 0 8px;
      }

      .chat-text table {
        border-collapse: collapse;
        font-size: 11.5px;
        white-space: nowrap;
      }

      .chat-text th,
      .chat-text td {
        border: 1px solid var(--line);
        padding: 3px 8px;
        text-align: left;
      }

      .chat-text th {
        font: 600 10px/1.6 var(--sans);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-3);
        background: var(--bg-context);
      }

      .chat-text hr {
        border: none;
        border-top: 1px solid var(--line);
        margin: 8px 0;
      }

      /* The hud tab's footer inverts: the one deliberately dark band in a
         light app, because the panel has to say where editing happens without
         growing a control that would contradict "the HUD explains". */
      .panel-body:has(> mnx-score-hud) ~ .panel-foot {
        background: var(--ink);
        color: var(--surface);
      }

      .hud-handoff {
        font-weight: 500;
      }

      .hud-key {
        margin-left: auto;
        font: 600 10px/1 var(--sans);
        letter-spacing: 0.1em;
        border: 1px solid color-mix(in oklab, var(--surface), transparent 65%);
        padding: 4px 7px;
      }

      /* The description tab's stat strip: four facts, flush left. */
      .facts {
        display: flex;
        gap: 0;
        margin: 14px 0 0;
      }

      .fact {
        flex: 1;
        min-width: 0;
      }

      .fact-k {
        font: 600 9.5px/1 var(--sans);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 4px;
      }

      .fact-v {
        font: 600 13px/1.2 var(--sans);
      }

      /* The 2px rule the design puts between "what this is" and "what the repo
         knows about it" — the seam where the tags tab was folded in. */
      .rule-strong {
        height: var(--rule-w);
        background: var(--ink);
        margin: 16px 0 0;
      }

      .tag-group {
        display: flex;
        align-items: center;
        gap: 7px;
        font: 600 9px/1 var(--sans);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin: 14px 0 7px;
      }

      .tag-count {
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0;
      }

      .idline {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-bottom: 10px;
      }

      .idline .copy {
        font: 600 9px/1 var(--sans);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--accent-fg);
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
      }

      .panel-foot .prompt {
        color: var(--accent-fg);
        font-weight: 600;
        flex: none;
      }

      .tagfilter {
        flex: 1;
        min-width: 0;
        border: none;
        background: transparent;
        font: inherit;
        font-size: 11.5px;
        color: var(--ink);
        outline: none;
      }

      .tagfilter::placeholder {
        color: var(--ink-3);
      }

      /* The ops tab's entry state, moved out of the retired actions tab. */
      .entry-state {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        padding-bottom: 8px;
        margin-bottom: 4px;
        border-bottom: 1px solid var(--line);
      }

      /* The setup popover is a page-level overlay over the score now, not a
         panel tab (workbench-score-panel.md step A). Bottom-LEFT so it cannot
         collide with the tray's bottom-centre docked fallback. */
      .popover-layer {
        position: absolute;
        left: 16px;
        bottom: 16px;
        z-index: 5;
      }

      /* The score frame (roadmap/inprogress/core-score-frame.md) fills the
         pane: its strips sit in flow above and below the score, its focus
         mark on the pane's corner toggles document focus, and the zoom pad
         and settings card hang pinned under the strip's buttons — the corner
         cluster they used to idle in is gone. z-index 4 keeps an open pad
         under the popover layer (5) and the tray (30), as the cluster was. */
      mnx-score-frame {
        position: absolute;
        inset: 0;
        z-index: 4;
      }

      mnx-score-frame > a[slot='back'] {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--ink);
        text-decoration: none;
      }

      /* The ops tab: the op queue as provenance rows — op · intent · key.
         Applied entries above the redo stack (dimmed); current position
         accented. */
      ol.ops {
        list-style: none;
        margin: 0;
        padding: 0;
        font-family: var(--mono);
        font-size: 10.5px;
      }

      ol.ops li {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 2px 10px;
        padding: 6px 8px;
        border-bottom: 1px solid var(--line);
        cursor: pointer;
        color: var(--ink-2);
      }

      /* The three states come from sharedChrome's .row-state primitives, which
         the campaign contract declares and which nothing had adopted until now
         - the ops list, the HUD's active rung and the tray's active tile were
         three spellings of two states. Only the italics are ops-specific. */
      ol.ops li.baseline {
        font-style: italic;
      }

      ol.ops .op-what {
        grid-column: 1;
      }

      ol.ops .op-keys {
        grid-column: 2;
        grid-row: 1;
        color: var(--ink-3);
        white-space: nowrap;
      }

      ol.ops .op-intent {
        grid-column: 1 / -1;
        font-size: 9.5px;
        color: var(--ink-3);
      }

      /* The hud tab: the component owns its rows' padding. */
      .panel-body:has(> mnx-score-hud) {
        padding: 0;
      }

      .panel-body .description {
        font-size: 12.5px;
        color: var(--ink-2);
        line-height: 1.55;
        margin: 0;
        text-wrap: pretty;
      }

      .import-warnings {
        margin: 0;
        padding-left: 18px;
        color: var(--warning-fg, var(--ink-2));
        font-size: 11.5px;
        line-height: 1.45;
      }

      .import-warnings li + li {
        margin-top: 5px;
      }

      .side-cap {
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 8px;
      }

      .ref-pane img {
        display: block;
        max-width: 100%;
        background: var(--paper);
        border-radius: var(--radius-panel);
        box-shadow: var(--shadow);
        padding: 12px;
        box-sizing: border-box;
      }

      .load-state {
        margin: 26px;
      }

      /* The spec-gap exhibit — workbench chrome since the viewer-surface
         eviction (docs/core-viewer-surface.md). Sits on the same paper card
         the score would have, so the page's shape is unchanged. */
      .exhibit {
        padding: 5px;
        background: var(--bg);
        height: 100%;
        overflow: auto;
        box-sizing: border-box;
      }

      .exhibit-panel {
        background: var(--paper);
        color: var(--paper-ink);
        border-radius: var(--radius-panel);
        box-shadow: var(--shadow);
        border: 1px solid oklch(0.85 0.01 85 / 0.6);
        padding: 26px 24px;
        max-width: 760px;
        margin: 0 auto;
      }

      .exhibit-panel h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 10px;
        font-family: var(--sans);
        font-weight: 500;
        font-size: 15px;
      }

      .exhibit-panel .sp-dia {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--accent);
        flex: none;
      }

      .exhibit-panel p {
        margin: 0 0 16px;
        font-size: 12.5px;
        line-height: 1.6;
        color: var(--ink-2);
      }

      .err-table {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .err-row {
        display: grid;
        gap: 2px;
        text-align: left;
        font: inherit;
        background: transparent;
        border: 1px solid var(--line);
        border-radius: var(--radius-input);
        padding: 8px 10px;
        cursor: pointer;
      }

      .err-row:hover {
        border-color: var(--accent);
      }

      .err-row .er-rule {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--accent-fg);
      }

      .err-row .er-msg {
        font-size: 12.5px;
        color: var(--ink);
      }

      .err-row .er-path {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
      }

      .ref-missing,
      .load-state {
        padding: 22px;
        border: 1px dashed var(--line-strong);
        border-radius: var(--radius-panel);
        font-size: 12.5px;
        color: var(--ink-2);
        line-height: 1.55;
      }

      .ref-credit {
        margin: 8px 0 0;
        font-family: var(--mono);
        font-size: 10px;
        color: var(--ink-3);
      }

      .ref-credit a {
        color: inherit;
      }

      .load-state p {
        margin: 8px 0 0;
      }

      .load-state.failed {
        border-style: solid;
        border-color: var(--accent);
      }

      .load-state .detail {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        word-break: break-word;
      }

      /* The json pane (core-json-view.md). A gutter of real DOCUMENT line
         numbers - they stay correct when the view is scoped to a selection or
         filtered by the find box, which is the whole point of showing them. */
      .jsonv {
        font-family: var(--mono);
        font-size: 10.5px;
        line-height: 1.55;
        color: var(--ink-2);
      }

      .jline {
        display: flex;
        gap: 10px;
        white-space: pre;
      }

      .jnum {
        flex: none;
        width: 34px;
        text-align: right;
        color: var(--line-strong);
        user-select: none;
      }

      .jcode {
        min-width: 0;
      }

      /* The pinned validation error, restored: showErrorInJson has set
         errorPointer since the panel consolidation and nothing has read it
         since, so the exhibit's "highlighted in document" has been a promise
         the pane did not keep. */
      .jline.pinned {
        background: var(--row-current);
        box-shadow: inset 2px 0 0 var(--accent);
      }

      /* THREE INKS, and the design means three: keys, numbers, everything
         else. No rainbow. */
      .jk {
        color: var(--ink);
        font-weight: 600;
      }

      .jn {
        color: var(--accent-fg);
      }

      .js,
      .jp {
        color: var(--ink-2);
      }

      .jp {
        color: var(--ink-3);
      }

      /* The scope toggle reads as one control, not two buttons. */
      .jscope {
        margin-left: 0;
      }

      .jscope button[aria-current='true'] {
        background: var(--ink);
        color: var(--surface);
        border-color: var(--ink);
      }

      .missing {
        padding: 40px;
        color: var(--ink-2);
      }
    `
  ];

  private entry(): ScenarioEntry | null {
    const local = this.localDocument;
    if (local && local.id === this.scenarioId) {
      const hasTab = local.document.parts.some(
        part => (part._x?.mnxLab?.strings?.length ?? 0) > 0
      );
      return {
        id: local.id,
        ns: 'lab',
        category: `${local.format} file`,
        meta: {
          title: local.name,
          description: `Opened from ${local.fileName}.`,
          expect: { standard: 'valid', extension: hasTab ? 'valid' : 'n/a' },
          source: local.fileName,
          status: 'valid'
        },
        featureDefs: [],
        specRef: null,
        issueRef: null,
        invalidByDesign: false,
        hasTab,
        loadDocument: async () => local.document,
        loadNotes: null
      };
    }
    return corpus.find(e => e.id === this.scenarioId) ?? null;
  }

  private isLocalDocument(): boolean {
    return this.localDocument?.id === this.scenarioId;
  }

  willUpdate(changed: Map<string, unknown>) {
    if(changed.has('at'))this.routeSeekConsumed=false;
    const sourceChanged = changed.has('scenarioId') || changed.has('localDocument');
    // ?panel=compare|json links (the queue's rows) open the matching panel
    // tab — the main pane keeps the stored score view.
    if (changed.has('panel') || sourceChanged) {
      if (this.panel === 'compare' || this.panel === 'json') this.panelTab = this.panel;
    }
    if (sourceChanged) {
      // A PKCE landing brought us here to show its verdict: the assist tab
      // wins over the route's default exactly once (core-assist-byok.md).
      if (this.landingFocus) {
        this.panelTab = 'assist';
        this.landingFocus = false;
      } else if (this.panel !== 'compare' && this.panel !== 'json') {
        this.panelTab = 'hud';
      }
      this.doc = null;
      this.rawDocument = '';
      this.pinnedErrors = [];
      this.referenceFailed = false;
      this.loadState = 'loading';
      this.loadError = '';
      this.allDefs = false;
      this.defFilter = '';
      this.copiedId = false;
      this.copiedJson = false;
      this.jsonScope = 'whole';
      this.jsonFind = '';
      this.session = null;
      this.renderRoot.querySelector<Player>('mnx-player')?.stop();
      this.performance=null;this.routeSeekConsumed=false;
      this.passDocument = null;
      this.passModel = null;
      this.setPlayback(initialPlaybackState());
      this.copied = false;
      this.showClipboardNotice(null);
      this.trayAnchor = null;
      // Overrides are per-part by INDEX, so carrying them to a different
      // document would misapply them.
      this.partSetups = new Map();
      void this.loadDocument();
    }
    // The rung chip's freshness window: any change to the displayed level —
    // including selection appearing — restarts it. Read here rather than
    // where intents dispatch, so tray commands, clicks and undo all count.
    const chipLevel = this.session && !this.cursorHidden ? this.session.selectionLevel : null;
    if (chipLevel !== this.chipLevel) {
      this.chipLevel = chipLevel;
      clearTimeout(this.chipTimer);
      this.chipFresh = chipLevel !== null;
      if (chipLevel !== null) {
        this.chipTimer = setTimeout(() => (this.chipFresh = false), 1200);
      }
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('playback-state-changed', this.onPlaybackUpdate);
    window.addEventListener('assist-credentials-change', this.onCredentialsChange);
    void this.refreshFingerprint();
    const landing = takeLanding();
    if (landing.kind === 'connected') {
      this.connectNotice = 'connected to OpenRouter';
      this.landingFocus = true;
    } else if (landing.kind === 'failed') {
      this.connectNotice = `connect failed: ${landing.reason}`;
      this.landingFocus = true;
    }
    window.addEventListener('mnx-palette-intent', this.onPaletteIntent);
    window.addEventListener('mnx-palette-action', this.onPaletteAction);
    // A page put back in the document has no binding until a render gives it one.
    this.requestUpdate();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.editor?.dispose();
    this.editor = null;
    this.removeEventListener('playback-state-changed', this.onPlaybackUpdate);
    window.removeEventListener('assist-credentials-change', this.onCredentialsChange);
    this.chatAbort?.abort();
    this.showClipboardNotice(null);
    clearTimeout(this.chipTimer);
    window.removeEventListener('mnx-palette-intent', this.onPaletteIntent);
    window.removeEventListener('mnx-palette-action', this.onPaletteAction);
  }

  /** After every render: keep the editor's binding in step with the session and the viewer on screen, and let it
   *  follow a change of pane once the viewer has taken it. */
  updated(changed: Map<string, unknown>) {
    this.syncBinding();
    if (this.editor && changed.has('view')) void this.boundViewer?.updateComplete.then(() => this.editor?.refresh());
  }

  private async loadDocument() {
    const entry = this.entry();
    if (!entry) return;
    const sourceId = this.scenarioId;
    // Read-and-clear up front: a load that fails, or one the reader navigates
    // away from, must not leave the baton lying around for the NEXT scenario
    // to pick up as though a gesture had brought it there.
    const railRung = this.railRung;
    this.railRung = null;
    try {
      const document = (await entry.loadDocument()) as MnxStructure;
      if (sourceId !== this.scenarioId) return; // navigated away meanwhile
      this.doc = {
        id: entry.id,
        // Host-owned fallback only; the piece's own title, when it states one,
        // travels in the document as `_x.mnxLab.work` and the viewer reads it.
        name: entry.meta.title,
        lastUpdated: 0,
        mnxJson: document
      };
      this.rawDocument = JSON.stringify(document, null, 2);
      if (entry.invalidByDesign) {
        this.pinnedErrors = await resolvePinnedErrors(document, entry.meta.expect.errors ?? []);
      } else {
        this.session = new EditorSession(document, entry.id, {
          ...(railRung ? { level: railRung } : {})
        });
        this.syncFromSession();
      }
      this.loadState = 'ready';
    } catch (e) {
      // The document is a lazy chunk: a dead dev server, an offline reload or a
      // half-deployed build all land here. Surfacing the reason is the whole
      // point — silently leaving the pane blank blames the renderer.
      if (sourceId !== this.scenarioId) return;
      this.loadState = 'failed';
      this.loadError = e instanceof Error ? e.message : String(e);
    }
  }

  /**
   * The editor's mount is the promoted binding (`src/elements/editorHost.ts`,
   * core-editor-element-promotion.md work-list item 5): it hears the keys,
   * holds the half-typed fret, draws the cursor and mounts the rung inspector
   * and the lyric editor. What stays here is the workbench's: WHICH session is
   * in force (`this.session` — a load, a revert and a construct replay each
   * build a new one), the HUD, the ops panel and the chip that read it, the
   * pass model, and the rail.
   *
   * A binding holds one session for its whole life, so this keeps the two in
   * step after every render: a new session, a new viewer element or a new
   * `.main` disposes the binding and binds again. The page already survived a
   * session swap; this is the same swap, stated once.
   */
  private syncBinding() {
    const viewer = this.renderRoot.querySelector<DocumentViewer>('mnx-document-viewer');
    const overlay = this.renderRoot.querySelector<HTMLElement>('.main');
    const session = this.session;
    if (this.editor && (this.editor.session !== session || this.boundViewer !== viewer || this.boundOverlay !== overlay)) {
      this.editor.dispose();
      this.editor = null;
      this.lyricPreviewDoc = null;
    }
    if (this.editor || !session || !viewer || !overlay) return;
    this.boundViewer = viewer;
    this.boundOverlay = overlay;
    this.tracedIntents = session.intentLog.length;
    this.editor = bindEditor(this, viewer, session.doc, {
      session,
      overlay,
      // A workbench reader who has clicked nothing yet is unambiguously addressing the score.
      claimUnfocused: true,
      ...(this.selectionClipboard ? { clipboard: this.selectionClipboard } : {}),
      title: () => this.entry()?.meta.title ?? '',
      onChange: () => this.syncFromSession(),
      onState: () => this.onEditorState(),
      onNotice: notice => this.showClipboardNotice(notice),
      // A rung this document does not present, asked for by name: a dead key with no feedback is what teaches
      // people a shortcut cannot be trusted. Every other refusal is a navigation edge, where silence is right.
      onRefused: intent => { if (intent.type === 'goToLevel') this.flashRungRefusal(); },
      onEscalate: delta => this.escalateToRail(delta),
      // The drawer's clean parses render live on a scratch copy. Stored as the COMPLETE wrapper the viewer
      // binds, built once per diff — minting it in render() gave the viewer a fresh identity every pass, and
      // relayout → render-scale → state → render is a loop.
      onPreview: preview => { this.lyricPreviewDoc = preview && this.doc ? { ...this.doc, mnxJson: preview } : null; },
      inspector: {
        extend: view => this.withIterationWord(view),
        apply: (word, text) => this.applyIterationLine(word, text)
      }
    });
    // The binding's first draw ran before `this.editor` was assigned, so the chip has not seen it yet.
    this.requestUpdate();
  }

  /** The cursor, the history or the keyboard's owner moved: everything here that reads the session redraws. */
  private onEditorState() {
    const traced = this.session?.intentLog.length ?? 0;
    // A copied trace is stale the moment the trace grows.
    if (traced !== this.tracedIntents) { this.tracedIntents = traced; this.copied = false; }
    this.requestUpdate();
  }

  /** Pull the document out of the session after it changed. */
  private syncFromSession() {
    const session = this.session;
    if (!session || !this.doc) return;
    this.refreshPassModel(session.doc);
    this.doc = { ...this.doc, mnxJson: session.doc };
    this.rawDocument = JSON.stringify(session.doc, null, 2);
  }

  /** A NEW session is in force — a revert, a construct replay. `updated()` rebinds the editor to it. */
  private adoptSession(session: EditorSession) {
    this.session = session;
    this.copied = false;
    this.syncFromSession();
  }

  /** Esc hides the cursor highlight until the next intent (review sense-0). The binding's, read here. */
  private get cursorHidden(): boolean {
    return this.editor?.cursorHidden ?? false;
  }

  /** Does the editor own the keyboard right now (core-editor-focus-scope.md stage 3)? The binding's predicate —
   *  the SAME one its key handler gates on. True before it binds: unclaimed focus counts as ours. */
  private get hasKeyboard(): boolean {
    return this.editor?.hasKeyboard ?? true;
  }

  /** A click on a note seeks playback to it. Which rendering owns subsequent
   * spatial input — the click's other meaning in the combined score — is the
   * binding's, because it is the session's projection. */
  /** A click on empty space seeks to that bar (core-editor-pointer-placement.md).
   *  Ink is `onNoteSelected`'s, above, so the two never race for one click. */
  private onPositionSelected = (
    event: CustomEvent<{ measureIndex?: number; noteKey?: string; columnKey?: string }>
  ) => {
    const { measureIndex, noteKey, columnKey } = event.detail ?? {};
    if (noteKey !== undefined || measureIndex === undefined || !this.passModel) return;
    const { ordinals } = resolveIteration(this.passModel, measureIndex, activeIteration(this.playback));
    const candidates = ordinals.length > 0
      ? ordinals
      : this.passModel.entries.filter(entry => entry.measureIndex === measureIndex).map(entry => entry.ordinal);
    const ordinal = chooseOrdinal(candidates, this.playback.ordinal, { explicitSeek: true });
    if (ordinal === null) return;
    // The drawn moment the press was nearest to — a rest, or a neighbour's
    // notehead on the same beat. The edit cursor lands on that same column, so
    // the two arrive together instead of at the beat and the barline.
    const beat = columnKey === undefined
      ? null
      : beatOfKey(this.performance, this.doc?.mnxJson, columnKey, ordinal);
    this.renderRoot.querySelector<Player>('mnx-player')?.seek(ordinal, beat ?? undefined);
  };

  private onNoteSelected = (
    event: CustomEvent<{ projection?: 'notation' | 'tab'; noteId?: string; ordinal?: number }>
  ) => {
    const key=event.detail.noteId;
    if(key && this.performance){
      const candidates=this.performance.written.filter(w=>w.noteKey===key).map(w=>w.ordinal);
      const ordinal=event.detail.ordinal ?? chooseOrdinal(candidates,this.playback.ordinal,{explicitSeek:true,cycle:this.clickedPlaybackKey===key});
      this.clickedPlaybackKey=key;
      // The note's OWN beat, not its bar's first.
      if(ordinal!==null){
        const beat = beatOfKey(this.performance, this.doc?.mnxJson, key, ordinal);
        this.renderRoot.querySelector<Player>('mnx-player')?.seek(ordinal, beat ?? undefined);
      }
    }
  };

  /**
   * The score rung's vertical neighbour: the prev/next scenario in the RAIL's
   * order (topic groups — src/corpus/groups.ts), because the rail is the
   * collection the reader can see. Stops at both ends, like every other rung's
   * arrows. The unfiltered order is deliberate: the rail's search box is the
   * shell's state, and a gesture that skipped differently depending on a filter
   * in another component would be unpredictable from here.
   */
  private escalateToRail(delta: 1 | -1): void {
    const ordered = [...groupScenarios(corpus, e => e.id).values()].flat();
    const at = ordered.findIndex(e => e.id === this.scenarioId);
    const next = at < 0 ? undefined : ordered[at + delta];
    if (!next) return; // both ends stop, like every other rung's arrows
    // THE RUNG SURVIVES THE STEP, so ↑/↓ is repeatable and this is a walk
    // rather than a one-shot. Set only on a step that really happens: at the
    // end of the collection nothing moves, so nothing should be carried.
    this.railRung = this.session?.selectionLevel ?? null;
    location.hash = scenarioHref(next.id);
  }

  /** Palette items act on the editor through the same funnels as keys: the
   *  intent channel feeds the session (recorded in traces), the action
   *  channel drives page chrome (copy trace, revert, the lyric editor). */
  private onPaletteIntent = (event: Event) => {
    // The palette took over (a global command ran from go-to's `>` list):
    // two overlays wanting the same keys is one too many.
    this.editor?.closeSurfaces();
    this.stripIntent((event as CustomEvent<EditorIntent>).detail);
  };

  private onPaletteAction = (event: Event) => {
    const action = (event as CustomEvent<string>).detail;
    if (action === 'copyTrace') void this.copyTrace();
    else if (action === 'revert') this.revertEdits();
    else if (action === 'lyricTextEditor') this.editor?.openLyrics();
  };

  // ── The rung chip's anchor ─────────────────────────────────────────────────

  /** The viewer's enclosure rect (viewport coords) → `.main` coords. */
  private mainHeight = 0;
  private mainWidth = 0;
  private onSelectionAnchored = (event: Event) => {
    const rect = (event as CustomEvent<{ rect: DOMRect | null }>).detail.rect;
    const main = this.renderRoot.querySelector('.main');
    if (!rect || !main) {
      this.trayAnchor = null;
      return;
    }
    const box = main.getBoundingClientRect();
    this.mainHeight = box.height;
    this.mainWidth = box.width;
    this.trayAnchor = {
      x: rect.left - box.left,
      y: rect.top - box.top,
      width: rect.width,
      height: rect.height
    };
  };

  // ── The inspector's one workbench word ─────────────────────────────────────

  /** `iteration` addresses the PASS MODEL, not the document — inspection is a
   *  preference of this page — so it is the host's word, offered to the
   *  binding's inspector beside the editor's own. */
  private withIterationWord(view: InspectorView): InspectorView {
    if (!this.session || !this.passModel || !hasRepeatStructure(this.session.doc)) return view;
    const iterations = [...new Set(this.passModel.availableIterations.flat())];
    return { ...view, words: [...view.words, { word: 'iteration', hint: 'inspection iteration (does not seek)', values: iterations.map(String) }] };
  }

  /** Undefined: not this page's line. Null: taken. Otherwise the sentence that says why not. */
  private applyIterationLine(word: string | null, text: string): string | null | undefined {
    const command = word === 'iteration' ? `iteration ${text}` : text.trim();
    if (!/^iteration\b/i.test(command)) return undefined;
    const match = /^iteration\s+([1-9]\d*)$/i.exec(command);
    const iteration = match ? Number(match[1]) : NaN;
    if (!this.session || !hasRepeatStructure(this.session.doc) || !Number.isSafeInteger(iteration)
        || !this.passModel?.availableIterations.some(available => available.includes(iteration))) {
      return 'Use iteration N with an iteration declared in this document.';
    }
    this.chooseInspection(iteration);
    return null;
  }

  /**
   * Which edge does the whole object hang from? The spec's rule, in its own
   * order: prefer left-anchored, and mirror only when the tray's right edge
   * would pass the score's right edge minus a margin — and only when there is
   * actually room to the left, since mirroring into a clamp would move the
   * word for nothing. The CHIP asks this every render (closed, it is free to
   * follow the selection); the TRAY is handed the answer once, at open.
   */
  private mirrorAt(anchor: OverlayAnchor): boolean {
    return mirrorOverlayAt(anchor, this.mainWidth);
  }

  /**
   * The ladder either side of the current rung, presence-filtered. `up`
   * climbs (wider), `down` descends (narrower); either may be absent at the
   * ends, which is what greys a micro button rather than removing it. The
   * rows come from `buildHudRows` so the chip, the HUD and the tray's own
   * ladder cannot disagree about which rungs exist or what they are called —
   * and they arrive widest-first, so climbing is a step TOWARDS index 0, the
   * same direction it is in the HUD and in the tray's drawn column.
   */
  private chipNeighbours(entry: ScenarioEntry): { up: string | null; down: string | null } {
    if (!this.session || !this.chipLevel) return { up: null, down: null };
    const ladder = buildHudRows(entry.meta.title, this.session, this.cursorHidden);
    const at = ladder.findIndex(row => row.key === ROW_BY_LEVEL[this.chipLevel!]);
    if (at < 0) return { up: null, down: null };
    return { up: ladder[at - 1]?.key ?? null, down: ladder[at + 1]?.key ?? null };
  }

  /**
   * The rung chip (workbench-rung-legibility.md, given its ▲▼ pair by
   * workbench-selection-chip-ladder.md): the selection's level named at the
   * gaze point, and the tray's COLLAPSED HANDLE — it sits one tray-gap below
   * the selection's leading edge, exactly where the ladder's current rung will
   * land, and clicking the word is the `/` key. It flips above by the tray's
   * own room-below test (a conservative height estimate; the tray measures
   * itself live, so the two can disagree only in a band a few pixels tall) so
   * the chip is always on the side the tray has space to expand, and mirrors
   * left/right by the same rule the tray will use.
   *
   * The ▲▼ pair is the ladder itself, collapsed to two keys: climbing with ▲
   * and clicking `voice` in the open tray are the same act, so they walk
   * through the same `walkToLevel`. Drawn only on hover or focus — idle, the
   * chip is one lowercase word. The word is ROW_BY_LEVEL's — the HUD's own
   * vocabulary. Hidden while the tray is open: the chip has expanded into it.
   * With no anchor (deselected, or nothing rendered) there is nothing to plant
   * on.
   */
  private rungChip(entry: ScenarioEntry) {
    if (!this.chipLevel || !this.trayAnchor) return nothing;
    const trayEstimate = OVERLAY_SHAFT_H + 200; // the tray's own fallback height
    const anchor = this.trayAnchor;
    const below = anchor.y + anchor.height + OVERLAY_EDGE_GAP;
    const flip =
      this.mainHeight > 0 &&
      below + trayEstimate > this.mainHeight &&
      anchor.y - trayEstimate > 0;
    const top = flip ? anchor.y - OVERLAY_EDGE_GAP : below;
    const mirrored = this.mirrorAt(anchor);
    const { up, down } = this.chipNeighbours(entry);

    // Right-anchored, the chip's own width is unknown until it paints, so it
    // is positioned by its RIGHT edge rather than measured and subtracted.
    const across = mirrored
      ? `right:${Math.max(6, this.mainWidth - (anchor.x + anchor.width))}px;`
      : `left:${Math.max(6, anchor.x)}px;`;
    const cls =
      `rung-chip${this.chipFresh ? ' fresh' : ''}${this.rungRefused ? ' refused' : ''}` +
      `${this.hasKeyboard ? '' : ' inactive'}${mirrored ? ' mirrored' : ''}`;

    const mic = (dir: 'up' | 'down', key: string | null) => html`<button
      class="mic"
      ?disabled=${key === null}
      title=${key ? `${dir === 'up' ? 'widen' : 'narrow'} to ${key}` : ''}
      aria-label=${key ? `${dir === 'up' ? 'widen' : 'narrow'} to ${key}` : ''}
      @click=${() => key && this.walkToLevel(LEVEL_BY_ROW[key])}
      @mouseenter=${() => key && (this.chipDest = { dir, label: key })}
      @focus=${() => key && (this.chipDest = { dir, label: key })}
      @mouseleave=${() => (this.chipDest = null)}
      @blur=${() => (this.chipDest = null)}
    >
      ${dir === 'up'
        ? html`<svg width="7" height="5" viewBox="0 0 7 5">
            <path d="M3.5 0 7 5H0z" fill="currentColor"></path>
          </svg>`
        : html`<svg width="7" height="5" viewBox="0 0 7 5">
            <path d="M3.5 5 0 0h7z" fill="currentColor"></path>
          </svg>`}
    </button>`;

    return html`<div
      class=${cls}
      style="${across}top:${Math.max(2, top)}px;${flip ? 'transform:translateY(-100%);' : ''}"
    >
      <button
        class="chip-word"
        title="inspect this rung (Enter)"
        aria-live="polite"
        @click=${() => this.editor?.openInspector()}
      >
        ${ROW_BY_LEVEL[this.chipLevel]}
      </button>
      <div class="chip-mics">${mic('up', up)}${mic('down', down)}</div>
      ${this.iterationChip()}
      ${this.chipDest
        ? html`<span class="chip-dest"
            >${this.chipDest.dir === 'up' ? '▲' : '▼'} ${this.chipDest.label}</span
          >`
        : nothing}
    </div>`;
  }

  private iterationChip() {
    if (!this.session || !this.passModel || !hasRepeatStructure(this.session.doc)) return nothing;
    const measure = this.session.cursor.measureIndex;
    const iteration = this.playback.inspectionIteration;
    const available = this.passModel.availableIterations[measure] ?? [1];
    const { performed } = resolveIteration(this.passModel, measure, iteration);
    return html`
      <button class="iteration-chip ${performed ? '' : 'not-performed'}"
        aria-label=${`Inspection iteration ${iteration}${performed ? '' : ', not performed'}. Click to cycle.`}
        title="Inspection iteration; change here or type iteration N in the inspector"
        @click=${() => this.chooseInspection(nextInspectionIteration(this.passModel!, measure, iteration))}>
        iteration ${iteration}${available.includes(iteration) ? ` of ${available.length}` : ''}${performed ? '' : ' · not performed'}
      </button>
      ${this.playback.ordinal !== null ? html`<span class="playback-label">playback iteration ${this.playback.playbackIteration}</span>` : nothing}
      <button class="follow-playback" aria-pressed=${this.playback.followPlayback}
        title="Follow live playback for verse and scrolling; keep inspection iteration"
        @click=${() => this.setPlayback(followPlayback(this.playback))}>Follow</button>`;
  }

  /** A HUD row click moves the selection to that row's level by walking
   *  relax/tighten intents — clicks go through the same funnel as keys, so
   *  traces replay them. Bounded: every step must actually move (the
   *  presence rule may stop the walk short of an absent rung). */
  private onHudRow = (event: Event) => {
    const key = (event as CustomEvent<{ key: string }>).detail.key;
    this.walkToLevel(LEVEL_BY_ROW[key]);
  };

  /**
   * Move the selection to a rung by NAME. The ladder grew a `goToLevel` verb
   * in core-rung-addressing.md, because Shift+1..8 addresses a rung directly
   * and a walk cannot honestly express that — see the body.
   *
   * The one funnel for every absolute rung move: the HUD's rows, the tray's
   * scope commit, the chip's ▲▼ and the digit keys. All four are recorded in
   * the trace as the one ladder move they are.
   */
  private walkToLevel(target: SelectionLevel | undefined) {
    if (!target) return;
    // One intent, not a walk. The loop this replaced stepped relax/tighten
    // until a step failed to move, which PARKED on the nearest reachable rung
    // when the target was absent — tolerable while every caller was stepping
    // anyway, a lie once Shift+3 claims to address `container` directly. The
    // session owns the presence rule now and refuses; a refusal flashes the
    // chip, because a dead key with no feedback is what teaches people a
    // shortcut cannot be trusted. The trace gets one jump per gesture.
    // The binding reports the refusal (`onRefused`), which is where the flash is wired — so the digit keys,
    // which never pass through here, flash identically.
    this.editor?.handleIntent({ type: 'goToLevel', level: target });
  }

  /** A rung this document does not present, asked for by name. */
  private flashRungRefusal() {
    this.rungRefused = true;
    window.clearTimeout(this.rungRefusalTimer);
    this.rungRefusalTimer = window.setTimeout(() => {
      this.rungRefused = false;
    }, RUNG_REFUSAL_MS);
  }

  private onHudPartSetup = (event: Event) => {
    const detail = (event as CustomEvent<{ index: number } & PartOverride>).detail;
    this.setPartOverride(detail.index, { instrument: detail.instrument, capo: detail.capo });
  };

  /** Button-driven intents go through the same funnel as keys, so they are
   *  recorded in the trace too — a recording must replay clicks as well. */
  private stripIntent(intent: EditorIntent) {
    this.editor?.handleIntent(intent);
  }

  private async copyTrace() {
    if (!this.session) return;
    this.editor?.refresh(); // a half-typed fret belongs in the trace it is about to become
    await navigator.clipboard.writeText(JSON.stringify(this.session.trace(), null, 2) + '\n');
    this.copied = true;
  }

  /** What the binding's clipboard verbs and its delete did. Every outcome —
   *  success or precise refusal — becomes the transient notice; a refusal must
   *  be SAID, or the keystroke reads as broken rather than conservative. */
  private showClipboardNotice(notice: ClipboardNotice | null) {
    clearTimeout(this.clipboardNoticeTimer);
    this.clipboardNotice = notice;
    if (notice) {
      this.clipboardNoticeTimer = setTimeout(() => {
        this.clipboardNotice = null;
      }, 5000);
    }
  }

  /** The id is the thing you paste into a `/verify` sentence or a commit
   *  message, so it gets a copy button rather than a careful double-click. */
  private async copyId(id: string) {
    await navigator.clipboard.writeText(id);
    this.copiedId = true;
  }

  private revertEdits() {
    if (!this.session) return;
    this.adoptSession(new EditorSession(this.session.initial, this.scenarioId));
  }

  // Tab/both exist only when the strings are KNOWN — declared by the document
  // or supplied through the instrument selector (the viewer override,
  // presentation-only). No instrument is ever assumed
  // (roadmap/complete/core-derived-positions.md): a document without strings has
  // no fingerboard until the user names one.
  private docDeclaresStrings(): boolean {
    return (this.doc?.mnxJson.parts ?? []).some(
      p => (p._x?.mnxLab?.strings?.length ?? 0) > 0
    );
  }

  private partOverride(index: number): PartOverride {
    return this.partSetups.get(index) ?? { instrument: 'document', capo: null };
  }

  private setPartOverride(index: number, patch: Partial<PartOverride>) {
    const next = new Map(this.partSetups);
    next.set(index, { ...this.partOverride(index), ...patch });
    this.partSetups = next;
  }

  /** The viewer's per-part override map, keyed by part index (the workbench
   *  owns the keys, so index is enough — presentation-only state). */
  private partTabSetups(): Record<string, TabSetup> | null {
    if (this.partSetups.size === 0) return null;
    const out: Record<string, TabSetup> = {};
    for (const [index, override] of this.partSetups) {
      const strings =
        override.instrument === 'document' ? null : parseTuning(override.instrument);
      const setup: TabSetup = {
        ...(strings ? { strings } : {}),
        ...(override.capo !== null ? { capo: override.capo } : {})
      };
      // An explicit per-part entry is the ask to SEE that part's fingerboard
      // — the document may never have opted the part into tab.
      if (Object.keys(setup).length > 0) out[String(index)] = { ...setup, staffKind: 'both' };
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  private overrideProvidesStrings(): boolean {
    return [...this.partSetups.values()].some(
      override => override.instrument !== 'document' && parseTuning(override.instrument) !== null
    );
  }

  private tabCapable(): boolean {
    return this.docDeclaresStrings() || this.overrideProvidesStrings();
  }

  private availableViews(): ViewMode[] {
    return this.tabCapable() ? ['notation', 'tab', 'both'] : ['notation'];
  }

  private activeView(_entry: ScenarioEntry): ViewMode {
    const allowed = this.availableViews();
    if (allowed.includes(this.view as ViewMode)) return this.view as ViewMode;
    // Unset (or unavailable for this document) view: the document's own
    // hint. The stored preference is left alone for the next document.
    return this.defaultView();
  }

  /** The document's preferred view when no view is stored: its `staffKind`
   *  hint when tab is possible, else notation. */
  private defaultView(): ViewMode {
    if (!this.tabCapable()) return 'notation';
    const kinds = (this.doc?.mnxJson.parts ?? []).map(p => p._x?.mnxLab?.tab?.staffKind);
    if (kinds.includes('both')) return 'both';
    if (kinds.includes('tab')) return 'tab';
    return 'notation';
  }

  private viewer(entry: ScenarioEntry, viewMode: ViewMode) {
    if (this.loadState === 'loading') {
      return html`<div class="load-state">Loading ${entry.id}…</div>`;
    }
    if (this.loadState === 'failed') {
      return html`<div class="load-state failed">
        <strong>Could not load this document.</strong>
        ${this.isLocalDocument()
          ? html`<p>The selected file could not be prepared for the workbench.</p>`
          : html`<p>
              <code>document.mnx.json</code> is fetched as a lazy chunk, so this is a transport
              failure, not a rendering one — most often a stopped <code>npm run dev</code> server
              or a stale tab against a redeployed build. Reload once the server is back.
            </p>`}
        <p class="detail">${this.loadError}</p>
      </div>`;
    }
    // The spec-gap exhibit is WORKBENCH chrome, not the viewer's job
    // (docs/core-viewer-surface.md, stage 3): the document is the exhibit and
    // rendering is deliberately skipped, so the score element is not involved
    // at all. It used to ride on the element as three props an embed could
    // never want.
    if (entry.invalidByDesign) return this.exhibit();

    // While the lyric drawer previews, the viewer draws the scratch document
    // — the committed one is untouched underneath and returns on close. The
    // wrapper's identity is stable per diff (see lyricPreviewDoc), so the
    // viewer relayouts only when the preview actually changes.
    const shownDoc = this.lyricPreviewDoc ?? this.doc;
    return html`
      <mnx-document-viewer
        .lyrics=${this.displayPreferences.lyrics}
        .timeSignatures=${this.displayPreferences.timeSignatures}
        .clefs=${this.displayPreferences.clefs}
        .scoreTitle=${this.displayPreferences.title}
        .barNumbers=${this.displayPreferences.barNumbers}
        .instrumentNames=${this.displayPreferences.instrumentNames}
        .beams=${this.displayPreferences.beams}
        .selectedVerse=${shownDoc ? verseForIteration(documentLyricLineIds(shownDoc.mnxJson), this.playback) : undefined}
        .mnxDoc=${shownDoc}
        .view=${viewMode}
        .unrolled=${this.unrolled}
        .zoom=${this.staffSp}
        .densityH=${this.densityH}
        .spacingMode=${this.spacingMode}
        .partTabSetups=${this.partTabSetups()}
        @note-selected=${this.onNoteSelected}
        @position-selected=${this.onPositionSelected}
        @selection-anchored=${this.onSelectionAnchored}
        @render-scale=${this.onRenderScale}
        @zoom-change=${this.onZoomChange}
        @transport-toggle=${() =>
          this.renderRoot.querySelector<Player>('mnx-player')?.toggle()}
      ></mnx-document-viewer>
    `;
  }

  private onRenderScale(event: CustomEvent<RenderScale>) {
    this.effectiveStaffSp = event.detail.staffSp;
  }

  /** Which spacing values actually change the score the viewer just drew — the
   *  pad walks these instead of stepping a flat percentage through values the
   *  justifier absorbs. Asked live rather than pushed: it moves with the
   *  viewport, and the viewer caches it per paint. */
  private densitySteps = () =>
    this.renderRoot?.querySelector<DocumentViewer>('mnx-document-viewer')?.densitySteps() ?? null;

  private onZoomChange(event: CustomEvent<ZoomPadChange>) {
    const { staffSp, densityH } = event.detail;
    this.staffSp = staffSp;
    this.densityH = densityH;
    // Null restores the product default on the next load; numeric choices are
    // persisted exactly as requested.
    if (staffSp === null) localStorage.removeItem(STAFF_SP_KEY);
    else localStorage.setItem(STAFF_SP_KEY, String(staffSp));
    if (densityH === null) localStorage.removeItem(SPACE_SP_KEY);
    else localStorage.setItem(SPACE_SP_KEY, String(densityH));
  }

  /** The invalid-by-design exhibit: pinned schema errors, each row locating
   *  its offending value in the document pane. */
  private exhibit() {
    return html`
      <div class="exhibit">
        <div class="exhibit-panel">
          <h3><span class="sp-dia"></span>Invalid by design — a spec-gap exhibit</h3>
          <p>
            This document is deliberately rejected by the official MNX schema. The validation
            errors below are pinned: if a schema bump makes this document start passing, the
            corpus tests flag it as a spec-evolution signal. Rendering is skipped — the document
            itself is the exhibit.
          </p>
          <div class="err-table">
            ${this.pinnedErrors.map(
              err => html`
                <button
                  class="err-row"
                  title="Click to locate the offending value in the document"
                  @click=${() => this.showErrorInJson(err)}
                >
                  <span class="er-rule"
                    >${err.rule}${this.errorPointer === err.pointer
                      ? ' · highlighted in document →'
                      : ''}</span
                  >
                  <span class="er-msg">${err.msg}</span>
                  ${err.path ? html`<span class="er-path">${err.path}</span>` : nothing}
                </button>
              `
            )}
          </div>
        </div>
      </div>
    `;
  }

  /** An exhibit row was clicked: pin it and open the json tab, where the
   *  pointer highlights the offending value. Formerly an element event. */
  private showErrorInJson(err: PinnedError) {
    this.errorPointer = err.pointer;
    this.panelTab = 'json';
  }

  render() {
    const entry = this.entry();
    if (!entry) {
      return html`<div class="missing">No scenario with id “${this.scenarioId}”.</div>`;
    }
    const view = this.activeView(entry);
    const views = this.availableViews();

    return html`
      <div
        class="body"
        style="grid-template-columns: 1fr ${
          this.documentFocus || this.panelHidden ? 0 : this.panelWidth
        }px"
      >
        <div class="main">
          <mnx-score-frame
            .heading=${entry.id}
            .subheading=${this.isLocalDocument() ? 'local document' : `${entry.ns} · ${entry.meta.status}`}
            .view=${view}
            .views=${views}
            .display=${this.displayPreferences}
            .unrolled=${this.unrolled}
            .staffSp=${this.staffSp}
            .densityH=${this.densityH}
            .spacingMode=${this.spacingMode}
            .densitySteps=${this.densitySteps}
            .effectiveStaffSp=${this.effectiveStaffSp}
            .focused=${this.documentFocus}
            focus-shortcut="Ctrl+Alt+F"
            .pads=${this.loadState === 'ready' && !entry.invalidByDesign}
            @focus-change=${() => this.dispatchEvent(new CustomEvent('document-focus-request', { bubbles: true, composed: true }))}
            @zoom-change=${this.onZoomChange}
            @spacing-mode-change=${(event: CustomEvent<'natural' | 'fill'>) => {
              this.spacingMode = event.detail;
              localStorage.setItem(SPACING_MODE_KEY, this.spacingMode);
            }}
            @display-change=${(event: CustomEvent<DisplayOptions>) => {
              this.displayPreferences = writeDisplayPreferences(event.detail);
            }}
          >
            <a slot="back" href="#/">← Queue</a>
            ${this.viewer(entry, view)}
            <mnx-player slot="player" .performance=${this.performance} .document=${this.session?.doc}
              .documentId=${this.scenarioId} .initialOrdinal=${this.routeSeekConsumed?null:this.at}
              @seek=${()=>{this.routeSeekConsumed=true;}}></mnx-player>
          </mnx-score-frame>
          ${this.modelPickerOpen
            ? html`<mnx-model-picker
                .currentModel=${this.assistModel}
                @picker-close=${() => (this.modelPickerOpen = false)}
                @model-pick=${this.onModelPick}
              ></mnx-model-picker>`
            : nothing}
          ${this.clipboardNotice
            ? html`<div
                class="clipboard-notice${this.clipboardNotice.ok ? '' : ' refused'}"
                role="status"
              >
                ${this.clipboardNotice.message}
              </div>`
            : nothing}
          ${this.rungChip(entry)}
        </div>
        ${this.documentFocus || this.panelHidden ? nothing : this.sidePanel(entry)}
      </div>
    `;
  }

  // ---- The side panel (roadmap/inprogress/core-score-hud.md): the page's
  // chrome, one tab each — description, tags (badges + defs), actions (the
  // former edit strip), the HUD, the spec reference, the raw JSON.

  private panelTabs(): PanelTab[] {
    const tabs: PanelTab[] = ['description'];
    if (this.session) tabs.push('ops', 'hud');
    tabs.push('assist');
    if (!this.isLocalDocument()) tabs.push('compare');
    tabs.push('json');
    return tabs;
  }

  /** THE FIVE-BAND FRAME (roadmap/proposed/workbench-score-panel.md).
   *
   *  Every tab is the same five bands: the panel's ink border, the tab strip, a
   *  CONTEXT BAR naming what you are looking at, exactly ONE scrolling body,
   *  and a footer carrying search or status. Only the body scrolls.
   *
   *  It is a helper rather than a convention because "only the body scrolls"
   *  and "the answer to *what am I looking at* stays put" are properties the
   *  panel should own. Before this, four of the tabs opened with an improvised
   *  header inside the scroll area, so the heading scrolled away exactly when a
   *  long document made it useful. */
  private panelFrame(parts: { context?: unknown; body: unknown; footer?: unknown }) {
    return html`
      ${parts.context ? html`<div class="panel-context">${parts.context}</div>` : nothing}
      <div class="panel-body">${parts.body}</div>
      ${parts.footer ? html`<div class="panel-foot">${parts.footer}</div>` : nothing}
    `;
  }

  private sidePanel(entry: ScenarioEntry) {
    const tabs = this.panelTabs();
    const tab = tabs.includes(this.panelTab) ? this.panelTab : 'description';
    return html`
      <aside class="panel">
        <div
          class="panel-drag"
          title="drag to resize"
          @pointerdown=${this.onPanelDrag}
        ></div>
        ${this.performanceError?html`<p role="alert">${this.performanceError}</p>`:nothing}
        <div class="panel-tabs">
          ${tabs.map(
            t => html`
              <button aria-current=${t === tab} @click=${() => (this.panelTab = t)}>${t}</button>
            `
          )}
        </div>
        ${tab === 'description'
          ? this.panelDescription(entry)
          : tab === 'ops'
            ? this.panelOps()
            : tab === 'hud'
              ? this.hud(entry)
              : tab === 'assist'
                ? this.panelAssist()
                : tab === 'compare'
                  ? this.panelCompare(entry)
                  : this.panelJson()}
      </aside>
    `;
  }

  /** The assist tab — the picker surface of core-assist-model-selector.md
   *  plus the BYOK connect flow of core-assist-byok.md, incubating in the
   *  shell. The context bar is the CTA pair: the current model and the
   *  switch that opens the query dialog, then the connection. The body is a
   *  plain chat against OpenRouter, browser-direct and tool-less — the
   *  connectivity probe the edit loop will later ride; the real prompt
   *  surface remains core-editor-ai-prompt.md's. */
  private panelAssist() {
    const connected = this.apiKey !== null;
    const fellBack = this.servedModel !== '' && this.servedModel !== this.assistModel;
    return this.panelFrame({
      context: html`<span class="ctx-name">assistant</span>
        <span
          class="ctx-dim"
          title=${this.assistFallbacks.length
            ? `${this.assistModel}\nthen: ${this.assistFallbacks.join(', ')}`
            : this.assistModel}
          >${modelDisplayName(this.assistModel)}${this.assistFallbacks.length
            ? html`<span class="assist-chain" title="ordered fallbacks"
                >+${this.assistFallbacks.length}</span
              >`
            : nothing}</span
        >
        ${fellBack
          ? html`<span class="ctx-dim" title=${this.servedModel}
              >served by ${modelDisplayName(this.servedModel)}</span
            >`
          : nothing}
        <span class="ctx-actions">
          <button title="switch model" @click=${() => (this.modelPickerOpen = true)}>model</button>
          ${this.chat.length
            ? html`<button title="clear the conversation" @click=${() => this.clearChat()}>clear</button>`
            : nothing}
          ${connected
            ? html`<button title=${`forget key ${this.keyFingerprint}`} @click=${() => this.disconnect()}>
                forget
              </button>`
            : nothing}
        </span>`,
      body: connected ? this.assistChat() : this.assistConnect(),
      footer: html`<span class="prompt">&gt;</span>
        <input
          class="tagfilter"
          ?disabled=${!connected || this.chatBusy}
          placeholder=${connected ? 'say something to the model…' : 'connect OpenRouter to chat'}
          .value=${this.chatDraft}
          @input=${(e: Event) => (this.chatDraft = (e.target as HTMLInputElement).value)}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void this.sendChat();
            }
          }}
        />`
    });
  }

  private assistConnect() {
    return html`
      <h1>Connect OpenRouter</h1>
      <p>
        Bring your own key — it stays in this browser and calls go straight to
        OpenRouter; nothing transits this site's server.
      </p>
      <div class="connect-row">
        <button class="connect-cta" @click=${() => void beginPkce()}>connect with OpenRouter</button>
        <span class="assist-dim">you approve once; OpenRouter issues a key just for this app</span>
      </div>
      <div class="rule-strong"></div>
      <p class="assist-dim">Or paste a key you made yourself (with its own spend limit):</p>
      <div class="connect-row">
        <input
          class="paste-key"
          type="password"
          placeholder="sk-or-v1-…"
          .value=${this.pasteDraft}
          @input=${(e: Event) => (this.pasteDraft = (e.target as HTMLInputElement).value)}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter') void this.pasteKey();
          }}
        />
        <button class="connect-cta" ?disabled=${!this.pasteDraft.trim()} @click=${() => void this.pasteKey()}>
          use key
        </button>
      </div>
      ${this.connectNotice ? html`<p class="connect-notice">${this.connectNotice}</p>` : nothing}
    `;
  }

  private assistChat() {
    return html`
      ${this.connectNotice ? html`<p class="connect-notice">${this.connectNotice}</p>` : nothing}
      ${this.chat.length === 0
        ? html`<p class="assist-dim">
            Connected. This is a plain chat — no tools, no document access yet —
            to prove the browser-direct path. Type below.
          </p>`
        : nothing}
      <div class="chat">
        ${this.chat.map(
          m => html`<div class="chat-msg ${m.role}">
            <span class="chat-role">${m.role}</span>
            <div class="chat-text">${m.role === 'assistant'
                ? m.content
                  ? renderMarkdown(m.content)
                  : this.chatBusy
                    ? '…'
                    : ''
                : m.content}</div>
          </div>`
        )}
      </div>
    `;
  }

  private onModelPick(event: CustomEvent<{ id: string; fallbacks?: string[] }>) {
    this.assistModel = event.detail.id;
    this.assistFallbacks = event.detail.fallbacks ?? [];
    this.servedModel = '';
    try {
      localStorage.setItem(ASSIST_MODEL_KEY, this.assistModel);
      localStorage.setItem(ASSIST_FALLBACKS_KEY, JSON.stringify(this.assistFallbacks));
    } catch {
      /* private mode — the choice just doesn't persist */
    }
  }

  private async refreshFingerprint() {
    this.keyFingerprint = this.apiKey ? (await keyFingerprint(this.apiKey)).slice(0, 12) : '';
  }

  private async pasteKey() {
    const key = this.pasteDraft.trim();
    if (!key) return;
    this.connectNotice = 'checking key…';
    try {
      const info = await fetchKeyInfo(key);
      storeApiKey(key);
      this.pasteDraft = '';
      this.connectNotice = info.label ? `connected · ${info.label}` : 'connected';
    } catch (e) {
      this.connectNotice = e instanceof Error ? e.message : String(e);
    }
  }

  private setChat(next: ChatMessage[]) {
    this.chat = next;
    try {
      if (next.length) sessionStorage.setItem(ASSIST_CHAT_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(ASSIST_CHAT_KEY);
    } catch {
      /* storage full or private — the conversation just doesn't persist */
    }
  }

  private clearChat() {
    this.chatAbort?.abort();
    this.setChat([]);
    this.connectNotice = '';
  }

  private disconnect() {
    this.chatAbort?.abort();
    forgetApiKey();
    this.setChat([]);
    this.connectNotice = '';
  }

  private async sendChat() {
    const text = this.chatDraft.trim();
    if (!text || !this.apiKey || this.chatBusy) return;
    this.chatDraft = '';
    this.connectNotice = '';
    this.servedModel = '';
    const history: ChatMessage[] = [...this.chat, { role: 'user', content: text }];
    this.setChat([...history, { role: 'assistant', content: '' }]);
    this.chatBusy = true;
    this.chatAbort = new AbortController();
    try {
      for await (const delta of streamChat({
        apiKey: this.apiKey,
        model: this.assistModel,
        fallbacks: this.assistFallbacks,
        onModel: id => (this.servedModel = id),
        messages: history,
        signal: this.chatAbort.signal,
        referer: location.origin,
        title: 'MNX Lab'
      })) {
        const last = this.chat[this.chat.length - 1];
        this.setChat([...this.chat.slice(0, -1), { ...last, content: last.content + delta }]);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        this.connectNotice = e instanceof Error ? e.message : String(e);
      }
    } finally {
      this.chatBusy = false;
      this.chatAbort = null;
    }
  }

  /** Description, with TAGS FOLDED IN below a rule — the design's seven-to-five
   *  cut. They were always one idea split across two tabs: what this scenario
   *  is, and what the repo knows about it. */
  private panelDescription(entry: ScenarioEntry) {
    if (this.isLocalDocument() && this.localDocument) {
      const local = this.localDocument;
      return this.panelFrame({
        context: html`<span class="ctx-name">${local.name}</span>
          <span class="ctx-dim">${local.format} · local file</span>`,
        body: html`
          <h1>${local.name}</h1>
          <div class="idline"><span class="id">${local.fileName}</span></div>
          <p class="description">
            Opened directly from this computer. The workbench keeps it only in this page;
            it is not stored, uploaded, or written back to the file.
          </p>
          ${this.scoreFacts(entry)}
          ${local.warnings.length
            ? html`<div class="rule-strong"></div>
                <div class="tag-group">import warnings</div>
                <ul class="import-warnings">
                  ${local.warnings.map(warning => html`<li>${warning}</li>`)}
                </ul>`
            : nothing}
        `,
        footer: html`<span class="ctx-dim">transient · reopen after a reload</span>`
      });
    }
    return this.panelFrame({
      context: html`<span class="ctx-name">${entry.meta.title}</span>
        <span class="ctx-dim">${entry.category}</span>`,
      body: html`
        <h1>${entry.meta.title}</h1>
        <div class="idline">
          <span class="id">${entry.id}</span>
          <button
            class="copy"
            title="copy the scenario id"
            @click=${() => this.copyId(entry.id)}
          >
            ${this.copiedId ? 'copied' : 'copy'}
          </button>
        </div>
        <p class="description">${entry.meta.description}</p>
        ${this.scoreFacts(entry)}
        <div class="rule-strong"></div>
        ${this.panelTags(entry)}
      `,
      footer: html`<span class="prompt">&gt;</span>
        <input
          class="tagfilter"
          type="text"
          placeholder="filter objects…"
          .value=${this.defFilter}
          @input=${(e: Event) => (this.defFilter = (e.target as HTMLInputElement).value)}
        />`
    });
  }

  /** BARS / PARTS / KEY / APPROVED — four facts, flush left, in the design's
   *  stat strip. The mock's fourth cell is EDITED; there is no such date and
   *  none can be invented (no backend, no mtime — git is the database), so the
   *  honest substitute is the provenance the repo really keeps: when a human
   *  last approved it. A dirty session adds a fifth cell counting its ops. */
  private scoreFacts(entry: ScenarioEntry) {
    const doc = this.session?.doc;
    const cell = (label: string, value: string) =>
      html`<div class="fact"><div class="fact-k">${label}</div><div class="fact-v">${value}</div></div>`;
    const approved = entry.meta.verification?.at;
    return html`
      <div class="facts">
        ${cell('bars', String(entry.meta.bars ?? doc?.global.measures.length ?? '—'))}
        ${cell('parts', String(doc?.parts.length ?? '—'))}
        ${cell('key', doc ? fmtKey(keyFifthsAt(doc, 0)) : '—')}
        ${this.isLocalDocument()
          ? cell('source', this.localDocument?.format ?? 'file')
          : cell('approved', approved ? approved.slice(0, 10) : 'never')}
        ${this.session?.dirty
          ? cell('edits', String(this.session.appliedOps.length))
          : nothing}
      </div>
    `;
  }

  /** The provenance half of the description tab, in the design's three named
   *  groups. A flat cloud of fourteen badges hides the two that matter. */
  private panelTags(entry: ScenarioEntry) {
    const item = classify(entry);
    const verification = entry.meta.verification;
    const defs = entry.featureDefs.filter(d =>
      this.defFilter ? d.toLowerCase().includes(this.defFilter.toLowerCase()) : true
    );
    return html`
      <div class="tag-group">status</div>
      <div class="badges">
        <span class="badge ${item.state === 'current' ? 'verified' : 'attention'}">
          ${item.state === 'current' ? entry.meta.status : item.state} — ${item.detail}
        </span>
        <span
          class="badge"
          title=${entry.ns === 'spec'
            ? 'mirrored by sync:spec — hand-edits forbidden'
            : 'ours, authored in scenarios/lab/'}
        >
          ${entry.ns === 'spec' ? 'mirrored' : 'local'}
        </span>
        <span class="badge">${entry.meta.source}</span>
        ${entry.meta.schema === 'proposed'
          ? html`<span class="badge attention">proposed schema</span>`
          : nothing}
        ${entry.specRef
          ? html`<span class="badge"><a href=${entry.specRef} target="_blank">spec ↗</a></span>`
          : nothing}
        ${entry.issueRef
          ? html`<span class="badge"><a href=${entry.issueRef} target="_blank">issue ↗</a></span>`
          : nothing}
      </div>

      <!-- One hash per golden: say which code each one witnesses, because a
           bare digest says neither. A verified scenario with no renderHash (or
           bothHash) was approved before that golden existed — it is current,
           not stale, and that distinction is the whole reason the fields are
           optional. Grouped away from status because a digest is not a verdict:
           it is what the verdict was made against. -->
      <div class="tag-group">build</div>
      <div class="badges">
        ${verification?.primitivesHash
          ? html`<span class="badge hash" title="hash of expected.primitives.json — layout"
              ><b>layout</b>${verification.primitivesHash.replace('sha256:', '')}</span
            >`
          : nothing}
        ${verification?.renderHash
          ? html`<span class="badge hash" title="hash of expected.svg — the SVG emitter's output"
              ><b>render</b>${verification.renderHash.replace('sha256:', '')}</span
            >`
          : verification?.primitivesHash
            ? html`<span
                class="badge muted"
                title="approved before the SVG golden existed — run verify-scenarios --backfill-render to stamp one"
                >render not witnessed</span
              >`
            : nothing}
        ${verification?.bothHash
          ? html`<span
              class="badge hash"
              title="hash of expected.both.svg — the combined notation+tab system"
              ><b>both</b>${verification.bothHash.replace('sha256:', '')}</span
            >`
          : nothing}
        ${!verification ? html`<span class="badge muted">no approval on record</span>` : nothing}
      </div>

      <!-- The schema objects this scenario exercises, from the spec's own
           coversDefs join. featureDefs (plumbing stripped) is what makes this
           wearable: the raw list runs to a median of 25 and a max of 50, but
           once the structural skeleton is gone the median is 5 and 58 of 70
           scenarios fit in nine. The handful that don't get a count instead of
           a wall. The footer's filter searches this group. -->
      ${entry.featureDefs.length > 0
        ? html`
            <div class="tag-group">
              schema coverage
              <span class="tag-count">${defs.length}/${entry.featureDefs.length}</span>
            </div>
            <div class="defs">
              ${(this.allDefs || this.defFilter ? defs : defs.slice(0, DEF_PREVIEW)).map(
                d => html`<a class="def" href=${objectsHref(d)} title="show every scenario using ${d}"
                  >${d}</a
                >`
              )}
              ${!this.allDefs && !this.defFilter && defs.length > DEF_PREVIEW
                ? html`<button class="def more" @click=${() => (this.allDefs = true)}>
                    +${defs.length - DEF_PREVIEW} more
                  </button>`
                : nothing}
              ${this.defFilter && defs.length === 0
                ? html`<span class="def muted">no object matches</span>`
                : nothing}
            </div>
          `
        : nothing}
    `;
  }


  /** The spec's reference engraving — the main pane is always "our render",
   *  so showing the reference beside it IS the comparison. */
  private panelCompare(entry: ScenarioEntry) {
    return this.panelFrame({
      context: html`<span class="ctx-name">${entry.meta.title}</span>
        <span class="ctx-dim"
          >${entry.ns === 'spec' ? 'mirrored from the spec' : 'no spec reference'}</span
        >`,
      // The pinned release is the whole provenance of the image above it: an
      // engraving is only evidence if you can say which spec drew it.
      footer: html`<span class="ctx-dim">reference images © the W3C MNX CG, from the pinned
        <code>vendor/mnx</code> checkout</span>`,
      body: html`
      <div class="ref-pane">
        <div class="side-cap">spec reference engraving</div>
        ${entry.ns === 'spec' && !this.referenceFailed
          ? html`<img
                src=${`/spec-media/${entry.id.replace(/^spec\//, '')}.png`}
                alt="Reference engraving from the MNX spec"
                @error=${() => (this.referenceFailed = true)}
              />
              <p class="ref-credit">
                Reference engraving © the W3C MNX Community Group, from the pinned spec
                release${entry.specRef
                  ? html` — <a href=${entry.specRef} target="_blank">source ↗</a>`
                  : nothing}
              </p>`
          : html`<div class="ref-missing">
              ${entry.ns !== 'spec'
                ? html`A lab scenario has no spec reference engraving — compare against the
                  committed golden via the harness (<code>npm run verify:scenarios</code> shows
                  what changed).`
                : this.loadState === 'failed'
                  ? // The score failed to fetch too, so this image 404'd for the same
                    // reason. Don't send them chasing the submodule.
                    html`Reference engraving unavailable — the same transport failure as the
                    document pane, not a missing image.`
                  : html`Reference engraving unavailable — the images come from the pinned
                    <code>vendor/mnx</code> checkout, copied into the build when one is present.
                    This build was made without the submodule; run
                    <code>git submodule update --init vendor/mnx</code> and rebuild.`}
            </div>`}
      </div>
      `
    });
  }

  /** The ops tab (roadmap/complete/core-element-ops-exemplar.md): the
   *  session's op log rendered as the undo/redo queue it already is —
   *  applied entries, the redo stack dimmed below, position marked, each
   *  row op · provoking intent · key (the provenance columns). Clicking an
   *  entry steps undo/redo to that boundary through the intent funnel. */
  private panelOps() {
    if (!this.session) return nothing;
    const { applied, future } = this.session.opQueue;
    if (applied.length === 0 && future.length === 0) {
      const trace = constructTraceByTarget.get(this.entry()?.id ?? '');
      const elements = elementKeys(this.session.doc);
      return this.panelFrame({
        context: html`<span class="ctx-name">no ops</span>
          <span class="ctx-dim">nothing edited yet</span>`,
        body: html`
        <p class="description">
          no edits yet — the queue fills as ops apply (every entry shows the op,
          the intent that provoked it, and the key that produced the intent)
        </p>
        ${trace || elements.length > 0
          ? html`
              <div class="actions">
                <div class="action-row">
                  ${trace
                    ? html`
                        <button @click=${() => this.replayConstructTrace(trace)}>
                          replay construct trace (${trace.intents.length} intents)
                        </button>
                      `
                    : nothing}
                  ${elements.length > 0
                    ? html`
                        <button @click=${() => this.runDestructSweep()}>
                          run destruct sweep (${elements.length} element${elements.length === 1 ? '' : 's'})
                        </button>
                      `
                    : nothing}
                </div>
                <p class="hint">
                  mirror sessions, both queues forward in time — “backwards” is only
                  relative to the score's fullness. <b>construct</b> replaces the
                  session: start <code>{}</code>, the recorded intents build the score,
                  undo dismantles it (revert returns to <code>{}</code>; reload for the
                  corpus file). <b>destruct</b> drives this session: the walker deletes
                  every element it can address, then tears down the emptied scaffolding
                  — bars, part, skeleton — to the literal <code>{}</code> (containers
                  are removable only once empty, so nothing is destroyed implicitly).
                  undo rebuilds everything back to the committed score. destruct needs
                  no fixture, so it works on any scenario.
                </p>
              </div>
            `
          : nothing}
      `
      });
    }
    // Position 0 — the state before any op. A queue of N ops has N+1
    // positions; without this row the start is reachable only by Ctrl+Z.
    const startIsEmpty = !('mnx' in (this.session.initial as object));
    const session = this.session;
    return this.panelFrame({
      // The design puts the count, the position and UNDO/REDO in the context
      // bar. They came from the retired actions tab; this is where they belong,
      // because they act on exactly what the body is listing.
      context: html`
        <span class="ctx-name"
          >${applied.length} op${applied.length === 1 ? '' : 's'}</span
        >
        <span class="ctx-dim"
          >${future.length === 0
            ? '· at head'
            : `· ${future.length} ahead`}${session.dirty ? '' : ' · clean'}</span
        >
        <span class="ctx-actions">
          <button
            ?disabled=${!session.canUndo}
            title="undo one op"
            @click=${() => this.stripIntent({ type: 'undo' })}
          >
            undo
          </button>
          <button
            ?disabled=${!session.canRedo}
            title="redo one op"
            @click=${() => this.stripIntent({ type: 'redo' })}
          >
            redo
          </button>
        </span>
      `,
      footer: html`<span class="ctx-dim"
          >click any row to travel to that state</span
        >
        <span class="ctx-actions">
          ${session.dirty
            ? html`<button
                title="discard every edit — back to the committed corpus file"
                @click=${() => this.revertEdits()}
              >
                revert
              </button>`
            : nothing}
          <button
            ?disabled=${session.intentLog.length === 0}
            title="copy this session as a replayable intent-trace fixture — paste into harness/fixtures/edit-traces/"
            @click=${() => void this.copyTrace()}
          >
            ${this.copied ? 'copied ✓' : 'copy trace'}
          </button>
        </span>`,
      body: html`
      <ol class="ops">
        <li
          class="baseline row-state ${applied.length === 0 ? 'row-current' : ''}"
          title="undo everything — back to the start"
          @click=${() => this.jumpToOp(0)}
        >
          <span class="op-what">start · ${startIsEmpty ? 'the empty document {}' : 'the document as loaded'}</span>
          <span class="op-keys">—</span>
          <span class="op-intent">before any op</span>
        </li>
        ${applied.map((entry, index) => {
          const row = buildOpRow(entry);
          return html`
            <li
              class="row-state ${index === applied.length - 1 ? 'row-current' : ''}"
              title="undo back to this point"
              @click=${() => this.jumpToOp(index + 1)}
            >
              <span class="op-what">${row.op}</span>
              <span class="op-intent">${row.intent}</span>
              <span class="op-keys">${row.keys}</span>
            </li>
          `;
        })}
        ${future.map((entry, index) => {
          const row = buildOpRow(entry);
          return html`
            <li class="row-state row-past" title="redo forward to this point" @click=${() => this.jumpToOp(applied.length + index + 1)}>
              <span class="op-what">${row.op}</span>
              <span class="op-intent">${row.intent}</span>
              <span class="op-keys">${row.keys}</span>
            </li>
          `;
        })}
      </ol>
      `
    });
  }

  /** Replace the session with the fixture's replay from `{}` — the ops
   *  queue becomes the construct sequence, undoable back to genesis. The
   *  committed corpus file is untouched (edits are in-memory by rule). */
  private replayConstructTrace(trace: ConstructTrace) {
    this.adoptSession(replayIntents({} as MnxStructure, trace.intents));
  }

  /** Run the destruct walk on THIS session (the construct mirror: no
   *  session replacement — it starts from the loaded score, so revert and
   *  undo-all still return to the committed document). The queue fills with
   *  the delete ops; undo rebuilds the score element by element. Same code
   *  as the harness sweep (src/edit/destructWalk.ts) — the button IS the
   *  sweep. */
  private runDestructSweep() {
    if (!this.session) return;
    this.editor?.refresh(); // end the fret window first
    const result = runDestructWalk(this.session);
    if (result.unaddressed.length > 0) {
      // A campaign finding, not a silent skip — v0 surfaces it to the console
      // (the harness asserts it; the panel stays a viewer).
      console.warn('destruct sweep: unaddressable elements', result.unaddressed);
    }
    this.editor?.sessionMoved();
  }

  /** Undo/redo until the applied queue holds `target` ops — through
   *  handleIntent, so panel clicks are recorded like keys. */
  private jumpToOp(target: number) {
    if (!this.session) return;
    this.editor?.refresh(); // end the fret window first
    for (let guard = 0; this.session.opQueue.applied.length > target && this.session.canUndo && guard < 128; guard++) {
      this.session.handleIntent({ type: 'undo' });
    }
    for (let guard = 0; this.session.opQueue.applied.length < target && this.session.canRedo && guard < 128; guard++) {
      this.session.handleIntent({ type: 'redo' });
    }
    this.editor?.sessionMoved();
  }

  /** Selection level → the JSON pointer whose span is worth showing.
   *
   *  Null means "no narrower scope than the whole document": at `section` and
   *  `score` the answer really is the file, and a pointer that pretended
   *  otherwise would scope the pane to something the reader did not select.
   *  Addresses come from `findNoteAddress`, the canonical walk — which carries
   *  `sequenceIndex` explicitly, documented as being for consumers addressing
   *  JSON, so this reuses the traversal rather than restating it. */
  private selectionPointer(): string | null {
    const session = this.session;
    if (!session || this.cursorHidden) return null;
    const level = session.selectionLevel;
    if (level === 'document') return null;

    const key = session.selectedNoteKeys[0];
    const at = key ? findNoteAddress(session.doc, key) : null;
    const m = session.cursor.measureIndex;

    if (level === 'measure') return `/global/measures/${m}`;
    if (!at) return null;
    const part = `/parts/${at.partIndex}/measures/${at.measureIndex}`;
    if (level === 'partMeasure') return part;
    const seq = `${part}/sequences/${at.sequenceIndex}`;
    if (level === 'voiceMeasure') return seq;
    const event = `${seq}/content/${at.eventIndex}`;
    if (level === 'event') return event;
    return `${event}/notes/${at.noteIndex}`;
  }

  private panelJson() {
    if (this.loadState !== 'ready') {
      return this.panelFrame({
        body: html`<div class="ref-missing">The document has not loaded (${this.loadState}).</div>`
      });
    }
    const source = this.session?.doc ?? this.parsedDocument();
    const view = buildJsonView(source);

    const pointer = this.selectionPointer();
    const scoped = this.jsonScope === 'selection' && pointer !== null;
    const span = scoped ? view.spanByPointer.get(pointer!) : undefined;
    const [from, to] = span ?? [0, view.lines.length - 1];

    // The error's line is a DOCUMENT line, so it survives scoping: pin an
    // error, switch to selection scope, and it is either in view or it is not,
    // which is itself informative.
    const errorLine =
      this.errorPointer !== null ? (view.lineByPointer.get(this.errorPointer) ?? null) : null;

    const needle = this.jsonFind.trim().toLowerCase();
    const rows: number[] = [];
    for (let i = from; i <= to; i++) {
      if (needle && !view.lines[i].toLowerCase().includes(needle)) continue;
      rows.push(i);
    }

    return this.panelFrame({
      context: html`
        <span class="ctx-actions jscope">
          <button
            aria-current=${scoped}
            ?disabled=${pointer === null}
            title=${pointer === null
              ? 'nothing narrower than the whole document is selected'
              : `scope to ${pointer}`}
            @click=${() => (this.jsonScope = 'selection')}
          >
            selection
          </button>
          <button aria-current=${!scoped} @click=${() => (this.jsonScope = 'whole')}>
            whole document
          </button>
        </span>
        <span class="ctx-dim"
          >${this.session?.dirty ? 'edited, in memory' : 'as committed'}</span
        >
        <span class="ctx-actions">
          <button title="copy the document as JSON" @click=${() => void this.copyJson(view.text)}>
            ${this.copiedJson ? 'copied ✓' : 'copy'}
          </button>
        </span>
      `,
      footer: html`<span class="prompt">&gt;</span>
        <input
          class="tagfilter"
          type="text"
          placeholder="find in JSON…"
          .value=${this.jsonFind}
          @input=${(e: Event) => (this.jsonFind = (e.target as HTMLInputElement).value)}
        />
        <span class="ctx-dim"
          >${needle || scoped
            ? `${rows.length} of ${view.lines.length}`
            : `${view.lines.length} lines`}</span
        >`,
      body: html`
        <div class="jsonv">
          ${rows.map(
            i => html`
              <div class="jline ${i === errorLine ? 'pinned' : ''}">
                <span class="jnum">${i + 1}</span>
                <span class="jcode">${jsonInk(view.lines[i])}</span>
              </div>
            `
          )}
          ${rows.length === 0
            ? html`<div class="ref-missing">Nothing matches “${this.jsonFind}”.</div>`
            : nothing}
        </div>
      `
    });
  }

  /** The committed file, for scenarios with no edit session. */
  private parsedDocument(): unknown {
    try {
      return this.rawDocument ? JSON.parse(this.rawDocument) : null;
    } catch {
      return null;
    }
  }

  private async copyJson(text: string) {
    await navigator.clipboard.writeText(text);
    this.copiedJson = true;
  }

  /** The HUD companion (roadmap/inprogress/core-score-hud.md): wired through
   *  the host, never through the viewer's props. */
  private hud(entry: ScenarioEntry) {
    if (!this.session || this.loadState !== 'ready') return nothing;
    // The cheatsheet's context mirrors activeLayers(): the digit layer is
    // live exactly when a tab pane is on screen.
    const view = this.activeView(entry);
    const tabPane = entry.hasTab && (view === 'tab' || view === 'both');
    const rows = buildHudRows(entry.meta.title, this.session, this.cursorHidden);
    const active = rows.find(r => r.active);
    return this.panelFrame({
      context: html`<span class="ctx-name">selection</span>
        <span class="ctx-dim"
          >${active ? `${active.label} · ${active.value}` : 'no cursor'}</span
        >`,
      // THE ONE DELIBERATELY DARK BAND IN A LIGHT APP — do not "fix" it.
      // The design's rule is "the tray edits, the HUD explains": the keys half
      // above is reference and never clickable, so the panel has to say where
      // editing actually happens. Inverting the footer is how it says so
      // without growing a control that would contradict the rule.
      footer: html`<span class="hud-handoff">edit commands live in the tray</span>
        <kbd class="hud-key">/</kbd>`,
      body: html`
        <mnx-score-hud
          .rows=${rows}
          .parts=${buildHudParts(
            this.session.doc,
            index => this.partOverride(index),
            this.session.cursor.partIndex ?? 0
          )}
          .presets=${TUNING_PRESET_NAMES}
          .cheats=${cheatsheet(this.session.selectionLevel, {
            tabPane,
            projection: this.session.projection
          })}
          @hud-row-activated=${this.onHudRow}
          @hud-part-setup-changed=${this.onHudPartSetup}
        ></mnx-score-hud>
      `
    });
  }
}
