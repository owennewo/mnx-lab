// One scenario, deep-linkable: #/scenario/<id>?view=notation|tab|both|compare|json.
// The compare view is the review surface — our render beside the spec's
// reference engraving (served by a dev-only middleware from the pinned
// vendor/mnx checkout; in a static deploy the reference pane degrades to a
// note). Rendering goes through the elements/ score viewer, property-driven.
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { corpus, type ScenarioEntry } from '../corpus/corpus.ts';
import { groupScenarios } from '../corpus/groups.ts';
import { classify } from './queue.ts';
import { designTokens, sharedChrome, scrollbars } from '../elements/tokens.ts';
import { scenarioHref, objectsHref } from './WorkbenchApp.ts';
import type { MnxDocument, MnxStructure } from '../model/mnx.ts';
import { resolvePinnedErrors, type PinnedError } from '../model/pinnedErrors.ts';
import type { ScoreViewer, ViewMode } from '../elements/ScoreViewer.ts';
import type { EnclosureKind, SelectionContext, SelectionSpan } from '../elements/mnxContext.ts';
import { EditorSession, replayIntents } from '../edit/session.ts';
import { elementKeys, runDestructWalk } from '../edit/destructWalk.ts';
import { constructTraceByTarget, type ConstructTrace } from './constructTraces.ts';
import {
  selectionNoteKeys,
  type SelectionMember,
  type SelectionLevel
} from '../edit/selection.ts';
import { measureSpans } from '../edit/cursor.ts';
import { eventAtAddress } from '../edit/ops.ts';
import { syntheticEventKey } from '../model/noteKeys.ts';
import type { EditorIntent } from '../edit/intents.ts';
import type { SelectionClipboardStore } from '../edit/selectionClipboard.ts';
import {
  copySelectionToStore,
  cutSelectionToStore,
  pasteSelectionFromStore
} from '../edit/selectionClipboardActions.ts';
import {
  copySelectionNotice,
  cutSelectionNotice,
  deleteSelectionNotice,
  pasteSelectionNotice,
  type ClipboardNotice
} from '../edit/clipboardFeedback.ts';
import type { TabSetup } from '../engine/tab/guitarPositions.ts';
import { cheatsheet } from '../edit/keymapDocs.ts';
import { buildHudParts, buildHudRows, LEVEL_BY_ROW, ROW_BY_LEVEL } from './hudRows.ts';
import { keyFifthsAt } from '../edit/staffSpace.ts';
import { buildJsonView } from '../model/jsonView.ts';
import { findNoteAddress } from '../model/noteWalk.ts';
import {
  EDIT_LAYER,
  NAVIGATION_LAYER,
  TAB_DIGIT_LAYER,
  resolveKeyAction,
  resolveShellAction,
  strokeOf,
  type KeymapLayer,
  type ShellAction
} from '../edit/keymap.ts';
import { TabDigitResolver } from '../edit/tabDigitResolver.ts';
import { LADDER_JUMP_LEVELS } from '../edit/keymap.ts';
import {
  ADORNMENT_HELP,
  LYRIC_HELP,
  parseLyric,
  parsePartDeclaration,
  BAR_ATTRIBUTE_HELP,
  RHYTHM_HELP,
  parseAdornment,
  CLEF_NAME_LIST,
  parseBarAttribute,
  parseRhythm,
  parseClef,
  parseKeySignature,
  parsePart,
  parseLayoutSentence,
  parseTimeSignature,
  parseTuning,
  TUNING_PRESET_NAMES
} from '../edit/setupGrammar.ts';
import { buildOpRow } from './opRows.ts';
import { editorHasKeyboard, keyIsOurs } from './keyScope.ts';
import {
  bandsForScope,
  commandState,
  commandsForScope,
  isTriaged,
  selectionMemberSummary,
  sessionView,
  type CommandScope,
  type EditorCommand
} from '../edit/commandRegistry.ts';
import type {
  TrayAnchor,
  TrayBand,
  TrayMeta,
  TrayRung,
  TrayTile
} from './SelectionTray.ts';
import {
  TRAY_EDGE_GAP,
  TRAY_MIRROR_MARGIN,
  TRAY_SHAFT_H,
  TRAY_WIDTH
} from './SelectionTray.ts';
import '../elements/ScoreViewer.ts';
import './SelectionTray.ts';
import './RungInspector.ts';
import { buildInspectorView } from './inspectorRows.ts';
import { parseInspectorLine } from '../edit/inspector.ts';
import './ZoomPad.ts';
import type { ZoomPadChange } from './ZoomPad.ts';
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
  MIN_STAFF_SCALE,
  MAX_STAFF_SCALE,
  type RenderScale
} from '../engine/render/scale.ts';
import { MIN_DENSITY, MAX_DENSITY, neighbourSystemMeasure } from '../engine/layout/spacing.ts';

/** The setup popovers, as data — one row per attribute rather than a ternary
 *  chain that grows a limb per campaign item. Label, placeholder and hint are
 *  the whole difference between them; parsing lives in edit/setupGrammar.ts. */
type PopoverKind =
  | 'time' | 'tuning' | 'part' | 'clef' | 'key' | 'bar' | 'adornment' | 'lyric' | 'rhythm'
  | 'layout';

const POPOVER_SPECS: Record<PopoverKind, { label: string; placeholder: string; hint: string }> = {
  time: {
    label: 'time signature',
    placeholder: '4/4 · 6/8 · common · 2/2 cut · inherit',
    hint: 'governs this bar onward · “inherit” un-declares it · Enter applies · Esc closes'
  },
  tuning: {
    label: 'tuning',
    placeholder: 'standard · drop-d · D2 A2 D3 G3 A3 D4',
    hint: 'low string first · Enter applies · Esc closes'
  },
  part: {
    label: 'part',
    placeholder: 'Guitar · capo 3 · staves 2 · no strings',
    hint: 'a name adds a part; capo/staves change this one; “no <thing>” strips · Enter applies · Esc closes'
  },
  layout: {
    label: 'layout',
    placeholder: 'layout L1: bracket [ vn1, vn2 ] · score "Part A": layout L1 · mmrest m3 x2',
    hint: 'the presentation layer: a layout groups parts onto staves, a score selects one · “no layout 2” strips · Enter applies · Esc closes'
  },
  clef: {
    label: 'clef',
    placeholder: 'treble · bass · treble8vb · inherit',
    hint: 'governs this bar onward · “inherit” un-declares it · Enter applies · Esc closes'
  },
  key: {
    label: 'key signature',
    placeholder: 'C · Bb · F# · -3 · inherit',
    hint: 'governs this bar onward · “inherit” un-declares it · Enter applies · Esc closes'
  },
  lyric: {
    label: 'lyric',
    placeholder: 'sleep- · -ing · 2: Am · line 2 Nederlands nl',
    hint: 'a syllable at the cursor’s note; trailing/leading “-” joins a word · “no lyric” strips · Enter applies'
  },
  adornment: {
    label: 'adornment',
    placeholder: 'accent · staccato · mf · text Play 8x · accidental parens',
    hint: 'at the cursor’s position · “no <adornment>” strips it · Enter applies · Esc closes'
  },
  rhythm: {
    label: 'rhythm',
    placeholder: '3:2 · 3 eighth in 1 quarter, no number · grace · tremolo 2 · rest half · space 1/4',
    hint: 'wraps from the cursor — the declaration says how much music it takes · Enter applies · Esc closes'
  },
  bar: {
    label: 'bar attribute',
    placeholder: 'barline double · repeat end · ending 1,2 · tempo 120 · full-measure rest',
    hint: 'this bar only · “no <attribute>” strips it · Enter applies · Esc closes'
  }
};

const POPOVER_ACTIONS: Partial<Record<ShellAction, PopoverKind>> = {
  timeSignaturePopover: 'time',
  tuningPopover: 'tuning',
  partPopover: 'part',
  clefPopover: 'clef',
  keySignaturePopover: 'key',
  barAttributePopover: 'bar',
  adornmentPopover: 'adornment',
  lyricPopover: 'lyric',
  rhythmPopover: 'rhythm',
  layoutPopover: 'layout'
};

/** EVERY setup popover, as a palette row (workbench-score-panel.md, step C).
 *
 *  The `actions` tab used to be the only place several of these could be
 *  reached by mouse; the palette hard-coded four of the nine. Retiring the tab
 *  without closing that gap would have removed a working surface, so the two
 *  now come from ONE table — `WorkbenchApp` maps over this rather than keeping
 *  its own list, which is what stops them drifting apart again.
 *
 *  `needsTab` mirrors `openPopover`'s own guard: tuning is meaningless without
 *  a fingerboard. */
