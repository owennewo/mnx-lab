// #/new — make a piece: what it is called, what it is played on, how many bars.
//
// The form builds a blank document from ops (src/edit/newDocument.ts), exports
// it as the `.gp` Studio stores, reads the library's tags off the document and
// posts both. The service names the piece; this page then opens it, where the
// Source sheet adds a recording and the player's sync bar lines the two up —
// no note needs writing first, a bar count is enough to sync against.
//
// A piece has strings: Guitar Pro cannot say "no instrument", so the form does
// not offer what the first save would quietly replace.
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { version } from '../../../package.json';
import { LibraryClient } from '../../../src/storage/libraryClient.ts';
import { exportForStorage } from '../../../src/importers/exportFile.ts';
import { derivedLibraryTags } from '../../../src/model/libraryTags.ts';
import { buildNewDocument, newDocumentProblem, MAX_NEW_BARS, type NewDocumentSpec } from '../../../src/edit/newDocument.ts';
import { TUNING_PRESET_NAMES, parseKeySignature, parseTimeSignature, parseTuning } from '../../../src/edit/setupGrammar.ts';
import { libraryReturnHref, pieceHref, returnToLibrary } from './StudioApp.ts';

const CUSTOM = 'custom';
const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
const keyLabel = (name: string) => {
  const fifths = (parseKeySignature(name) as { fifths: number }).fifths;
  return `${name} major${fifths ? ` · ${Math.abs(fifths)} ${fifths > 0 ? 'sharp' : 'flat'}${Math.abs(fifths) > 1 ? 's' : ''}` : ''}`;
};
/** A filename the service will accept: the title, without what a path or a header could misread. */
export const pieceFilename = (title: string) => `${title.trim().replace(/[\\/\x00-\x1f"<>|:*?]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Untitled'}.gp`;

@customElement('mnx-studio-new-piece')
export class NewPiecePage extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @state() private form = { title: '', artist: '', tuning: 'standard', custom: '', capo: '0', time: '4/4', key: 'C', bars: '16' };
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
    this.busy = true; this.error = '';
    try {
      const document = buildNewDocument(spec);
      const { bytes, options } = await exportForStorage(document);
      const { snapshot } = await this.client.createPiece(
        { filename: pieceFilename(spec.title), bytes, producerVersion: version, producerOptions: options }, derivedLibraryTags(document));
      location.hash = pieceHref(snapshot.piece.id);
    } catch (error) {
      this.error = error instanceof Error && error.message ? error.message : 'The piece could not be made.';
      this.busy = false;
    }
  }

  private set(field: keyof NewPiecePage['form']) {
    return (event: Event) => { this.form = { ...this.form, [field]: (event.target as HTMLInputElement | HTMLSelectElement).value }; this.error = ''; };
  }

  render() {
    const f = this.form;
    return html`
      <h1>New piece</h1>
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
