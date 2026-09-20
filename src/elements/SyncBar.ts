import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  beatTimes, isClosedSegment, moveCut, placeEnd, placeStart, removeCut, renameSegment, segmentAt, segmentTempo,
  setBeats, setBpm, splitAt, type SyncSegments,
} from '../model/syncSegments.ts';

export interface SyncChange { segments: SyncSegments; /** False while a drag is still moving. */ commit: boolean }
type Selection = { kind: 'cut'; index: number } | { kind: 'segment'; index: number } | { kind: 'parked'; end: 'start' | 'end' } | null;

/** The zoomed window a selected cut is first shown in, in media seconds; a pinch changes it, within these. */
const ZOOM_SPAN = 16;
const MIN_SPAN = 2;
/** Beat ticks are for placing a cut by eye; past this many they are texture, not information. */
const MAX_TICKS = 160;
const stroke = (d: string) => svg`<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d=${d} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
/** Nudge steps, in seconds. A cut is placed against what a person can HEAR:
 *  two sounds read as together until roughly 25 ms apart, a tapped downbeat
 *  carries more error than that, the readout prints hundredths, and a YouTube
 *  clock is coarser still — so a finer step would move nothing anyone could
 *  judge. The coarse step crosses an audible flam in one press. */
const FINE_NUDGE = 0.025, COARSE_NUDGE = 0.1;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;

/**
 * The SYNC BAR (roadmap/complete/studio-sync-bar.md): the recording's whole
 * length in the rail's slot and at the rail's size, divided by cut lines into
 * segments of whole beats. It edits a `SyncSegments` value and owns nothing
 * else — the player seeks, loops, clicks and derives; the host stores.
 *
 * Two of the cuts are trim handles, parked at the bar's ends until placed:
 * left of the start handle and right of the end handle are unsynced. There is
 * no cut button and no zoom button: handles are dragged or sent to the
 * playhead, a split lives in the selected segment's row, and selecting a cut
 * zooms the bar around it.
 */
@customElement('mnx-sync-bar')
export class SyncBar extends LitElement {
  @property({ attribute: false }) segments!: SyncSegments;
  /** The recording's length in seconds; 0 until the source has reported it. */
  @property({ type: Number }) duration = 0;
  @property({ type: Number }) time = 0;
  /** Playback rate, so a tapped tempo is heard tempo divided by it. */
  @property({ type: Number }) rate = 1;
  @state() private selected: Selection = null;
  @state() private zoom: { from: number; to: number } | null = null;
  @state() private looping = false;
  /** Where a mouse or pen is over the track, in media seconds; the hover card reads it. Never a finger. */
  @state() private hover: number | null = null;
  /** The window was moved by hand: it stays put until the playhead is seen inside it again, or is sought elsewhere. */
  private panHeld = false;
  private lastTime = 0;
  private miniDrag: { pointer: number; x: number; from: number } | null = null;
  /** Fingers on the bar. Two of them drag the zoomed window, the way they would scroll anything else. */
  private touches = new Map<number, number>();
  /** How many seconds the zoomed window shows. A pinch sets it and it sticks: the scale is the person's, not the cut's. */
  private span = ZOOM_SPAN;
  private drag: { index: number | 'start' | 'end'; origin: number | 'start' | 'end'; x: number; from: number; span: number; moved: boolean; pointer: number } | null = null;
  private taps: number[] = [];

  static styles = css`
    :host {
      position: relative;
      display: block;
      flex: 1 1 160px;
      min-width: 120px;
      font: 14px/1.4 var(--sans);
      color: var(--ink);
    }
    .bar {
      position: relative;
      height: 36px;
      outline: none;
    }
    .bar:focus-visible {
      outline: var(--rule-w, 2px) solid var(--focus-ring, var(--ink));
      outline-offset: 4px;
    }
    .lab {
      position: absolute;
      top: 0;
      height: 16px;
      box-sizing: border-box;
      margin: 0;
      padding: 0 0 4px 4px;
      border: 0;
      border-left: 1px solid var(--line-strong);
      border-radius: 0;
      background: none;
      font: 600 10px/1 var(--sans);
      letter-spacing: 0.11em;
      text-transform: uppercase;
      text-align: left;
      color: var(--ink-3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    button.lab { cursor: pointer; color: var(--ink-2); }
    button.lab:hover, button.lab[aria-pressed='true'] { color: var(--ink); }
    .track {
      position: absolute;
      left: 0;
      right: 0;
      top: 16px;
      height: 18px;
      cursor: pointer;
      overflow: hidden;
    }
    .seg {
      position: absolute;
      top: 0;
      bottom: 0;
      box-sizing: border-box;
      border-radius: 1px;
      background: var(--line);
    }
    .seg.un {
      background: repeating-linear-gradient(135deg, var(--line-strong) 0 1.5px, transparent 1.5px 6px);
    }
    .seg.sel { box-shadow: inset 0 0 0 2px var(--ink); }
    .tick {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: color-mix(in oklab, var(--ink), transparent 50%);
      pointer-events: none;
    }
    /* What is under the pointer: segment, beat, time and tempo. It sits over the label strip, where nothing
       else needs the room, rather than above the bar where the selection's row is. */
    .tip {
      position: absolute;
      top: -2px;
      height: 18px;
      box-sizing: border-box;
      padding: 0 6px;
      transform: translateX(-50%);
      font: 500 11px/16px var(--mono);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: var(--ink);
      background: var(--player-ground, var(--surface, #fff));
      border: 1px solid var(--line);
      border-radius: 3px;
      pointer-events: none;
      z-index: 5;
    }
    .tip.l { transform: none; }
    .tip.r { transform: translateX(-100%); }
    .played {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      background: color-mix(in oklab, var(--accent), transparent 58%);
      pointer-events: none;
    }
    .head {
      position: absolute;
      top: 12px;
      height: 26px;
      width: 2px;
      margin-left: -1px;
      background: var(--accent);
      box-shadow: 0 0 0 1px var(--surface, #fff);
      pointer-events: none;
      z-index: 3;
    }
    /* A cut is a 1px line under a 16px-wide grab area; a trim handle is heavier. */
    .cut {
      position: absolute;
      top: -4px;
      height: 40px;
      width: 16px;
      margin: 0 0 0 -8px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: none;
      cursor: ew-resize;
      touch-action: none;
      z-index: 2;
      color: var(--ink-3);
    }
    .cut::before {
      content: '';
      position: absolute;
      left: 7.5px;
      top: 0;
      bottom: 0;
      width: 1px;
      background: currentColor;
    }
    .cut::after {
      content: '';
      position: absolute;
      left: 4px;
      top: 0;
      width: 8px;
      height: 5px;
      background: currentColor;
    }
    .cut.trim { color: var(--ink); }
    .cut.trim::before { left: 7px; width: 2px; }
    .cut.trim::after { left: 3px; width: 10px; height: 7px; }
    .cut.parked { color: var(--ink-3); }
    .cut[aria-pressed='true'] { color: var(--accent); z-index: 4; }
    .cut:focus-visible { outline: var(--rule-w, 2px) solid var(--focus-ring, var(--ink)); }
    /* Where the zoomed window sits in the whole recording — and the handle that moves it. The line is 2px; the
       grab area is the 12px around it, because a scrollbar nobody can catch is worse than none. */
    .bar { touch-action: pan-y; }
    .mini {
      position: absolute;
      left: 0;
      right: 0;
      top: 33px;
      height: 12px;
      cursor: grab;
      touch-action: none;
      z-index: 4;
    }
    .mini:active { cursor: grabbing; }
    .mini::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 5px;
      height: 2px;
      background: var(--line-strong);
    }
    .mini i {
      position: absolute;
      top: 3px;
      height: 6px;
      min-width: 12px;
      border-radius: 1px;
      background: var(--ink);
    }
    .wait {
      font: 500 12px/36px var(--sans);
      color: var(--ink-3);
      white-space: nowrap;
    }
    .pop {
      position: absolute;
      left: 0;
      bottom: calc(100% + 14px);
      z-index: 6;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      width: max-content;
      max-width: min(760px, calc(100vw - 24px));
      box-sizing: border-box;
      padding: 8px;
      background: var(--player-ground, var(--bg));
      border: 1px solid var(--line);
      border-radius: 3px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18), 0 6px 18px rgba(0, 0, 0, 0.22);
    }
    .pop button, .pop input, .pop .value {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 40px;
      box-sizing: border-box;
      margin: 0;
      padding: 0 12px;
      font: inherit;
      color: inherit;
      background: var(--surface, transparent);
      border: 1px solid var(--line);
      border-radius: 3px;
      white-space: nowrap;
    }
    .pop button { cursor: pointer; }
    .pop button:hover:not(:disabled) { border-color: var(--ink-3); }
    .pop button:disabled { opacity: 0.4; cursor: default; }
    .pop button[aria-pressed='true'] { background: var(--ink); border-color: var(--ink); color: var(--surface, #fff); }
    .pop input { width: 140px; justify-content: flex-start; font-weight: 600; cursor: text; }
    .pop .mono, .pop .value { font: 500 13px/1 var(--mono); font-variant-numeric: tabular-nums; }
    .pop .value { min-width: 150px; font-weight: 700; }
    .pop .time { padding: 0 6px; font: 700 14px/1 var(--mono); font-variant-numeric: tabular-nums; }
    .pop kbd { font: 500 12px/1 var(--mono); color: var(--ink-3); }
    .pop button[aria-pressed='true'] kbd { color: inherit; }
    .join { display: inline-flex; }
    .join > * + * { margin-left: -1px; border-top-left-radius: 0; border-bottom-left-radius: 0; }
    .join > *:not(:last-child) { border-top-right-radius: 0; border-bottom-right-radius: 0; }
    .join button { min-width: 40px; padding: 0 10px; }
    .hint { font-size: 12px; color: var(--ink-2); }
  `;

  // ── the window ──────────────────────────────────────────────────────────
  private get view() {
    const to = this.duration > 0 ? this.duration : 1;
    return this.zoom ?? { from: 0, to };
  }
  private pct(seconds: number) {
    const { from, to } = this.view;
    return `${Math.min(100, Math.max(0, (seconds - from) / (to - from) * 100))}%`;
  }
  private zoomTo(seconds: number) {
    if (this.duration <= this.span) { this.zoom = null; return; }
    const from = Math.min(this.duration - this.span, Math.max(0, seconds - this.span / 2));
    this.zoom = { from, to: from + this.span };
    // Put here on purpose, around a cut: a playhead that is somewhere else does not get to take it away.
    this.panHeld = true;
  }
  /**
   * Change the scale, keeping the moment under the pointer where it is. There is no zoom button: a pinch (two
   * touches, or a trackpad's — which arrives as a Ctrl+wheel) is the gesture, and zooming all the way out is the
   * whole recording again. Moving a cut a minute is a pinch out, a drag, and a pinch back in.
   */
  private zoomBy(factor: number, anchor: number) {
    if (!(this.duration > 0) || !Number.isFinite(factor) || factor <= 0) return;
    const { from, to } = this.view, old = to - from;
    const span = Math.min(this.duration, Math.max(Math.min(MIN_SPAN, this.duration), old * factor));
    if (span === old) return;
    this.span = span;
    this.panHeld = true;
    if (span >= this.duration) { this.zoom = null; return; }
    const next = Math.min(this.duration - span, Math.max(0, anchor - (anchor - from) / old * span));
    this.zoom = { from: next, to: next + span };
  }
  /** Move the zoomed window by hand. It holds where it is put (`panHeld`) rather than snapping back to a playhead
   *  that is still where it was. */
  private panTo(from: number) {
    if (!this.zoom) return;
    const clamped = Math.min(this.duration - this.span, Math.max(0, from));
    if (clamped === this.zoom.from) return;
    this.zoom = { from: clamped, to: clamped + this.span };
    this.panHeld = true;
  }
  /**
   * The zoomed window follows the playhead: a seek made anywhere — the video's own scrubber, the score, the rail —
   * brings the bar to where the sound now is, and playback that runs off the right edge turns the page. A window
   * moved by hand is left alone until the playhead is back inside it or jumps; a drag in progress always is.
   */
  private followPlayhead() {
    const jumped = Math.abs(this.time - this.lastTime) > 1.5;
    this.lastTime = this.time;
    if (!this.zoom || this.drag || this.miniDrag || this.touches.size > 1) return;
    const inside = this.time >= this.zoom.from && this.time <= this.zoom.to;
    if (inside) { this.panHeld = false; return; }
    if (this.panHeld && !jumped) return;
    // A quarter in: what is about to sound matters more than what just did.
    const from = Math.min(this.duration - this.span, Math.max(0, this.time - this.span / 4));
    this.zoom = { from, to: from + this.span };
    this.panHeld = false;
  }
  /** Selecting a cut zooms to it; selecting anything else zooms out — except a split, which keeps the window it
   *  was made in (`keepZoom`): the person is looking at the beats there and has just chosen one. */
  private select(next: Selection, keepZoom = false) {
    if (this.looping && !(next?.kind === 'cut')) this.setLoop(false);
    this.selected = next;
    if (next?.kind === 'cut') { this.zoomTo(this.segments.cuts[next.index]); if (this.looping) this.setLoop(true); }
    else if (!keepZoom) this.zoom = null;
  }

  protected willUpdate(changed: Map<PropertyKey, unknown>) {
    if (changed.has('time')) this.followPlayhead();
    if (!changed.has('segments') && !changed.has('duration')) return;
    // A selection that no longer names anything (another editor, a reload) lets go.
    const s = this.selected;
    if (s?.kind === 'cut' && s.index >= this.segments.cuts.length) this.select(null);
    if (s?.kind === 'segment' && s.index >= this.segments.segments.length) this.select(null);
  }
  protected updated() {
    // Keep the overlay inside the window whatever the tray's width.
    const pop = this.renderRoot.querySelector<HTMLElement>('.pop');
    if (!pop) return;
    pop.style.transform = '';
    const over = pop.getBoundingClientRect().right - (window.innerWidth - 12);
    if (over > 0) pop.style.transform = `translateX(${-over}px)`;
  }

  // ── changes ─────────────────────────────────────────────────────────────
  private change(segments: SyncSegments, commit = true) {
    if (segments === this.segments && !commit) return;
    this.segments = segments;
    this.dispatchEvent(new CustomEvent<SyncChange>('sync-change', { detail: { segments, commit }, bubbles: true, composed: true }));
  }
  private seek(seconds: number) {
    this.dispatchEvent(new CustomEvent('sync-seek', { detail: { seconds }, bubbles: true, composed: true }));
  }
  private setLoop(on: boolean) {
    this.looping = on;
    const s = this.selected;
    const at = on && s?.kind === 'cut' ? this.segments.cuts[s.index] : null;
    this.dispatchEvent(new CustomEvent('sync-loop', {
      detail: at === null ? null : { start: Math.max(0, at - 1.5), end: Math.min(this.duration || Infinity, at + 1) }, bubbles: true, composed: true,
    }));
  }
  private moveSelectedCut(to: number, commit = true) {
    const s = this.selected;
    if (s?.kind !== 'cut') return;
    this.change(moveCut(this.segments, s.index, to, this.duration || undefined), commit);
    if (commit && this.looping) this.setLoop(true);
  }
  private toPlayhead() {
    const s = this.selected;
    if (s?.kind === 'parked') {
      const next = s.end === 'start' ? placeStart(this.segments, this.time) : placeEnd(this.segments, this.time);
      if (next === this.segments) return;
      this.change(next);
      this.select({ kind: 'cut', index: s.end === 'start' ? 0 : next.cuts.length - 1 });
    } else if (s?.kind === 'cut') { this.moveSelectedCut(this.time); this.zoomTo(this.segments.cuts[s.index]); }
  }
  private removeSelectedCut() {
    const s = this.selected;
    if (s?.kind !== 'cut') return;
    const next = removeCut(this.segments, s.index);
    this.select(null);
    this.change(next);
  }
  private split(seconds = this.time) {
    const result = splitAt(this.segments, seconds);
    if (!result) return;
    this.change(result.doc);
    this.select({ kind: 'segment', index: result.cut }, true);
  }
  private tap() {
    const s = this.selected;
    if (s?.kind !== 'segment') return;
    const now = performance.now();
    if (this.taps.length && now - this.taps[this.taps.length - 1] > 2500) this.taps = [];
    this.taps.push(now);
    if (this.taps.length > 12) this.taps.shift();
    if (this.taps.length < 3) return;
    const mean = (this.taps[this.taps.length - 1] - this.taps[0]) / (this.taps.length - 1);
    // Tapped against slowed playback, the recording's own tempo is faster.
    this.change(setBpm(this.segments, s.index, 60000 / mean / (this.rate || 1)));
  }
  private step(direction: 1 | -1, coarse: boolean) {
    const s = this.selected;
    if (s?.kind !== 'segment') return;
    const segment = this.segments.segments[s.index];
    if (isClosedSegment(this.segments, s.index)) { if (segment.beats !== null) this.change(setBeats(this.segments, s.index, segment.beats + direction)); }
    else if (segment.bpm !== null) this.change(setBpm(this.segments, s.index, segment.bpm + direction * (coarse ? 1 : 0.1)));
  }

  // ── pointer and keys ────────────────────────────────────────────────────
  private timeAt(event: MouseEvent) {
    const box = this.renderRoot.querySelector('.track')!.getBoundingClientRect(), { from, to } = this.view;
    return from + Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * (to - from);
  }
  /**
   * A drag is captured by the BAR and heard there, never by the handle's own button: placing a parked handle
   * replaces its button with a cut's, and a captured element that leaves the document takes the rest of the
   * gesture with it — the pointerup was lost, the drag stayed armed, and every later hover over the cut moved it.
   */
  private onCutDown(event: PointerEvent, index: number | 'start' | 'end') {
    if (event.button !== 0) return;
    // Capture can be refused (the pointer is already up by the time we ask); the drag still ends on the bar's own pointerup.
    try { this.renderRoot.querySelector<HTMLElement>('.bar')!.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
    const from = index === 'start' ? 0 : index === 'end' ? this.duration : this.segments.cuts[index];
    const { from: a, to: b } = typeof index === 'number' ? this.zoomWindowFor(from) : this.view;
    this.drag = { index, origin: index, x: event.clientX, from, span: b - a, moved: false, pointer: event.pointerId };
  }
  /** The window a cut will be shown in once selected — a drag is measured in it. */
  private zoomWindowFor(seconds: number) {
    if (this.duration <= this.span) return { from: 0, to: this.duration || 1 };
    const from = Math.min(this.duration - this.span, Math.max(0, seconds - this.span / 2));
    return { from, to: from + this.span };
  }
  private onCutMove(event: PointerEvent) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    // No button is down: whatever ended this drag, we did not hear it. Let go rather than follow a hover.
    if (event.pointerType === 'mouse' && event.buttons === 0) { this.endDrag(drag); return; }
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 3) return;
    const width = this.renderRoot.querySelector('.track')!.getBoundingClientRect().width;
    const to = drag.from + dx / width * drag.span;
    if (!drag.moved) {
      drag.moved = true;
      if (typeof drag.index === 'number') { if (!(this.selected?.kind === 'cut' && this.selected.index === drag.index)) this.select({ kind: 'cut', index: drag.index }); }
      else this.select({ kind: 'parked', end: drag.index });
    }
    if (typeof drag.index === 'number') { this.moveSelectedCut(to, false); return; }
    // A parked handle is placed by its first move, then is a cut like any other.
    const next = drag.index === 'start' ? placeStart(this.segments, Math.max(0, to)) : placeEnd(this.segments, Math.min(this.duration, to));
    if (next === this.segments) return;
    drag.index = drag.index === 'start' ? 0 : next.cuts.length - 1;
    this.selected = { kind: 'cut', index: drag.index };
    this.change(next, false);
  }
  private onCutUp(event: PointerEvent) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    this.endDrag(drag);
  }
  private endDrag(drag: NonNullable<SyncBar['drag']>) {
    const index = drag.origin;
    this.drag = null;
    if (!drag.moved) {
      const same = typeof index === 'number' ? this.selected?.kind === 'cut' && this.selected.index === index
        : this.selected?.kind === 'parked' && this.selected.end === index;
      this.select(same ? null : typeof index === 'number' ? { kind: 'cut', index } : { kind: 'parked', end: index });
      return;
    }
    this.change(this.segments, true);
    if (this.selected?.kind === 'cut') { this.zoomTo(this.segments.cuts[this.selected.index]); if (this.looping) this.setLoop(true); }
  }
  // Panning the zoomed window: the minimap is its scrollbar, and two fingers over the bar — a trackpad's wheel
  // events, or two touches — drag it the way they would scroll anything else.
  private trackWidth() { return this.renderRoot.querySelector('.track')!.getBoundingClientRect().width || 1; }
  private onMiniDown(event: PointerEvent) {
    if (event.button !== 0 || !this.zoom) return;
    event.stopPropagation();
    const strip = event.currentTarget as HTMLElement, box = strip.getBoundingClientRect();
    try { strip.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
    // A press off the thumb brings the window to the pointer first, so the drag continues from under it.
    const at = (event.clientX - box.left) / box.width * this.duration;
    if (at < this.zoom.from || at > this.zoom.to) this.panTo(at - this.span / 2);
    this.miniDrag = { pointer: event.pointerId, x: event.clientX, from: this.zoom.from };
  }
  private onMiniMove(event: PointerEvent) {
    const drag = this.miniDrag;
    if (!drag || event.pointerId !== drag.pointer) return;
    const width = (event.currentTarget as HTMLElement).getBoundingClientRect().width || 1;
    this.panTo(drag.from + (event.clientX - drag.x) / width * this.duration);
  }
  private onMiniUp(event: PointerEvent) { if (this.miniDrag?.pointer === event.pointerId) this.miniDrag = null; }
  private onWheel(event: WheelEvent) {
    // A trackpad pinch arrives as a Ctrl+wheel; taking it also keeps the browser from zooming the page instead.
    if (event.ctrlKey) {
      event.preventDefault();
      this.zoomBy(Math.exp(event.deltaY * 0.01), this.timeAt(event));
      return;
    }
    // Horizontal intent only: a vertical wheel over the tray still scrolls the page.
    const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
    if (!this.zoom || !dx || Math.abs(event.deltaY) > Math.abs(dx) && !event.shiftKey) return;
    event.preventDefault();
    this.panTo(this.zoom.from + dx / this.trackWidth() * this.span);
  }
  private onTouchDown(event: PointerEvent) {
    if (event.pointerType !== 'touch') return;
    this.touches.set(event.pointerId, event.clientX);
    // A second finger turns whatever the first began into a pan or a pinch: let go of the cut, do not move it.
    if (this.touches.size === 2 && this.drag) { const drag = this.drag; this.drag = null; if (drag.moved) this.change(this.segments, true); }
  }
  private onTouchMove(event: PointerEvent) {
    if (!this.touches.has(event.pointerId)) return;
    const before = [...this.touches.values()];
    this.touches.set(event.pointerId, event.clientX);
    if (this.touches.size !== 2) return;
    const after = [...this.touches.values()];
    const box = this.renderRoot.querySelector('.track')!.getBoundingClientRect();
    const mid = (xs: number[]) => (xs[0] + xs[1]) / 2, apart = (xs: number[]) => Math.abs(xs[0] - xs[1]);
    // Fingers moving apart or together change the scale about the point between them…
    if (apart(before) > 24 && apart(after) > 24) {
      const { from, to } = this.view;
      this.zoomBy(apart(before) / apart(after), from + Math.min(1, Math.max(0, (mid(before) - box.left) / box.width)) * (to - from));
    }
    // …and moving together they carry the window along, one for one with what is under them.
    if (this.zoom) this.panTo(this.zoom.from - (mid(after) - mid(before)) / (box.width || 1) * this.span);
  }
  private onTouchUp(event: PointerEvent) { this.touches.delete(event.pointerId); }

  private onKey(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return;
    const s = this.selected, key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    let used = true;
    if ((key === 'ArrowLeft' || key === 'ArrowRight') && s?.kind === 'cut')
      this.moveSelectedCut(this.segments.cuts[s.index] + (key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? COARSE_NUDGE : FINE_NUDGE));
    else if (key === 'Enter' && (s?.kind === 'cut' || s?.kind === 'parked')) this.toPlayhead();
    else if ((key === 'Delete' || key === 'Backspace') && s?.kind === 'cut') this.removeSelectedCut();
    else if (key === 'Escape' && s) this.select(null);
    else if (key === 's') this.split();
    else if (key === 't' && s?.kind === 'segment') this.tap();
    else if (key === 'l' && s?.kind === 'cut') this.setLoop(!this.looping);
    else used = false;
    if (used) { event.preventDefault(); event.stopPropagation(); }
  }

  // ── render ──────────────────────────────────────────────────────────────
  /** The hover card's line: `beat 7 of 11 · 0:13.20 · 120.0 bpm`, or the unsynced region's name and time. The
   *  segment's name is not repeated — its label is on the strip beside the card. */
  private tipText(seconds: number) {
    const i = segmentAt(this.segments, seconds), at = clock(seconds);
    if (i < 0) return `${this.regions().find(r => r.index < 0 && seconds >= r.from && seconds < r.to)?.name ?? 'Unsynced'} · ${at}`;
    const segment = this.segments.segments[i], tempo = segmentTempo(this.segments, i);
    if (tempo === null) return `${at} · no tempo`;
    const beat = Math.floor((seconds - this.segments.cuts[i]) * tempo / 60 + 1e-6) + 1;
    return `beat ${beat}${segment.beats !== null ? ` of ${segment.beats}` : ''} · ${at} · ${tempo.toFixed(1)} bpm`;
  }
  private regions() {
    const { cuts, segments, closed } = this.segments, end = this.duration;
    if (!cuts.length) return [{ from: 0, to: end, name: 'Unsynced', index: -1 }];
    const out = [{ from: 0, to: cuts[0], name: 'Pre-roll', index: -1 }];
    segments.forEach((s, i) => out.push({ from: cuts[i], to: cuts[i + 1] ?? end, name: s.name, index: i }));
    if (closed) out.push({ from: cuts[cuts.length - 1], to: end, name: 'Post-roll', index: -1 });
    return out.filter(r => r.to > r.from);
  }
  private cutButton(index: number | 'start' | 'end', seconds: number, label: string, trim: boolean, pressed: boolean) {
    return html`<button type="button" class=${`cut${trim ? ' trim' : ''}${typeof index === 'number' ? '' : ' parked'}`} style=${`left:${this.pct(seconds)}`}
      aria-pressed=${pressed} aria-label=${label} title=${label}
      @pointerdown=${(e: PointerEvent) => this.onCutDown(e, index)}
      @click=${(e: MouseEvent) => { if (e.detail === 0) this.select(typeof index === 'number' ? { kind: 'cut', index } : { kind: 'parked', end: index }); }}></button>`;
  }
  private cutRow() {
    const s = this.selected;
    if (s?.kind === 'parked') {
      const blocked = s.end === 'end' && !this.segments.cuts.length;
      return html`<div class="pop" role="group" aria-label=${`${s.end === 'start' ? 'Start' : 'End'} handle`}>
        <span class="hint">${blocked ? 'Place the start handle first.' : s.end === 'start' ? 'Start handle: drag it to the first beat, or play and press' : 'End handle: drag it to the last steady beat, or play and press'}</span>
        <button type="button" ?disabled=${blocked} @click=${() => this.toPlayhead()}>To playhead <kbd>Enter</kbd></button></div>`;
    }
    if (s?.kind !== 'cut') return nothing;
    const at = this.segments.cuts[s.index];
    const nudge = (ms: number) => html`<button type="button" class="mono" aria-label=${`Nudge ${ms} milliseconds`} @click=${() => this.moveSelectedCut(at + ms / 1000)}>${ms > 0 ? '+' : '−'}${Math.abs(ms)}</button>`;
    return html`<div class="pop" role="group" aria-label="Cut line">
      <span class="time">${clock(at)}</span>
      <span class="join" role="group" aria-label="Nudge, milliseconds">${nudge(-100)}${nudge(-25)}${nudge(25)}${nudge(100)}</span><span class="hint">ms</span>
      <button type="button" @click=${() => this.toPlayhead()}>To playhead <kbd>Enter</kbd></button>
      <button type="button" aria-pressed=${this.looping} @click=${() => this.setLoop(!this.looping)}>${stroke('M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4')}Loop</button>
      <button type="button" aria-label="Remove this cut" title="Remove this cut" @click=${() => this.removeSelectedCut()}>${stroke('M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13')}</button>
    </div>`;
  }
  private segmentRow() {
    const s = this.selected;
    if (s?.kind !== 'segment') return nothing;
    const segment = this.segments.segments[s.index], closed = isClosedSegment(this.segments, s.index), tempo = segmentTempo(this.segments, s.index);
    const value = tempo === null ? 'Tap the tempo' : closed ? `${segment.beats} beats · ${tempo.toFixed(2)}` : `${tempo.toFixed(1)} bpm`;
    return html`<div class="pop" role="group" aria-label="Segment">
      <input aria-label="Segment name" maxlength="80" .value=${segment.name}
        @change=${(e: Event) => this.change(renameSegment(this.segments, s.index, (e.target as HTMLInputElement).value))}>
      <span class="join"><button type="button" ?disabled=${tempo === null} aria-label=${closed ? 'One beat fewer' : 'Slower'} @click=${(e: MouseEvent) => this.step(-1, e.shiftKey)}>−</button
        ><span class="value" aria-live="polite">${value}</span
        ><button type="button" ?disabled=${tempo === null} aria-label=${closed ? 'One beat more' : 'Faster'} @click=${(e: MouseEvent) => this.step(1, e.shiftKey)}>+</button></span>
      <button type="button" @click=${() => this.tap()}>Tap <kbd>T</kbd></button>
      <button type="button" ?disabled=${segmentAt(this.segments, this.time) !== s.index} @click=${() => this.split()}>Split at playhead <kbd>S</kbd></button>
      ${closed ? nothing : html`<span class="hint">Open-ended until the end handle is placed</span>`}
    </div>`;
  }
  render() {
    if (!this.segments) return nothing;
    if (!(this.duration > 0)) return html`<div class="wait" role="status">Play the recording once to load its length.</div>`;
    const { from, to } = this.view, s = this.selected, { cuts, closed } = this.segments;
    const shown = this.regions().filter(r => r.to > from && r.from < to);
    // Beat ticks whenever they can be told apart: past MAX_TICKS in the window they would be a grey wash.
    const beats = beatTimes(this.segments, from, to, this.duration).filter(b => !b.cut);
    const ticks = beats.length > MAX_TICKS ? [] : beats;
    const tip = this.hover !== null && !this.drag && !this.miniDrag && this.hover >= from && this.hover <= to ? this.tipText(this.hover) : null;
    const tipAt = (this.hover! - from) / (to - from);
    const width = (a: number, b: number) => `${(Math.min(to, b) - Math.max(from, a)) / (to - from) * 100}%`;
    return html`<div class="bar" tabindex="0" role="group" aria-label="Recording sync" @keydown=${this.onKey} @wheel=${this.onWheel}
        @pointerdown=${this.onTouchDown} @pointermove=${(e: PointerEvent) => { this.onCutMove(e); this.onTouchMove(e); }}
        @pointerup=${(e: PointerEvent) => { this.onCutUp(e); this.onTouchUp(e); }} @pointercancel=${(e: PointerEvent) => { this.onCutUp(e); this.onTouchUp(e); }}
        @lostpointercapture=${(e: PointerEvent) => this.onCutUp(e)}>
        ${shown.map(r => r.index < 0
          ? html`<span class="lab" style=${`left:${this.pct(r.from)};width:${width(r.from, r.to)}`}>${r.name}</span>`
          : html`<button type="button" class="lab" style=${`left:${this.pct(r.from)};width:${width(r.from, r.to)}`}
              aria-pressed=${s?.kind === 'segment' && s.index === r.index} title=${`Edit ${r.name}`}
              @click=${() => this.select(s?.kind === 'segment' && s.index === r.index ? null : { kind: 'segment', index: r.index })}>${r.name}</button>`)}
        <div class="track" @click=${(e: MouseEvent) => this.seek(this.timeAt(e))} @dblclick=${(e: MouseEvent) => this.split(this.timeAt(e))}
          @pointermove=${(e: PointerEvent) => { if (e.pointerType !== 'touch') this.hover = this.timeAt(e); }}
          @pointerleave=${() => (this.hover = null)}>
          ${shown.map(r => html`<div class=${`seg${r.index < 0 ? ' un' : ''}${s?.kind === 'segment' && s.index === r.index ? ' sel' : ''}`}
            style=${`left:calc(${this.pct(r.from)} + 1px);width:calc(${width(r.from, r.to)} - 2px)`}></div>`)}
          ${ticks.map(b => html`<i class="tick" style=${`left:${this.pct(b.time)}`}></i>`)}
          <div class="played" style=${`width:${this.pct(this.time)}`}></div>
        </div>
        ${cuts.length ? nothing : this.cutButton('start', from, 'Start handle, not placed', true, s?.kind === 'parked' && s.end === 'start')}
        ${cuts.map((t, i) => t < from || t > to ? nothing : this.cutButton(i, t,
          `${i === 0 ? 'Start handle' : closed && i === cuts.length - 1 ? 'End handle' : 'Cut'} at ${clock(t)}`,
          i === 0 || (closed && i === cuts.length - 1), s?.kind === 'cut' && s.index === i))}
        ${closed || this.zoom ? nothing : this.cutButton('end', to, 'End handle, not placed', true, s?.kind === 'parked' && s.end === 'end')}
        ${this.time >= from && this.time <= to ? html`<div class="head" style=${`left:${this.pct(this.time)}`}></div>` : nothing}
        ${tip === null ? nothing : html`<div class=${`tip${tipAt < 0.15 ? ' l' : tipAt > 0.85 ? ' r' : ''}`} aria-hidden="true"
          style=${tipAt < 0.15 ? 'left:0' : tipAt > 0.85 ? 'left:100%' : `left:${this.pct(this.hover!)}`}>${tip}</div>`}
        ${this.zoom ? html`<div class="mini" role="scrollbar" aria-orientation="horizontal" aria-label="The part of the recording shown"
          aria-valuemin="0" aria-valuemax=${Math.round(this.duration)} aria-valuenow=${Math.round(from)}
          @pointerdown=${this.onMiniDown} @pointermove=${this.onMiniMove} @pointerup=${this.onMiniUp} @pointercancel=${this.onMiniUp}
          @click=${(e: Event) => e.stopPropagation()}><i style=${`left:${from / this.duration * 100}%;width:${(to - from) / this.duration * 100}%`}></i></div>` : nothing}
      </div>
      ${this.cutRow()}${this.segmentRow()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'mnx-sync-bar': SyncBar }
}
