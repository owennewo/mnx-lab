// One scenario, deep-linkable: #/scenario/<id>?view=notation|tab|both|compare|json.
// The compare view is the review surface — our render beside the spec's
// reference engraving (served by a dev-only middleware from the pinned
// vendor/mnx checkout; in a static deploy the reference pane degrades to a
// note). Rendering goes through the elements/ score viewer, property-driven.
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { corpus, type ScenarioEntry } from '../corpus/corpus.ts';
import { classify } from './queue.ts';
import { designTokens, sharedChrome, scrollbars } from '../elements/tokens.ts';
import { scenarioHref, objectsHref } from './WorkbenchApp.ts';
import type { MnxDocument, MnxStructure } from '../model/mnx.ts';
import { resolvePinnedErrors, type PinnedError } from '../model/pinnedErrors.ts';
import type { ViewMode } from '../elements/ScoreViewer.ts';
import type { EnclosureKind, SelectionContext } from '../elements/mnxContext.ts';
import { EditorSession } from '../edit/session.ts';
import { SELECTION_LADDER, type SelectionLevel } from '../edit/selection.ts';
import type { EditorIntent } from '../edit/intents.ts';
import type { TabSetup } from '../engine/tab/guitarPositions.ts';
import { buildHudParts, buildHudRows, LEVEL_BY_ROW } from './hudRows.ts';
import {
  EDIT_LAYER,
  NAVIGATION_LAYER,
  TAB_DIGIT_LAYER,
  resolveIntent,
  resolveShellAction,
  strokeOf,
  type KeymapLayer,
  type ShellAction
} from '../edit/keymap.ts';
import { parseTimeSignature, parseTuning, TUNING_PRESET_NAMES } from '../edit/setupGrammar.ts';
import '../elements/ScoreViewer.ts';
import './ScoreHud.ts';

/** The side panel's tabs (roadmap/inprogress/core-score-hud.md): the page's
 *  scattered chrome — description, badges/defs, the edit strip, the HUD, the
 *  spec reference, the raw JSON — consolidated into one rail. */
type PanelTab = 'description' | 'tags' | 'actions' | 'hud' | 'compare' | 'json';

/** One part's override state — the HUD ensemble table's currency. */
interface PartOverride {
  instrument: string;
  capo: number | null;
}

/** Side panel width bounds and its remembered-per-browser preference key. */
const PANEL_WIDTH_KEY = 'mnx-lab.panel-width';
const PANEL_MIN = 240;
const PANEL_MAX = 640;
const PANEL_DEFAULT = 320;

function storedPanelWidth(): number {
  const n = Number(localStorage.getItem(PANEL_WIDTH_KEY));
  return Number.isFinite(n) && n >= PANEL_MIN && n <= PANEL_MAX ? n : PANEL_DEFAULT;
}

/** How many object tags to show before collapsing the tail into a count. */
const DEF_PREVIEW = 9;

/** Ladder level → enclosure shape (roadmap/inprogress/core-selection-ladder.md).
 *  The mapping lives HERE so elements/ knows shapes, never editor levels.
 *  measure and section share panel-wide: the extent difference (one bar vs
 *  the labelled range) comes from the footprint itself. */
const ENCLOSURE_BY_LEVEL: Record<SelectionLevel, EnclosureKind> = {
  note: 'cell',
  event: 'slice',
  voiceMeasure: 'run',
  partMeasure: 'panel',
  measure: 'panel-wide',
  section: 'panel-wide',
  score: 'frame'
};

@customElement('mnx-scenario-page')
export class ScenarioPage extends LitElement {
  @property({ type: String }) scenarioId = '';
  @property({ type: String }) view = '';

  /** Per-part instrument overrides (roadmap/inprogress/core-score-hud.md),
   *  keyed by part index: 'document' = no strings override, else a tuning
   *  preset name from setupGrammar. Presentation only — never written back.
   *  Single-part scores edit entry 0 through the toolbar selector; the HUD's
   *  ensemble table edits any entry. */
  @state() private partSetups = new Map<number, PartOverride>();

