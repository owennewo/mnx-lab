// The Mix panel on a piece: what plays, and how it sounds. It opens from the tray's Mix field
// and stands in the frame's side slot like the other sheets, tall and narrow.
//
// Three layers, each headed by the same toggle the tray shows (Mix panel: recordings as
// channels, 2026-10-22; roadmap/inprogress/studio-mix-layers.md): the RECORDING — on, it leads
// and its video shows; the radio to choose it only when the piece has more than one — the SYNTH,
// a row per part (the eye takes it off the score; its instrument; its level), and the CLICK on
// every beat. The synth and the click play along with a recording that leads, through its sync.
// No mute or solo: the toggles and the levels are the whole mix. The Master — the tray's volume
// — is last, by the tray. The synth's settings for this device (Full or Light, sounding notes as
// you select them) are behind a button on the Synth heading.
//
// It owns nothing: every change leaves as an event for the page to store and hand to the
// viewer and the player. Instruments play on the synth (core-campaign-synth.md Phase 6):
// a factory design, or a part rig imported from the synth's app.
import { LitElement, css, html, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { LibraryRecording } from '../../../src/storage/libraryClient.ts';
import type { MnxDocument } from '../../../src/model/mnx.ts';
import type { PartMix, PartMixEntry } from '../../../src/audio/partMix.ts';
import type { MixLayers } from '../../../src/elements/Player.ts';
import { BASIC_KEYS, BASIC_KIT, parsePartRig, type FactoryDesign } from '../../../src/audio/hostInstruments.ts';
import type { RoutedPart } from '../../../src/audio/hostSetup.ts';
import { linearizePasses } from '../../../src/model/passes.ts';
import { compilePerformance } from '../../../src/audio/performance.ts';
import { syncSummary, type SyncSummary } from './syncSummary.ts';
import { playbackNotes } from './playbackNotes.ts';
import { isImportedSync, storedScoreShape, storedSyncSegments } from '../../../src/model/recordingAttachment.ts';
import { performedBarBeats } from '../../../src/audio/recordingSync.ts';
import { staleSegmentBars } from '../../../src/model/syncSegments.ts';

export interface MixPart {
  /** The part's index in the document. */
  index: number;
  name: string;
  /** Strings and capo, or "Percussion". */
  detail: string;
  /** Plays only kit voices. */
  kit: boolean;
}

const line = (d: string, px: number) => svg`<svg width=${px} height=${px} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${d}></path></svg>`;
const cross = html`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;
const pencil = line('M4 20h4l10-10-4-4L4 16v4zM13 7l4 4', 13);
const plus = line('M12 5v14M5 12h14', 13);
const warnMark = line('M12 4l9 16H3zM12 10v4M12 17v.5', 14);
const sliders = svg`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"></path><circle cx="16" cy="7" r="2"></circle><circle cx="10" cy="17" r="2"></circle></svg>`;
const glyph = (d: string, px: number) => svg`<svg width=${px} height=${px} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${d}></path></svg>`;
const ICON = {
  video: 'M5 5h14a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5H5a2.5 2.5 0 0 1-2.5-2.5v-9A2.5 2.5 0 0 1 5 5zM10 9l5 3-5 3z',
  audio: 'M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2',
  synth: 'M3 5h18v14H3zM9 5v9M15 5v9',
  click: 'M7 21h10L14 4h-4L7 21zM12 15l6-9',
};
const eye = (off: boolean) => svg`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>${off ? svg`<path d="M4 4l16 16"></path>` : nothing}</svg>`;

@customElement('mnx-studio-mix')
export class MixSheet extends LitElement {
  // ── what plays ──
  /** The piece's playable recordings, as the library stores them. */
  @property({ attribute: false }) recordings: readonly LibraryRecording[] = [];
  @property({ attribute: false }) document: MnxDocument | null = null;
  /** `synth` or the id of the recording playing (or asked for): the recording layer is on. */
  @property() activeId = 'synth';
  /** The recording the layer plays when it is on: the one playing, else the last chosen. */
  @property() chosenId: string | null = null;
  @property({ attribute: false }) layers: MixLayers = { synth: true, click: false, clickLevel: 0.6, recordingLevel: 1, synthLevel: 1 };
  /** The live score-follow warning for the active recording. */
  @property() syncWarning = '';
  @property({ type: Boolean }) canAdd = false;
  /** The score as a recording sees it now; an imported sync stamped with another shape may be out of date. */
  @property() scoreShape = '';
  // ── the mix ──
  @property({ attribute: false }) parts: readonly MixPart[] = [];
  /** Part indices off the score (not `hidden`, which every element already owns). */
  @property({ attribute: false }) hiddenParts: readonly number[] = [];
  @property({ attribute: false }) mix: PartMix = {};
  /** How each part is routed, why when it is not what was asked, and the guitar designs. */
  @property({ attribute: false }) routing: readonly RoutedPart[] = [];
  @property({ attribute: false }) routingNotes: readonly { partIndex: number; message: string }[] = [];
  @property({ attribute: false }) designs: readonly FactoryDesign[] = [];
  /** The master volume, 0–1: the tray's. */
  @property({ type: Number }) master = 0.7;
  // ── the synth on this device ──
  /** Light plays at 32 kHz, a third less work. */
  @property() sound: 'full' | 'light' = 'full';
  /** Sound a note the editor's cursor lands on (roadmap: core-note-audition). */
  @property({ type: Boolean }) auditionNotes = true;

  /** Where the synth's settings hang, measured from the panel's top, or null when closed. */
  @state() private settingsAt: number | null = null;
  /** A rig file that could not be imported, by part. */
  @state() private importProblem: { index: number; message: string } | null = null;
  private compiled?: ReturnType<typeof compilePerformance>;
  private passes?: ReturnType<typeof linearizePasses>;

  static styles = css`
    :host {
      box-sizing: border-box; position: relative; display: flex; flex-direction: column;
      width: 360px; max-width: 100%; height: 100%;
      border-left: 1px solid var(--frame-line, var(--line));
      background: light-dark(oklch(0.975 0.006 75), oklch(0.215 0.006 70));
      color: var(--ink); font-size: 14px;
    }
    .scroll { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
    button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--frame-line, var(--line)); border-radius: 0; cursor: pointer; }
    button:disabled { opacity: 0.4; cursor: default; }
    button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    header { display: flex; align-items: center; height: 40px; flex: none; padding: 0 8px 0 16px; }
    header b { flex: 1; font-size: 15px; font-weight: 600; }
    button.plain { border: 0; width: 28px; height: 28px; padding: 0; display: grid; place-items: center; color: var(--ink-3); }
    button.plain:hover, button.plain[aria-expanded='true'] { color: var(--ink); background: var(--frame-press, var(--hover)); }

    /* ── a layer: its toggle (the tray's), then its rows ── */
    section { display: flex; flex-direction: column; gap: 4px; padding: 8px 12px 10px; }
    section + section { border-top: 1px solid var(--frame-line, var(--line)); }
    /* Every level in one column at the right, the same width (just under half the panel): a layer's in
       its heading, a part's in its row, the master's in its bar. */
    .head { display: flex; align-items: center; gap: 10px; min-height: 30px; }
    .head .grow { flex: 1; }
    .head input[type='range'] { width: 160px; flex: none; }
    /* A layer that is off keeps its level, quieter. */
    .head .layer[aria-pressed='false'] ~ input[type='range'] { opacity: 0.55; }
    .layer { display: flex; align-items: center; gap: 7px; height: 30px; padding: 0 10px; border: 0; font: 600 12px/1 var(--sans, inherit);
      background: var(--tray-cell, light-dark(oklch(0.91 0.012 75), oklch(0.3 0.008 70))); color: var(--ink-3); }
    .layer:hover:not(:disabled):not([aria-pressed='true']) { color: var(--ink); }
    .layer[aria-pressed='true'] { background: var(--ink); color: var(--paper, #fff); }
    .layer[aria-pressed='true']:hover { color: color-mix(in oklab, var(--paper, #fff), var(--ink) 45%); }
    .rows { display: flex; flex-direction: column; }
    .rows.off { opacity: 0.55; }
    /* Every row one grid, so every slider is the same length and lines up. */
    .ch { display: grid; grid-template-columns: 28px minmax(0, 1fr) 160px; align-items: center; column-gap: 8px; min-height: 40px;
      border-bottom: 1px solid light-dark(oklch(0.92 0.008 70), oklch(0.28 0.006 70)); }
    .ch:last-child { border-bottom: 0; }
    /* A lone part has no slider of its own (the Synth heading's is its level): its sound takes the room. */
    .ch.lone { grid-template-columns: 28px minmax(0, 1fr); }
    .ch > .icon { display: grid; place-items: center; color: var(--ink-2); }
    .name { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .name b { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* A part: its name and its sound on one line. */
    .name.inline { flex-direction: row; align-items: baseline; gap: 10px; }
    .name.inline b { flex: none; max-width: 60%; }
    .name.inline .sound { min-width: 0; flex: 1 1 auto; }
    .off .name b { color: var(--ink-3); }
    /* The instrument as a quiet line under the name: a select without its box. */
    .sound { max-width: 100%; margin-left: -3px; padding: 0; border: 0; background: transparent; font: 12px/1.2 var(--sans, inherit); color: var(--ink-3); cursor: pointer; text-overflow: ellipsis; }
    .sound:hover { color: var(--ink); }
    .sound option, .sound optgroup { color: var(--ink); background-color: var(--surface, #fff); }
    input[type='range'] { width: 100%; margin: 0; accent-color: var(--accent); }
    .eye { width: 28px; height: 28px; padding: 0; border: 0; display: grid; place-items: center; color: var(--ink-2); }
    .eye[aria-pressed='true'] { color: var(--ink-faint, var(--ink-3)); }
    .note { grid-column: 2 / -1; padding-bottom: 8px; font-size: 12px; line-height: 1.4; color: var(--ink-3); }
    .note.problem { color: light-dark(#a3341f, #f0907c); }
    .choice { display: flex; align-items: center; }
    .pick { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; height: 30px; padding: 0 6px; border: 0; text-align: left; font-size: 13px; color: var(--ink-2); }
    .pick > span:last-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .pick[aria-checked='true'] { color: var(--ink); font-weight: 600; }
    .one { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; height: 30px; padding: 0 6px; font-size: 13px; font-weight: 600; }
    .one > span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .one > .icon { display: grid; color: var(--ink-2); }
    .alarm { flex: none; display: grid; color: light-dark(#a12121, #ffb4ab); }
    .add { align-self: flex-start; display: flex; align-items: center; gap: 10px; height: 30px; padding: 0 6px; border: 0; font-size: 13px; color: var(--ink-3); }
    .add:hover { color: var(--ink); }
    .dot { width: 12px; height: 12px; flex: none; box-sizing: border-box; border-radius: 50%; border: 1.5px solid var(--ink-3); }
    [aria-checked='true'] .dot { border: 3.5px solid var(--accent); }
    .diagnostic ul { margin: 4px 0 0; padding-left: 18px; }
    .diagnostic { margin: 2px 0 4px; font-size: 13px; padding: 10px; background: light-dark(#efeeeb, #343330); line-height: 1.5; }
    .empty { margin: 0; padding: 4px 6px 2px; font-size: 12px; color: var(--ink-3); }

    /* ── the synth's settings, behind the Synth heading ── */
    .pop {
      position: absolute; z-index: 6; right: 12px; width: 290px; box-sizing: border-box;
      display: flex; flex-direction: column; gap: 9px; padding: 10px 12px; font-size: 13px;
      background: var(--paper, light-dark(#fff, oklch(0.25 0.006 70))); border: 1px solid var(--frame-line, var(--line));
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12), 0 6px 18px rgba(0, 0, 0, 0.14);
    }
    /* Where the window has room, it opens over the score beside the panel, not over the rows. */
    @media (min-width: 900px) { .pop { right: calc(100% + 8px); } }
    .pop .row { display: flex; align-items: center; gap: 10px; }
    .pop .row > span { flex: 1; }
    .quality { display: flex; }
    .quality button { height: 26px; padding: 0 10px; font-size: 12px; }
    .quality button + button { border-left: 0; }
    .quality button b { font-weight: 500; }
    .quality button[aria-checked='true'] { background: var(--ink); border-color: var(--ink); color: var(--paper, #fff); }
    .quality button[aria-checked='true'] b { font-weight: 600; }
    .pop label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .pop label input { margin: 0; accent-color: var(--accent); }
    .pop p { margin: 0; font-size: 12px; line-height: 1.45; color: var(--ink-3); }
    .pop a { color: var(--ink-2); }

    .fill { flex: 1; min-height: 16px; }
    .master {
      flex: none; padding: 0 12px;
      background: var(--frame-bar, light-dark(oklch(0.948 0.012 75), oklch(0.245 0.008 70)));
      border-top: 1px solid var(--frame-line, var(--line));
    }
    .master .ch { border: 0; min-height: 50px; }
    .master .name { flex-direction: row; align-items: baseline; justify-content: space-between; }
    .master .name b { font: 600 11px/1 var(--sans, inherit); letter-spacing: 0.1em; text-transform: uppercase; }
    .master .val { font: 600 12px/1 var(--mono, ui-monospace, monospace); font-variant-numeric: tabular-nums; }
    .master input[type='range'] { accent-color: var(--ink); }
    input[type='file'] { display: none; }
  `;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onClickAway);
  }
  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.onClickAway);
    super.disconnectedCallback();
  }
  private readonly onClickAway = (event: PointerEvent) => {
    if (this.settingsAt === null) return;
    const path = event.composedPath();
    if (path.some(n => n instanceof HTMLElement && (n.classList.contains('pop') || n.dataset.settings !== undefined))) return;
    this.settingsAt = null;
  };

  protected willUpdate(changed: Map<PropertyKey, unknown>) {
    if (changed.has('document') && this.document) {
      this.passes = linearizePasses(this.document.mnxJson);
      this.compiled = compilePerformance(this.document.mnxJson, this.passes);
    }
  }
  private emit<T>(type: string, detail?: T) {
    this.dispatchEvent(new CustomEvent<T>(type, { detail, bubbles: true, composed: true }));
  }

  // ── what plays ─────────────────────────────────────────────────────────

  /** An imported sync whose bars have moved since it was last known good. */
  private outOfDate(row: LibraryRecording): boolean {
    const stamped = isImportedSync(row) ? storedScoreShape(row.provenance) : null;
    return !!stamped && !!this.scoreShape && stamped !== this.scoreShape;
  }
  /** Bars a one-segment-a-bar sync no longer counts right: they play at the wrong speed. */
  private staleBars(row: LibraryRecording): number[] {
    const segments = storedSyncSegments(row.provenance), compiled = this.compiled;
    return segments && compiled?.ok ? staleSegmentBars(segments, performedBarBeats(compiled.performance, compiled.writtenBarDurations, segments)) : [];
  }
  /** How a recording follows this score. */
  private follows(summary: SyncSummary, active: boolean, outOfDate = false) {
    if (summary.warning || (active && this.syncWarning)) return 'sync warning';
    if (outOfDate) return 'may be out of date';
    if (!summary.points.length) return 'no sync points';
    return summary.coverage === 'full' ? 'follows the whole score' : 'follows part of the score';
  }
  private toggleSettings(button: HTMLElement) {
    if (this.settingsAt !== null) { this.settingsAt = null; return; }
    const head = button.closest('.head') as HTMLElement;
    this.settingsAt = head.getBoundingClientRect().bottom - this.getBoundingClientRect().top + 4;
  }
  private setLayers(patch: Partial<MixLayers>) { this.emit<MixLayers>('layers-change', { ...this.layers, ...patch }); }
  /** A row's level: every slider the same length (the row's last column). */
  private level(label: string, value: number, set: (value: number) => void, disabled = false) {
    return html`<input type="range" min="0" max="1" step="0.05" aria-label=${label} title=${String(Math.round(value * 100))} ?disabled=${disabled}
      .value=${String(value)} @input=${(e: Event) => set(Number((e.target as HTMLInputElement).value))} />`;
  }
  /** A layer's toggle: the tray's, as the section's heading. */
  private layerToggle(layer: string, on: boolean, icon: string, label: string, title: string, act: () => void, disabled = false) {
    return html`<button class="layer" type="button" data-layer=${layer} aria-pressed=${on} ?disabled=${disabled}
      aria-label=${`${label}: ${on ? 'on' : 'off'}`} title=${title} @click=${act}>${glyph(icon, 15)}${label}</button>`;
  }

  // ── the recording ──────────────────────────────────────────────────────

  /** The recording the layer plays: the one playing, else the last chosen, else the first. */
  private get chosen(): LibraryRecording | undefined {
    return this.recordings.find(r => r.id === this.activeId) ?? this.recordings.find(r => r.id === this.chosenId) ?? this.recordings[0];
  }
  private recordingSection() {
    const chosen = this.chosen, on = this.activeId !== 'synth' && !!chosen;
    const icon = chosen?.kind === 'audio' ? ICON.audio : ICON.video;
    const add = this.canAdd ? html`<button class="add" type="button" aria-label="Add recording" title="Add a recording" @click=${() => this.emit('recording-add')}>${plus}<span>Add recording</span></button>` : nothing;
    return html`<section aria-label="Recordings">
      <div class="head">
        ${this.layerToggle('recording', on, icon, 'Recordings', !chosen ? 'Add a recording first' : on ? 'Turn the recording off' : `Play ${chosen.name ?? 'the recording'}`,
          () => this.emit('recording-toggle', { on: !on }), !chosen)}
        <span class="grow"></span>
        ${this.level(chosen ? `${chosen.name ?? 'Recording'} level` : 'Recording level', this.layers.recordingLevel, value => this.setLayers({ recordingLevel: value }), !chosen)}
      </div>
      ${!chosen
        ? html`<p class="empty">${this.canAdd ? 'None yet: add a YouTube video or an audio file to play along to.' : 'None.'}</p>${add}`
        : html`<div class=${on ? 'rows' : 'rows off'}>
            ${this.recordings.length > 1
              ? html`<div role="radiogroup" aria-label="Which recording">${this.recordings.map(r => html`<div class="choice">
                  <button class="pick" type="button" role="radio" aria-checked=${r.id === chosen.id} data-source=${r.id}
                    @click=${() => this.emit('recording-choose', { id: r.id })}><span class="dot"></span><span>${r.name ?? 'Unnamed recording'}</span>${this.alarmMark(r, on && r.id === chosen.id)}</button>
                  ${this.editButton(r)}
                </div>`)}</div>`
              : html`<div class="choice"><span class="one"><span class="icon">${glyph(icon, 15)}</span><span>${chosen.name ?? 'Unnamed recording'}</span>${this.alarmMark(chosen, on)}</span>${this.editButton(chosen)}</div>`}
            ${add}
            ${this.recordingNotes(chosen, on)}
          </div>`}
    </section>`;
  }
  private editButton(r: LibraryRecording) {
    return html`<button class="plain" type="button" data-edit=${r.id} aria-label=${`Edit ${r.name ?? 'recording'}`}
      title="Edit the recording and its sync" @click=${() => this.emit('recording-edit', { id: r.id })}>${pencil}</button>`;
  }
  /** Why a recording's sync is not to be trusted — a mark by its name, its words in the title. */
  private alarm(row: LibraryRecording, active: boolean): string {
    const follows = this.follows(syncSummary(row, this.compiled, this.passes), active, this.outOfDate(row) || this.staleBars(row).length > 0);
    return follows === 'sync warning' || follows === 'may be out of date' ? follows : '';
  }
  private alarmMark(row: LibraryRecording, active: boolean) {
    const alarm = this.alarm(row, active);
    return alarm ? html`<span class="alarm" data-alarm=${alarm} role="img" aria-label=${`Sync: ${alarm}`} title=${`Sync: ${alarm}`}>${warnMark}</span>` : nothing;
  }

  /** Why the score plays other than as written, or not at all: the synth plays this
   *  performance and every recording follows it, so it sits under the Synth row. */
  private playbackNotes() {
    const { failure, notes } = playbackNotes(this.compiled);
    if (failure) return html`<div class="diagnostic" role="status" data-playback-notes><strong>Can't play:</strong> ${failure} The score still shows; the synth and score following wait until it plays.</div>`;
    if (!notes.length) return nothing;
    return html`<div class="diagnostic" role="status" data-playback-notes><strong>Plays not quite as written:</strong>
      ${notes.length === 1 ? notes[0] : html`<ul>${notes.map(n => html`<li>${n}</li>`)}</ul>`}</div>`;
  }

  /** What the recording playing needs said: a sync gone stale, a sync warning, or none to follow by. */
  private recordingNotes(row: LibraryRecording, on: boolean) {
    const summary = syncSummary(row, this.compiled, this.passes);
    const outOfDate = this.outOfDate(row), stale = this.staleBars(row);
    const points = summary.points.length;
    const warning = on && (this.syncWarning || summary.warning || summary.dropped);
    // The synth and the click follow the recording's sync: without one they have nothing to go by.
    const alone = on && (this.layers.synth || this.layers.click) && (!points || summary.warning);
    return html`
      ${outOfDate && on
        ? html`<div class="diagnostic" role="status" data-out-of-date><strong>May be out of date:</strong> the score's bars have changed since this sync was made. It counts bars by number, so everything after the change may now be early or late. Make a new sync in the sync bar to replace it.</div>`
        : nothing}
      ${stale.length && on
        ? html`<div class="diagnostic" role="status" data-out-of-date data-stale-bars=${stale.length}><strong>May be out of date:</strong> ${stale.length === 1 ? `bar ${stale[0]! + 1} has` : `${stale.length} bars, from bar ${stale[0]! + 1}, have`} changed length since this sync was made, so ${stale.length === 1 ? 'it plays' : 'they play'} at the wrong speed and later bars drift. Make a new sync in the sync bar to replace it.</div>`
        : nothing}
      ${warning
        ? html`<div class="diagnostic" role="status"><strong>Sync warning:</strong> ${this.syncWarning || (summary.warning ? summary.message : `${summary.dropped} out-of-range sync ${summary.dropped === 1 ? 'point' : 'points'} dropped.`)} Score following and seeking may be unavailable.</div>`
        : nothing}
      ${alone && !warning
        ? html`<div class="diagnostic" role="status" data-unsynced>The synth and the click play along once this recording is synced to the score: open the sync bar in the tray.</div>`
        : nothing}`;
  }

  private settings() {
    if (this.settingsAt === null) return nothing;
    return html`<div class="pop" role="dialog" aria-label="Synth settings" style=${`top: ${this.settingsAt}px`}>
      <div class="row"><span>Sound on this device</span>
        <span class="quality" role="radiogroup" aria-label="Sound">
          ${(['full', 'light'] as const).map((sound) => html`<button type="button" role="radio" aria-checked=${String(this.sound === sound)}
            title=${sound === 'full' ? 'The device’s sample rate' : '32 kHz, a third less work: for phones and tablets that skip'}
            @click=${() => { if (this.sound !== sound) this.emit('sound-change', sound); }}><b>${sound === 'full' ? 'Full' : 'Light'}</b></button>`)}
        </span>
      </div>
      <label><input type="checkbox" .checked=${this.auditionNotes} @change=${(e: Event) => this.emit('audition-change', (e.target as HTMLInputElement).checked)} />Sound notes as you select them</label>
      <p class="synth-link">Make a sound in <a href="/synth/" target="_blank" rel="noopener">the synth</a>, choose <b>Export part</b>, then <b>Import rig…</b> on a part's instrument.</p>
    </div>`;
  }

  // ── the mix ────────────────────────────────────────────────────────────

  private setMix(index: number, change: Partial<PartMixEntry>) {
    // No mute or solo here: one left from before the panel lost them goes with the next change.
    const { muted: _muted, solo: _solo, ...entry } = { ...this.mix[index], ...change };
    this.emit<PartMix>('mix-change', { ...this.mix, [index]: entry });
  }
  private toggleHidden(index: number) {
    const next = this.hiddenParts.includes(index) ? this.hiddenParts.filter((i) => i !== index) : [...this.hiddenParts, index];
    this.emit<number[]>('hidden-change', next);
  }
  /** The instrument value for a part: what it plays now. */
  private hostValue(part: MixPart, entry: PartMixEntry): string {
    const choice = entry.instrument, routed = this.routing.find(r => r.partIndex === part.index);
    if (choice?.kind === 'rig' && routed?.source === 'rig') return 'rig';
    return `design:${routed?.design ?? (part.kit ? BASIC_KIT.id : BASIC_KEYS.id)}`;
  }
  private chooseHost(part: MixPart, value: string, select: HTMLSelectElement) {
    if (value === 'import') {
      select.value = this.hostValue(part, this.mix[part.index] ?? {});
      this.renderRoot.querySelector<HTMLInputElement>(`input[type=file][data-part="${part.index}"]`)?.click();
      return;
    }
    this.importProblem = null;
    if (value === 'rig') return;
    this.setMix(part.index, { instrument: { kind: 'design', design: value.slice(7) } });
  }
  private async importRig(part: MixPart, input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let parsed;
    try { parsed = parsePartRig(JSON.parse(await file.text())); } catch { parsed = { ok: false as const, message: 'That file is not JSON: choose a .rig.json exported from the synth.' }; }
    if (!parsed.ok) { this.importProblem = { index: part.index, message: parsed.message }; return; }
    const routed = this.routing.find(r => r.partIndex === part.index);
    if (part.kit ? parsed.kind !== 'kit' : parsed.kind === 'kit' || (parsed.kind === 'plucked' && !routed?.pluckable)) {
      this.importProblem = { index: part.index, message: part.kit ? 'A percussion part plays a kit rig.' : parsed.kind === 'kit' ? 'A kit rig plays percussion parts only.' : 'A guitar rig needs the part to declare strings the guitar can play.' };
      return;
    }
    this.importProblem = null;
    this.setMix(part.index, { instrument: { kind: 'rig', rig: parsed.rig } });
  }
  private instrument(part: MixPart, entry: PartMixEntry) {
    const routed = this.routing.find(r => r.partIndex === part.index);
    const value = this.hostValue(part, entry), rig = entry.instrument?.kind === 'rig' ? entry.instrument.rig : null;
    const option = (id: string, label: string) => html`<option value=${id} ?selected=${value === id}>${label}</option>`;
    return html`<select class="sound" aria-label=${`${part.name} instrument`} title="Instrument"
        @change=${(e: Event) => { const select = e.target as HTMLSelectElement; this.chooseHost(part, select.value, select); }}>
        ${part.kit
          ? option(`design:${BASIC_KIT.id}`, BASIC_KIT.name)
          : html`${routed?.pluckable ? html`<optgroup label="Guitar">${this.designs.map(d => option(`design:${d.id}`, d.name))}</optgroup>` : nothing}
            <optgroup label="Keys">${option(`design:${BASIC_KEYS.id}`, BASIC_KEYS.name)}</optgroup>`}
        <optgroup label="Your rig">${rig ? option('rig', `Rig: ${rig.name}`) : nothing}${option('import', 'Import rig…')}</optgroup>
      </select>
      <input type="file" accept=".json,application/json" data-part=${part.index} @change=${(e: Event) => void this.importRig(part, e.target as HTMLInputElement)} />`;
  }
  private note(part: MixPart) {
    const problem = this.importProblem?.index === part.index ? this.importProblem.message : null;
    if (problem) return html`<div class="note problem" role="alert">${problem}</div>`;
    const notes = this.routingNotes.filter(n => n.partIndex === part.index).map(n => n.message);
    return notes.length ? html`<div class="note">${notes.join(' ')}</div>` : nothing;
  }
  private eyeButton(part: MixPart, hidden: boolean, lastVisible: boolean) {
    return html`<button class="eye" type="button" aria-pressed=${hidden} ?disabled=${lastVisible}
      aria-label=${hidden ? `Show ${part.name} on the score` : `Hide ${part.name} from the score`}
      title=${lastVisible ? 'One part stays on the score' : hidden ? 'Show on the score' : 'Hide from the score'}
      @click=${() => this.toggleHidden(part.index)}>${eye(hidden)}</button>`;
  }

  /** A part: shown or hidden, its sound, and — beside others — its own level. A lone part's level is the
   *  Synth heading's: one slider for one sound. */
  private partRow(part: MixPart, visibleCount: number) {
    const hidden = this.hiddenParts.includes(part.index);
    const lastVisible = !hidden && visibleCount === 1;
    const entry = this.mix[part.index] ?? {};
    const lone = this.parts.length === 1;
    return html`<div class=${lone ? 'ch lone' : 'ch'} role="group" aria-label=${part.name}>
      ${this.eyeButton(part, hidden, lastVisible)}
      <span class="name inline"><b title=${part.detail}>${part.name}</b>${this.instrument(part, entry)}</span>
      ${lone ? nothing : this.partLevel(part, entry)}
      ${this.note(part)}
    </div>`;
  }
  private partLevel(part: MixPart, entry: PartMixEntry) {
    return this.level(`${part.name} volume`, entry.volume ?? 1, value => this.setMix(part.index, { volume: value }));
  }
  private synthSection(visibleCount: number) {
    const on = this.layers.synth;
    return html`<section aria-label="Synth">
      <div class="head">
        ${this.layerToggle('synth', on, ICON.synth, 'Synth', on ? 'Turn the synth off' : 'Play the synth', () => this.setLayers({ synth: !on }))}
        <span class="grow"></span>
        <button class="plain" type="button" data-settings aria-label="Synth settings" title="Synth settings" aria-expanded=${this.settingsAt !== null}
          @click=${(e: Event) => this.toggleSettings(e.currentTarget as HTMLElement)}>${sliders}</button>
        ${this.parts.length === 1
          ? this.partLevel(this.parts[0]!, this.mix[this.parts[0]!.index] ?? {})
          : this.level('Synth level', this.layers.synthLevel ?? 1, value => this.setLayers({ synthLevel: value }), !this.parts.length)}
      </div>
      ${this.playbackNotes()}
      <div class=${on ? 'rows' : 'rows off'}>${this.parts.map((part) => this.partRow(part, visibleCount))}</div>
    </section>`;
  }
  private clickSection() {
    const on = this.layers.click;
    return html`<section aria-label="Click">
      <div class="head">
        ${this.layerToggle('click', on, ICON.click, 'Click', on ? 'Turn the click off' : 'Play the click', () => this.setLayers({ click: !on }))}
        <span class="grow"></span>
        ${this.level('Click level', this.layers.clickLevel, value => this.setLayers({ clickLevel: value }))}
      </div>
    </section>`;
  }

  render() {
    const visibleCount = this.parts.filter((p) => !this.hiddenParts.includes(p.index)).length;
    return html`
      <div class="scroll">
        <header><b>Mix</b><button class="plain" type="button" aria-label="Close mix" @click=${() => this.emit('close')}>${cross}</button></header>
        ${this.recordingSection()}
        ${this.synthSection(visibleCount)}
        ${this.clickSection()}
        <div class="fill"></div>
      </div>
      <div class="master" role="group" aria-label="Master">
        <div class="ch">
          <span></span>
          <span class="name"><b>Master</b><span class="val">${Math.round(this.master * 100)}</span></span>
          ${this.level('Master volume', this.master, value => this.emit<number>('master-change', value))}
        </div>
      </div>
      ${this.settings()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-studio-mix': MixSheet;
  }
}
