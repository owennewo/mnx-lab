// #/new — make a piece: blank (what it is called, what it is played on, how
// many bars) or from a file someone already has.
//
// The form builds a blank document from ops (src/edit/newDocument.ts), exports
// it as the `.gp` Studio stores, reads the library's tags off the document and
// posts both. The service names the piece; this page then opens it, where the
// Source sheet adds a recording and the player's sync bar lines the two up —
// no note needs writing first, a bar count is enough to sync against.
//
// A piece has strings: Guitar Pro cannot say "no instrument", so the form does
// not offer what the first save would quietly replace.
//
// From a file (roadmap: studio-new-piece-from-file), the importers layer opens
// it, the person settles its title, artist and capo, and the same export and
// POST store it. Only the `.gp` Studio writes is kept, never the file chosen:
// what the converter could not carry is said here, before anything is made.
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LibraryClient } from '../../../src/storage/libraryClient.ts';
import { exportForStorage } from '../../../src/importers/exportFile.ts';
import { derivedLibraryTags } from '../../../src/model/libraryTags.ts';
import { adoptImportedDocument, buildNewDocument, fileCapo, newDocumentProblem, MAX_NEW_BARS, type NewDocumentSpec } from '../../../src/edit/newDocument.ts';
import { LOCAL_FILE_ACCEPT, openLocalFile, type LocalDocumentSource } from '../../../src/importers/localFile.ts';
import { documentArtist, documentTitle, type MnxStructure } from '../../../src/model/mnx.ts';
import { TUNING_PRESET_NAMES, parseKeySignature, parseTimeSignature, parseTuning } from '../../../src/edit/setupGrammar.ts';
import { libraryReturnHref, pieceHref, returnToLibrary } from './StudioApp.ts';
import { pieceFilename } from '../../../src/storage/pieceSaveContext.ts';
import { BUILD } from './build.ts';

const CUSTOM = 'custom';
const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
/** Converter warnings, said once each with a count: a file can drop the same thing a hundred times. */
function groupedNotes(warnings: readonly string[]): { text: string; count: number }[] {
  const counts = new Map<string, number>();
  // "measure 31 track 1 … string 6: let-ring is not represented yet." → what, not where.
  for (const warning of warnings) { const text = warning.replace(/^[^:]*\d[^:]*:\s*/, ''); counts.set(text, (counts.get(text) ?? 0) + 1); }
  return [...counts].map(([text, count]) => ({ text, count }));
}

const keyLabel = (name: string) => {
  const fifths = (parseKeySignature(name) as { fifths: number }).fifths;
  return `${name} major${fifths ? ` · ${Math.abs(fifths)} ${fifths > 0 ? 'sharp' : 'flat'}${Math.abs(fifths) > 1 ? 's' : ''}` : ''}`;
};