  @state() private doc: MnxDocument | null = null;
  @state() private rawScore = '';
  @state() private pinnedErrors: PinnedError[] = [];
  @state() private referenceFailed = false;
  // Three states, not two: the score arrives over a lazy import, so "nothing
  // on screen" is either still-in-flight or a dead fetch. Collapsing them
  // into one empty pane is how a stopped dev server reads as a render bug.
  @state() private loadState: 'loading' | 'ready' | 'failed' = 'loading';
  @state() private loadError = '';
  @state() private allDefs = false;
  // The editor incubates here (roadmap/complete/core-editor-input-layer.md):
  // in-memory only — the workbench has no backend, and this page is a bench
  // for testing the editor, not for authoring corpus files.
  @state() private session: EditorSession | null = null;
  @state() private selection: SelectionContext | null = null;
  @state() private copied = false;
  /** The open setup popover (survey §6.2's Shift+letter tier), if any.
   *  (Named to dodge the DOM's built-in HTMLElement.popover property.) */
  @state() private setupPopover: 'time' | 'tuning' | null = null;
  @state() private setupPopoverError = '';
  /** Esc hides the cursor highlight until the next intent (review sense-0). */
  private cursorHidden = false;

  /** The side panel's active tab; falls back when the tab isn't available
   *  (hud/actions need a session). */
  @state() private panelTab: PanelTab = 'hud';

  /** Side panel width in px — the drag bar on its left edge adjusts it. */
  @state() private panelWidth = storedPanelWidth();

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

      .head {
        padding: 10px 24px 0;
        border-bottom: 1px solid var(--line);
      }

      /* Title + id live in the description tab now — the head is tabs only. */
      .panel-body h1 {
        font-family: var(--serif);
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
        border-radius: 999px;
        padding: 2px 9px;
        color: var(--ink-2);
      }

      .badge.verified {
        color: var(--st-verified);
        border-color: currentColor;
      }

      .badge.attention {
        color: var(--st-gap);
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
        border-radius: 5px;
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
        gap: 2px;
        align-items: center;
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

      .actions button {
        font: inherit;
        color: var(--ink-2);
        background: transparent;
        border: 1px solid var(--line-strong);
        border-radius: 5px;
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
        border: 1px solid var(--accent);
        border-radius: 8px;
        background: var(--surface);
        font-family: var(--mono);
        font-size: 11px;
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
        color: var(--st-gap);
      }

      .tabs a {
        font-size: 12px;
        padding: 5px 12px;
        border-radius: 7px 7px 0 0;
        color: var(--ink-2);
        text-decoration: none;
        border: 1px solid transparent;
        border-bottom: none;
      }

      .tabs a[aria-current='true'] {
        color: var(--accent-fg);
        background: var(--surface);
        border-color: var(--line);
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
      }

      .panel {
        position: relative;
        border-left: 1px solid var(--line);
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

      .panel-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        padding: 8px 10px 0;
        border-bottom: 1px solid var(--line);
        font-family: var(--mono);
      }

      .panel-tabs button {
        font: inherit;
        font-size: 10.5px;
        color: var(--ink-2);
        background: transparent;
        border: 1px solid transparent;
        border-bottom: none;
        border-radius: 6px 6px 0 0;
        padding: 4px 8px;
        cursor: pointer;
      }

      .panel-tabs button[aria-current='true'] {
        color: var(--accent-fg);
        background: var(--bg);
        border-color: var(--line);
      }

      .panel-body {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
        padding: 12px 14px;
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
        border-radius: 10px;
        box-shadow: var(--shadow);
        padding: 12px;
        box-sizing: border-box;
      }

      .load-state {
        margin: 26px;
      }

      .ref-missing,
      .load-state {
        padding: 22px;
        border: 1px dashed var(--line-strong);
        border-radius: 10px;
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
        border-color: var(--st-gap);
      }

      .load-state .detail {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        word-break: break-word;
      }

      .json {
        margin: 0;
        font-family: var(--mono);
        font-size: 10.5px;
        line-height: 1.5;
        color: var(--ink);
        overflow-x: auto;
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
    // Legacy ?view=compare|json deep links (the documented contract) open
    // the matching panel tab — the main pane keeps the default score view.
    if (changed.has('view') || changed.has('scenarioId')) {
      if (this.view === 'compare' || this.view === 'json') this.panelTab = this.view;
    }
    if (changed.has('scenarioId')) {
      if (this.view !== 'compare' && this.view !== 'json') this.panelTab = 'hud';
      this.doc = null;
      this.rawScore = '';
      this.pinnedErrors = [];
      this.referenceFailed = false;
      this.loadState = 'loading';
      this.loadError = '';
      this.allDefs = false;
      this.session = null;
      this.selection = null;
      this.copied = false;
      this.setupPopover = null;
      this.setupPopoverError = '';
      this.cursorHidden = false;
      // Overrides are per-part by INDEX, so carrying them to a different
      // document would misapply them.
      this.partSetups = new Map();
      void this.loadScore();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('mnx-palette-intent', this.onPaletteIntent);
    window.addEventListener('mnx-palette-action', this.onPaletteAction);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('mnx-palette-intent', this.onPaletteIntent);
    window.removeEventListener('mnx-palette-action', this.onPaletteAction);
  }

  private async loadScore() {
    const entry = this.entry();
    if (!entry) return;
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
        this.session = new EditorSession(score, entry.id);
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
    this.selection = {
      activePartId: null,
      activeMeasureIndex: session.cursor.measureIndex,
      activeVoiceIndex: null,
      activeEventIndex: null,
      selectedNoteIds: this.cursorHidden ? [] : session.selectedNoteKeys,
      enclosure: this.cursorHidden ? null : ENCLOSURE_BY_LEVEL[session.selectionLevel],
      cursor: this.cursorHidden ? null : session.cursorContext()
    };
  }

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

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    // Shadow-DOM retargeting makes window-level `event.target` the outermost
    // host; composedPath()[0] is the real target (the focused input, if any).
    const target = event.composedPath()[0];
    if (target instanceof HTMLElement) {
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable)
        return;
    }
    if (this.session && this.activeLayers().length > 0) {
      const action = resolveShellAction(strokeOf(event));
      if (action && this.openPopover(action)) {
        event.preventDefault();
        return;
      }
    }
    const intent = resolveIntent(strokeOf(event), this.activeLayers());
    if (!intent || !this.session) return;
    event.preventDefault();
    this.followProjection();
    // The selection ladder (roadmap/inprogress/core-selection-ladder.md): Escape
    // relaxes rung by rung; only a relax that can't widen further — already at
    // score — becomes the old deselect. While deselected, Escape stays inert
    // (and unrecorded — deselection is view chrome, not session history).
    if (intent.type === 'relaxSelection' && this.cursorHidden) return;
    const handled = this.session.handleIntent(intent);
    if (intent.type === 'relaxSelection') {
      if (!handled) this.cursorHidden = true;
    } else {
      this.cursorHidden = false;
    }
    this.copied = false;
    this.syncFromSession();
  };

