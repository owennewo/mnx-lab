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
// The caret IS the editor's cursor: a caret on a token sends the performed place
// it starts (lyric-editor-caret) and the host moves the one cursor there — the
// playback cursor with it. The other way, a place — the cursor's, or the playhead's
// while playing — outlines the one token that holds it (`coverAt`). The panel
// draws no cursor of its own. A click or
// an arrow moves it at once; typing moves it at the pause, with the preview.
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { designTokens, sharedChrome, scrollbars } from './tokens.ts';
import type { MnxStructure } from '../model/mnx.ts';
import {
  coverAt,
  lyricVisitLabels,
  lyricPassWarnings,
  parseLyricText,
  planLyricEdits,
  serializeLyricText,
  type LyricPlace,
  type LyricPlanEdit,
  type LyricTextDiagnostic,
  type ParsedLyricText
} from '../edit/lyricText.ts';

/** The marks the text places words with — behind the header's ?, not under the box. */
const MARKS: readonly { mark: string; example: string; meaning: string }[] = [
  { mark: '-', example: 'fant-as-tic', meaning: 'split a word' },
  { mark: '--', example: 'fant--as', meaning: 'hold a syllable on' },
  { mark: '__', example: 'day__', meaning: 'extend a word' },
  { mark: '_', example: '__', meaning: 'skip a note, each' },
  { mark: '~', example: 'you~are', meaning: 'two words, one note' },
  { mark: '|', example: 'a | b', meaning: 'next bar' },
  { mark: '×4', example: '×4 or x4', meaning: 'bars without words' },
  { mark: '2:', example: '2:', meaning: 'another verse' },
  { mark: 'nl:', example: 'nl 2:', meaning: 'language' }
];

/** How long typing must pause before a clean parse is committed. */
export const LYRIC_COMMIT_PAUSE_MS = 3_000;
/** …and before the score beside it is redrawn as the text reads: a redraw of a long
 *  piece costs more than a keystroke is worth, so the box answers at once and the
 *  score catches up when the typing stops. */
export const LYRIC_PREVIEW_PAUSE_MS = 250;

export type { LyricPlace };

/** What the host is told: `edits` to commit; `accepted` is set by the host when they landed. */
export interface LyricCommitDetail { edits: LyricPlanEdit[]; accepted: boolean }