@customElement('mnx-studio-new-piece')
export class NewPiecePage extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @state() private form = { title: '', artist: '', tuning: 'standard', custom: '', capo: '0', time: '4/4', key: 'C', bars: '16' };
  @state() private mode: 'blank' | 'file' = 'blank';
  /** The file chosen, opened; its form starts from what the file says. */
  @state() private opened: LocalDocumentSource | null = null;
  @state() private fromFile = { title: '', artist: '', capo: '' };
  @state() private opening = false;
  @state() private busy = false;
  @state() private error = '';

  static styles = css`
    :host { display: block; max-width: 34rem; margin: 0 auto; padding: 64px 24px 48px; }
    h1 { font-size: 1.4rem; font-weight: 600; margin: 0 0 4px; }
    .muted { color: var(--ink-dim); }
    form { display: grid; gap: 14px; margin-top: 20px; }
    label { display: grid; gap: 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-dim); }
    label span.hint { font-weight: 400; letter-spacing: 0; text-transform: none; }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr)); gap: 14px; }
    input, select { font: inherit; font-size: 14px; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--ink); background: transparent; border: 1px solid var(--line); border-radius: 3px; padding: 7px 9px; min-width: 0; }
    select option { color: initial; }
    .actions { display: flex; gap: 10px; align-items: center; margin-top: 6px; }
    button, a.button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 3px; padding: 7px 14px; cursor: pointer; text-decoration: none; }
    button.primary { border-color: var(--accent); color: var(--accent); font-weight: 600; }
    button:disabled { opacity: 0.5; cursor: default; }
    .error { color: #b91c1c; margin: 0; }
    .modes { display: inline-flex; margin-top: 20px; border: 1px solid var(--line); border-radius: 3px; }
    .modes button { border: 0; border-radius: 0; }
    .modes button + button { border-left: 1px solid var(--line); }
    .modes button[aria-pressed=true] { color: var(--accent); font-weight: 600; }
    .file-facts { margin: 0; font-size: 13px; }
    .notes { margin: 0; font-size: 13px; }
    .notes ul { margin: 4px 0 0; padding-left: 18px; }
  `;

  /** The form as a spec, or the sentence that says why it is not one yet. */
  private spec(): NewDocumentSpec | string {
    const f = this.form;
    const tuning = parseTuning(f.tuning === CUSTOM ? f.custom : f.tuning);
    if (!tuning) return 'Say the tuning low string first, like D2 A2 D3 G3 A3 D4 — three to twelve strings.';
    const time = parseTimeSignature(f.time);
    if (!time || time === 'inherit') return 'A time signature looks like 4/4, 6/8 or 12/8.';
    const key = parseKeySignature(f.key);
    if (!key || key === 'inherit') return 'Choose a key.';
    const spec: NewDocumentSpec = { title: f.title, artist: f.artist, tuning, capo: Number(f.capo || 0), time, fifths: key.fifths, bars: Number(f.bars) };
    return newDocumentProblem(spec) ?? spec;
  }

  private async create(event: Event) {
    event.preventDefault();
    const spec = this.spec();
    if (typeof spec === 'string') { this.error = spec; return; }
    await this.store(spec.title, () => buildNewDocument(spec));
  }

  private async createFromFile(event: Event) {
    event.preventDefault();
    const opened = this.opened;
    if (!opened) { this.error = 'Choose a file first.'; return; }
    const f = this.fromFile;
    if (!f.title.trim()) { this.error = 'A piece needs a title.'; return; }
    const was = fileCapo(opened.document);
    // Untouched, the capo stays per part as the file wrote it.
    const capo = was === null || f.capo === String(was) ? undefined : Number(f.capo || 0);
    await this.store(f.title, () => adoptImportedDocument(opened.document, { title: f.title, artist: f.artist, capo }));
  }

  /** Export the document as the `.gp` Studio stores, post it, and open what the service made. */
  private async store(title: string, build: () => MnxStructure) {
    this.busy = true; this.error = '';
    try {
      const document = build();
      const { bytes, options } = await exportForStorage(document);
      const { snapshot } = await this.client.createPiece(
        { filename: pieceFilename(title), bytes, producerVersion: BUILD, producerOptions: options }, derivedLibraryTags(document));
      location.hash = pieceHref(snapshot.piece.id);
    } catch (error) {
      this.error = error instanceof Error && error.message ? error.message : 'The piece could not be made.';
      this.busy = false;
    }
  }

  private async choose(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.opened = null; this.error = '';
    if (!file) return;
    this.opening = true;
    try {
      const opened = await openLocalFile(file);
      const capo = fileCapo(opened.document);
      this.fromFile = { title: documentTitle(opened.document) ?? opened.name, artist: documentArtist(opened.document) ?? '', capo: capo === null ? '' : String(capo) };
      this.opened = opened;
    } catch (error) {
      this.error = error instanceof Error && error.message ? error.message : 'The file could not be opened.';
    } finally {
      this.opening = false;
    }
  }

  private setFromFile(field: keyof NewPiecePage['fromFile']) {
    return (event: Event) => { this.fromFile = { ...this.fromFile, [field]: (event.target as HTMLInputElement).value }; this.error = ''; };
  }

  private set(field: keyof NewPiecePage['form']) {
    return (event: Event) => { this.form = { ...this.form, [field]: (event.target as HTMLInputElement | HTMLSelectElement).value }; this.error = ''; };
  }

  private switchTo(mode: NewPiecePage['mode']) {
    return () => { this.mode = mode; this.error = ''; };
  }

  render() {
    return html`
      <h1>New piece</h1>
      <div class="modes" role="group" aria-label="Start from">
        <button type="button" aria-pressed=${this.mode === 'blank'} @click=${this.switchTo('blank')}>Blank</button>
        <button type="button" aria-pressed=${this.mode === 'file'} @click=${this.switchTo('file')}>From a file</button>
      </div>
      ${this.mode === 'blank' ? this.renderBlank() : this.renderFromFile()}
    `;
  }

  private renderFromFile() {
    const opened = this.opened;
    const f = this.fromFile;
    const facts = opened && (() => {
      const tags = derivedLibraryTags(opened.document);
      const tuning = tags.find(t => t.dimension === 'tuning-name')?.value;
      const bars = opened.document.global.measures.length;
      const parts = opened.document.parts.length;
      return [opened.format, `${parts} part${parts === 1 ? '' : 's'}`, `${bars} bar${bars === 1 ? '' : 's'}`, ...(tuning ? [tuning] : [])].join(' · ');
    })();
    const notes = opened ? groupedNotes(opened.warnings) : [];
    return html`
      <p class="muted">Guitar Pro (GP, GPX, GP3–5), MusicXML or MNX. Studio keeps its own copy of the music, not the file itself.</p>
      <form @submit=${this.createFromFile}>
        <label>File<input type="file" accept=${LOCAL_FILE_ACCEPT} ?disabled=${this.busy} @change=${this.choose} /></label>
        ${this.opening ? html`<p class="muted file-facts">Reading the file…</p>` : nothing}
        ${opened ? html`
          <p class="file-facts">${facts}</p>
          <label>Title<input required maxlength="200" .value=${f.title} @input=${this.setFromFile('title')} /></label>
          <label>Artist<input maxlength="200" .value=${f.artist} @input=${this.setFromFile('artist')} /></label>
          ${fileCapo(opened.document) === null
            ? html`<p class="muted file-facts">No part in this file says what strings it has, so there is no tab or capo to set.</p>`
            : html`<label>Capo <span class="hint">on every fretted part</span><input type="number" min="0" max="24" step="1" inputmode="numeric" .value=${f.capo} @input=${this.setFromFile('capo')} /></label>`}
          ${notes.length ? html`<div class="notes"><span class="muted">Conversion notes:</span>
            <ul>${notes.map(n => html`<li>${n.text}${n.count > 1 ? html` <span class="muted">× ${n.count}</span>` : nothing}</li>`)}</ul></div>` : nothing}
        ` : nothing}
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        <div class="actions">
          <button class="primary" ?disabled=${this.busy || !opened}>${this.busy ? 'Making…' : 'Make the piece'}</button>
          <a class="button" href=${libraryReturnHref()} @click=${returnToLibrary}>Cancel</a>
        </div>
      </form>
    `;
  }

  private renderBlank() {
    const f = this.form;
    return html`
      <p class="muted">A title, an instrument and a number of bars. Add a recording and sync it straight away; the notes can come later.</p>
      <form @submit=${this.create}>
        <label>Title<input required maxlength="200" autofocus .value=${f.title} @input=${this.set('title')} /></label>
        <label>Artist<input maxlength="200" .value=${f.artist} @input=${this.set('artist')} /></label>
        <div class="row">
          <label>Tuning
            <select .value=${f.tuning} @change=${this.set('tuning')}>
              ${TUNING_PRESET_NAMES.map(name => html`<option value=${name} ?selected=${name === f.tuning}>${name}</option>`)}
              <option value=${CUSTOM} ?selected=${f.tuning === CUSTOM}>another tuning…</option>
            </select>
          </label>
          <label>Capo<input type="number" min="0" max="24" step="1" inputmode="numeric" .value=${f.capo} @input=${this.set('capo')} /></label>
        </div>
        ${f.tuning === CUSTOM
          ? html`<label>Strings <span class="hint">low string first</span><input placeholder="D2 A2 D3 G3 A3 D4" .value=${f.custom} @input=${this.set('custom')} /></label>`
          : nothing}
        <div class="row">
          <label>Time<input placeholder="4/4" .value=${f.time} @input=${this.set('time')} /></label>
          <label>Key
            <select .value=${f.key} @change=${this.set('key')}>${KEYS.map(name => html`<option value=${name} ?selected=${name === f.key}>${keyLabel(name)}</option>`)}</select>
          </label>
          <label>Bars<input type="number" min="1" max=${MAX_NEW_BARS} step="1" inputmode="numeric" .value=${f.bars} @input=${this.set('bars')} /></label>
        </div>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        <div class="actions">
          <button class="primary" ?disabled=${this.busy}>${this.busy ? 'Making…' : 'Make the piece'}</button>
          <a class="button" href=${libraryReturnHref()} @click=${returnToLibrary}>Cancel</a>
        </div>
      </form>
    `;
  }
}
