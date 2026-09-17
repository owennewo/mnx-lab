// #/deleted — what the owner deleted, newest first, each one restorable. Deleting
// in Studio removes nothing (docs/studio-storage.md): the piece leaves every
// list and read until it is restored here, with its versions, recordings and
// tags as they were.
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LibraryClient, type DeletedPiece } from '../../../src/storage/libraryClient.ts';
import { pieceHref } from './StudioApp.ts';

@customElement('mnx-studio-deleted')
export class DeletedPage extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @state() private pieces: DeletedPiece[] = [];
  @state() private busy = true;
  @state() private error = '';

  static styles = css`
    :host { display: block; max-width: 48rem; margin: 0 auto; padding: 64px 24px 48px; }
    h1 { font-size: 1.4rem; font-weight: 600; margin: 0; }
    .head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
    .muted { color: var(--ink-dim); }
    .row { display: flex; align-items: center; gap: 16px; padding: 10px 4px; border-bottom: 1px solid var(--line); }
    .row:first-of-type { border-top: 1px solid var(--line); }
    .what { flex: 1; min-width: 0; display: grid; }
    .what b { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 3px; padding: 5px 11px; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: default; }
    .error { color: #b91c1c; }
  `;

  connectedCallback() { super.connectedCallback(); void this.load(); }

  private async load() {
    this.busy = true; this.error = '';
    try { this.pieces = (await this.client.deleted()).pieces; }
    catch (error) { this.error = error instanceof Error && error.message ? error.message : 'The library is unavailable.'; }
    finally { this.busy = false; }
  }
  private async restore(piece: DeletedPiece) {
    this.busy = true; this.error = '';
    try { await this.client.restorePiece(piece.id); location.hash = pieceHref(piece.id); }
    catch (error) { this.error = error instanceof Error && error.message ? error.message : 'The piece could not be restored.'; this.busy = false; }
  }

  render() {
    return html`
      <div class="head"><h1>Deleted pieces</h1><span class="muted">out of your library, not destroyed — restore one and it is back as it was</span></div>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      ${this.pieces.map(piece => html`<div class="row" data-piece=${piece.id}>
        <span class="what"><b>${piece.title ?? 'Untitled'}</b><span class="muted">${piece.artist ? `${piece.artist} · ` : ''}deleted ${new Date(piece.deleted_at).toLocaleString()}</span></span>
        <button type="button" ?disabled=${this.busy} @click=${() => this.restore(piece)}>Restore</button>
      </div>`)}
      ${!this.busy && !this.pieces.length && !this.error ? html`<p class="muted">Nothing has been deleted.</p>` : nothing}
    `;
  }
}
