// The lyric text editor — the paste-and-tweak surface of one-surface item 6
// phase 2 (roadmap/complete/workbench-one-surface-lyrics.md). The buffer is
// WORKBENCH STATE, not the document: it opens on the canonical projection
// (serializeLyricText) and parses live into diagnostics named by bar. There is
// no apply: a pause in typing, leaving the box, closing the panel or hiding the
// page COMMITS a clean parse — the host is handed the plan (planLyricEdits)
// against `doc`, the document the visit opened on, and keeps one undo step per
// visit. Text that does not parse cannot be committed, so it goes to the host's
// draft store instead and is offered back the next time the panel opens.
//
// A right-hand panel: the score frame makes room beside the score and
// the host renders the buffer's parse onto it live (lyric-editor-edits →
// a scratch document through the same lyricPlanOps the session applies), so
// typing previews the words on the score once it pauses (LYRIC_PREVIEW_PAUSE_MS).
// Keyboard ownership needs no precedence wiring — a focused textarea is isTextEntry and the page keymap
// yields; clicking the score hands the keys back without closing the drawer.
// The caret IS the editor's cursor: a caret on a word sends its visit and
// onset (lyric-editor-caret) and the host moves the one cursor there — the
// playback cursor with it. The panel draws no cursor of its own. A click or
// an arrow moves it at once; typing moves it at the pause, with the preview.
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { designTokens, sharedChrome, scrollbars } from './tokens.ts';
import type { MnxStructure } from '../model/mnx.ts';
import {
  lyricEventWalk,
  lyricVisitLabels,
  lyricPassWarnings,
  parseLyricText,
  planLyricEdits,
  serializeLyricText,
  type LyricPlanEdit,
  type LyricTextDiagnostic,
  type ParsedLyricText
} from '../edit/lyricText.ts';

const LEGEND =
  'split - · hold fant--as · extend day__ · skip _ · join you~are · next bar | · bars without words ×4 (or x4) · another verse 2: · language nl:';

/** How long typing must pause before a clean parse is committed. */
export const LYRIC_COMMIT_PAUSE_MS = 3_000;
/** …and before the score beside it is redrawn as the text reads: a redraw of a long
 *  piece costs more than a keystroke is worth, so the box answers at once and the
 *  score catches up when the typing stops. */
export const LYRIC_PREVIEW_PAUSE_MS = 250;

/** What the host is told: `edits` to commit; `accepted` is set by the host when they landed. */
export interface LyricCommitDetail { edits: LyricPlanEdit[]; accepted: boolean }

@customElement('mnx-lyric-text-editor')
export class LyricTextEditor extends LitElement {
  @property({ attribute: false }) doc: MnxStructure | null = null;
  @property({ type: Number }) partIndex = 0;
  /** The part's display name, for the header. */
  @property({ type: String }) partLabel = '';
  /** Opens with the caret on this note's token, when it has one. */
  @property({ type: String }) focusNoteKey = '';
  /** …on this performed visit of it, when the text names that visit. */
  @property({ type: Number }) focusOrdinal: number | null = null;
  /** The music is playing: the panel stays open, read-only, until it pauses — nothing is written while it plays. */
  @property({ type: Boolean }) playing = false;
  /** Text a previous visit could not commit, offered in place of the document's own. */
  @property({ attribute: false }) draft: string | null = null;

  @state() private text = '';
  @state() private parsed: ParsedLyricText = { lines: [], diagnostics: [], tokens: [] };
  /** The pass bound (phase 3): blue, live, never blocks a commit. */
  @state() private warnings: LyricTextDiagnostic[] = [];
  @state() private edits: LyricPlanEdit[] = [];
  /** The box holds text the document has not been given yet. */
  @state() private pending = false;
  /** The text was typed in during this visit (or brought back from a draft). */
  private touched = false;
  private commitTimer: ReturnType<typeof setTimeout> | undefined;
  private previewTimer: ReturnType<typeof setTimeout> | undefined;
  /** The key down now typed (an input followed it), rather than only moving the caret. */
  private typed = false;

