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
import type { MnxTuningEntry } from '../model/mnx.ts';
import type { ViewMode } from '../elements/ScoreViewer.ts';
import type { SelectionContext } from '../elements/mnxContext.ts';
import { EditorSession } from '../edit/session.ts';
import type { EditorIntent } from '../edit/intents.ts';
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

type PageView = ViewMode | 'compare' | 'json';

/** How many object tags to show before collapsing the tail into a count. */
const DEF_PREVIEW = 9;

@customElement('mnx-scenario-page')
export class ScenarioPage extends LitElement {
  @property({ type: String }) scenarioId = '';
  @property({ type: String }) view = '';

  /** Instrument selector: 'document' = no override, else a tuning preset
   *  name from setupGrammar. Presentation only — never written back. */
  @state() private instrument = 'document';
  @state() private capoOverride: number | null = null;

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
  // The editor incubates here (roadmap/complete/editor-input-layer.md):
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
        padding: 16px 24px 12px;
        border-bottom: 1px solid var(--line);
      }

      .head h1 {
        font-family: var(--serif);
        font-weight: 500;
        font-size: 20px;
        margin: 0;
        display: flex;
        align-items: baseline;
        gap: 12px;
        flex-wrap: wrap;
      }

      .head .id {
        font-family: var(--mono);
        font-size: 11.5px;
        color: var(--ink-3);
      }

      .head p {
        font-size: 12.5px;
        color: var(--ink-2);
        line-height: 1.55;
        margin: 6px 0 10px;
        max-width: 78ch;
        text-wrap: pretty;
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
        margin-top: 12px;
        align-items: center;
      }

      /* The instrument override — the viewer surface's strings/capo. */
      .tabs .instrument {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: var(--mono);
        font-size: 10.5px;
      }

      .tabs .instrument select,
      .tabs .instrument input {
        font: inherit;
        color: var(--ink-2);
        background: var(--surface);
        border: 1px solid var(--line-strong);
        border-radius: 5px;
        padding: 2px 6px;
      }

      .tabs .instrument .capo {
        width: 56px;
      }

      /* The incubating editor's status strip — cursor, history, trace. */
      .edit-strip {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 10px;
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-2);
      }

      .edit-strip .cur {
        color: var(--ink);
      }

      .edit-strip .dirty {
        color: var(--accent);
      }

      .edit-strip button {
        font: inherit;
        color: var(--ink-2);
        background: transparent;
        border: 1px solid var(--line-strong);
        border-radius: 5px;
        padding: 1px 8px;
        cursor: pointer;
      }

      .edit-strip button:hover:not(:disabled) {
        color: var(--accent);
        border-color: var(--accent);
      }

      .edit-strip button:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .edit-strip .hint {
        margin-left: auto;
        color: var(--ink-3);
      }

      /* Setup popovers (survey §6.2's Shift+letter tier): a typed prompt
         whose text parses into a setup intent. */
      .popover {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin-top: 8px;
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
        min-width: 22ch;
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

      .body {
        overflow: hidden;
        min-height: 0;
      }

      .compare {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0;
        height: 100%;
        overflow: hidden;
      }

      .compare > div {
        overflow: auto;
        min-width: 0;
      }

      .compare .side-cap {
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-3);
        padding: 10px 16px 0;
      }

      .compare .ref {
        border-left: 1px solid var(--line);
        background: var(--bg);
      }

      .compare .ref img {
        display: block;
        max-width: calc(100% - 52px);
        margin: 26px;
        background: var(--paper);
        border-radius: 10px;
        box-shadow: var(--shadow);
        padding: 20px;
      }

      .ref-missing,
      .load-state {
        margin: 26px;
        padding: 22px;
        border: 1px dashed var(--line-strong);
        border-radius: 10px;
        font-size: 12.5px;
        color: var(--ink-2);
        line-height: 1.55;
      }

      .ref-credit {
        margin: -14px 26px 26px;
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
        height: 100%;
        overflow: auto;
        margin: 0;
        padding: 18px 24px;
        box-sizing: border-box;
        font-family: var(--mono);
        font-size: 11.5px;
        line-height: 1.5;
        color: var(--ink);
        background: var(--surface);
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
    if (changed.has('scenarioId')) {
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
      selectedNoteIds: this.cursorHidden ? [] : session.selectedNoteKeys
    };
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
    if (view === 'json') return [];
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
    if (event.code === 'Escape') {
      this.cursorHidden = true;
      this.syncFromSession();
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
    this.cursorHidden = false;
    this.session.handleIntent(intent);
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
  // (roadmap/proposed/derived-positions.md): a document without strings has
  // no fingerboard until the user names one.
  private docDeclaresStrings(): boolean {
    return (this.doc?.mnxJson.parts ?? []).some(
      p => (p._x?.mnxLab?.strings?.length ?? 0) > 0
    );
  }

  private overrideStrings(): MnxTuningEntry[] | null {
    if (this.instrument === 'document') return null;
    return parseTuning(this.instrument);
  }

  private tabCapable(): boolean {
    return this.docDeclaresStrings() || this.overrideStrings() !== null;
  }

  private availableViews(): PageView[] {
    return this.tabCapable()
      ? ['notation', 'tab', 'both', 'compare', 'json']
      : ['notation', 'compare', 'json'];
  }

  private activeView(_entry: ScenarioEntry): PageView {
    const allowed = this.availableViews();
    if (allowed.includes(this.view as PageView)) return this.view as PageView;
    // Unspecified (or no-longer-available) view: the document's own hint.
    return this.defaultView();
  }

  /** The document's preferred view when the URL names none: its `staffKind`
   *  hint when tab is possible, else notation. */
  private defaultView(): PageView {
    if (!this.tabCapable()) return 'notation';
    const kinds = (this.doc?.mnxJson.parts ?? []).map(p => p._x?.mnxLab?.tab?.staffKind);
    if (kinds.includes('both')) return 'both';
    if (kinds.includes('tab')) return 'tab';
    return 'notation';
  }

  /** The compare pane's "our render": the combined notation+tab system when
   *  the DOCUMENT prefers a tab view (published guitar engraving is what a
   *  reviewer wants beside the reference), plain notation otherwise. The
   *  document's own hint, not the viewer override — an override on a
   *  notation-only spec scenario must keep the comparison notation-to-
   *  notation with the reference engraving. */
  private comparePaneView(): ViewMode {
    const kinds = (this.doc?.mnxJson.parts ?? []).map(p => p._x?.mnxLab?.tab?.staffKind);
    const prefersTab = kinds.includes('both') || kinds.includes('tab');
    return prefersTab && this.tabCapable() ? 'both' : 'notation';
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
        .stringsOverride=${this.overrideStrings()}
        .capoOverride=${this.capoOverride}
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
    const item = classify(entry);
    const verification = entry.meta.verification;
    const views = this.availableViews();

    return html`
      <div class="head">
        <h1>${entry.meta.title} <span class="id">${entry.id}</span></h1>
        <p>${entry.meta.description}</p>
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
        <div class="tabs">
          ${views.map(
            v => html`
              <a href=${scenarioHref(entry.id, v)} aria-current=${v === view}>
                ${v === 'compare' ? 'compare · spec reference' : v}
              </a>
            `
          )}
          <span class="instrument" title="view this score on an instrument — a rendering override, the document is untouched">
            <select
              .value=${this.instrument}
              @change=${(e: Event) => {
                this.instrument = (e.target as HTMLSelectElement).value;
              }}
            >
              <option value="document">instrument: document</option>
              ${TUNING_PRESET_NAMES.map(
                n => html`<option value=${n} ?selected=${this.instrument === n}>${n}</option>`
              )}
            </select>
            <input
              class="capo"
              type="number"
              min="0"
              max="24"
              placeholder="capo"
              .value=${this.capoOverride === null ? '' : String(this.capoOverride)}
              @change=${(e: Event) => {
                const raw = (e.target as HTMLInputElement).value.trim();
                const n = raw === '' ? NaN : Number(raw);
                this.capoOverride = Number.isInteger(n) && n >= 0 && n <= 24 ? n : null;
              }}
            />
          </span>
        </div>
        ${this.session && view !== 'json'
          ? html`
              <div class="edit-strip">
                <span class="cur">
                  m${this.session.cursor.measureIndex + 1} ·
                  ${this.session.cursor.onset.num}/${this.session.cursor.onset.den}
                  ${this.session.mode === 'string'
                    ? html`· s${this.session.cursor.line}`
                    : nothing}
                  · ${this.session.entryDurationBase}${this.session.selectedNoteKeys.length &&
                  !this.cursorHidden
                    ? html` · ${this.session.selectedNoteKeys[0]}`
                    : nothing}
                </span>
                ${this.session.dirty
                  ? html`<span class="dirty" title="edits are in-memory only — the corpus file is untouched"
                      >● ${this.session.appliedOps.length}
                      op${this.session.appliedOps.length === 1 ? '' : 's'}</span
                    >`
                  : nothing}
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
                <button
                  ?disabled=${this.session.intentLog.length === 0}
                  @click=${() => void this.copyTrace()}
                  title="copy this session as a replayable intent-trace fixture — paste into harness/fixtures/edit-traces/"
                >
                  ${this.copied ? 'copied ✓' : 'copy trace'}
                </button>
                ${this.session.dirty
                  ? html`<button @click=${() => this.revertEdits()}>revert</button>`
                  : nothing}
                <button @click=${() => this.openPopover('timeSignaturePopover')}>time…</button>
                ${entry.hasTab
                  ? html`<button @click=${() => this.openPopover('tuningPopover')}>tuning…</button>`
                  : nothing}
                <span class="hint"
                  >arrows move${entry.hasTab ? ' (↑↓ strings) · digits enter frets' : ''} · Del
                  removes · −/= duration · Alt+↑↓ transpose · Shift+M add bar · Shift+T
                  time${entry.hasTab ? ' · Shift+U tuning' : ''} · Ctrl+K palette · Ctrl+G go
                  to</span
                >
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
            `
          : nothing}
      </div>
      <div class="body">
        ${view === 'json'
          ? this.loadState === 'ready'
            ? html`<pre class="json">${this.rawScore}</pre>`
            : this.viewer(entry, 'notation')
          : view === 'compare'
            ? html`
                <div class="compare">
                  <div>
                    <div class="side-cap">our render</div>
                    ${this.viewer(entry, this.comparePaneView())}
                  </div>
                  <div class="ref">
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
                            ? html`A lab scenario has no spec reference engraving — compare against
                              the committed golden via the harness
                              (<code>npm run verify:scenarios</code> shows what changed).`
                            : this.loadState === 'failed'
                              ? // The score failed to fetch too, so this image 404'd for the same
                                // reason. Don't send them chasing the submodule.
                                html`Reference engraving unavailable — the same transport failure
                                as the left pane, not a missing image.`
                              : html`Reference engraving unavailable — the images come from the
                                pinned <code>vendor/mnx</code> checkout, copied into the build when
                                one is present. This build was made without the submodule; run
                                <code>git submodule update --init vendor/mnx</code> and rebuild.`}
                        </div>`}
                  </div>
                </div>
              `
            : this.viewer(entry, view)}
      </div>
    `;
  }
}
