import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LibraryClient, LibraryRequestError, type LibraryPiece, type LibraryTag } from '../storage/libraryClient.ts';

@customElement('mnx-library-dialog')
export class LibraryDialog extends LitElement {
  private client = new LibraryClient();
  @state() private email = '';
  @state() private error = '';
  @state() private signIn = false;
  @state() private busy = false;
  @state() private pieces: LibraryPiece[] = [];
  @state() private tags: string[] = [];
  @state() private suggestions: LibraryTag[] = [];
  @state() private query = '';
  @state() private next: string | null = null;
  private generation = 0;
  private active = false;
  static styles = css`
    dialog { background:var(--surface,white); color:var(--ink,#222); border:1px solid var(--line,#aaa); width:min(580px,85vw); max-height:80vh; padding:24px; }
    dialog::backdrop { background:#0006; } header,footer,form { display:flex; gap:12px; align-items:center; } h2 { flex:1; margin:0; }
    input { flex:1; min-width:0; } button,input { font:inherit; padding:6px 10px; } ul { list-style:none; padding:0; } li { margin:8px 0; } li button { width:100%; text-align:left; } small { display:block; } .error { color:var(--danger,#b22); } footer { margin-top:20px; flex-wrap:wrap; }
  `;
  async open() {
    await this.updateComplete;
    this.renderRoot.querySelector('dialog')!.showModal();
    this.active = true;
    const generation = ++this.generation;
    this.busy = true;
    try { const { user } = await this.client.me(); if (generation !== this.generation) return; this.email = user.email; await this.search(); }
    catch (error) { this.fail(error); }
    finally { this.busy = false; }
  }
  private fail(error: unknown) {
    if (!this.active) return;
    this.error = error instanceof Error ? error.message : 'Library unavailable';
    this.signIn = error instanceof LibraryRequestError && error.status === 401;
    this.pieces = []; this.suggestions = []; this.next = null;
    if (error instanceof LibraryRequestError && [401,403].includes(error.status)) this.email = '';
  }
  private close() { this.active = false; this.busy = false; this.generation++; this.renderRoot.querySelector('dialog')!.close(); this.pieces = []; this.suggestions = []; this.email = ''; this.error = ''; this.tags = []; this.query = ''; this.signIn = false; }
  private async search(more = false) {
    this.busy = true; this.error = ''; this.signIn = false;
    const generation = ++this.generation;
    try { const result = await this.client.pieces(this.tags, more ? this.next ?? '' : ''); if (generation !== this.generation) return; this.pieces = more ? [...this.pieces, ...result.pieces] : result.pieces; this.next = result.next; }
    catch (error) { if (generation === this.generation) this.fail(error); }
    finally { if (generation === this.generation) this.busy = false; }
  }
  private async suggest(event: Event) {
    this.query = (event.target as HTMLInputElement).value;
    const query = this.query; const generation = this.generation;
    try { const result = await this.client.tags(query); if (this.active && generation === this.generation && query === this.query) this.suggestions = result.tags; }
    catch (error) { this.fail(error); }
  }
  private addTag(event: Event) {
    event.preventDefault();
    const tag = this.query.trim();
    if (!tag.includes(':') || this.tags.includes(tag) || this.tags.length >= 12) return;
    this.tags = [...this.tags, tag]; this.query = ''; void this.search();
  }
  private async load(piece: LibraryPiece) {
    const generation = ++this.generation;
    this.busy = true;
    try {
      const { document } = await this.client.mnx(piece.id);
      if (!this.active || generation !== this.generation) return;
      this.dispatchEvent(new CustomEvent('library-load', { detail: { document, name: piece.title ?? 'Library piece' }, bubbles: true, composed: true }));
      this.close();
    } catch (error) { this.fail(error); }
    finally { this.busy = false; }
  }
  render() {
    return html`<dialog aria-labelledby="library-title" @cancel=${(e: Event) => { e.preventDefault(); this.close(); }}>
      <header><h2 id="library-title">Load from library</h2><button @click=${this.close} aria-label="Close library">×</button></header>
      <p>Choose a piece to open for testing.</p>
      ${this.email ? html`<form @submit=${this.addTag}><input aria-label="Filter by dimension:value" placeholder="Filter by dimension:value" list="library-tags" .value=${this.query} @input=${this.suggest} maxlength="512"><datalist id="library-tags">${this.suggestions.map(t => html`<option value=${`${t.dimension}:${t.value}`}></option>`)}</datalist><button ?disabled=${this.busy}>Add filter</button></form>
      <p>${this.tags.map(tag => html`<button @click=${() => { this.tags = this.tags.filter(t => t !== tag); void this.search(); }}>${tag} ×</button>`)}</p>` : nothing}
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      ${this.signIn ? html`<button @click=${() => this.client.signIn()}>Sign in with email</button>` : nothing}
      ${this.busy ? html`<p role="status">Loading…</p>` : nothing}
      <ul>${this.pieces.map(p => html`<li><button ?disabled=${this.busy} @click=${() => this.load(p)}>${p.title ?? p.id}${p.artist ? html`<small>${p.artist}</small>` : nothing}</button></li>`)}</ul>
      ${!this.busy && this.email && !this.error && !this.pieces.length ? html`<p>No matching pieces.</p>` : nothing}
      ${this.next ? html`<button ?disabled=${this.busy} @click=${() => this.search(true)}>More</button>` : nothing}
      <footer>${this.email ? html`<span>${this.email}</span><button @click=${() => { this.close(); this.client.signOut(); }}>Sign out</button>` : nothing}<a href="/" @click=${(e: Event) => { e.preventDefault(); this.close(); }}>Back to workbench</a></footer>
    </dialog>`;
  }
}