  static styles = [
    designTokens,
    sharedChrome,
    scrollbars,
    css`
      :host {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(480px, 100vw);
        z-index: 40;
        display: flex;
        min-height: 0;
      }
      :host([slot='side']) {
        position: relative;
        inset: auto;
        width: min(480px, 45vw);
        max-width: 100%;
        height: 100%;
        z-index: auto;
      }
      .card {
        position: relative;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        min-height: 0;
        background: var(--surface);
        border-left: 1px solid var(--frame-line, var(--line));
        overflow: hidden;
        outline: none;
        display: flex;
        flex-direction: column;
      }
      header {
        display: flex;
        align-items: center;
        flex: none;
        min-height: 40px;
        gap: 8px;
        padding: 0 8px 0 16px;
        border-bottom: 1px solid var(--line);
      }
      header .title {
        font-weight: 600;
      }
      header .part {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--ink-3);
        font-size: 12px;
      }
      /* The text names no bars: the margin beside it does, live, as a rail — each line a
         dot labelled with the bar played it starts in and that bar's score bar and pass. */
      .editor {
        --faint: color-mix(in oklab, var(--ink-3) 55%, var(--bg));
        --run: color-mix(in oklab, var(--ink-3) 14%, var(--bg));
        position: relative;
        display: flex;
        flex: 1;
        min-height: 5em;
        margin: 10px 14px 6px 0;
      }
      .gutter {
        position: relative;
        flex: none;
        width: 13ch;
        overflow: hidden;
        font: 11px/1 var(--mono);
      }
      .start {
        position: absolute;
        right: 4px;
        display: flex;
        align-items: center;
        gap: 5px;
        height: calc(13px * 1.7);
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
      }
      .start .played { color: var(--ink-2); font-weight: 600; }
      .start .visit {
        color: var(--ink-3);
        font-size: 10px;
        border: 1px solid var(--line-strong);
        border-radius: 8px;
        padding: 1px 4px;
      }
      .start .dot {
        position: relative;
        z-index: 1;
        flex: none;
        width: 7px;
        height: 7px;
        margin-right: -3px;
        box-sizing: border-box;
        border-radius: 50%;
        background: var(--ink-2);
      }
      /* A line that only crosses bars without words. */
      .start.silent .dot { background: var(--surface); border: 1.5px solid var(--ink-3); }
      .start:hover .played, .start:hover .visit { color: var(--ink); }
      .rail {
        position: absolute;
        right: 4.75px;
        width: 1.5px;
        background: var(--faint);
      }
      /* The next line starts further on than this one ends: bars nobody sings. */
      .rail.gap { background: repeating-linear-gradient(to bottom, var(--ink-3) 0 2px, transparent 2px 5px); }
      .tip {
        position: absolute;
        z-index: 5;
        pointer-events: none;
        white-space: nowrap;
        font: 12px/1.4 var(--sans);
        color: var(--surface);
        background: var(--ink);
        border-radius: 6px;
        padding: 6px 9px;
        box-shadow: 0 4px 14px rgb(0 0 0 / 0.18);
      }
      .tip b { font-weight: 600; }
      /* What the box draws: its own text is transparent, and this copy, laid out the same,
         sits beneath it in two inks — words in ink, the marks that place them faded back. */
      .paint {
        position: absolute;
        z-index: 0;
        overflow: hidden;
        pointer-events: none;
        box-sizing: border-box;
        border: 1px solid transparent;
        border-radius: 6px;
        background: var(--bg);
      }
      .paint-inner {
        box-sizing: border-box;
        padding: 8px 10px;
        font: 13px/1.7 var(--mono);
        color: var(--ink);
        white-space: pre-wrap;
        overflow-wrap: break-word;
      }
      .paint .bar, .paint .skip { color: var(--faint); }
      .paint .hy { color: var(--ink-3); }
      .paint .run {
        color: var(--ink-3);
        border-radius: 3px;
        background: var(--run);
        box-shadow: 0 0 0 2px var(--run);
      }
      .paint .head { color: var(--ink-2); font-weight: 600; }
      /* The word the cursor is on, outlined as the score outlines a selected element: the
         box's own selection is not drawn once focus leaves it, and a press on the score takes it. */
      .marks {
        position: absolute;
        z-index: 2;
        overflow: hidden;
        pointer-events: none;
      }
      .marks span {
        position: absolute;
        box-sizing: border-box;
        border: 1px solid var(--accent);
        border-radius: 3px;
        background: color-mix(in srgb, var(--accent) 10%, transparent);
      }
      textarea {
        position: relative;
        z-index: 1;
        flex: 1;
        min-width: 0;
        resize: none;
        font: 13px/1.7 var(--mono);
        color: transparent;
        caret-color: var(--ink);
        background: transparent;
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 8px 10px;
        outline: none;
      }
      textarea:focus {
        border-color: var(--line-strong);
      }
      textarea::selection { background: color-mix(in srgb, var(--accent) 22%, transparent); }
      .diagnostics {
        margin: 0 14px;
        max-height: 25%;
        overflow: auto;
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .diagnostic {
        font-size: 12px;
        color: var(--accent);
      }
      /* The blue lane (decision A): worth naming, never worth refusing over.
         No blue token exists in the shared palette yet, so the pair is local
         — matched to the renderer's warning-badge hue. */
      .diagnostic.warning {
        color: light-dark(oklch(0.45 0.13 250), oklch(0.72 0.11 250));
      }
      footer {
        display: flex;
        flex: none;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-top: 1px solid var(--line);
      }
      .legend {
        flex: 1 0 100%;
        font-size: 11px;
        color: var(--ink-3);
      }
      button {
        font: inherit;
        padding: 4px 14px;
        border-radius: 6px;
        border: 1px solid var(--line-strong);
        background: var(--surface);
        color: var(--ink);
        cursor: pointer;
      }
      button.close {
        margin-left: auto;
        flex: none;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--ink-3);
        font-size: 20px;
      }
      button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
      .status {
        margin-right: auto;
        font-size: 12px;
        color: var(--ink-3);
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    globalThis.document?.addEventListener('visibilitychange', this.onHidden);
    globalThis.addEventListener?.('pagehide', this.onHidden);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    clearTimeout(this.commitTimer);
    clearTimeout(this.previewTimer);
    globalThis.document?.removeEventListener('visibilitychange', this.onHidden);
    globalThis.removeEventListener?.('pagehide', this.onHidden);
  }

  firstUpdated() {
    if (this.doc) {
      this.text = serializeLyricText(this.doc, this.partIndex);
      if (this.draft !== null && this.draft !== this.text) {
        this.text = this.draft;
        this.touched = this.pending = true;
      }
      this.reparse();
      if (this.pending) this.preview();
    }
    const area = this.textarea();
    if (!area) return;
    area.focus();
    // Open at the caller's note: place the caret on its token — once the text
    // set above has been rendered into the box, or the range lands on an empty
    // box and the render that fills it leaves the caret at the end.
    void this.updateComplete.then(() => this.showWord(this.focusNoteKey, this.focusOrdinal));
  }

  /**
   * Put the caret on a note's word — on this visit of it, when the text names
   * that visit — and bring it into view. Used when the panel opens and when a
   * syllable is pressed on the score while it is open
   * (core-editor-click-targets.md): the cursor is already there, so nothing
   * is sent back until the caret moves. False when the note has no word here,
   * and then no word is outlined.
   */
  showWord(noteKey: string, ordinal: number | null): boolean {
    const area = this.textarea();
    if (!area || !this.doc) return false;
    const walk = lyricEventWalk(this.doc, this.partIndex);
    const entryIndex = walk.findIndex(entry => entry.noteKey === noteKey);
    const tokens = this.parsed.tokens.filter(token => token.entryIndex === entryIndex);
    const span = tokens.find(token => token.ordinal === ordinal) ?? tokens[0];
    this.marked = span ?? null;
    this.layoutMark();
    if (!span) return false;
    area.setSelectionRange(span.from, span.to);
    // A caret set from outside does not scroll the box: bring its line into view
    // by the painted copy the margin is placed with.
    const line = this.text.slice(0, span.from).split('\n').length - 1;
    const row = this.rows()[line];
    if (row && (row.offsetTop < area.scrollTop || row.offsetTop + row.offsetHeight > area.scrollTop + area.clientHeight)) {
      area.scrollTop = Math.max(0, row.offsetTop - area.clientHeight / 3);
    }
    return true;
  }

  /** Each bar played's `bar.pass`, by performance ordinal. */
  private labels: string[] = [];
  private labelsFor: MnxStructure | null = null;
  private resizeObserver: ResizeObserver | null = null;
  /** The word outlined: the caret's, or the one the host last showed. */
  private marked: { from: number; to: number } | null = null;

  protected updated() {
    this.layout();
    const area = this.textarea();
    if (area && !this.resizeObserver && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.layout());
      this.resizeObserver.observe(area);
    }
  }

  /** The painted copy's rows, one per line of the text. */
  private rows(): HTMLElement[] {
    return [...this.renderRoot.querySelector('.paint-inner')?.children ?? []] as HTMLElement[];
  }

  /**
   * Paint the text beneath the box, and the rail beside it: a dot on each line,
   * at the height the box gives it, labelled with the bar played the line starts
   * in and that bar's `bar.pass`. The rail runs on between the lines of a block,
   * dashed where a line ends on bars nobody sings, and breaks at a header.
   */
  private layout() {
    const area = this.textarea();
    const gutter = this.renderRoot.querySelector<HTMLElement>('.gutter-inner');
    const paint = this.renderRoot.querySelector<HTMLElement>('.paint');
    const inner = paint?.firstElementChild as HTMLElement | null | undefined;
    if (!area || !gutter || !paint || !inner || !this.doc) return;
    Object.assign(paint.style, {
      left: `${area.offsetLeft}px`, top: `${area.offsetTop}px`,
      width: `${area.offsetWidth}px`, height: `${area.offsetHeight}px`
    });
    inner.style.width = `${area.clientWidth}px`;
    const lines = this.text.split('\n');
    const headers = new Set(this.parsed.headers ?? []);
    inner.replaceChildren(...lines.map((line, index) => paintLine(line, headers.has(index))));
    const rows = this.rows();
    // A row's top, past the box's 1px border.
    const rowTop = (line: number) => 1 + (rows[line]?.offsetTop ?? 0);
    const half = (13 * 1.7) / 2;
    const starts = this.parsed.starts ?? [];
    const rails = starts.slice(0, -1).flatMap((start, i) => {
      const next = starts[i + 1]!;
      if (next.block !== start.block) return [];
      const rail = document.createElement('div');
      rail.className = start.gap ? 'rail gap' : 'rail';
      rail.style.top = `${rowTop(start.textLine) + half}px`;
      rail.style.height = `${rowTop(next.textLine) - rowTop(start.textLine)}px`;
      return [rail];
    });
    gutter.replaceChildren(...rails, ...starts.map(start => {
      const label = document.createElement('div');
      label.className = start.sung ? 'start' : 'start silent';
      const played = document.createElement('span'), visit = document.createElement('span'), dot = document.createElement('span');
      played.className = 'played'; played.textContent = String(start.ordinal + 1);
      visit.className = 'visit'; visit.textContent = this.labels[start.ordinal] ?? '';
      dot.className = 'dot';
      label.append(played, visit, dot);
      label.style.top = `${rowTop(start.textLine)}px`;
      label.addEventListener('mouseenter', () => this.showTip(label, start.ordinal));
      label.addEventListener('mouseleave', () => this.showTip(null, 0));
      // A label is a way to the line's first word: the caret goes there, and the cursor with it.
      label.addEventListener('mousedown', event => event.preventDefault());
      label.addEventListener('click', () => {
        const word = this.parsed.tokens.find(token => token.ordinal !== undefined && atLine(this.text, token.from) === start.textLine);
        const at = word?.from ?? lineStart(this.text, start.textLine);
        area.focus();
        area.setSelectionRange(at, word?.to ?? at);
        this.caretAt(at);
      });
      return label;
    }));
    this.onScroll();
  }

  /** The hover card on a margin label: what its two numbers mean. */
  private showTip(label: HTMLElement | null, ordinal: number) {
    const editor = this.renderRoot.querySelector<HTMLElement>('.editor');
    let tip = editor?.querySelector<HTMLElement>('.tip') ?? null;
    if (!label || !editor) { tip?.remove(); return; }
    const [bar, pass] = (this.labels[ordinal] ?? '').split('.').map(Number);
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; editor.append(tip); }
    tip.replaceChildren();
    const lead = document.createElement('b');
    lead.textContent = `${ordinalWord(ordinal + 1)} bar played`;
    tip.append(lead, ` · bar ${bar} of the score, ${ordinalWord(pass ?? 1)} time through`);
    const r = label.getBoundingClientRect(), e = editor.getBoundingClientRect();
    tip.style.left = `${r.left - e.left}px`;
    tip.style.top = `${r.bottom - e.top + 4}px`;
  }

  /** Outline the marked word where the painted copy lays it out, clipped to the box's text area. */
  private layoutMark() {
    const area = this.textarea();
    const marks = this.renderRoot.querySelector<HTMLElement>('.marks');
    const mark = marks?.firstElementChild as HTMLElement | null | undefined;
    if (!area || !marks || !mark) return;
    Object.assign(marks.style, {
      left: `${area.offsetLeft + 1}px`, top: `${area.offsetTop + 1}px`,
      width: `${area.clientWidth}px`, height: `${area.clientHeight}px`
    });
    const span = this.marked;
    const line = span ? atLine(this.text, span.from) : -1;
    const row = this.rows()[line];
    const column = span ? span.from - lineStart(this.text, line) : 0;
    const range = span && row ? rangeIn(row, column, column + span.to - span.from) : null;
    mark.hidden = !range;
    if (!range) return;
    // The painted copy scrolls with the box, so the word is where it is drawn.
    const word = range.getBoundingClientRect(), layer = marks.getBoundingClientRect();
    Object.assign(mark.style, {
      left: `${word.left - layer.left - 2}px`, top: `${word.top - layer.top - 1}px`,
      width: `${word.width + 4}px`, height: `${word.height + 2}px`
    });
  }

  private onScroll = () => {
    const area = this.textarea();
    const gutter = this.renderRoot.querySelector<HTMLElement>('.gutter-inner');
    const inner = this.renderRoot.querySelector<HTMLElement>('.paint-inner');
    if (area && gutter) gutter.style.transform = `translateY(${-area.scrollTop}px)`;
    if (area && inner) inner.style.transform = `translateY(${-area.scrollTop}px)`;
    this.showTip(null, 0);
    this.layoutMark();
  };

  private textarea(): HTMLTextAreaElement | null {
    return this.renderRoot.querySelector('textarea');
  }

  private reparse() {
    if (!this.doc) return;
    if (this.labelsFor !== this.doc) { this.labels = lyricVisitLabels(this.doc); this.labelsFor = this.doc; }
    this.parsed = parseLyricText(this.doc, this.partIndex, this.text);
    this.warnings = lyricPassWarnings(this.doc, this.partIndex, this.parsed);
    this.edits = this.parsed.diagnostics.length === 0
      ? planLyricEdits(this.doc, this.partIndex, this.parsed)
      : [];
  }

  /**
   * The live preview: a clean parse hands the host the current diff so the
   * score beside it redraws as if applied. While errors stand, the last clean
   * preview holds — flickering back to the committed text mid-word would
   * punish typing the very hyphen the parser is complaining about.
   */
  private preview() {
    clearTimeout(this.previewTimer); this.previewTimer = undefined;
    if (this.parsed.diagnostics.length === 0) {
      this.dispatchEvent(new CustomEvent('lyric-editor-edits', {
        detail: { edits: this.edits },
        bubbles: true,
        composed: true
      }));
    }
  }

  /** The performed word the caret is in, if any — the one the cursor goes to, and the one outlined. */
  private caretWord(caret: number) {
    const span = this.parsed.tokens.find(token => caret >= token.from && caret <= token.to);
    return span?.ordinal === undefined || !span.onset ? null : { ...span, ordinal: span.ordinal, onset: span.onset };
  }

  /** Caret → the word's performed place → the host moves the editor's cursor there. */
  private caretAt(caret: number) {
    const span = this.caretWord(caret);
    this.marked = span;
    this.layoutMark();
    // Sent on every caret move, the same word too: the cursor may have moved off it meanwhile, and a
    // place the cursor already holds settles without seeking.
    if (!span) return;
    this.dispatchEvent(new CustomEvent('lyric-editor-caret', {
      detail: { ordinal: span.ordinal, onset: span.onset },
      bubbles: true,
      composed: true
    }));
  }

  private onInput = () => {
    const area = this.textarea();
    if (!area) return;
    this.text = area.value;
    this.touched = this.pending = true;
    this.reparse();
    // The outline follows the typing at once (the render this input causes lays it out); the cursor waits.
    this.marked = this.caretWord(area.selectionStart);
    // The cursor follows the typing at the pause, with the preview — in the same
    // frame, so the score is laid out once, not on every word the caret enters.
    this.typed = true;
    clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => this.settleTyping(), LYRIC_PREVIEW_PAUSE_MS);
    clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(() => this.commit(), LYRIC_COMMIT_PAUSE_MS);
  };

  /**
   * Give the document what the box holds, now. A clean parse is handed to the
   * host as the plan against `doc`; text that does not parse — or that the host
   * turned away — is kept as a draft instead. Nothing is sent while playing.
   */
  commit() {
    clearTimeout(this.commitTimer); this.commitTimer = undefined;
    // A commit redraws the score itself; the preview it would have drawn is moot — but not
    // the cursor move that was waiting with it.
    if (this.previewTimer !== undefined) {
      clearTimeout(this.previewTimer); this.previewTimer = undefined;
      const area = this.textarea();
      if (area) this.caretAt(area.selectionStart);
    }
    if (!this.pending || this.playing || !this.doc) return;
    this.reparse();
    if (this.parsed.diagnostics.length === 0) {
      const detail: LyricCommitDetail = { edits: this.edits, accepted: false };
      this.dispatchEvent(new CustomEvent('lyric-editor-commit', { detail, bubbles: true, composed: true }));
      if (detail.accepted) {
        this.pending = false;
        this.saveDraft(null);
        return;
      }
    }
    this.saveDraft(this.text);
  }

  /** The document the plan is measured against moved under the visit: plan against the new one. */
  rebase(doc: MnxStructure) {
    this.doc = doc;
    this.reparse();
  }

  /** The plan against `doc`, or null while the text does not parse. */
  get plan(): LyricPlanEdit[] | null {
    return this.parsed.diagnostics.length === 0 ? this.edits : null;
  }

  private saveDraft(text: string | null) {
    this.dispatchEvent(new CustomEvent('lyric-editor-draft', { detail: { text }, bubbles: true, composed: true }));
  }

  /** Leaving the page: commit what can be, and keep this visit's text as a draft too — the
   *  commit's own recovery write may not get out before the page does. A draft the document
   *  already holds plans to nothing when it is next opened, and is dropped then. */
  private onHidden = (event: Event) => {
    if (event.type === 'visibilitychange' && globalThis.document?.visibilityState !== 'hidden') return;
    this.commit();
    if (this.touched) this.saveDraft(this.text);
  };

  private onBlur = () => this.commit();

  /** The pause after typing: the cursor goes to the caret's word, and the score previews the text. */
  private settleTyping() {
    const area = this.textarea();
    if (area) this.caretAt(area.selectionStart);
    this.preview();
  }

  /** A key that typed waits for the pause; one that only moved the caret moves the cursor now. */
  private onCaretMove = (event: Event) => {
    if (event.type === 'keyup' && this.typed) return;
    const area = this.textarea();
    if (area) this.caretAt(area.selectionStart);
  };

  private close() {
    this.commit();
    this.dispatchEvent(new CustomEvent('lyric-editor-close', { bubbles: true, composed: true }));
  }

  private onKey = (event: KeyboardEvent) => {
    // The drawer owns its keystrokes: nothing it sees may reach the page
    // keymap. (The reverse door stays open — clicking the score moves focus
    // out and the score keys work with the drawer still up.)
    event.stopPropagation();
    this.typed = false;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  };

  render() {
    const blocked = this.parsed.diagnostics.length > 0;
    const shown = [...this.parsed.diagnostics, ...this.warnings];
    return html`
      <div class="card" role="complementary" aria-label="Lyrics" tabindex="-1" @keydown=${this.onKey}>
        <header>
          <span class="title">lyrics</span>
          ${this.partLabel ? html`<span class="part">${this.partLabel}</span>` : nothing}
          <button class="close" aria-label="Close lyrics" title="Close lyrics (Escape)" @click=${() => this.close()}>×</button>
        </header>
        <div class="editor">
        <div class="gutter" aria-hidden="true"><div class="gutter-inner"></div></div>
        <textarea
          aria-label="Lyric text"
          ?readonly=${this.playing}
          title=${this.playing ? 'pause to edit' : ''}
          spellcheck="false"
          .value=${this.text}
          @input=${this.onInput}
          @keyup=${this.onCaretMove}
          @click=${this.onCaretMove}
          @blur=${this.onBlur}
          @scroll=${this.onScroll}
        ></textarea>
        <div class="paint" aria-hidden="true"><div class="paint-inner"></div></div>
        <div class="marks" aria-hidden="true"><span hidden></span></div>
        </div>
        <div class="diagnostics">
          ${shown.map(d => html`
            <span class="diagnostic${d.severity === 'warning' ? ' warning' : ''}">
              ${d.played !== undefined ? `${d.played} (${this.labels[d.played - 1] ?? d.bar}) — ` : d.bar !== undefined ? `bar ${d.bar} — ` : `line ${d.textLine + 1} — `}${d.message}
            </span>
          `)}
        </div>
        <footer>
          <span class="legend">${LEGEND}</span>
          <span class="status" role="status">${this.pending && blocked ? 'not in the score yet — fix the errors above' : ''}</span>
          <button @click=${() => this.close()}>close</button>
        </footer>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-lyric-text-editor': LyricTextEditor;
  }
}

