// #/piece/<id> — one piece, fullscreen. Fetches the canonical MNX through the
// library's read route, mounts <mnx-document-viewer> filling the viewport and
// wires it to the shell's <mnx-player> with the same plain-DOM host binding
// the embed face exports. Nothing here edits or persists anything.
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { LibraryClient, LibraryRequestError } from '../../../src/storage/libraryClient.ts';
import { documentTitle, documentArtist, type MnxDocument } from '../../../src/model/mnx.ts';
import { upgradeTabExtension } from '../../../src/model/upgradeTabExtension.ts';
import { bindPlayback } from '../../../src/elements/playbackHost.ts';
import type { DocumentViewer, ViewSetting } from '../../../src/elements/DocumentViewer.ts';
import type { Player } from '../../../src/elements/Player.ts';

@customElement('mnx-studio-piece')
export class PiecePage extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @property({ type: String }) pieceId = '';
  @property({ attribute: false }) player: Player | undefined;
  @property({ type: String }) view: ViewSetting = 'auto';
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
      const { document } = await this.client.mnx(this.pieceId);
      if (generation !== this.generation) return;
      const mnxJson = upgradeTabExtension(document);
      const doc: MnxDocument = {
        id: `library:${this.pieceId}`,
        name: documentTitle(mnxJson) ?? this.pieceId,
        lastUpdated: Date.now(),
        mnxJson,
      };
      this.doc = doc;
      const artist = documentArtist(mnxJson);
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
    `;
  }
}