  private openPopover(action: ShellAction): boolean {
    // Only the two popover actions are ours; palette actions belong to the shell.
    if (action !== 'timeSignaturePopover' && action !== 'tuningPopover') return false;
    const entry = this.entry();
    if (action === 'tuningPopover' && !entry?.hasTab) return false;
    this.setupPopover = action === 'timeSignaturePopover' ? 'time' : 'tuning';
    this.setupPopoverError = '';
    // The popover lives in the actions tab now; a keyboard-opened one must
    // still be visible.
    this.panelTab = 'actions';
    return true;
  }

  /** Palette items act on the editor through the same funnels as keys: the
   *  intent channel feeds the session (recorded in traces), the action
   *  channel drives page chrome (popovers, copy trace, revert). */
  private onPaletteIntent = (event: Event) => {
    this.stripIntent((event as CustomEvent<EditorIntent>).detail);
  };

  private onPaletteAction = (event: Event) => {
    const action = (event as CustomEvent<string>).detail;
    if (action === 'copyTrace') void this.copyTrace();
    else if (action === 'revert') this.revertEdits();
    else this.openPopover(action as ShellAction);
  };

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
        this.setupPopoverError = 'not a time signature — try 4/4 or 6/8';
        return;
      }
      this.stripIntent({ type: 'setTimeSignature', count: time.count, unit: time.unit });
    } else if (this.setupPopover === 'tuning') {
      const tuning = parseTuning(input.value);
      if (!tuning) {
        this.setupPopoverError = `not a tuning — a preset (${TUNING_PRESET_NAMES.join(', ')}) or pitches low→high like D2 A2 D3 G3 A3 D4`;
        return;
      }
      this.stripIntent({ type: 'setTuning', tuning });
    }
    this.setupPopover = null;
  }

  /** A HUD row click moves the selection to that row's level by walking
   *  relax/tighten intents — clicks go through the same funnel as keys, so
   *  traces replay them. Bounded: every step must actually move (the
   *  presence rule may stop the walk short of an absent rung). */
  private onHudRow = (event: Event) => {
    const key = (event as CustomEvent<{ key: string }>).detail.key;
    const target = LEVEL_BY_ROW[key];
    if (!this.session || !target) return;
    this.cursorHidden = false;
    for (let guard = 0; guard < SELECTION_LADDER.length; guard++) {
      const current: SelectionLevel = this.session.selectionLevel;
      if (current === target) break;
      const widen = SELECTION_LADDER.indexOf(target) > SELECTION_LADDER.indexOf(current);
      this.session.handleIntent({ type: widen ? 'relaxSelection' : 'tightenSelection' });
      if (this.session.selectionLevel === current) break;
    }
    this.copied = false;
    this.syncFromSession();
  };

  private onHudPartSetup = (event: Event) => {
    const detail = (event as CustomEvent<{ index: number } & PartOverride>).detail;
    this.setPartOverride(detail.index, { instrument: detail.instrument, capo: detail.capo });
  };

  /** Button-driven intents go through the same funnel as keys, so they are
   *  recorded in the trace too — a recording must replay clicks as well. */
  private stripIntent(intent: EditorIntent) {
    if (!this.session) return;
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

  private revertEdits() {
    if (!this.session) return;
    this.session = new EditorSession(this.session.initial, this.scenarioId);
    this.copied = false;
    this.syncFromSession();
  }

  // Tab/both exist only when the strings are KNOWN — declared by the document
  // or supplied through the instrument selector (the viewer override,
  // presentation-only). No instrument is ever assumed
  // (roadmap/proposed/core-derived-positions.md): a document without strings has
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
    return html`
      <mnx-score-viewer
        .mnxDoc=${this.doc}
        .viewMode=${viewMode}
        .hasTab=${entry.hasTab}
        .partTabSetups=${this.partTabSetups()}
        .invalidByDesign=${entry.invalidByDesign}
        .pinnedErrors=${this.pinnedErrors}
        .selection=${this.selection}
      ></mnx-score-viewer>
    `;
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
      </div>
      <div class="body" style="grid-template-columns: 1fr ${this.panelWidth}px">
        <div class="main">${this.viewer(entry, view)}</div>
        ${this.sidePanel(entry)}
      </div>
    `;
  }

  // ---- The side panel (roadmap/inprogress/core-score-hud.md): the page's
  // chrome, one tab each — description, tags (badges + defs), actions (the
  // former edit strip), the HUD, the spec reference, the raw JSON.

  private panelTabs(): PanelTab[] {
    const tabs: PanelTab[] = ['description', 'tags'];
    if (this.session) tabs.push('actions', 'hud');
    tabs.push('compare', 'json');
    return tabs;
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
        <div class="panel-body">
          ${tab === 'description'
            ? this.panelDescription(entry)
            : tab === 'tags'
              ? this.panelTags(entry)
              : tab === 'actions'
                ? this.panelActions(entry)
                : tab === 'hud'
                  ? this.hud(entry)
                  : tab === 'compare'
                    ? this.panelCompare(entry)
                    : this.panelJson()}
        </div>
      </aside>
    `;
  }

  private panelDescription(entry: ScenarioEntry) {
    return html`
      <h1>${entry.meta.title}</h1>
      <div class="id">${entry.id}</div>
      <p class="description">${entry.meta.description}</p>
    `;
  }

  private panelTags(entry: ScenarioEntry) {
    const item = classify(entry);
    const verification = entry.meta.verification;
    return html`
      <div class="badges">
          <span class="badge ${item.state === 'current' ? 'verified' : 'attention'}">
            ${item.state === 'current' ? entry.meta.status : item.state} — ${item.detail}
          </span>
          <!-- One hash per golden: say which code each one witnesses,
               because a bare digest says neither. A verified scenario with no
               renderHash (or bothHash) was approved before that golden
               existed — it is current, not stale, and that distinction is
               the whole reason the fields are optional. -->
          ${verification?.primitivesHash
            ? html`<span class="badge" title="hash of expected.primitives.json — layout"
                >layout ${verification.primitivesHash.replace('sha256:', '')}</span
              >`
            : nothing}
          ${verification?.renderHash
            ? html`<span class="badge" title="hash of expected.svg — the SVG emitter's output"
                >render ${verification.renderHash.replace('sha256:', '')}</span
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
                class="badge"
                title="hash of expected.both.svg — the combined notation+tab system"
                >both ${verification.bothHash.replace('sha256:', '')}</span
              >`
            : nothing}
          <span class="badge" title=${entry.ns === 'spec' ? 'mirrored by sync:spec — hand-edits forbidden' : 'ours, authored in scenarios/lab/'}>
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
        <!-- The schema objects this scenario exercises, from the spec's own
             coversDefs join. featureDefs (plumbing stripped) is what makes
             this wearable: the raw list runs to a median of 25 and a max of
             50, but once the structural skeleton is gone the median is 5 and
             58 of 70 scenarios fit in nine. The handful that don't get a
             count instead of a wall. -->
        ${entry.featureDefs.length > 0
          ? html`<div class="defs">
              ${(this.allDefs ? entry.featureDefs : entry.featureDefs.slice(0, DEF_PREVIEW)).map(
                d => html`<a class="def" href=${objectsHref(d)} title="show every scenario using ${d}"
                  >${d}</a
                >`
              )}
              ${!this.allDefs && entry.featureDefs.length > DEF_PREVIEW
                ? html`<button class="def more" @click=${() => (this.allDefs = true)}>
                    +${entry.featureDefs.length - DEF_PREVIEW} more
                  </button>`
                : nothing}
            </div>`
          : nothing}
    `;
  }

  /** The former edit strip: history/trace/setup controls. The cursor readout
   *  it used to carry (bar · beat · line · selection) is the HUD's job now —
   *  duplicating it here was the overlap the panel exists to remove. */
  private panelActions(entry: ScenarioEntry) {
    if (!this.session) return nothing;
    return html`
      <div class="actions">
        <div class="action-row">
          <button
            ?disabled=${!this.session.canUndo}
            @click=${() => this.stripIntent({ type: 'undo' })}
          >
            undo
          </button>
          <button
            ?disabled=${!this.session.canRedo}
            @click=${() => this.stripIntent({ type: 'redo' })}
          >
            redo
          </button>
          ${this.session.dirty
            ? html`<button @click=${() => this.revertEdits()}>revert</button>`
            : nothing}
          <button
            ?disabled=${this.session.intentLog.length === 0}
            @click=${() => void this.copyTrace()}
            title="copy this session as a replayable intent-trace fixture — paste into harness/fixtures/edit-traces/"
          >
            ${this.copied ? 'copied ✓' : 'copy trace'}
          </button>
          <button @click=${() => this.openPopover('timeSignaturePopover')}>time…</button>
          ${entry.hasTab
            ? html`<button @click=${() => this.openPopover('tuningPopover')}>tuning…</button>`
            : nothing}
        </div>
        <div class="action-state">
          entry duration: ${this.session.entryDurationBase}
          ${this.session.dirty
            ? html`<span class="dirty" title="edits are in-memory only — the corpus file is untouched"
                >· ● ${this.session.appliedOps.length}
                op${this.session.appliedOps.length === 1 ? '' : 's'}</span
              >`
            : nothing}
        </div>
        ${this.setupPopover
          ? html`
              <div class="popover">
                <span class="pop-label"
                  >${this.setupPopover === 'time' ? 'time signature' : 'tuning'}</span
                >
                <input
                  placeholder=${this.setupPopover === 'time' ? '4/4' : 'standard · drop-d · D2 A2 D3 G3 A3 D4'}
                  @keydown=${(e: KeyboardEvent) => this.onPopoverKey(e)}
                />
                ${this.setupPopoverError
                  ? html`<span class="pop-error">${this.setupPopoverError}</span>`
                  : html`<span class="pop-hint"
                      >${this.setupPopover === 'time'
                        ? 'applies to the current bar onward · Enter applies · Esc closes'
                        : 'low string first · Enter applies · Esc closes'}</span
                    >`}
              </div>
            `
          : nothing}
        <p class="hint">
          arrows move${entry.hasTab ? ' (↑↓ strings) · digits enter frets' : ''} · Del removes ·
          −/= duration · Alt+↑↓ transpose · Shift+M add bar · Shift+T
          time${entry.hasTab ? ' · Shift+U tuning' : ''} · Ctrl+K palette · Ctrl+G go to
        </p>
      </div>
    `;
  }

  /** The spec's reference engraving — the main pane is always "our render",
   *  so showing the reference beside it IS the comparison. */
  private panelCompare(entry: ScenarioEntry) {
    return html`
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
    `;
  }

  private panelJson() {
    return this.loadState === 'ready'
      ? html`<pre class="json">${this.rawScore}</pre>`
      : html`<div class="ref-missing">The score has not loaded (${this.loadState}).</div>`;
  }

  /** The HUD companion (roadmap/inprogress/core-score-hud.md): wired through
   *  the host, never through the viewer's props. */
  private hud(entry: ScenarioEntry) {
    if (!this.session || this.loadState !== 'ready') return nothing;
    return html`
      <mnx-score-hud
        .rows=${buildHudRows(entry.meta.title, this.session, this.cursorHidden)}
        .parts=${buildHudParts(this.session.doc, index => this.partOverride(index))}
        .presets=${TUNING_PRESET_NAMES}
        @hud-row-activated=${this.onHudRow}
        @hud-part-setup-changed=${this.onHudPartSetup}
      ></mnx-score-hud>
    `;
  }
}
