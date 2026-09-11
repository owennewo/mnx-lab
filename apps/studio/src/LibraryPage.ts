// #/ — the library as a page: the same tag-filtered browse the workbench's
// Load dialog does, over the same typed client and the same read routes.
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  LibraryClient,
  LibraryRequestError,
  type LibraryPiece,
  type LibraryTag,
} from '../../../src/storage/libraryClient.ts';
import { pieceHref } from './StudioApp.ts';

const MAX_TAGS = 12;

@customElement('mnx-studio-library')
export class LibraryPage extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @state() private pieces: LibraryPiece[] = [];
  @state() private tags: string[] = [];
  @state() private suggestions: LibraryTag[] = [];
  @state() private query = '';
  @state() private next: string | null = null;
  @state() private busy = false;
  @state() private error = '';
  private generation = 0;

  static styles = css`
    :host {
      display: block;
      max-width: 52rem;
      margin: 0 auto;
      padding: 64px 24px 48px;
    }
    h1 {
      font-size: 1.4rem;
      font-weight: 600;
      margin: 0 0 16px;
    }
    form {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    input {
      flex: 1;
      min-width: 0;
      font: inherit;
      color: inherit;
      background: transparent;
      border: 1px solid var(--line);
      border-radius: 3px;
      padding: 6px 9px;
    }
    button {
      font: inherit;
      color: inherit;
      background: transparent;
      border: 1px solid var(--line);
      border-radius: 3px;
      padding: 6px 10px;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0 0 16px;
      min-height: 1em;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      border-top: 1px solid var(--line);
    }
    li a {
      display: block;
      padding: 12px 4px;
      border-bottom: 1px solid var(--line);
      color: inherit;
      text-decoration: none;
    }
    li a:hover {
      color: var(--accent);
    }
    small {
      display: block;
      color: var(--ink-dim);
    }
    .error {
      color: #b91c1c;
    }
    p {
      color: var(--ink-dim);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.search();
  }

  private async search(more = false) {
    const generation = ++this.generation;
    this.busy = true;
    this.error = '';
    try {
      const result = await this.client.pieces(this.tags, more ? (this.next ?? '') : '');
      if (generation !== this.generation) return;
      this.pieces = more ? [...this.pieces, ...result.pieces] : result.pieces;
      this.next = result.next;
    } catch (error) {
      if (generation !== this.generation) return;
      this.error = error instanceof Error ? error.message : 'The library is unavailable.';
      if (error instanceof LibraryRequestError && error.status === 403) location.hash = '#/not-permitted';
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private async suggest(event: Event) {
    this.query = (event.target as HTMLInputElement).value;
    const query = this.query;
    try {
      const result = await this.client.tags(query);
      if (query === this.query) this.suggestions = result.tags;
    } catch {
      /* completion is a convenience; the filter still submits */
    }
  }

  private addTag(event: Event) {
    event.preventDefault();
    const tag = this.query.trim();
    if (!tag.includes(':') || this.tags.includes(tag) || this.tags.length >= MAX_TAGS) return;
    this.tags = [...this.tags, tag];
    this.query = '';
    void this.search();
  }

  private removeTag(tag: string) {
    this.tags = this.tags.filter(t => t !== tag);
    void this.search();
  }

  render() {
    return html`
      <h1>Library</h1>
      <form @submit=${this.addTag}>
        <input
          aria-label="Filter by dimension:value"
          placeholder="Filter by dimension:value"
          list="tags"
          maxlength="512"
          .value=${this.query}
          @input=${this.suggest}
        />
        <datalist id="tags">
          ${this.suggestions.map(t => html`<option value=${`${t.dimension}:${t.value}`}></option>`)}
        </datalist>
        <button ?disabled=${this.busy}>Add filter</button>
      </form>
      <div class="chips">
        ${this.tags.map(tag => html`<button @click=${() => this.removeTag(tag)} aria-label=${`Remove filter ${tag}`}>${tag} ×</button>`)}
      </div>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      ${this.busy ? html`<p role="status">Loading…</p>` : nothing}
      <ul>
        ${this.pieces.map(
          p => html`<li>
            <a href=${pieceHref(p.id)}>${p.title ?? p.id}${p.artist ? html`<small>${p.artist}</small>` : nothing}</a>
          </li>`
        )}
      </ul>
      ${!this.busy && !this.error && !this.pieces.length
        ? html`<p>${this.tags.length ? 'No matching pieces.' : 'Your library is empty.'}</p>`
        : nothing}
      ${this.next ? html`<button ?disabled=${this.busy} @click=${() => this.search(true)}>More</button>` : nothing}
    `;
  }
}
