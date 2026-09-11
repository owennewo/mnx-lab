// #/piece/<id> — one piece, fullscreen. Fetches the canonical FILE through the
// library's read route (a .gp for a Soundslice piece), converts it in the
// importers' clean-room worker — the service stores the source, the reader
// converts — mounts <mnx-document-viewer> filling the viewport and wires it to
// the shell's <mnx-player> with the plain-DOM host binding the embed face
// exports. Nothing here edits or persists anything.
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { LibraryClient, LibraryRequestError } from '../../../src/storage/libraryClient.ts';
import { documentTitle, documentArtist, type MnxDocument } from '../../../src/model/mnx.ts';
import { openLocalFile } from '../../../src/importers/localFile.ts';
import { bindPlayback } from '../../../src/elements/playbackHost.ts';
import type { DocumentViewer, ViewSetting } from '../../../src/elements/DocumentViewer.ts';
import type { Player } from '../../../src/elements/Player.ts';
import { LibraryClient as Client } from '../../../src/storage/libraryClient.ts';
import './TagsSheet.ts';
import type { TagsSnapshot } from './TagsSheet.ts';

@customElement('mnx-studio-piece')
export class PiecePage extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @property({ type: String }) pieceId = '';
  @property({ attribute: false }) player: Player | undefined;
  @property({ type: String }) view: ViewSetting = 'auto';
  @property({ type: Boolean }) tagsOpen = false;
  @state() private snapshot: TagsSnapshot | null = null;
  @state() private doc: MnxDocument | null = null;
  @state() private error = '';
  @state() private loading = true;
  @query('mnx-document-viewer') private viewer!: DocumentViewer;
  private binding: ReturnType<typeof bindPlayback> | null = null;
  private generation = 0;

  static styles = css`
    :host {
      display: block;
      min-height: 100%;
      /* Room under the top bar and above the transport dock. */
      padding: 48px 0 160px;
    }
    mnx-studio-tags {
      position: fixed;
      top: 40px;
      right: 0;
      bottom: 0;
      z-index: 1;
    }
    mnx-document-viewer {
      display: block;
      min-height: calc(100vh - 208px);
    }
    mnx-document-viewer[hidden] {
      display: none;
    }
    .notice {
      max-width: 36rem;
      margin: 20vh auto 0;
      padding: 0 24px;
      color: var(--ink-dim);
    }
    .notice h1 {
      font-size: 1.4rem;
      color: var(--ink);
      margin: 0 0 12px;
    }
    a {
      color: inherit;
    }
  `;

  disconnectedCallback() {
    this.binding?.dispose();
    this.binding = null;
    super.disconnectedCallback();
  }

  // The viewer element is always in the DOM (hidden until a document arrives)
  // so the binding is made once and survives piece-to-piece navigation.
  protected updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('pieceId')) void this.load();
    let fresh = false;
    if (!this.binding && this.player && this.viewer) {
      this.binding = bindPlayback(this, this.viewer, this.player);
      fresh = true;
    }
    if (this.binding && this.doc && (fresh || changed.has('doc'))) this.present(this.doc);
  }

  private async load() {
    const generation = ++this.generation;
    this.doc = null;
    this.error = '';
    this.loading = true;
    this.announce('');
    try {
      const [{ bytes, filename }, snapshot] = await Promise.all([
        this.client.canonical(this.pieceId),
        // The library's own name for the piece (its title/artist tags, as shown) outranks the file's header.
        this.client.piece(this.pieceId).then(r => r.snapshot as TagsSnapshot, () => null),
      ]);
      if (generation !== this.generation) return;
      this.snapshot = snapshot;
      this.announceTags();
      // The library remembers what was opened; the recent sort reads it. Never blocking.
      void this.client.opened(this.pieceId).catch(() => {});
      const tag = (dimension: string) => snapshot?.tags.find(t => t.dimension === dimension)?.shown ?? null;
      const opened = await openLocalFile(new File([bytes], filename));
      if (generation !== this.generation) return;
      const mnxJson = opened.document;
      const doc: MnxDocument = {
        id: `library:${this.pieceId}`,
        name: tag('title') ?? documentTitle(mnxJson) ?? opened.name,
        lastUpdated: Date.now(),
        mnxJson,
      };
      this.doc = doc;
      const artist = tag('artist') ?? documentArtist(mnxJson);
      this.announce(artist ? `${doc.name} — ${artist}` : doc.name);
    } catch (error) {
      if (generation !== this.generation) return;
      this.error = error instanceof Error ? error.message : 'The library is unavailable.';
      if (error instanceof LibraryRequestError && error.status === 403) location.hash = '#/not-permitted';
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  /** Hand the document to the viewer and the player through one binding. */
  private present(doc: MnxDocument) {
    const result = this.binding!.setDocument(doc);
    if (!result.ok) this.error = 'This piece has no playable performance; the score still shows.';
  }

  private announce(title: string) {
    this.dispatchEvent(new CustomEvent('piece-title', { detail: title, bubbles: true, composed: true }));
  }
  private announceTags() {
    this.dispatchEvent(new CustomEvent('piece-tags', { detail: this.snapshot?.tags.length ?? 0, bubbles: true, composed: true }));
  }
  private async refreshSnapshot() {
    try { this.snapshot = (await this.client.piece(this.pieceId)).snapshot as TagsSnapshot; } catch { /* keep what we have */ }
    this.announceTags();
    const tag = (dimension: string) => this.snapshot?.tags.find(t => t.dimension === dimension)?.shown ?? null;
    if (this.doc) { const title = tag('title') ?? this.doc.name; const artist = tag('artist'); this.announce(artist ? `${title} — ${artist}` : title); }
  }

  render() {
    return html`
      ${this.loading ? html`<p class="notice" role="status">Loading…</p>` : nothing}
      ${!this.loading && !this.doc
        ? html`<div class="notice">
            <h1>Could not open this piece</h1>
            <p role="alert">${this.error}</p>
            <p><a href="#/">Back to the library</a></p>
          </div>`
        : nothing}
      ${this.doc && this.error ? html`<p class="notice" role="alert">${this.error}</p>` : nothing}
      <mnx-document-viewer ?hidden=${!this.doc} .view=${this.view}></mnx-document-viewer>
      ${this.tagsOpen ? html`<mnx-studio-tags .client=${this.client as Client} .snapshot=${this.snapshot}
        @tags-changed=${(e: CustomEvent<TagsSnapshot>) => { this.snapshot = e.detail; void this.refreshSnapshot(); }}
        @aliases-changed=${() => this.refreshSnapshot()}
        @close=${() => this.dispatchEvent(new CustomEvent('tags-close', { bubbles: true, composed: true }))}></mnx-studio-tags>` : nothing}
    `;
  }
}