@customElement('mnx-lyric-text-editor')
export class LyricTextEditor extends LitElement {
  @property({ attribute: false }) doc: MnxStructure | null = null;
  @property({ type: Number }) partIndex = 0;
  /** The part's display name, for the header. */
  @property({ type: String }) partLabel = '';
  /** Opens with the caret on the token that holds this performed place — the cursor's. */
  @property({ attribute: false }) focusPlace: LyricPlace | null = null;
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
  /** The marks card, behind the header's ?, is open. */
  @state() private marksOpen = false;
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
        /* The blue lane (decision A): worth naming, never worth refusing over.
           No blue token exists in the shared palette yet, so the pair is local
           — matched to the renderer's warning-badge hue. */
        --warning-ink: light-dark(oklch(0.45 0.13 250), oklch(0.72 0.11 250));
      }
      header {
        display: flex;
        align-items: center;
        flex: none;
        min-height: 44px;
        gap: 8px;
        padding: 0 4px 0 16px;
        border-bottom: 1px solid var(--line);
      }
      header .title {
        font-size: 14px;
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
      }
      /* The panel is the box: no frame of its own, and the margin a tinted column beside it. */
      .gutter {
        position: relative;
        flex: none;
        width: calc(13ch + 12px);
        overflow: hidden;
        font: 11px/1 var(--mono);
        background: var(--bg-context);
        border-right: 1px solid var(--line);
      }
      .start {
        position: absolute;
        right: 12px;
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
      /* The cursor's line, lit across the box as the score's current row is. */
      .start.now .played, .start.now .visit { color: var(--accent-fg); }
      .start.now .visit { border-color: color-mix(in oklab, var(--accent) 45%, var(--surface)); }
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
      .start.now .dot { background: var(--accent); }
      /* A line the text cannot place: a ring in the margin, red for an error, blue for a warning. */
      .start.error .dot, .start.warning .dot, .flag {
        width: 9px;
        height: 9px;
        margin-right: -4px;
        background: var(--surface);
        border: 2px solid var(--accent);
      }
      .start.warning .dot, .flag.warning { border-color: var(--warning-ink); }
      .flag {
        position: absolute;
        right: 8px;
        z-index: 1;
        box-sizing: border-box;
        border-radius: 50%;
        margin: 0;
      }
      .start:hover .played, .start:hover .visit { color: var(--ink); }
      .rail {
        position: absolute;
        right: 12.75px;
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
      .tip .problem { display: block; max-width: 34ch; white-space: normal; margin-bottom: 3px; }
      /* What the box draws: its own text is transparent, and this copy, laid out the same,
         sits beneath it in two inks — words in ink, the marks that place them faded back. */
      .paint {
        position: absolute;
        z-index: 0;
        overflow: hidden;
        pointer-events: none;
        box-sizing: border-box;
        border: 1px solid transparent;
        background: var(--surface);
      }
      .paint-inner {
        box-sizing: border-box;
        padding: 12px 16px 12px 14px;
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
      .paint-inner > .now {
        background: var(--row-current);
        box-shadow: -14px 0 0 var(--row-current), 16px 0 0 var(--row-current);
      }
      /* The word the cursor is on, outlined as the score outlines a selected element: the
         box's own selection is not drawn once focus leaves it, and a press on the score takes it. */
      .marks {
        position: absolute;
        z-index: 2;
        overflow: hidden;
        pointer-events: none;
      }
      /* Under each token an error is about. */
      .marks .squiggle {
        position: absolute;
        border-bottom: 2px solid var(--accent);
      }
      .marks .word {
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
        border: 1px solid transparent;
        border-radius: 0;
        padding: 12px 16px 12px 14px;
        outline: none;
      }
      textarea::selection { background: color-mix(in srgb, var(--accent) 22%, transparent); }
      /* What the text cannot place, named by bar: each a way to the token it is about. */
      .diagnostics {
        max-height: 25%;
        overflow: auto;
        flex: none;
        display: flex;
        flex-direction: column;
        padding: 4px 0;
        border-top: 1px solid var(--line);
      }
      .diagnostic {
        text-align: left;
        font-size: 12px;
        line-height: 1.4;
        padding: 4px 16px;
        color: var(--accent-fg);
      }
      .diagnostic:hover { background: var(--row-current); }
      .diagnostic.warning { color: var(--warning-ink); }
      .diagnostic .at { font-weight: 600; font-variant-numeric: tabular-nums; }
      .tools {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .issues {
        height: 28px;
        margin-right: 4px;
        padding: 0 10px;
        border-radius: var(--radius-pill);
        background: color-mix(in oklab, var(--accent) 10%, var(--surface));
        color: var(--accent-fg);
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
      }
      .icon {
        flex: none;
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-control);
        color: var(--ink-2);
      }
      .icon:hover, .icon[aria-expanded='true'] { background: var(--bg); color: var(--ink); }
      .icon svg { width: 18px; height: 18px; }
      /* The marks, kept behind the ? until they are wanted. */
      .marks-card {
        position: absolute;
        z-index: 6;
        top: 48px;
        right: 8px;
        width: min(320px, calc(100% - 16px));
        padding: 12px 16px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius-panel);
        box-shadow: 0 10px 30px rgb(0 0 0 / 0.14);
        font-size: 12px;
      }
      .marks-card h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
      .marks-card table { width: 100%; border-collapse: collapse; }
      .marks-card td { padding: 3px 0; color: var(--ink-2); vertical-align: baseline; }
      .marks-card td:first-child { width: 3.5em; }
      .marks-card td:nth-child(2) { width: 8.5em; font-family: var(--mono); }
      .marks-card kbd {
        display: inline-block;
        min-width: 2.4em;
        padding: 2px 4px;
        text-align: center;
        font: 600 12px/1.2 var(--mono);
        color: var(--ink);
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: var(--radius-chip);
      }
      .marks-card p {
        margin: 8px 0 0;
        padding-top: 8px;
        border-top: 1px solid var(--line);
        color: var(--ink-3);
        font-size: 11px;
      }
      button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
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
    void this.updateComplete.then(() => this.showPlace(this.focusPlace));
  }

  /**
   * Outline the token whose stretch of the performance holds `place` — a word, or
   * the `_`, `×4` or `|` that a blank place is — and bring its line into view. The
   * cursor and the playhead are both a place, so the panel answers them alike, as
   * the score's lyric does. Paused (`select`), the caret goes onto it, so typing
   * starts there: used when the panel opens and when the cursor moves while the
   * box is not being typed in, and nothing is sent back until the caret moves.
   * Playing, the caret stays where it was. False when no token holds the place.
   */
  showPlace(place: LyricPlace | null, select = true): boolean {
    const area = this.textarea();
    if (!area) return false;
    const cover = place ? coverAt(this.parsed, place) : undefined;
    if (!select && (cover?.from ?? null) === (this.marked?.from ?? null)) return !!cover;
    this.marked = cover ?? null;
    this.layoutMark();
    if (!cover) return false;
    if (select) area.setSelectionRange(cover.from, cover.to);
    this.reveal(cover.from);
    return true;
  }

  /** A caret set from outside does not scroll the box: bring its line into view
   *  by the painted copy the margin is placed with. */
  private reveal(offset: number) {
    const area = this.textarea();
    const row = this.rows()[atLine(this.text, offset)];
    if (area && row && (row.offsetTop < area.scrollTop || row.offsetTop + row.offsetHeight > area.scrollTop + area.clientHeight)) {
      area.scrollTop = Math.max(0, row.offsetTop - area.clientHeight / 3);
    }
  }

  /** A problem is a way to what it is about: the caret selects its token, or goes to its line. */
  private goTo(problem: LyricTextDiagnostic) {
    const area = this.textarea();
    if (!area) return;
    const from = problem.from ?? lineStart(this.text, problem.textLine);
    area.focus();
    area.setSelectionRange(from, problem.to ?? from);
    this.reveal(from);
    this.caretAt(from);
  }

  /** Each line's problems, errors first — what its margin ring and tip say. */
  private problemsByLine(): Map<number, LyricTextDiagnostic[]> {
    const lines = new Map<number, LyricTextDiagnostic[]>();
    for (const problem of [...this.parsed.diagnostics, ...this.warnings])
      lines.set(problem.textLine, [...lines.get(problem.textLine) ?? [], problem]);
    return lines;
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
    const problems = this.problemsByLine();
    const ring = (line: number) => problems.get(line)?.some(p => p.severity !== 'warning') ? 'error' : 'warning';
    const labelled = new Set(starts.map(start => start.textLine));
    const flags = [...problems.keys()].filter(line => !labelled.has(line)).map(line => {
      const flag = document.createElement('div');
      flag.className = `flag ${ring(line)}`;
      flag.style.top = `${rowTop(line) + half - 4.5}px`;
      flag.addEventListener('mouseenter', () => this.showTip(flag, null, problems.get(line)!));
      flag.addEventListener('mouseleave', () => this.showTip(null, null, []));
      return flag;
    });
    gutter.replaceChildren(...rails, ...flags, ...starts.map(start => {
      const label = document.createElement('div');
      label.className = start.sung ? 'start' : 'start silent';
      if (problems.has(start.textLine)) label.classList.add(ring(start.textLine));
      label.dataset.line = String(start.textLine);
      const played = document.createElement('span'), visit = document.createElement('span'), dot = document.createElement('span');
      played.className = 'played'; played.textContent = String(start.ordinal + 1);
      visit.className = 'visit'; visit.textContent = this.labels[start.ordinal] ?? '';
      dot.className = 'dot';
      label.append(played, visit, dot);
      label.style.top = `${rowTop(start.textLine)}px`;
      label.addEventListener('mouseenter', () => this.showTip(label, start.ordinal, problems.get(start.textLine) ?? []));
      label.addEventListener('mouseleave', () => this.showTip(null, null, []));
      // A label is a way to the line's first word: the caret goes there, and the cursor with it.
      label.addEventListener('mousedown', event => event.preventDefault());
      label.addEventListener('click', () => {
        const word = this.parsed.covers?.find(cover => atLine(this.text, cover.from) === start.textLine);
        const at = word?.from ?? lineStart(this.text, start.textLine);
        area.focus();
        area.setSelectionRange(at, word?.to ?? at);
        this.caretAt(at);
      });
      return label;
    }));
    this.onScroll();
  }

  /** The hover card on a margin mark: the line's problems, then what a label's two numbers mean. */
  private showTip(label: HTMLElement | null, ordinal: number | null, problems: LyricTextDiagnostic[]) {
    const editor = this.renderRoot.querySelector<HTMLElement>('.editor');
    let tip = editor?.querySelector<HTMLElement>('.tip') ?? null;
    if (!label || !editor) { tip?.remove(); return; }
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; editor.append(tip); }
    tip.replaceChildren(...problems.map(problem => {
      const line = document.createElement('span');
      line.className = 'problem'; line.textContent = problem.message;
      return line;
    }));
    if (ordinal !== null) {
      const [bar, pass] = (this.labels[ordinal] ?? '').split('.').map(Number);
      const lead = document.createElement('b');
      lead.textContent = `${ordinalWord(ordinal + 1)} bar played`;
      tip.append(lead, ` · bar ${bar} of the score, ${ordinalWord(pass ?? 1)} time through`);
    }
    const r = label.getBoundingClientRect(), e = editor.getBoundingClientRect();
    tip.style.left = `${r.left - e.left}px`;
    tip.style.top = `${r.bottom - e.top + 4}px`;
  }

  /**
   * Outline the marked word where the painted copy lays it out, clipped to the box's
   * text area; light its line, in the box and the margin; and underline each token a
   * problem is about (a whole line, for an error that names none).
   */
  private layoutMark() {
    const area = this.textarea();
    const marks = this.renderRoot.querySelector<HTMLElement>('.marks');
    const mark = marks?.querySelector<HTMLElement>('.word');
    if (!area || !marks || !mark) return;
    Object.assign(marks.style, {
      left: `${area.offsetLeft + 1}px`, top: `${area.offsetTop + 1}px`,
      width: `${area.clientWidth}px`, height: `${area.clientHeight}px`
    });
    const rows = this.rows();
    const span = this.marked;
    const line = span ? atLine(this.text, span.from) : -1;
    rows.forEach((row, index) => row.classList.toggle('now', index === line));
    for (const label of this.renderRoot.querySelectorAll<HTMLElement>('.gutter .start'))
      label.classList.toggle('now', label.dataset.line === String(line));
    // The painted copy scrolls with the box, so a token is where it is drawn.
    const layer = marks.getBoundingClientRect();
    const rangeOf = (from: number, to: number) => {
      const at = atLine(this.text, from), row = rows[at], start = lineStart(this.text, at);
      return row ? rangeIn(row, from - start, to - start) : null;
    };
    marks.querySelectorAll('.squiggle').forEach(squiggle => squiggle.remove());
    for (const problem of this.parsed.diagnostics) {
      let { from, to } = problem;
      if (from === undefined || to === undefined) {
        const start = lineStart(this.text, problem.textLine), text = this.text.split('\n')[problem.textLine] ?? '';
        from = start + (text.length - text.trimStart().length); to = start + text.trimEnd().length;
      }
      const range = to > from ? rangeOf(from, to) : null;
      for (const rect of range?.getClientRects() ?? []) {
        const squiggle = document.createElement('span');
        squiggle.className = 'squiggle';
        Object.assign(squiggle.style, {
          left: `${rect.left - layer.left}px`, top: `${rect.bottom - layer.top - 1}px`, width: `${rect.width}px`
        });
        marks.append(squiggle);
      }
    }
    const range = span ? rangeOf(span.from, span.to) : null;
    mark.hidden = !range;
    if (!range) return;
    const word = range.getBoundingClientRect();
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
    this.showTip(null, null, []);
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

  /** The token the caret is in that takes up performed time, if any — where the cursor goes, and what is outlined. */
  private caretWord(caret: number) {
    return this.parsed.covers?.find(cover => caret >= cover.from && caret <= cover.to) ?? null;
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
      if (this.marksOpen) this.marksOpen = false;
      else this.close();
    }
  };

  render() {
    const errors = this.parsed.diagnostics;
    const shown = [...errors, ...this.warnings];
    // A press on the header's controls or a problem keeps the caret in the box.
    const keepFocus = (event: Event) => event.preventDefault();
    return html`
      <div class="card" role="complementary" aria-label="Lyrics" tabindex="-1" @keydown=${this.onKey}>
        <header>
          <span class="title">Lyrics</span>
          ${this.partLabel ? html`<span class="part">${this.partLabel}</span>` : nothing}
          <div class="tools">
            <span role="status">${errors.length ? html`
              <button class="issues" title="Go to the first" @mousedown=${keepFocus} @click=${() => this.goTo(errors[0]!)}>
                ${errors.length} to fix${this.pending ? ' · not in the score yet' : ''}
              </button>` : nothing}</span>
            <button class="icon marks-toggle" aria-label="Lyric marks" title="Lyric marks" aria-controls="marks"
              aria-expanded=${String(this.marksOpen)} @mousedown=${keepFocus} @click=${() => { this.marksOpen = !this.marksOpen; }}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
                <circle cx="10" cy="10" r="7.5"></circle><path d="M7.8 7.9a2.3 2.3 0 0 1 4.4.9c0 1.5-2.2 1.9-2.2 3.2"></path>
                <circle cx="10" cy="14.4" r="0.5" fill="currentColor"></circle>
              </svg>
            </button>
            <button class="icon close" aria-label="Close lyrics" title="Close lyrics (Escape)" @click=${() => this.close()}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15"></path>
              </svg>
            </button>
          </div>
        </header>
        ${this.marksOpen ? html`
          <div class="marks-card" id="marks" role="dialog" aria-label="Lyric marks">
            <h2>Marks</h2>
            <table>
              ${MARKS.map(m => html`<tr><td><kbd>${m.mark}</kbd></td><td>${m.example}</td><td>${m.meaning}</td></tr>`)}
            </table>
            <p>Each line’s margin label is the bar played it starts in, then that bar of the score and its pass.</p>
          </div>` : nothing}
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
        <div class="marks" aria-hidden="true"><span class="word" hidden></span></div>
        </div>
        ${shown.length ? html`
          <div class="diagnostics">
            ${shown.map(d => html`
              <button class="diagnostic${d.severity === 'warning' ? ' warning' : ''}" @mousedown=${keepFocus} @click=${() => this.goTo(d)}>
                <span class="at">${d.played !== undefined ? `${d.played} (${this.labels[d.played - 1] ?? d.bar})` : d.bar !== undefined ? `bar ${d.bar}` : `line ${d.textLine + 1}`}</span> — ${d.message}
              </button>
            `)}
          </div>` : nothing}
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