/** The 0-based line an offset into the text is on, and where a line begins. */
const atLine = (text: string, offset: number) => text.slice(0, offset).split('\n').length - 1;
const lineStart = (text: string, line: number) => text.split('\n').slice(0, line).reduce((at, row) => at + row.length + 1, 0);

/** 1st, 2nd, 3rd, 4th… */
const ordinalWord = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;

/** A range over characters `from`–`to` of a painted row, whose text is split across spans. */
function rangeIn(row: Element, from: number, to: number): Range | null {
  const range = document.createRange();
  const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
  let at = 0, started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent!.length;
    if (!started && from <= at + length) { range.setStart(node, from - at); started = true; }
    if (started && to <= at + length) { range.setEnd(node, to - at); return range; }
    at += length;
  }
  return null;
}

/** One line of the text, painted: the marks that place words (bar lines, skips, runs of
 *  empty bars, the hyphens and underscores inside a word) faded back from the words. */
function paintLine(line: string, header: boolean): HTMLElement {
  const row = document.createElement('div');
  const span = (className: string, text: string) => {
    const el = document.createElement('span'); el.className = className; el.textContent = text; return el;
  };
  if (header) { row.append(span('head', line)); return row; }
  for (const piece of line.split(/(\s+)/)) {
    if (piece === '' || /^\s+$/.test(piece)) row.append(piece);
    else if (piece === '|') row.append(span('bar', piece));
    else if (/^[x×]\d+$/i.test(piece)) row.append(span('run', piece));
    else if (/^_+$/.test(piece)) row.append(span('skip', piece));
    else for (const part of piece.split(/(-+|_+|~|^\\)/)) {
      if (part === '') continue;
      row.append(/^-+$/.test(part) ? span('hy', part) : /^(_+|\\)$/.test(part) ? span('skip', part) : part);
    }
  }
  // An empty line still takes a row's height.
  if (!line) row.append('​');
  return row;
}
