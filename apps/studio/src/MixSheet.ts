// The Mix panel on a piece: what plays, and how it sounds. It opens from the tray's
// "Mix · <what plays>" field and stands in the frame's side slot like the other sheets,
// tall and narrow. From the Studio tray & header canvas, round 4 (2026-10-16), which
// merged the Source and Instruments sheets: the choice of what plays leads, at the top,
// and the faders sit at the bottom, by the tray, with the Master — the tray's volume —
// last, under the parts it governs.
//
// With the synth playing, each part is a channel: the eye (take it off the score; it keeps
// playing), its instrument, its level, mute and solo. A recording plays as one sound, so
// its parts only show or hide, and their mix waits for the synth. The synth's settings
// for this device (Full or Light, sounding notes as you select them) are buried behind a
// button on the Synth row.
//
// It owns nothing: every change leaves as an event for the page to store and hand to the
// viewer and the player. Instruments play on the synth (core-campaign-synth.md Phase 6):
// a factory design, or a part rig imported from the synth's app.
import { LitElement, css, html, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { LibraryRecording } from '../../../src/storage/libraryClient.ts';
import type { MnxDocument } from '../../../src/model/mnx.ts';
import type { PartMix, PartMixEntry } from '../../../src/audio/partMix.ts';
import { BASIC_KEYS, BASIC_KIT, parsePartRig, type FactoryDesign } from '../../../src/audio/hostInstruments.ts';
import type { RoutedPart } from '../../../src/audio/hostSetup.ts';
import { linearizePasses } from '../../../src/model/passes.ts';
import { compilePerformance } from '../../../src/audio/performance.ts';
import { syncSummary, type SyncSummary } from './syncSummary.ts';
import { playbackNotes } from './playbackNotes.ts';
import { isImportedSync, storedScoreShape } from '../../../src/model/recordingAttachment.ts';

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
const sliders = svg`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"></path><circle cx="16" cy="7" r="2"></circle><circle cx="10" cy="17" r="2"></circle></svg>`;
const eye = (off: boolean) => svg`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>${off ? svg`<path d="M4 4l16 16"></path>` : nothing}</svg>`;

@customElement('mnx-studio-mix')
export class MixSheet extends LitElement {
  // ── what plays ──
  /** The piece's playable recordings, as the library stores them. */
  @property({ attribute: false }) recordings: readonly LibraryRecording[] = [];
  @property({ attribute: false }) document: MnxDocument | null = null;
  /** `synth` or the id of the recording playing (or asked for). */
  @property() activeId = 'synth';
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
  /** False while a recording plays: it has no parts to mix. */
  @property({ type: Boolean }) mixAvailable = true;
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
    .label { display: flex; align-items: baseline; gap: 8px; padding: 2px 16px 6px; font: 600 10px/1 var(--sans, inherit); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3); }
    .label small { font-size: 12px; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--ink-faint, var(--ink-3)); }

    /* ── play from ── */
    .sources { display: flex; flex-direction: column; gap: 2px; padding: 0 12px; }
    .source { display: flex; align-items: stretch; min-height: 36px; box-sizing: border-box; border: 1px solid transparent; }
    .source.on { border-color: var(--ink); background: var(--paper, light-dark(#fff, oklch(0.25 0.006 70))); }
    .pick { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 6px 10px; border: 0; text-align: left; }
    .dot { width: 12px; height: 12px; flex: none; box-sizing: border-box; border-radius: 50%; border: 1.5px solid var(--ink-3); }
    [aria-checked='true'] .dot { border: 3.5px solid var(--accent); }
    .text { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .first { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
    .first b { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .on .first b { font-weight: 600; }
    .sub { font-size: 12px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sub.warn, .stats.warn { color: light-dark(#a12121, #ffb4ab); }
    .stats { font-size: 12px; line-height: 1.3; color: var(--ink-2); }
    .side { width: 34px; flex: none; padding: 0; border: 0; display: grid; place-items: center; color: var(--ink-3); }
    .side:hover, .side[aria-expanded='true'] { color: var(--ink); background: var(--frame-press, var(--hover)); }
    .on .side { border-left: 1px solid var(--frame-line, var(--line)); }
    .diagnostic ul { margin: 4px 0 0; padding-left: 18px; }
    .diagnostic { margin: 2px 0 4px; font-size: 13px; padding: 10px; background: light-dark(#efeeeb, #343330); line-height: 1.5; }
    .add { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 10px; border: 0; font-size: 13px; color: var(--ink-2); text-align: left; }
    .add:hover { color: var(--ink); }

    /* ── the synth's settings, behind the Synth row ── */
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

    /* ── the mix: parts, then the master, by the tray ── */
    .grow { flex: 1; min-height: 16px; }
    .parts { display: flex; flex-direction: column; padding: 0 12px; }
    .part, .master { display: grid; grid-template-columns: 28px minmax(0, 1fr) 92px 26px 26px 26px; align-items: center; gap: 6px; min-height: 46px; }
    .part { border-top: 1px solid light-dark(oklch(0.92 0.008 70), oklch(0.28 0.006 70)); }
    .part.compact { grid-template-columns: 28px minmax(0, 1fr) auto; min-height: 36px; }
    .eye { width: 28px; height: 28px; padding: 0; border: 0; display: grid; place-items: center; color: var(--ink-2); }
    .eye[aria-pressed='true'] { color: var(--ink-faint, var(--ink-3)); }
    .name { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .name b { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .off .name b, .off > b { color: var(--ink-3); }
    .compact > b { font-size: 13px; font-weight: 600; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .compact > span { font-size: 12px; color: var(--ink-3); }
    /* The instrument as a quiet line under the name: a select without its box. */
    .sound { max-width: 100%; margin-left: -3px; padding: 0; border: 0; background: transparent; font: 12px/1.2 var(--sans, inherit); color: var(--ink-3); cursor: pointer; text-overflow: ellipsis; }
    .sound:hover { color: var(--ink); }
    .sound option, .sound optgroup { color: var(--ink); background-color: var(--surface, #fff); }
    input[type='range'] { width: 92px; margin: 0; accent-color: var(--accent); }
    .muted input[type='range'], .master input[type='range'] { accent-color: var(--ink-3); }
    .master input[type='range'] { accent-color: var(--ink); }
    .val { font: 500 12px/1 var(--mono, ui-monospace, monospace); font-variant-numeric: tabular-nums; color: var(--ink-2); text-align: right; }
    .ms { width: 26px; height: 26px; padding: 0; font: 700 11px/1 var(--sans, inherit); color: var(--ink-2); }
    .ms[aria-pressed='true'] { background: var(--ink); border-color: var(--ink); color: var(--paper, #fff); }
    .ms.solo[aria-pressed='true'] { background: var(--accent); border-color: var(--accent); color: #fff; }
    .note { grid-column: 2 / -1; padding-bottom: 8px; font-size: 12px; line-height: 1.4; color: var(--ink-3); }
    .note.problem { color: light-dark(#a3341f, #f0907c); }
    .master {
      flex: none; margin-top: 2px; padding: 0 12px;
      background: var(--frame-bar, light-dark(oklch(0.948 0.012 75), oklch(0.245 0.008 70)));
      border-top: 1px solid var(--frame-line, var(--line));
    }
    .master b { font: 600 11px/1 var(--sans, inherit); letter-spacing: 0.1em; text-transform: uppercase; }
    .master .val { color: var(--ink); font-weight: 600; }
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
  /** How a recording follows this score. */
  private follows(summary: SyncSummary, active: boolean, outOfDate = false) {
    if (summary.warning || (active && this.syncWarning)) return 'sync warning';
    if (outOfDate) return 'may be out of date';
    if (!summary.points.length) return 'no sync points';
    return summary.coverage === 'full' ? 'follows the whole score' : 'follows part of the score';
  }
  private toggleSettings(button: HTMLElement) {
    if (this.settingsAt !== null) { this.settingsAt = null; return; }
    const row = button.closest('.source') as HTMLElement;
    this.settingsAt = row.getBoundingClientRect().bottom - this.getBoundingClientRect().top + 4;
  }

  private synthRow() {
    const on = this.activeId === 'synth';
    return html`<div class=${on ? 'source on' : 'source'}>
      <button class="pick" type="button" role="radio" aria-checked=${on} data-source="synth" @click=${() => this.emit('source-choose', { id: 'synth' })}>
        <span class="dot"></span>
        <span class="first"><b>Synth</b><span class="sub">${this.recordings.length || !this.canAdd ? 'each part an instrument' : 'add a recording below'}</span></span>
      </button>
      <button class="side" type="button" data-settings aria-label="Synth settings" title="Synth settings" aria-expanded=${this.settingsAt !== null}
        @click=${(e: Event) => this.toggleSettings(e.currentTarget as HTMLElement)}>${sliders}</button>
    </div>`;
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

  private recordingRow(row: LibraryRecording) {
    const active = row.id === this.activeId;
    const summary = syncSummary(row, this.compiled, this.passes);
    const name = row.name ?? 'Unnamed recording';
    const outOfDate = this.outOfDate(row);
    const follows = this.follows(summary, active, outOfDate);
    const alarm = follows === 'sync warning' || follows === 'may be out of date';
    const warning = active && (this.syncWarning || summary.warning || summary.dropped);
    const points = summary.points.length;
    return html`<div class=${active ? 'source on' : 'source'}>
        <button class="pick" type="button" role="radio" aria-checked=${active} data-source=${row.id}
          @click=${() => this.emit('source-choose', { id: row.id, warning: !!(summary.warning || summary.dropped) })}>
          <span class="dot"></span>
          <span class="text">
            <span class="first"><b>${name}</b><span class=${!active && alarm ? 'sub warn' : 'sub'}>${row.kind === 'youtube' ? 'Video' : 'Audio'}${active ? '' : ` · ${follows}`}</span></span>
            ${active ? html`<span class=${alarm ? 'stats warn' : 'stats'}>${follows}${points ? ` · ${points} sync ${points === 1 ? 'point' : 'points'}` : ''}</span>` : nothing}
          </span>
        </button>
        <button class="side" type="button" data-edit=${row.id} aria-label=${`Edit ${name}`} title="Edit details" @click=${() => this.emit('recording-edit', { id: row.id })}>${pencil}</button>
      </div>
      ${outOfDate && active
        ? html`<div class="diagnostic" role="status" data-out-of-date><strong>May be out of date:</strong> the score's bars have changed since this sync was made. It counts bars by number, so everything after the change may now be early or late. Make a new sync in the sync bar to replace it.</div>`
        : nothing}
      ${warning
        ? html`<div class="diagnostic" role="status"><strong>Sync warning:</strong> ${this.syncWarning || (summary.warning ? summary.message : `${summary.dropped} out-of-range sync ${summary.dropped === 1 ? 'point' : 'points'} dropped.`)} Score following and seeking may be unavailable.</div>`
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
    const next: PartMix = { ...this.mix, [index]: { ...this.mix[index], ...change } };
    this.emit<PartMix>('mix-change', next);
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

  private partRow(part: MixPart, visibleCount: number) {
    const hidden = this.hiddenParts.includes(part.index);
    const lastVisible = !hidden && visibleCount === 1;
    if (!this.mixAvailable) {
      return html`<div class=${hidden ? 'part compact off' : 'part compact'} role="group" aria-label=${part.name}>
        ${this.eyeButton(part, hidden, lastVisible)}<b>${part.name}</b><span>${hidden ? 'hidden' : 'on the score'}</span>
      </div>`;
    }
    const entry = this.mix[part.index] ?? {};
    const muted = entry.muted ?? false, solo = entry.solo ?? false;
    const level = Math.round((entry.volume ?? 1) * 100);
    return html`<div class=${[ 'part', hidden ? 'off' : '', muted ? 'muted' : ''].join(' ')} role="group" aria-label=${part.name}>
      ${this.eyeButton(part, hidden, lastVisible)}
      <span class="name"><b title=${part.detail}>${part.name}</b>${this.instrument(part, entry)}</span>
      <input type="range" min="0" max="1" step="0.05" aria-label=${`${part.name} volume`} ?disabled=${muted}
        .value=${String(entry.volume ?? 1)}
        @input=${(e: Event) => this.setMix(part.index, { volume: Number((e.target as HTMLInputElement).value) })} />
      <span class="val">${muted ? '—' : level}</span>
      <button class="ms" type="button" aria-pressed=${muted} aria-label=${muted ? `Unmute ${part.name}` : `Mute ${part.name}`} title=${muted ? 'Unmute' : 'Mute'}
        @click=${() => this.setMix(part.index, { muted: !muted })}>M</button>
      <button class="ms solo" type="button" aria-pressed=${solo} aria-label=${solo ? `Unsolo ${part.name}` : `Solo ${part.name}`} title=${solo ? 'Unsolo' : 'Solo: hear only the soloed parts'}
        @click=${() => this.setMix(part.index, { solo: !solo })}>S</button>
      ${this.note(part)}
    </div>`;
  }

  render() {
    const visibleCount = this.parts.filter((p) => !this.hiddenParts.includes(p.index)).length;
    const level = Math.round(this.master * 100), silent = this.master === 0;
    return html`
      <div class="scroll">
        <header><b>Mix</b><button class="plain" type="button" aria-label="Close mix" @click=${() => this.emit('close')}>${cross}</button></header>
        <div class="label">Play from</div>
        <div class="sources" role="radiogroup" aria-label="Play from">
          ${this.synthRow()}
          ${this.playbackNotes()}
          ${this.recordings.map((row) => this.recordingRow(row))}
          ${this.canAdd ? html`<button class="add" type="button" aria-label="Add recording" @click=${() => this.emit('recording-add')}>${plus}<span>Add recording</span></button>` : nothing}
        </div>
        <div class="grow"></div>
        <div class="label">Mix${this.mixAvailable ? nothing : html`<small>one sound · parts only show or hide</small>`}</div>
        <div class="parts">${this.parts.map((part) => this.partRow(part, visibleCount))}</div>
      </div>
      <div class="master" role="group" aria-label="Master">
        <span></span><b>Master</b>
        <input type="range" min="0" max="1" step="0.05" aria-label="Master volume" .value=${String(this.master)}
          @input=${(e: Event) => this.emit<number>('master-change', Number((e.target as HTMLInputElement).value))} />
        <span class="val">${level}</span>
        <button class="ms" type="button" aria-pressed=${silent} aria-label=${silent ? 'Unmute everything' : 'Mute everything'} title=${silent ? 'Unmute' : 'Mute everything'}
          @click=${() => this.emit('master-mute')}>M</button>
        <span></span>
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