export const SETUP_POPOVER_COMMANDS: {
  label: string;
  action: ShellAction;
  stroke: string;
  needsTab?: boolean;
}[] = [
  { label: 'setup: time signature…', action: 'timeSignaturePopover', stroke: 'Shift+T' },
  { label: 'setup: add part…', action: 'partPopover', stroke: 'Shift+P' },
  { label: 'setup: clef…', action: 'clefPopover', stroke: 'Shift+C' },
  { label: 'setup: key signature…', action: 'keySignaturePopover', stroke: 'Shift+K' },
  { label: 'setup: bar attribute…', action: 'barAttributePopover', stroke: 'Shift+B' },
  { label: 'setup: adornment…', action: 'adornmentPopover', stroke: 'Shift+A' },
  { label: 'setup: lyric…', action: 'lyricPopover', stroke: 'Shift+L' },
  { label: 'setup: rhythm…', action: 'rhythmPopover', stroke: 'Shift+R' },
  { label: 'setup: tuning…', action: 'tuningPopover', stroke: 'Shift+U', needsTab: true }
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
/** Folded or not — SEPARATE from the width, so unfolding restores the width
 *  that was dragged rather than a default (mirrors `mnx-lab.rail-hidden`). */
const PANEL_HIDDEN_KEY = 'mnx-lab.panel-hidden';
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
   score — looking at a document must not modify it. Both keys store "unset" by
   ABSENCE rather than a sentinel, because unset genuinely differs from any
   value: no staff scale means FITTED, which no number can express. */
const STAFF_SCALE_KEY = 'mnx-lab.staff-scale';
const DENSITY_H_KEY = 'mnx-lab.density-h';

function storedScale(key: string, min: number, max: number): number | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const n = Number(raw);
  // CLAMP, don't reset — storedPanelWidth's rule, for the same reason: a value
  // saved under wider bounds means "as far as it goes", not "start over".
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
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

/** The tray tab for the `document` scope — the one that is not a ladder rung
 *  (core-selection-tray-global-tab.md). */
const GLOBAL_TAB = 'global';

/** Tile ids the PAGE owns rather than the registry; see `chromeCommands`. */
const CHROME_PREFIX = 'page:';

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

/** Ladder level → enclosure shape (roadmap/complete/core-selection-ladder.md).
 *  The mapping lives HERE so elements/ knows shapes, never editor levels.
 *  measure and section share panel-wide: the extent difference (one bar vs
 *  the labelled range) comes from the footprint itself — and where it
 *  degenerates, LIT_LABEL_LEVELS below carries the pair instead. */
const ENCLOSURE_BY_LEVEL: Record<SelectionLevel, EnclosureKind> = {
  note: 'cell',
  event: 'slice',
  container: 'lasso',
  voiceMeasure: 'run',
  partMeasure: 'panel',
  measure: 'panel-wide',
  section: 'panel-wide',
  document: 'frame'
};

/** Which rungs claim the section labels they enclose (the ladder's "label
 *  chip lit"; workbench-rung-legibility.md). Only the section rung does:
 *  extent separates bar from section whenever the section is longer than a
 *  bar and not at all when it is exactly one, and the bar's own slot covers
 *  the label strip either way — so the shared shape needs a channel that does
 *  not depend on how long the section happens to be. A bar owning the
 *  rehearsal mark and tempo in that same strip is why the claim is the
 *  section's alone. */
const LIT_LABEL_LEVELS = new Set<SelectionLevel>(['section']);

/** Translate editor membership into the deliberately smaller geometry
 * vocabulary accepted by `elements/`. Rests survive as onset-bearing moments;
 * empty voice/part/global bar copies survive as full-measure units. */
/**
 * The keys of the selected events that are RESTS — the only ones that need
 * this channel, because every other event is lit through its notes.
 *
 * Real `event.id` first, exactly as notes prefer their own id; the synthetic
 * key otherwise, and the layout mints the same one from the same coordinates,
 * so the two sides meet without a shared table.
 */
function selectedRestKeys(
  doc: MnxStructure,
  members: readonly SelectionMember[]
): string[] {
  const keys: string[] = [];
  for (const member of members) {
    if (member.kind !== 'note' && member.kind !== 'event') continue;
    const event = eventAtAddress(doc, {
      partIndex: member.partIndex,
      staffIndex: member.staffIndex,
      measureIndex: member.measureIndex,
      voiceIndex: member.voiceIndex,
      eventIndex: member.eventIndex,
      ...(member.containerIndex === undefined ? {} : { containerIndex: member.containerIndex })
    });
    if (!event?.rest) continue;
    keys.push(
      event.id ??
        syntheticEventKey({
          partIndex: member.partIndex,
          measureIndex: member.measureIndex,
          staffIndex: member.staffIndex,
          voiceIndex: member.voiceIndex,
          eventIndex: member.eventIndex,
          ...(member.containerIndex === undefined ? {} : { containerIndex: member.containerIndex })
        })
    );
  }
  return keys;
}

function presentationSpan(
  doc: MnxStructure,
  level: SelectionLevel,
  members: readonly SelectionMember[]
): SelectionSpan | null {
  if (level === 'document') return null;
  const spans = measureSpans(doc);
  const coverage: SelectionSpan['coverage'] =
    level === 'note' || level === 'event' || level === 'container'
      ? 'moment'
      : level === 'voiceMeasure' || level === 'partMeasure'
        ? 'staff-measure'
        : 'measure';
  const units: SelectionSpan['units'] = [];
  const push = (
    measureIndex: number,
    partIndex?: number,
    staffIndex?: number,
    onset?: { num: number; den: number }
  ) => {
    const measure = spans[measureIndex] ?? { num: 1, den: 1 };
    const raw = onset
      ? (onset.num / onset.den) / Math.max(Number.EPSILON, measure.num / measure.den)
      : undefined;
    units.push({
      measureIndex,
      ...(partIndex === undefined ? {} : { partIndex }),
      ...(staffIndex === undefined ? {} : { staffIndex }),
      ...(raw === undefined ? {} : { position: Math.max(0, Math.min(1, raw)) })
    });
  };
  for (const member of members) {
    switch (member.kind) {
      case 'note':
      case 'event':
      case 'container':
        push(member.measureIndex, member.partIndex, member.staffIndex, member.onset);
        break;
      case 'voiceMeasure':
      case 'partMeasure':
        push(member.measureIndex, member.partIndex, member.staffIndex);
        break;
      case 'measure':
        push(member.measureIndex);
        break;
      case 'section':
        for (let measureIndex = member.start; measureIndex < member.end; measureIndex++) {
          push(measureIndex);
        }
        break;
      case 'document':
        break;
    }
  }
  // Chords and coincident container members share one presentation anchor.
  const seen = new Set<string>();
  return {
    coverage,
    units: units.filter(unit => {
      const key = [unit.measureIndex, unit.partIndex ?? '', unit.staffIndex ?? '', unit.position ?? ''].join(':');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  };
}

@customElement('mnx-scenario-page')
export class ScenarioPage extends LitElement {
  @property({ type: String }) scenarioId = '';
  @property({ type: String }) view = '';
  /** App-lifetime transport injected by WorkbenchApp: route/session changes
   *  replace this page's score but deliberately retain the copied clip. */
  @property({ attribute: false }) selectionClipboard: SelectionClipboardStore | null = null;

  /** Per-part instrument overrides (roadmap/inprogress/core-score-hud.md),
   *  keyed by part index: 'document' = no strings override, else a tuning
   *  preset name from setupGrammar. Presentation only — never written back.
   *  Single-part scores edit entry 0 through the toolbar selector; the HUD's
   *  ensemble table edits any entry. */
  @state() private partSetups = new Map<number, PartOverride>();

  @state() private doc: MnxDocument | null = null;
  @state() private rawScore = '';
  @state() private pinnedErrors: PinnedError[] = [];
  /** Which pinned error the json tab is highlighting — workbench chrome, and
   *  since stage 3 of the viewer surface it lives here rather than on the
   *  element (docs/core-viewer-surface.md). */
  @state() private errorPointer: string | null = null;
  @state() private referenceFailed = false;
  // Three states, not two: the score arrives over a lazy import, so "nothing
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
  @state() private selection: SelectionContext | null = null;
  /** One uncommitted tab digit, painted at the cursor for the 500 ms window. */
  @state() private pendingFret: number | null = null;
  private readonly tabDigits = new TabDigitResolver(
    fret => this.commitResolvedFret(fret),
    candidate => {
      this.pendingFret = candidate;
      this.syncFromSession();
    }
  );
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
   * `escalateToRail` and the `loadScore` it causes, not something a render
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
  @state() private setupPopover: PopoverKind | null = null;
  @state() private setupPopoverError = '';
  /** The assist tab's model choice and its query dialog
   *  (core-assist-model-selector.md's picker surface). */
  @state() private assistModel: string =
    localStorage.getItem(ASSIST_MODEL_KEY) ?? DEFAULT_ASSIST_MODEL;
  @state() private assistFallbacks: string[] = storedFallbacks();
  /** Which model actually answered — OpenRouter names it in every frame, and
   *  it is not always the one you picked once a chain is in play. */
  @state() private servedModel = '';
  @state() private modelPickerOpen = false;
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
  /** Esc hides the cursor highlight until the next intent (review sense-0). */
  private cursorHidden = false;

  /** Does the editor own the keyboard right now (core-editor-focus-scope.md
   *  stage 3)? Drives the overlay's dimming through the SAME predicate the
   *  key handler gates on, so the cursor can never claim a keystroke that
   *  would land elsewhere. Starts true: unclaimed focus counts as ours. */
  @state() private hasKeyboard = true;

  /** The side panel's active tab; falls back when the tab isn't available
   *  (hud/actions need a session). */
  @state() private panelTab: PanelTab = 'hud';
  private landingFocus = false;

  // ── The selection command tray (core-selection-tray-visuals.md), at its
  // VISUALS stage: real tabs and anchor from the session/viewer, DEMO tiles
  // from trayDemo.ts, and no intents fired — tab commits and tile flips are
  // page-local so the look and keyboard model can be reviewed before wiring.
  @state() private trayOpen = false;
  /** The rung inspector (roadmap/inprogress/workbench-rung-inspector.md):
   *  Enter with nothing pending opens it over the selection, where the tray
   *  sits. It and the tray are never open together — both want the keys. */
  @state() private inspectorOpen = false;
  @state() private inspectorMirrored = false;
  @state() private inspectorError: string | null = null;

  /** The zoom pad's two axes. `null` staff scale means FITTED — the renderer
   *  gets no pxPerSp and sizes the score to the viewport. */
  @state() private staffScale: number | null = storedScale(
    STAFF_SCALE_KEY,
    MIN_STAFF_SCALE,
    MAX_STAFF_SCALE
  );
  @state() private densityH: number | null = storedScale(
    DENSITY_H_KEY,
    MIN_DENSITY,
    MAX_DENSITY
  );
  /** What the viewer's last paint actually used, so a fitted readout can print
   *  a true number instead of assuming 100%. */
  @state() private effectiveStaffScale = 1;
  /** Previewed tab (row key), or null = the tab holding the selection. */
  @state() private trayTab: string | null = null;
  /** The selection's box in `.main` coordinates, from `selection-anchored`. */
  @state() private trayAnchor: TrayAnchor | null = null;
  @state() private traySearch = '';

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
  @state() private trayMirrored = false;

  /** Side panel width in px — the drag bar on its left edge adjusts it. */
  @state() private panelWidth = storedPanelWidth();

  /**
   * The panel folds away, like the rail (`Ctrl+Alt+B`, or the chevron at the
   * right of the view tabs) — the score takes the whole page.
   *
   * Remembered per browser, next to the width it does not disturb: folding is
   * not resizing to zero, and a reader who folds the panel expects their 480px
   * back when they unfold it. Same reasoning as the zoom pad's two keys.
   */
  @state() private panelHidden = localStorage.getItem(PANEL_HIDDEN_KEY) === '1';

  /** Read by the shell's palette, which labels the row show-or-hide. */
  get panelIsHidden(): boolean {
    return this.panelHidden;
  }

  /** Public because the shell's Ctrl+Alt+B reaches it the way the rail's
   *  Ctrl+B reaches `toggleRail` — one handler, one keymap, two panes. */
  togglePanel() {
    this.panelHidden = !this.panelHidden;
    localStorage.setItem(PANEL_HIDDEN_KEY, this.panelHidden ? '1' : '0');
  }

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
      :host {
        display: grid;
        grid-template-rows: auto 1fr;
        height: 100%;
        overflow: hidden;
      }

      /* The page head is the panel's tab strip in the same vocabulary: flush
         left, no padding of its own (the tabs carry it), and a full 2px ink
         rule under it. Band 2 for the score exactly as .panel-tabs is band 2
         for the panel (workbench-chrome-language.md).

         They do NOT line up horizontally, and cannot: .head spans the whole
         page ABOVE .body, so the panel's strip necessarily sits one band
         lower. The two read as one control because they are the same shape and
         the same mark, not because they share a baseline.

         The ground stays the score pane's --bg rather than --bg-context,
         because a tab strip takes the ground of the REGION IT HEADS — which is
         why .panel-tabs sits on the panel's --surface and this one does not. */
      .head {
        padding: 0;
        border-bottom: var(--rule-w) solid var(--ink);
        display: flex;
        align-items: stretch;
        justify-content: space-between;
        gap: 12px;
      }

      /* The panel's fold control, and deliberately the app header's rail
         chevron in a mirror: same glyphs, same borrowed-outline styling, same
         chevron-points-where-it-goes rule. The head spans the panel too, so
         this button stays put — and stays reachable — whichever state it is
         in, which a control living inside the panel could not do. */
      .panel-toggle {
        font-family: var(--mono);
        font-size: 12px;
        color: var(--ink-2);
        background: transparent;
        border: 1px solid var(--line-strong);
        border-radius: var(--radius-tab);
        padding: 1px 8px;
        /* Centred in the band rather than dropped to its baseline: the head
           lost its own padding when it became band 2
           (workbench-chrome-language.md), so the old margin-bottom: 6px
           against align-items: flex-end no longer has a gap to sit in. This
           also lines it up with .rail-toggle, its mirror in the app header,
           which already centred itself. */
        align-self: center;
        margin-right: 12px;
        cursor: pointer;
        flex: none;
      }

      .panel-toggle:hover {
        color: var(--accent);
        border-color: var(--accent);
      }

      .panel-toggle:focus-visible {
        outline: var(--rule-w) solid var(--focus-ring);
        outline-offset: 2px;
      }

      /* Title + id live in the description tab now — the head is tabs only. */
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

      .tabs {
        display: flex;
        gap: 0;
        align-items: stretch;
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

      /* Identical to .panel-tabs button, deliberately: the view tabs and the
         panel tabs are the same control doing the same job on two sides of one
         page, and before this they were a boxed 12px link and an uppercase
         10px label. The active one is marked by a 2px inset underline rather
         than by an outlined box — nothing floats in this system, so the mark
         goes under the word instead of around it. */
      .tabs a {
        font: 600 10px/1 var(--sans);
        letter-spacing: 0.11em;
        text-transform: uppercase;
        color: var(--ink-3);
        padding: 11px 12px;
        text-decoration: none;
        white-space: nowrap;
        display: flex;
        align-items: center;
      }

      .tabs a:hover[aria-current='false'] {
        color: var(--ink);
        background: var(--bg-context);
      }

      .tabs a[aria-current='true'] {
        color: var(--accent-fg);
        box-shadow: inset 0 -2px 0 var(--accent);
      }

      /* Score pane + the side panel (columns set inline — the drag bar). */
      .body {
        display: grid;
        overflow: hidden;
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
         sits at, which is why the two read as one decision. */
      mnx-score-viewer {
        padding: 14px;
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

      /* The zoom/density pad (core-zoom-density-pad.md). Top-RIGHT, pinned
         while the score scrolls — the viewer scrolls itself one level down, so
         an absolute child of .main simply stays put. z-index 4 puts it under
         the popover layer (5) and the tray (30): everything that can cover it,
         should. The panel needs no z-order at all, being a grid column rather
         than an overlay.

         The design's inset is 14px from this box; it is 28 here because the
         paper now starts at 14 and the pad would otherwise straddle its
         corner. Same 14px of clear space the design asked for — measured from
         the paper it overlays, which is what it was measuring when the bench
         behind it was empty. */
      mnx-zoom-pad {
        position: absolute;
        top: 28px;
        right: 28px;
        z-index: 4;
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
    return corpus.find(e => e.id === this.scenarioId) ?? null;
  }

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('view') || changed.has('scenarioId')) this.flushPendingFret();
    // Legacy ?view=compare|json deep links (the documented contract) open
    // the matching panel tab — the main pane keeps the default score view.
    if (changed.has('view') || changed.has('scenarioId')) {
      if (this.view === 'compare' || this.view === 'json') this.panelTab = this.view;
    }
    if (changed.has('scenarioId')) {
      // A PKCE landing brought us here to show its verdict: the assist tab
      // wins over the route's default exactly once (core-assist-byok.md).
      if (this.landingFocus) {
        this.panelTab = 'assist';
        this.landingFocus = false;
      } else if (this.view !== 'compare' && this.view !== 'json') {
        this.panelTab = 'hud';
      }
      this.doc = null;
      this.rawScore = '';
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
      this.selection = null;
      this.copied = false;
      this.setupPopover = null;
      this.setupPopoverError = '';
      this.showClipboardNotice(null);
      this.cursorHidden = false;
      this.trayOpen = false;
      this.trayTab = null;
      this.trayAnchor = null;
      // Overrides are per-part by INDEX, so carrying them to a different
      // document would misapply them.
      this.partSetups = new Map();
      void this.loadScore();
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
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('mnx-palette-intent', this.onPaletteIntent);
    window.addEventListener('mnx-palette-action', this.onPaletteAction);
    window.addEventListener('mnx-tray-intent', this.onTrayIntent);
    // Keyboard-ownership tracking re-reads `document.activeElement`, which is
    // always accurate; the only question is WHEN. Focus events are the
    // obvious trigger but are not dependable everywhere (headless Chrome
    // delivers none of the four to `window`, even for real clicks, while
    // activeElement updates correctly) — so the causes of focus change are
    // watched too: pointerdown (clicks) and keydown (Tab). Cheap, and it
    // keeps the overlay honest where focus events are silent.
    window.addEventListener('focusin', this.onFocusChange);
    window.addEventListener('focusout', this.onFocusChange);
    window.addEventListener('focus', this.onFocusChange, true);
    window.addEventListener('blur', this.onFocusChange, true);
    window.addEventListener('pointerdown', this.onFocusChange, true);
    window.addEventListener('pointerdown', this.onPointerDownOutside, true);
  }

  disconnectedCallback() {
    this.flushPendingFret();
    super.disconnectedCallback();
    window.removeEventListener('assist-credentials-change', this.onCredentialsChange);
    this.chatAbort?.abort();
    this.showClipboardNotice(null);
    clearTimeout(this.chipTimer);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('mnx-palette-intent', this.onPaletteIntent);
    window.removeEventListener('mnx-palette-action', this.onPaletteAction);
    window.removeEventListener('mnx-tray-intent', this.onTrayIntent);
    window.removeEventListener('focusin', this.onFocusChange);
    window.removeEventListener('focusout', this.onFocusChange);
    window.removeEventListener('focus', this.onFocusChange, true);
    window.removeEventListener('blur', this.onFocusChange, true);
    window.removeEventListener('pointerdown', this.onFocusChange, true);
    window.removeEventListener('pointerdown', this.onPointerDownOutside, true);
  }

  /** Focus may have moved — re-ask the ownership predicate. Deferred a task,
   *  not a microtask: `focusout` and `pointerdown` both fire BEFORE the new
   *  element is active, so an immediate read would see the outgoing state
   *  and every transition would flicker as "lost". */
  private onFocusChange = () => {
    setTimeout(() => {
      if (!this.isConnected) return;
      const nextHasKeyboard = editorHasKeyboard(this);
      if (!nextHasKeyboard) this.flushPendingFret();
      this.hasKeyboard = nextHasKeyboard;
      // The tray goes with the keyboard. It is a surface for acting on the
      // selection with keys it no longer receives, and one that advertises
      // shortcuts it cannot honour is the same lie the dimmed cursor exists
      // to avoid (core-editor-focus-scope.md, stage 3).
      if (!this.hasKeyboard) {
        this.trayOpen = false;
        this.inspectorOpen = false;
      }
    }, 0);
  };

  /** A pointer went down somewhere: close the tray unless it landed inside
   *  it. Capture phase and `composedPath`, so the check survives a handler
   *  that stops propagation and sees through the tray's shadow root — and
   *  nothing is prevented, so the click still reaches whatever it hit. */
  private onPointerDownOutside = (event: Event) => {
    if (!this.trayOpen && !this.inspectorOpen) return;
    const inOverlay = event
      .composedPath()
      .some(
        node =>
          node instanceof HTMLElement &&
          (node.tagName === 'MNX-SELECTION-TRAY' || node.tagName === 'MNX-RUNG-INSPECTOR')
      );
    if (!inOverlay) {
      this.trayOpen = false;
      this.inspectorOpen = false;
    }
  };

  private async loadScore() {
    const entry = this.entry();
    if (!entry) return;
    // Read-and-clear up front: a load that fails, or one the reader navigates
    // away from, must not leave the baton lying around for the NEXT scenario
    // to pick up as though a gesture had brought it there.
    const railRung = this.railRung;
    this.railRung = null;
    try {
      const score = (await entry.loadScore()) as MnxStructure;
      if (entry.id !== this.scenarioId) return; // navigated away meanwhile
      this.doc = {
        id: entry.id,
        name: entry.meta.title,
        lastUpdated: 0,
        mnxJson: score
      };
      this.rawScore = JSON.stringify(score, null, 2);
      if (entry.invalidByDesign) {
        this.pinnedErrors = await resolvePinnedErrors(score, entry.meta.expect.errors ?? []);
      } else {
        this.session = new EditorSession(score, entry.id, {
          ...(railRung ? { level: railRung } : {})
        });
        this.syncFromSession();
      }
      this.loadState = 'ready';
    } catch (e) {
      // The score is a lazy chunk: a dead dev server, an offline reload or a
      // half-deployed build all land here. Surfacing the reason is the whole
      // point — silently leaving the pane blank blames the renderer.
      if (entry.id !== this.scenarioId) return;
      this.loadState = 'failed';
      this.loadError = e instanceof Error ? e.message : String(e);
    }
  }

  /** Pull doc/selection out of the session after it changed. */
  private syncFromSession() {
    const session = this.session;
    if (!session || !this.doc) return;
    this.doc = { ...this.doc, mnxJson: session.doc };
    this.rawScore = JSON.stringify(session.doc, null, 2);
    const cursor = session.cursor;
    const partIndex = cursor.partIndex ?? 0;
    const staffIndex = cursor.staffIndex ?? 1;
    const measureSpan = measureSpans(session.doc)[cursor.measureIndex] ?? { num: 1, den: 1 };
    const rawPosition =
      (cursor.onset.num / cursor.onset.den) /
      Math.max(Number.EPSILON, measureSpan.num / measureSpan.den);
    const activePart = session.doc.parts?.[partIndex];
    const cursorGhost: NonNullable<SelectionContext['cursor']> = {
      ...session.cursorContext(),
      measureIndex: cursor.measureIndex,
      partIndex,
      staffIndex,
      position: Math.max(0, Math.min(1, rawPosition)),
      pendingFret: session.projection === 'tab' ? this.pendingFret : null,
      ...(
        activePart &&
        (session.doc.global?.measures?.length ?? 0) === 0 &&
        (activePart.measures?.length ?? 0) === 0
          ? { structuralEmpty: 'part-measure' as const }
          // The ghost bar past the end (core-rung-insert.md): the cursor is
          // standing where the next bar would go, and the vacancy is drawn
          // there instead of a cell in a bar that does not exist.
          : session.pastEnd
            ? { structuralEmpty: 'past-end' as const }
            : {}
      )
    };
    this.selection = {
      activePartId: activePart?.id ?? null,
      activeMeasureIndex: cursor.measureIndex,
      activeVoiceIndex: null,
      activeEventIndex: null,
      selectedNoteIds: this.cursorHidden ? [] : session.selectedNoteKeys,
      selectedEventIds: this.cursorHidden
        ? []
        : selectedRestKeys(session.doc, session.resolvedSelection.members),
      primaryProjection: session.projection,
      enclosure: this.cursorHidden ? null : ENCLOSURE_BY_LEVEL[session.selectionLevel],
      litLabels: !this.cursorHidden && LIT_LABEL_LEVELS.has(session.selectionLevel),
      span: this.cursorHidden
        ? null
        : presentationSpan(session.doc, session.selectionLevel, session.resolvedSelection.members),
      cursor: this.cursorHidden ? null : cursorGhost,
      preview: this.previewScope()
    };
  }

  /** The tray's previewed scope as a drawable footprint: the rung's own note
   *  keys computed WITHOUT moving the session, so previewing costs the
   *  document nothing and Escape has nothing to undo. Null unless a tray tab
   *  other than the selection's own is on display. */
  private previewScope(): SelectionContext['preview'] {
    const session = this.session;
    if (!session || !this.trayOpen || this.cursorHidden) return null;
    const level = this.trayTab ? LEVEL_BY_ROW[this.trayTab] : undefined;
    if (!level || level === session.selectionLevel) return null;
    return {
      enclosure: ENCLOSURE_BY_LEVEL[level],
      noteIds: selectionNoteKeys(
        session.doc,
        session.positions,
        session.cursor,
        level,
        session.projection
      )
    };
  }

  /** A click in the combined score chooses which rendering owns subsequent
   * spatial input. Note membership is still model state and therefore does
   * not fork: switching projection remaps the existing selection in place. */
  private onNoteSelected = (
    event: CustomEvent<{ projection?: 'notation' | 'tab' }>
  ) => {
    const projection = event.detail.projection;
    if (!this.session || !projection || projection === this.session.projection) return;
    this.flushPendingFret();
    if (this.session.handleIntent({ type: 'setProjection', projection })) {
      this.syncFromSession();
    }
  };

  /** Keep the session's projection following the pane on screen: notation
   *  pane → staff space, tab pane → fingerboard; the both view keeps its
   *  last (tab by default on tab documents). Recorded as an intent so traces
   *  replay navigation faithfully. */
  private followProjection() {
    const entry = this.entry();
    if (!entry || !this.session) return;
    const view = this.activeView(entry);
    const desired =
      view === 'tab' ? 'tab' : view === 'notation' ? 'notation' : null;
    if (!desired || desired === this.session.projection) return;
    if (desired === 'tab' && this.session.mode !== 'string') return;
    this.session.handleIntent({ type: 'setProjection', projection: desired });
  }

  /**
   * The pane-owned layer rule (survey §6.1, adopted in the roadmap doc):
   * digits belong to the pane on screen — frets when a tab pane is visible.
   * Bare arrows never mutate, so navigation is active on every score view.
   */
  private activeLayers(): KeymapLayer[] {
    const entry = this.entry();
    if (!entry || !this.session) return [];
    const view = this.activeView(entry);
    const layers: KeymapLayer[] = [];
    if (entry.hasTab && (view === 'tab' || view === 'both')) layers.push(TAB_DIGIT_LAYER);
    layers.push(NAVIGATION_LAYER, EDIT_LAYER);
    return layers;
  }

  private commitResolvedFret(fret: number) {
    if (!this.session) return;
    this.session.handleIntent({ type: 'enterFret', fret });
    this.cursorHidden = false;
    this.copied = false;
    this.syncFromSession();
  }

  private flushPendingFret(): boolean {
    return this.tabDigits.flush();
  }

  /**
   * Escape and Enter — the pending-gesture pair (`PENDING_PRECEDENCE` in
   * keymap.ts, which states the contract). Escape abandons the innermost
   * pending thing, Enter commits it, and they walk the same list in the same
   * order so neither can drift from the other.
   *
   * Levels 1–2 (popovers, tray, palette) never arrive here: overlays own
   * their keydown and `preventDefault()` before the page listener runs. This
   * is levels 3–5, and it is the whole reason these are shell actions rather
   * than intents — the fret resolver is the MOUNT's, the anchor is the
   * SESSION's, and deselection is neither.
   */
  private handlePending(action: 'abandonPending' | 'commitPending') {
    if (!this.session) return;
    const commit = action === 'commitPending';
    // 3. a half-typed fret. Enter ends the 500 ms window early rather than
    //    making the player wait it out; Escape drops the digit, the one path
    //    `TabDigitResolver.cancel()` has been waiting for a key to reach.
    if (this.tabDigits.pending !== null) {
      if (commit) this.flushPendingFret();
      else this.tabDigits.cancel();
      return;
    }
    // 4. an armed spanner anchor. Enter dispatches the intent the anchor's
    //    OWN letter would have — which is why the anchor carries its kind —
    //    so the trace records `toggleSlur` twice exactly as two presses of
    //    `S` do, and replay is unchanged.
    const anchor = this.session.spanAnchor;
    if (anchor) {
      this.stripIntent(
        commit
          ? anchor.kind === 'slur'
            ? { type: 'toggleSlur' }
            : { type: 'toggleBeam' }
          : { type: 'dropAnchor' }
      );
      return;
    }
    // 5. nothing pending. Escape deselects — view chrome, deliberately not
    //    session history, so it is never recorded and never replayed. Enter
    //    opens the rung inspector — LAST in the walk, so a half-typed fret or
    //    an armed spanner never opens one (the roadmap's agreement 1).
    if (!commit) {
      this.cursorHidden = true;
      this.syncFromSession();
    } else {
      this.openInspector();
    }
  }

  private onKeyDown = (event: KeyboardEvent) => {
    // Tab moves focus with no pointer event, so a keydown is also a
    // focus-change cause — re-ask after it settles.
    if (event.code === 'Tab') this.onFocusChange();
    // Scope (core-editor-focus-scope.md): the editor's keys are ours while
    // focus is inside this page (or unclaimed — nothing focused yet). The
    // listener is still window-scoped because the mount lives in
    // `workbench/`; the promotion moves it onto the host element and this
    // test becomes structural.
    if (!keyIsOurs(event, this)) return;
    const layers = this.activeLayers();
    const keyAction = this.session && layers.length > 0
      ? resolveKeyAction(strokeOf(event), layers)
      : null;
    if (keyAction?.type === 'tabDigit') {
      if (!this.session) return;
      event.preventDefault();
      if (this.session.projection !== 'tab' && this.session.mode === 'string') {
        this.session.handleIntent({ type: 'setProjection', projection: 'tab' });
      } else {
        this.followProjection();
      }
      this.cursorHidden = false;
      this.copied = false;
      this.tabDigits.push(keyAction.digit);
      return;
    }
    if (this.session && layers.length > 0) {
      const action = resolveShellAction(strokeOf(event));
      // The pending pair is excluded from the blanket flush: abandoning a
      // half-typed fret is the whole point of Escape, and flushing here would
      // commit it before Escape ever ran. Enter flushes too, but as its OWN
      // act (`handlePending` below), not as a side effect of arriving.
      const pending = action === 'abandonPending' || action === 'commitPending';
      if ((action || keyAction) && !pending) this.flushPendingFret();
      if (pending && action) {
        event.preventDefault();
        this.handlePending(action);
        return;
      }
      // The clipboard verbs (stage 6): resolved here because the store I/O is
      // the mount's — the session only ever sees the materialized plan. The
      // focus gate above is the whole scope story; text fields never reach
      // this point, so native copy/paste inside inputs is untouched.
      if (action === 'copySelection' || action === 'cutSelection' || action === 'pasteSelection') {
        if (!this.selectionClipboard) return;
        // Innermost open thing first (the Escape doctrine, applied to copy):
        // a live TEXT selection means the user is addressing the prose, not
        // the score — unclaimed focus counts as ours, so without this test a
        // mouse-selected paragraph would Ctrl+C the score instead.
        const text = window.getSelection();
        if (action !== 'pasteSelection' && text && !text.isCollapsed) return;
        event.preventDefault();
        if (action === 'copySelection') void this.copyCurrentSelection();
        else if (action === 'cutSelection') void this.cutCurrentSelection();
        else void this.pasteCurrentSelection();
        return;
      }
      if (action && this.openPopover(action)) {
        event.preventDefault();
        return;
      }
    }
    let intent: EditorIntent | null = keyAction;
    if (!intent || !this.session) return;
    event.preventDefault();
    this.followProjection();
    // The ladder does not end at the document (the navigation map's score
    // row): at the top rung the vertical neighbour is the next SCORE, which
    // the session cannot know and the element must not assume. The workbench
    // binds it to the rail; studio will bind the same gesture to its own
    // collection. Handled here rather than as an intent because it leaves the
    // document entirely — there is nothing for a trace to replay.
    if (
      (intent.type === 'lineUp' || intent.type === 'lineDown') &&
      this.session.selectionLevel === 'document' &&
      !this.cursorHidden
    ) {
      this.escalateToRail(intent.type === 'lineDown' ? 1 : -1);
      return;
    }
    // The system rungs, resolved HERE and dispatched as `goToMeasure` — the
    // stage-1 pattern: this layer already owns environment-dependent
    // interpretation, and it emits the RESOLVED intent so the session stays
    // deterministic and the trace records a bar, never a paint. `src/edit` may
    // import only `src/model`, so where the renderer wrapped the score is a
    // fact it structurally cannot see.
    // The absolute rung keys land in the SAME funnel as the chip's ▲▼, the
    // HUD's rows and the tray's ladder — `walkToLevel` — so a refusal flashes
    // identically however the rung was asked for.
    if (intent.type === 'goToLevel') {
      this.walkToLevel(intent.level);
      return;
    }
    const systemStep = this.resolveSystemStep(intent);
    if (systemStep !== undefined) {
      if (systemStep === null) return; // no neighbouring system — the arrow dies here
      intent = systemStep;
    }
    this.session.handleIntent(intent);
    // Every intent re-shows the cursor. Widening past the top used to fall
    // through to deselect here, because Escape was the widen key and had to
    // keep its universal meaning somehow; deselect is Escape's outright now
    // (`handlePending`), so relaxing is just navigation like the rest and the
    // top rung is simply where it stops (core-rung-addressing.md).
    this.cursorHidden = false;
    // Delete is the one verb whose two presses mean different things, so it
    // says which one this was — including when it declined. Everything else
    // that returns false is a navigation edge, where silence is the right
    // answer (core-delete-clears-then-removes.md).
    const deleted = intent.type === 'delete' ? this.session.lastDelete : null;
    if (deleted) this.showClipboardNotice(deleteSelectionNotice(deleted));
    this.copied = false;
    this.syncFromSession();
  };

  /**
   * The two rungs whose vertical arrow means "the neighbouring SYSTEM": bare
   * ↑↓ at the measure rung, and the Ctrl climb from part-measure (whose own
   * ↑↓ is the staff step, so the climb lands one rung further up).
   *
   * Returns the resolved `goToMeasure` intent, `null` when there is no
   * neighbouring system to move to, or `undefined` when this stroke is not a
   * system step at all — three answers, because "not mine" and "mine, but
   * nowhere to go" have to act differently at the call site.
   */
  private resolveSystemStep(intent: EditorIntent): EditorIntent | null | undefined {
    const session = this.session;
    if (!session || this.cursorHidden) return undefined;
    const level = session.selectionLevel;
    const vertical =
      (level === 'measure' && (intent.type === 'lineUp' || intent.type === 'lineDown')) ||
      (level === 'partMeasure' && (intent.type === 'jumpUp' || intent.type === 'jumpDown'));
    if (!vertical) return undefined;

    const rows = this.renderRoot?.querySelector<ScoreViewer>('mnx-score-viewer')?.systemRows();
    if (!rows || rows.length === 0) return null; // nothing painted yet
    const delta = intent.type === 'lineDown' || intent.type === 'jumpDown' ? 1 : -1;
    const target = neighbourSystemMeasure(rows, session.cursor.measureIndex, delta);
    return target === null ? null : { type: 'goToMeasure', measureIndex: target };
  }

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
    location.hash = scenarioHref(next.id, this.view || undefined);
  }

  private openPopover(action: ShellAction): boolean {
    this.flushPendingFret();
    // Only the popover actions are ours; palette actions belong to the shell.
    const kind = POPOVER_ACTIONS[action];
    if (!kind) return false;
    const entry = this.entry();
    if (kind === 'tuning' && !entry?.hasTab) return false;
    this.setupPopover = kind;
    this.setupPopoverError = '';
    // No panel tab to switch to any more: the popover is a page-level overlay
    // over the score (setupPopoverOverlay), so it is visible wherever the panel
    // happens to be — and opening one no longer moves the panel out from under
    // whatever you were reading.
    return true;
  }

  /** Palette items act on the editor through the same funnels as keys: the
   *  intent channel feeds the session (recorded in traces), the action
   *  channel drives page chrome (popovers, copy trace, revert). */
  private onPaletteIntent = (event: Event) => {
    // The palette took over (a global command ran from go-to's `>` list):
    // two overlays wanting the same keys is one too many.
    this.trayOpen = false;
    this.stripIntent((event as CustomEvent<EditorIntent>).detail);
  };

  private onPaletteAction = (event: Event) => {
    this.flushPendingFret();
    const action = (event as CustomEvent<string>).detail;
    if (action === 'copyTrace') void this.copyTrace();
    else if (action === 'revert') this.revertEdits();
    else this.openPopover(action as ShellAction);
  };

  // ── The selection command tray's mount ─────────────────────────────────────

  /** The shell's cancelable `/` intent: claim it while an editor session holds
   *  the keyboard; unclaimed, the shell opens go-to instead. */
  private onTrayIntent = (event: Event) => {
    if (!this.session || !this.hasKeyboard || this.loadState !== 'ready') return;
    event.preventDefault();
    this.openTray();
  };

  /** One door for `/` and the rung chip's click — the chip IS the `/` key. */
  private openTray() {
    this.flushPendingFret();
    // The tray offers a DIALECT — `S` slurs in notation and slides in tab —
    // so it must follow the pane exactly as the keys do. Without this the
    // projection keeps whatever it defaulted to (tab, on a string document)
    // and the notation pane would show the fingerboard's commands.
    this.followProjection();
    this.trayOpen = true;
    this.inspectorOpen = false;
    this.trayTab = null;
    this.traySearch = '';
    // Decided ONCE, here: the tray must not change sides while it is open,
    // and the chip it grew out of must have been on that side already.
    this.trayMirrored = this.trayAnchor ? this.mirrorAt(this.trayAnchor) : false;
    this.syncFromSession();
  }

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

  private closeTray() {
    this.trayOpen = false;
    // The keyboard goes back to the editor, not into the void.
    this.renderRoot.querySelector<HTMLElement>('mnx-score-viewer')?.focus();
  }

  /** Enter's door (handlePending, level 5). The inspector follows the pane
   *  and takes its side once, exactly as the tray does — it is the tray's
   *  sibling and hangs off the same anchor. */
  private openInspector() {
    if (!this.session || !this.hasKeyboard || this.loadState !== 'ready') return;
    if (this.cursorHidden) return;
    this.flushPendingFret();
    this.followProjection();
    this.trayOpen = false;
    this.inspectorError = null;
    this.inspectorMirrored = this.trayAnchor ? this.mirrorAt(this.trayAnchor) : false;
    this.inspectorOpen = true;
    this.syncFromSession();
  }

  private closeInspector() {
    this.inspectorOpen = false;
    this.inspectorError = null;
    this.renderRoot.querySelector<HTMLElement>('mnx-score-viewer')?.focus();
  }

  /** The inspector's line, applied: parse, fire, and either clear the error
   *  or say why not. A refusal by the session (a time signature that does
   *  not fit, a key nothing declared) is said too — the keystroke must not
   *  read as broken. */
  private applyInspectorLine(word: string | null, text: string) {
    if (!this.session) return;
    const parsed = parseInspectorLine(word, text);
    if ('error' in parsed) {
      this.inspectorError = parsed.error;
      return;
    }
    this.fireFromInspector(parsed.intent);
  }

  private fireFromInspector(intent: EditorIntent) {
    if (!this.session) return;
    this.flushPendingFret();
    this.cursorHidden = false;
    const ok = this.session.handleIntent(intent);
    this.inspectorError = ok ? null : 'the document refused that — nothing to remove, or it does not fit';
    this.copied = false;
    this.syncFromSession();
  }

  /**
   * Which edge does the whole object hang from? The spec's rule, in its own
   * order: prefer left-anchored, and mirror only when the tray's right edge
   * would pass the score's right edge minus a margin — and only when there is
   * actually room to the left, since mirroring into a clamp would move the
   * word for nothing. The CHIP asks this every render (closed, it is free to
   * follow the selection); the TRAY is handed the answer once, at open.
   */
  private mirrorAt(anchor: TrayAnchor): boolean {
    if (this.mainWidth <= 0) return false;
    return (
      anchor.x + TRAY_WIDTH > this.mainWidth - TRAY_MIRROR_MARGIN &&
      anchor.x + anchor.width - TRAY_WIDTH >= TRAY_EDGE_GAP
    );
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
    if (!this.chipLevel || !this.trayAnchor || this.trayOpen) return nothing;
    const trayEstimate = TRAY_SHAFT_H + 200; // the tray's own fallback height
    const anchor = this.trayAnchor;
    const below = anchor.y + anchor.height + TRAY_EDGE_GAP;
    const flip =
      this.mainHeight > 0 &&
      below + trayEstimate > this.mainHeight &&
      anchor.y - trayEstimate > 0;
    const top = flip ? anchor.y - TRAY_EDGE_GAP : below;
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
        title="selection commands (/)"
        aria-live="polite"
        @click=${() => this.openTray()}
      >
        ${ROW_BY_LEVEL[this.chipLevel]}
      </button>
      <div class="chip-mics">${mic('up', up)}${mic('down', down)}</div>
      ${this.chipDest
        ? html`<span class="chip-dest"
            >${this.chipDest.dir === 'up' ? '▲' : '▼'} ${this.chipDest.label}</span
          >`
        : nothing}
    </div>`;
  }

  /**
   * The tray's view model: a pure projection of registry + session, rebuilt
   * every render. The rungs are the ladder's present ones (the HUD's rows, so
   * the tray and the HUD can never disagree about the address), in the HUD's
   * own widest-first order so the two columns on screen run the same way;
   * tiles are the registry filtered to the displayed rung, each drawing its
   * own state from the document.
   *
   * The displayed rung is the previewed one when a preview is open, else the
   * session's own level — preview never touches the session.
   */
  private trayView(entry: ScenarioEntry): {
    rungs: TrayRung[];
    meta: TrayMeta | null;
    bands: TrayBand[];
    commands: EditorCommand[];
  } | null {
    if (!this.session) return null;
    // Widest first — `document` at the top, `note` at the bottom, which is the
    // HUD's own order rather than its inverse. One direction now serves the
    // whole screen: up is wider in the keys, in the chip's ▲, in the HUD's
    // column and in this one.
    const ladder = buildHudRows(entry.meta.title, this.session, this.cursorHidden);
    if (ladder.length === 0) return null;
    // With nothing selected no row is active, and the rung to fall back on is
    // the floor — the narrowest, which is now the LAST row rather than the
    // first. Reading it off the end keeps that independent of the order.
    const baseKey = ladder.find(r => r.active)?.key ?? ladder[ladder.length - 1].key;
    // `global` is the scope ABOVE the ladder, so unlike the rungs it is never
    // presence-filtered — the document is always there
    // (core-selection-tray-global-tab.md). Above, now literally: it sits at
    // the head of the column, where a scope wider than the widest rung
    // belongs.
    const known = (key: string | null) =>
      key === GLOBAL_TAB || ladder.some(r => r.key === key);
    const displayKey = known(this.trayTab) ? this.trayTab! : baseKey;

    const rungs: TrayRung[] = [
      {
        key: GLOBAL_TAB,
        label: GLOBAL_TAB,
        active: displayKey === GLOBAL_TAB,
        holdsSelection: false,
        // Not a rung: there is no selection to widen to the document.
        committable: false
      },
      ...ladder.map(r => ({
        key: r.key,
        label: r.label,
        active: r.key === displayKey,
        holdsSelection: r.key === baseKey,
        // The digit that JUMPS here, read off the ladder itself — not this
        // row's position in the column. The column is presence-filtered, so
        // counting the rows on screen would print a different number for the
        // same rung in a different document, which is the one thing an
        // absolute address may not do (core-rung-addressing.md 8).
        ordinal: LADDER_JUMP_LEVELS.indexOf(LEVEL_BY_ROW[r.key]) + 1
      }))
    ];

    const view = sessionView(this.session);
    const q = this.traySearch.trim().toLowerCase();
    const scope: CommandScope =
      displayKey === GLOBAL_TAB ? 'session' : LEVEL_BY_ROW[displayKey];
    const commands = commandsForScope(scope, view).filter(
      command =>
        !q ||
        command.label.toLowerCase().includes(q) ||
        (command.detail?.toLowerCase().includes(q) ?? false)
    );
    const asTile = (command: EditorCommand): TrayTile => ({
      id: command.id,
      glyph: command.glyph,
      shortcut: command.shortcut ?? '',
      label: command.label,
      detail: command.detail,
      state: commandState(command, view),
      // Purple until the registry says someone vouched for this command AT
      // THIS RUNG — the triage ledger's one product-visible consequence
      // (roadmap/proposed/core-selection-tray-residue.md). The scope is the
      // tab being drawn, not the command's whole `scopes` list, which is the
      // whole point of the per-scope mark.
      untriaged: !isTriaged(command, scope)
    });
    // Bands are cut from the ALREADY-FILTERED list, so a caption is only ever
    // drawn over tiles that survived the query.
    const bands: TrayBand[] = bandsForScope(scope, commands).map(band => ({
      id: band.id,
      caption: band.caption,
      tiles: band.commands.map(asTile)
    }));
    // The page's OWN commands join the global tab as their own trailing band:
    // they act on the session's history and fixtures rather than on the
    // document, so `edit/` has no business knowing them — which is also why
    // they carry no caption from a table that does not describe them.
    // `fireTrayCommand` recognises the prefix and never consults the registry.
    if (displayKey === GLOBAL_TAB) {
      const chrome = this.chromeCommands().filter(
        tile => !q || tile.label.toLowerCase().includes(q)
      );
      if (chrome.length > 0) bands.push({ id: 'chrome', tiles: chrome });
    }

    const displayRow = ladder.find(r => r.key === displayKey);
    const live = bands
      .flatMap(band => band.tiles)
      .filter(t => t.state !== 'unavailable').length;
    const meta: TrayMeta = {
      primary: displayKey === GLOBAL_TAB ? 'session' : (displayRow?.label ?? ''),
      secondary:
        displayKey === GLOBAL_TAB
          ? entry.meta.title
          : [selectionMemberSummary(view), displayRow?.value ?? ''].filter(Boolean).join(' · '),
      count: `${live} command${live === 1 ? '' : 's'}`
    };

    return { rungs, meta, bands, commands };
  }

  /** Workbench-tier commands for the global tab — the session's own chrome,
   *  which is the page's to run and not the registry's to describe. */
  private chromeCommands(): TrayTile[] {
    const session = this.session;
    if (!session) return [];
    const tiles: TrayTile[] = [
      ...(this.selectionClipboard ? [
        {
          id: `${CHROME_PREFIX}copy-selection`,
          glyph: { smufl: 'repeat1Bar' } as const,
          shortcut: 'Ctrl+C',
          label: 'Copy current selection',
          state: 'available' as const
        },
        {
          id: `${CHROME_PREFIX}paste-selection`,
          glyph: { smufl: 'arrowBlackLeft' } as const,
          shortcut: 'Ctrl+V',
          label: 'Paste copied selection here',
          state: 'available' as const
        },
        {
          id: `${CHROME_PREFIX}cut-selection`,
          glyph: { arc: 'slur' } as const,
          shortcut: 'Ctrl+X',
          label: 'Cut current selection',
          state: session.selectionLevel === 'document' ? 'unavailable' as const : 'available' as const
        }
      ] : []),
      {
        id: `${CHROME_PREFIX}copy-trace`,
        glyph: { smufl: 'repeat1Bar' },
        shortcut: '',
        label: 'Copy this session as a trace fixture',
        state: session.intentLog.length === 0 ? 'unavailable' : 'available'
      }
    ];
    if (session.dirty) {
      tiles.push({
        id: `${CHROME_PREFIX}revert`,
        glyph: { smufl: 'arrowBlackLeft' },
        shortcut: '',
        label: 'Revert every edit',
        state: 'available'
      });
    }
    // Chrome tiles are the page's, so there is no registry row to carry their
    // marks — and no reviewer has clicked them either. They are purple on the
    // same terms as everything else (the ledger lists them in their own
    // table), and, like a registry row, never while unavailable.
    return tiles.map(tile =>
      tile.state === 'unavailable' ? tile : { ...tile, untriaged: true }
    );
  }

  /** A tile fired: resolve the command against the CURRENT session and send
   *  what it asks for through the one funnel — an intent to the session, or a
   *  typed popover to open. Never `applyOp`, so every tray edit lands in the
   *  op queue with provenance and replays in a trace. */
  private fireTrayCommand(entry: ScenarioEntry, id: string) {
    if (!this.session) return;
    if (id.startsWith(CHROME_PREFIX)) {
      const chrome = id.slice(CHROME_PREFIX.length);
      this.trayOpen = false;
      if (chrome === 'copy-selection') void this.copyCurrentSelection();
      else if (chrome === 'paste-selection') void this.pasteCurrentSelection();
      else if (chrome === 'cut-selection') void this.cutCurrentSelection();
      else if (chrome === 'copy-trace') void this.copyTrace();
      else if (chrome === 'revert') this.revertEdits();
      return;
    }
    const command = this.trayView(entry)?.commands.find(c => c.id === id);
    if (!command?.action) return;
    const action = command.action(sessionView(this.session));
    if (!action) return;
    if ('surface' in action) {
      // The tray is where a typed grammar becomes discoverable; it does not
      // reimplement one. Opening the popover closes the tray, because both
      // want the same keystrokes.
      this.trayOpen = false;
      this.openPopover(action.surface);
      return;
    }
    // AND THE INTENT BRANCH CLOSES TOO. Both branches above already did — the
    // popover one because "both want the same keystrokes" — and this one was
    // simply never given the line. Firing a command is a completed act: the
    // tray covers the score you just changed, so leaving it up hides the
    // result and leaves the keyboard aimed at a search box instead of the
    // music. `closeTray` also hands focus back to the viewer, so the next
    // keystroke edits.
    this.closeTray();
    this.stripIntent(action.intent);
  }

  private inspectorOverlay(entry: ScenarioEntry) {
    if (!this.session) return nothing;
    const view = buildInspectorView(entry.meta.title, this.session, this.cursorHidden);
    return html`
      <mnx-rung-inspector
        .crumbs=${view.crumbs}
        .pills=${view.pills}
        .words=${view.words}
        .primary=${view.primary}
        .secondary=${view.secondary}
        .note=${view.note}
        .error=${this.inspectorError}
        .anchor=${this.trayAnchor}
        ?mirrored=${this.inspectorMirrored}
        @inspector-level=${(e: CustomEvent<{ direction: 'relax' | 'tighten' }>) => {
          this.fireFromInspector({
            type: e.detail.direction === 'relax' ? 'relaxSelection' : 'tightenSelection'
          });
        }}
        @inspector-goto=${(e: CustomEvent<{ intent: EditorIntent }>) => {
          this.fireFromInspector(e.detail.intent);
        }}
        @inspector-apply=${(e: CustomEvent<{ word: string | null; text: string }>) => {
          this.applyInspectorLine(e.detail.word, e.detail.text);
        }}
        @inspector-remove=${(e: CustomEvent<{ key: string; intent: EditorIntent }>) => {
          this.fireFromInspector(e.detail.intent);
        }}
        @inspector-widen=${() => {
          // `/` in the inspector: the verbs live in the tray. Same anchor,
          // same side, the other surface.
          this.inspectorOpen = false;
          this.openTray();
        }}
        @inspector-close=${() => this.closeInspector()}
      ></mnx-rung-inspector>
    `;
  }

  private trayOverlay(entry: ScenarioEntry) {
    const view = this.trayView(entry);
    if (!view) return nothing;
    return html`
      <mnx-selection-tray
        .rungs=${view.rungs}
        .meta=${view.meta}
        .bands=${view.bands}
        .anchor=${this.trayAnchor}
        .searchText=${this.traySearch}
        ?mirrored=${this.trayMirrored}
        @tray-rung-preview=${(e: CustomEvent<{ key: string }>) => {
          this.trayTab = e.detail.key;
          this.syncFromSession();
        }}
        @tray-rung-commit=${(e: CustomEvent<{ key: string }>) => {
          this.walkToLevel(LEVEL_BY_ROW[e.detail.key]);
          this.trayTab = null;
        }}
        @tray-command=${(e: CustomEvent<{ id: string }>) => {
          this.fireTrayCommand(entry, e.detail.id);
        }}
        @tray-search=${(e: CustomEvent<{ text: string }>) => {
          this.traySearch = e.detail.text;
        }}
        @tray-widen=${(e: CustomEvent<{ text: string }>) => {
          // A second `/`: the same question, asked of everything. Since the
          // global commands are a RUNG now, widening moves one scope outward
          // and stays in this surface — no widget switch, no context lost
          // (core-selection-tray-global-tab.md). The typed text carries over.
          this.trayTab = GLOBAL_TAB;
          this.traySearch = e.detail.text;
        }}
        @tray-close=${() => this.closeTray()}
      ></mnx-selection-tray>
    `;
  }

  updated() {
    if (this.setupPopover) {
      this.renderRoot.querySelector<HTMLInputElement>('.popover input')?.focus();
    }
  }

  private onPopoverKey(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    if (event.code === 'Escape') {
      event.preventDefault();
      this.setupPopover = null;
      return;
    }
    if (event.code !== 'Enter') return;
    event.preventDefault();
    if (this.setupPopover === 'time') {
      const time = parseTimeSignature(input.value);
      if (!time) {
        this.setupPopoverError = 'not a time signature — try 4/4, 6/8, common, 2/2 cut, or “inherit”';
        return;
      }
      this.stripIntent(
        time === 'inherit'
          ? { type: 'removeTimeSignature' }
          : {
              type: 'setTimeSignature',
              count: time.count,
              unit: time.unit,
              ...(time.display ? { display: time.display } : {})
            }
      );
    } else if (this.setupPopover === 'layout') {
      const sentence = parseLayoutSentence(input.value);
      if (!sentence) {
        this.setupPopoverError =
          'not a layout sentence — try “layout L1: bracket [ vn1, vn2 ]”, “score \u201cPart A\u201d: layout L1”, “mmrest m3 x2”, or “no layout 2”';
        return;
      }
      // The id is the primary key: naming an existing layout replaces it in
      // place, and only a NEW one needs somewhere to go (the typed slot, else
      // the end). Same for a score, by name.
      const doc = this.session?.doc;
      if ('layout' in sentence) {
        const existing = (doc?.layouts ?? []).findIndex(l => l.id === sentence.layout.id);
        const index = existing >= 0 ? existing
          : Number.isNaN(sentence.layout.index) ? (doc?.layouts?.length ?? 0)
          : sentence.layout.index;
        this.stripIntent({
          type: 'setLayout',
          index,
          layout: { id: sentence.layout.id, content: sentence.layout.content }
        });
      } else if ('score' in sentence) {
        const existing = (doc?.scores ?? []).findIndex(sc => sc.name === sentence.score.value.name);
        const index = existing >= 0 ? existing
          : Number.isNaN(sentence.score.index) ? (doc?.scores?.length ?? 0)
          : sentence.score.index;
        this.stripIntent({ type: 'setScore', index, score: sentence.score.value });
      } else if ('multimeasureRest' in sentence) {
        this.stripIntent({ type: 'addMultimeasureRest', ...sentence.multimeasureRest });
      } else {
        this.stripIntent(
          sentence.removeDocument === 'layout'
            ? { type: 'removeLayout', index: sentence.index }
            : sentence.removeDocument === 'score'
              ? { type: 'removeScore', index: sentence.index }
              : { type: 'removeMultimeasureRest', scoreIndex: 0, index: sentence.index }
        );
      }
    } else if (this.setupPopover === 'tuning') {
      const tuning = parseTuning(input.value);
      if (!tuning) {
        this.setupPopoverError = `not a tuning — a preset (${TUNING_PRESET_NAMES.join(', ')}) or pitches low→high like D2 A2 D3 G3 A3 D4`;
        return;
      }
      this.stripIntent({ type: 'setTuning', tuning });
    } else if (this.setupPopover === 'part') {
      // "capo 3" / "no strings" change THIS part; anything else names a new one.
      const declaration = parsePartDeclaration(input.value);
      if (declaration) {
        this.stripIntent(
          'support' in declaration
            ? { type: 'setSupport', key: declaration.support.key, value: declaration.support.value }
            : 'set' in declaration
            ? { type: 'setPartDeclaration', declaration: declaration.set }
            : { type: 'removePartDeclaration', kind: declaration.remove }
        );
        this.setupPopover = null;
        return;
      }
      // parsePart never fails: empty input is an anonymous part (legal MNX).
      const part = parsePart(input.value);
      const intent: Extract<EditorIntent, { type: 'addPart' }> = { type: 'addPart' };
      if (part.partId !== undefined) intent.partId = part.partId;
      if (part.name !== undefined) intent.name = part.name;
      this.stripIntent(intent);
    } else if (this.setupPopover === 'clef') {
      const clef = parseClef(input.value);
      if (!clef) {
        this.setupPopoverError = `not a clef — one of ${CLEF_NAME_LIST.join(', ')}, or “inherit”`;
        return;
      }
      // `inherit` is removal: the bar reverts to the predecessor's governance
      // (campaign item 5's inherited-attribute class), never to "no clef".
      this.stripIntent(
        clef === 'inherit'
          ? { type: 'removeClef' }
          : {
              type: 'setClef',
              sign: clef.sign,
              staffPosition: clef.staffPosition,
              ...(clef.octave ? { octave: clef.octave } : {})
            }
      );
    } else if (this.setupPopover === 'lyric') {
      const parsed = parseLyric(input.value);
      if (!parsed) {
        this.setupPopoverError = `not a lyric — ${LYRIC_HELP}`;
        return;
      }
      this.stripIntent(
        'syllable' in parsed
          ? {
              type: 'setSyllable',
              line: parsed.line,
              text: parsed.syllable,
              ...(parsed.syllableType ? { syllableType: parsed.syllableType } : {})
            }
          : 'removeSyllable' in parsed
            ? { type: 'removeSyllable', line: parsed.removeSyllable }
            : 'removeLine' in parsed
              ? { type: 'removeLyricLine', line: parsed.removeLine }
              : {
                  type: 'setLyricLine',
                  line: parsed.line,
                  ...(parsed.label !== undefined ? { label: parsed.label } : {}),
                  ...(parsed.lang !== undefined ? { lang: parsed.lang } : {})
                }
      );
    } else if (this.setupPopover === 'adornment') {
      const parsed = parseAdornment(input.value);
      if (!parsed) {
        this.setupPopoverError = `not an adornment — ${ADORNMENT_HELP}`;
        return;
      }
      this.stripIntent(
        'fingering' in parsed
          ? { type: 'setFingering', hand: parsed.fingering.hand, finger: parsed.fingering.finger }
          : 'removeFingering' in parsed
            ? { type: 'removeFingering' }
            : 'technique' in parsed
          ? {
              type: 'toggleTechnique',
              kind: parsed.technique.kind,
              ...(parsed.technique.semitones !== undefined
                ? { semitones: parsed.technique.semitones }
                : {}),
              ...(parsed.technique.release ? { release: true } : {})
            }
          : 'accidental' in parsed
          ? parsed.accidental === 'remove'
            ? { type: 'removeAccidentalDisplay' }
            : {
                type: 'setAccidentalDisplay',
                show: parsed.accidental.show,
                ...(parsed.accidental.parenthesized ? { parenthesized: true } : {})
              }
          : 'removeStringAnnotation' in parsed
          ? { type: 'removeStringAnnotation' }
          : 'marking' in parsed
          ? parsed.remove
            ? { type: 'removeMarking', marking: parsed.marking }
            : {
                type: 'setMarking',
                marking: parsed.marking,
                ...(parsed.attributes ? { attributes: parsed.attributes } : {})
              }
          : 'positioned' in parsed
            ? { type: 'setPositioned', attribute: parsed.positioned }
            : { type: 'removePositioned', kind: parsed.removePositioned }
      );
    } else if (this.setupPopover === 'bar') {
      const parsed = parseBarAttribute(input.value);
      if (!parsed) {
        this.setupPopoverError = `not a bar attribute — ${BAR_ATTRIBUTE_HELP}`;
        return;
      }
      if ('rhythm' in parsed) {
        this.stripIntent(
          parsed.rhythm === 'fullMeasureRest'
            ? parsed.remove
              ? { type: 'removeFullMeasureRest' }
              : {
                  type: 'setFullMeasureRest',
                  ...(parsed.visualDuration ? { visualDuration: parsed.visualDuration } : {})
                }
            : parsed.remove
              ? { type: 'removeMeasureRepeat' }
              : {
                type: 'setMeasureRepeat',
                number: parsed.number ?? 1,
                ...(parsed.counter ? { counter: parsed.counter } : {})
              }
        );
      } else {
        this.stripIntent(
          'set' in parsed
            ? { type: 'setMeasureAttribute', attribute: parsed.set }
            : { type: 'removeMeasureAttribute', kind: parsed.remove }
        );
      }
    } else if (this.setupPopover === 'rhythm') {
      const parsed = parseRhythm(input.value);
      if (!parsed) {
        this.setupPopoverError = `not a rhythm declaration — ${RHYTHM_HELP}`;
        return;
      }
      this.stripIntent(
        'space' in parsed
          ? { type: 'insertSpace', duration: parsed.space }
          : 'rest' in parsed
            ? { type: 'setRestSpelling', duration: parsed.rest }
          : {
              type: 'wrapInContainer',
              spec: parsed.wrap,
              ...(parsed.count === undefined ? {} : { count: parsed.count })
            }
      );
    } else if (this.setupPopover === 'key') {
      const key = parseKeySignature(input.value);
      if (!key) {
        this.setupPopoverError = 'not a key — C, Bb, F#, a fifths count like -3, or “inherit”';
        return;
      }
      this.stripIntent(
        key === 'inherit' ? { type: 'removeKeySignature' } : { type: 'setKeySignature', fifths: key.fifths }
      );
    }
    this.setupPopover = null;
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
    if (!this.session || !target) return;
    this.flushPendingFret();
    this.cursorHidden = false;
    // One intent, not a walk. The loop this replaced stepped relax/tighten
    // until a step failed to move, which PARKED on the nearest reachable rung
    // when the target was absent — tolerable while every caller was stepping
    // anyway, a lie once Shift+3 claims to address `container` directly. The
    // session owns the presence rule now and refuses; a refusal flashes the
    // chip, because a dead key with no feedback is what teaches people a
    // shortcut cannot be trusted. The trace gets one jump per gesture.
    if (!this.session.handleIntent({ type: 'goToLevel', level: target })) this.flashRungRefusal();
    this.copied = false;
    this.syncFromSession();
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
    if (!this.session) return;
    this.flushPendingFret();
    this.cursorHidden = false;
    this.session.handleIntent(intent);
    this.copied = false;
    this.syncFromSession();
  }

  private async copyTrace() {
    if (!this.session) return;
    await navigator.clipboard.writeText(JSON.stringify(this.session.trace(), null, 2) + '\n');
    this.copied = true;
  }

  /** The clipboard surface: Ctrl/⌘+C/X/V and the tray's explicit actions,
   *  both landing here. Every outcome — success or precise refusal — becomes
   *  the transient notice; a refusal must be SAID, or the keystroke reads as
   *  broken rather than conservative. */
  private showClipboardNotice(notice: ClipboardNotice | null) {
    clearTimeout(this.clipboardNoticeTimer);
    this.clipboardNotice = notice;
    if (notice) {
      this.clipboardNoticeTimer = setTimeout(() => {
        this.clipboardNotice = null;
      }, 5000);
    }
  }

  private async copyCurrentSelection() {
    if (!this.session || !this.selectionClipboard) return;
    const result = await copySelectionToStore(this.session, this.selectionClipboard);
    this.showClipboardNotice(copySelectionNotice(result));
  }

  private async pasteCurrentSelection() {
    if (!this.session || !this.selectionClipboard) return;
    const result = await pasteSelectionFromStore(this.session, this.selectionClipboard);
    this.showClipboardNotice(pasteSelectionNotice(result));
    if (!result.ok) return;
    this.cursorHidden = false;
    this.copied = false;
    this.syncFromSession();
  }

  private async cutCurrentSelection() {
    if (!this.session || !this.selectionClipboard) return;
    const result = await cutSelectionToStore(this.session, this.selectionClipboard);
    this.showClipboardNotice(cutSelectionNotice(result));
    if (!result.ok) return;
    this.cursorHidden = false;
    this.copied = false;
    this.syncFromSession();
  }

  /** The id is the thing you paste into a `/verify` sentence or a commit
   *  message, so it gets a copy button rather than a careful double-click. */
  private async copyId(id: string) {
    await navigator.clipboard.writeText(id);
    this.copiedId = true;
  }

  private revertEdits() {
    if (!this.session) return;
    this.session = new EditorSession(this.session.initial, this.scenarioId);
    this.copied = false;
    this.syncFromSession();
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
    // Unspecified (or no-longer-available, or legacy compare/json) view:
    // the document's own hint.
    return this.defaultView();
  }

  /** The document's preferred view when the URL names none: its `staffKind`
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
        <strong>Could not load this scenario's score.</strong>
        <p>
          <code>score.mnx.json</code> is fetched as a lazy chunk, so this is a transport failure,
          not a rendering one — most often a stopped <code>npm run dev</code> server or a stale
          tab against a redeployed build. Reload once the server is back.
        </p>
        <p class="detail">${this.loadError}</p>
      </div>`;
    }
    // The spec-gap exhibit is WORKBENCH chrome, not the viewer's job
    // (docs/core-viewer-surface.md, stage 3): the document is the exhibit and
    // rendering is deliberately skipped, so the score element is not involved
    // at all. It used to ride on the element as three props an embed could
    // never want.
    if (entry.invalidByDesign) return this.exhibit();

    return html`
      <mnx-score-viewer
        .mnxDoc=${this.doc}
        .view=${viewMode}
        .zoom=${this.staffScale}
        .densityH=${this.densityH}
        .partTabSetups=${this.partTabSetups()}
        .selection=${this.selection}
        .selectionInactive=${!this.hasKeyboard}
        @note-selected=${this.onNoteSelected}
        @selection-anchored=${this.onSelectionAnchored}
        @render-scale=${this.onRenderScale}
      ></mnx-score-viewer>
    `;
  }

  private onRenderScale(event: CustomEvent<RenderScale>) {
    this.effectiveStaffScale = event.detail.staffScale;
  }

  /** Which spacing values actually change the score the viewer just drew — the
   *  pad walks these instead of stepping a flat percentage through values the
   *  justifier absorbs. Asked live rather than pushed: it moves with the
   *  viewport, and the viewer caches it per paint. */
  private densitySteps = () =>
    this.renderRoot?.querySelector<ScoreViewer>('mnx-score-viewer')?.densitySteps() ?? null;

  private onZoomChange(event: CustomEvent<ZoomPadChange>) {
    const { staffScale, densityH } = event.detail;
    this.staffScale = staffScale;
    this.densityH = densityH;
    // Absence is the "unset" state, so reset REMOVES rather than writing a
    // sentinel — otherwise the next load could not tell "fitted" from "1.0".
    if (staffScale === null) localStorage.removeItem(STAFF_SCALE_KEY);
    else localStorage.setItem(STAFF_SCALE_KEY, String(staffScale));
    if (densityH === null) localStorage.removeItem(DENSITY_H_KEY);
    else localStorage.setItem(DENSITY_H_KEY, String(densityH));
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
      <div class="head">
        <div class="tabs">
          ${views.map(
            v => html`
              <a href=${scenarioHref(entry.id, v)} aria-current=${v === view}>${v}</a>
            `
          )}
        </div>
        <button
          class="panel-toggle"
          title="${this.panelHidden ? 'show' : 'hide'} the score panel (Ctrl+Alt+B)"
          aria-label="${this.panelHidden ? 'show' : 'hide'} the score panel"
          aria-expanded=${!this.panelHidden}
          @click=${() => this.togglePanel()}
        >
          ${this.panelHidden ? '⟨' : '⟩'}
        </button>
      </div>
      <div
        class="body"
        style="grid-template-columns: 1fr ${this.panelHidden ? 0 : this.panelWidth}px"
      >
        <div class="main">
          ${this.viewer(entry, view)}
          ${this.loadState === 'ready' && !entry.invalidByDesign
            ? html`<mnx-zoom-pad
                .staffScale=${this.staffScale}
                .densityH=${this.densityH}
                .densitySteps=${this.densitySteps}
                .effectiveStaffScale=${this.effectiveStaffScale}
                ?suppressed=${this.trayOpen}
                @zoom-change=${this.onZoomChange}
              ></mnx-zoom-pad>`
            : nothing}
          ${this.trayOpen && this.session ? this.trayOverlay(entry) : nothing}
          ${this.inspectorOpen && this.session ? this.inspectorOverlay(entry) : nothing}
          ${this.setupPopoverOverlay()}
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
        ${this.panelHidden ? nothing : this.sidePanel(entry)}
      </div>
    `;
  }

  // ---- The side panel (roadmap/inprogress/core-score-hud.md): the page's
  // chrome, one tab each — description, tags (badges + defs), actions (the
  // former edit strip), the HUD, the spec reference, the raw JSON.

  private panelTabs(): PanelTab[] {
    const tabs: PanelTab[] = ['description'];
    if (this.session) tabs.push('ops', 'hud');
    tabs.push('assist', 'compare', 'json');
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
        ${cell('approved', approved ? approved.slice(0, 10) : 'never')}
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

  /** THE SETUP POPOVER, REHOMED (roadmap/proposed/workbench-score-panel.md, step A).
   *
   *  It used to render inside the `actions` tab, and `openPopover()` force-switched
   *  the panel there so a keyboard-opened popover would be visible — which meant
   *  pressing Shift+K yanked the panel away from whatever you were reading. It is
   *  a page-level overlay now, so the popover appears over the score where the
   *  edit is happening and the panel keeps its place. Worth doing on its own
   *  merits; retiring the tab is what forced the issue.
   *
   *  Anchored bottom-left of `.main`, deliberately clear of the tray's own
   *  bottom-centre dock so the two overlays cannot collide. */
  private setupPopoverOverlay() {
    if (!this.setupPopover) return nothing;
    const spec = POPOVER_SPECS[this.setupPopover];
    return html`
      <div class="popover-layer">
        <div class="popover">
          <span class="pop-label">${spec.label}</span>
          <input
            placeholder=${spec.placeholder}
            @keydown=${(e: KeyboardEvent) => this.onPopoverKey(e)}
          />
          ${this.setupPopoverError
            ? html`<span class="pop-error">${this.setupPopoverError}</span>`
            : html`<span class="pop-hint">${spec.hint}</span>`}
        </div>
      </div>
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
                    score pane, not a missing image.`
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
      <div class="entry-state">
        entry duration:
        ${session.entryDurationBase}${'.'.repeat(session.entryDurationDots)}
        ${session.spanAnchor
          ? html`<span
              class="span-anchor"
              title=${`press ${session.spanAnchor.kind === 'slur' ? 'S' : 'B'} at the far note` +
              ` or Enter to complete the ${session.spanAnchor.kind} · Esc drops it`}
              >· ${session.spanAnchor.kind} from ${session.spanAnchor.key}…</span
            >`
          : nothing}
      </div>
      <ol class="ops">
        <li
          class="baseline row-state ${applied.length === 0 ? 'row-current' : ''}"
          title="undo everything — back to the start"
          @click=${() => this.jumpToOp(0)}
        >
          <span class="op-what">start · ${startIsEmpty ? 'the empty document {}' : 'the score as loaded'}</span>
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
    this.session = replayIntents({} as MnxStructure, trace.intents);
    this.cursorHidden = false;
    this.copied = false;
    this.syncFromSession();
  }

  /** Run the destruct walk on THIS session (the construct mirror: no
   *  session replacement — it starts from the loaded score, so revert and
   *  undo-all still return to the committed document). The queue fills with
   *  the delete ops; undo rebuilds the score element by element. Same code
   *  as the harness sweep (src/edit/destructWalk.ts) — the button IS the
   *  sweep. */
  private runDestructSweep() {
    if (!this.session) return;
    this.flushPendingFret();
    const result = runDestructWalk(this.session);
    if (result.unaddressed.length > 0) {
      // A campaign finding, not a silent skip — v0 surfaces it to the console
      // (the harness asserts it; the panel stays a viewer).
      console.warn('destruct sweep: unaddressable elements', result.unaddressed);
    }
    this.cursorHidden = false;
    this.copied = false;
    this.syncFromSession();
  }

  /** Undo/redo until the applied queue holds `target` ops — through
   *  handleIntent, so panel clicks are recorded like keys. */
  private jumpToOp(target: number) {
    if (!this.session) return;
    this.flushPendingFret();
    for (let guard = 0; this.session.opQueue.applied.length > target && this.session.canUndo && guard < 128; guard++) {
      this.session.handleIntent({ type: 'undo' });
    }
    for (let guard = 0; this.session.opQueue.applied.length < target && this.session.canRedo && guard < 128; guard++) {
      this.session.handleIntent({ type: 'redo' });
    }
    this.syncFromSession();
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
    if (level === 'document' || level === 'section') return null;

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
        body: html`<div class="ref-missing">The score has not loaded (${this.loadState}).</div>`
      });
    }
    const source = this.session?.doc ?? this.parsedScore();
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
            whole score
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
  private parsedScore(): unknown {
    try {
      return this.rawScore ? JSON.parse(this.rawScore) : null;
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
