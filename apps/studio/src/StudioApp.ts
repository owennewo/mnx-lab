// The studio shell: fullscreen by default — the score is the page. Two thin
// overlays, both fading when the pointer is idle over a score: a top bar with
// the piece title, the staff view, Library, the signed-in address and Sign
// out; a bottom dock with the player's transport (the player element carries
// its whole tray — transport, sound, rate, volume, the iteration table — which
// is a dock's worth, not a bar's). Three hash routes
// (roadmap/inprogress/studio-shell.md):
//   #/                 the library (tag-filtered browse)
//   #/piece/<id>       one piece, viewer + player filling the viewport
//   #/not-permitted    Access admitted the address, D1 did not
import { LitElement, css, html, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { LibraryClient } from '../../../src/storage/libraryClient.ts';
import type { Player } from '../../../src/elements/Player.ts';
import type { ViewSetting } from '../../../src/elements/DocumentViewer.ts';
import { loadSession, signIn, type Session } from './session.ts';
import './LibraryPage.ts';
import './PiecePage.ts';

export type Route =
  | { page: 'library' }
  | { page: 'piece'; id: string }
  | { page: 'not-permitted' };

export function parseHash(hash: string): Route {
  const piece = /^#\/piece\/([^/?#]+)$/.exec(hash);
  if (piece) return { page: 'piece', id: decodeURIComponent(piece[1]) };
  if (hash === '#/not-permitted') return { page: 'not-permitted' };
  return { page: 'library' };
}

export const libraryHref = '#/';
export const pieceHref = (id: string): string => `#/piece/${encodeURIComponent(id)}`;

const VIEW_KEY = 'mnx-studio.view';
const VIEWS: ViewSetting[] = ['auto', 'notation', 'tab', 'both'];
const IDLE_MS = 3000;

function storedView(): ViewSetting {
  try {
    const value = localStorage.getItem(VIEW_KEY);
    return VIEWS.includes(value as ViewSetting) ? (value as ViewSetting) : 'auto';
  } catch {
    return 'auto';
  }
}

@customElement('mnx-studio')
export class StudioApp extends LitElement {
  private readonly client = new LibraryClient();
  @state() private session: Session | null = null;
  @state() private route: Route = parseHash(location.hash);
  @state() private pieceTitle = '';
  @state() private view: ViewSetting = storedView();
  @state() private idle = false;
  @query('mnx-player') private player!: Player;
  private idleTimer = 0;

  static styles = css`
    :host {
      --ink: light-dark(oklch(0.24 0.004 60), oklch(0.93 0.003 60));
      --ink-dim: light-dark(oklch(0.5 0.006 60), oklch(0.7 0.005 60));
      --bar: light-dark(oklch(0.985 0.002 60 / 0.92), oklch(0.22 0.004 60 / 0.92));
      --line: light-dark(oklch(0.85 0.004 60), oklch(0.34 0.004 60));
      --accent: #ec3013;
      position: fixed;
      inset: 0;
      display: block;
      font: 14px/1.4 Archivo, system-ui, sans-serif;
      color: var(--ink);
    }
    header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px;
      background: var(--bar);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(6px);
      transition: opacity 240ms ease, transform 240ms ease;
    }
    header.idle:not(:hover):not(:focus-within) {
      opacity: 0;
      transform: translateY(-100%);
    }
    footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2;
      background: var(--bar);
      border-top: 1px solid var(--line);
      backdrop-filter: blur(6px);
      transition: opacity 240ms ease, transform 240ms ease;
    }
    footer.idle:not(:hover):not(:focus-within) {
      opacity: 0;
      transform: translateY(100%);
    }
    footer[hidden] {
      display: none;
    }
    .brand {
      font-weight: 600;
      letter-spacing: 0.01em;
      text-decoration: none;
      color: inherit;
      white-space: nowrap;
    }
    .brand b {
      color: var(--accent);
    }
    .title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
    }
    mnx-player {
      border-block: 0;
      background: transparent;
    }
    .who {
      color: var(--ink-dim);
      white-space: nowrap;
    }
    a,
    button,
    select {
      font: inherit;
      color: inherit;
    }
    button,
    select {
      background: transparent;
      border: 1px solid var(--line);
      border-radius: 3px;
      padding: 5px 9px;
      cursor: pointer;
    }
    button:hover {
      border-color: var(--ink-dim);
    }
    a.button {
      border: 1px solid var(--line);
      border-radius: 3px;
      padding: 5px 9px;
      text-decoration: none;
    }
    main {
      position: absolute;
      inset: 0;
      overflow: auto;
    }
    .notice {
      max-width: 36rem;
      margin: 20vh auto 0;
      padding: 0 24px;
    }
    .notice h1 {
      font-size: 1.4rem;
      margin: 0 0 12px;
    }
    .notice p {
      margin: 0 0 12px;
      color: var(--ink-dim);
    }
    @media (max-width: 720px) {
      .who {
        display: none;
      }
    }
  `;

  private readonly onHashChange = () => {
    this.route = parseHash(location.hash);
    if (this.route.page !== 'piece') this.pieceTitle = '';
    this.wake();
  };

  private readonly wake = () => {
    this.idle = false;
    clearTimeout(this.idleTimer);
    if (this.route.page === 'piece') this.idleTimer = window.setTimeout(() => (this.idle = true), IDLE_MS);
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this.onHashChange);
    window.addEventListener('pointermove', this.wake, { passive: true });
    window.addEventListener('keydown', this.wake);
    void loadSession(this.client).then(session => {
      this.session = session;
      if (session.kind === 'not-permitted' && this.route.page !== 'not-permitted') location.hash = '#/not-permitted';
    });
    this.wake();
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.onHashChange);
    window.removeEventListener('pointermove', this.wake);
    window.removeEventListener('keydown', this.wake);
    clearTimeout(this.idleTimer);
    super.disconnectedCallback();
  }

  /** The piece page takes the player by reference; it exists only after the
   *  header's first render, so one more pass hands it down. */
  protected firstUpdated() {
    this.requestUpdate();
  }

  private setView(event: Event) {
    this.view = (event.target as HTMLSelectElement).value as ViewSetting;
    try {
      localStorage.setItem(VIEW_KEY, this.view);
    } catch {
      /* a per-browser convenience only; never required */
    }
  }

  private signOut() {
    this.client.signOut();
  }

  render() {
    const email = this.session?.kind === 'signed-in' ? this.session.email : '';
    const onPiece = this.route.page === 'piece';
    return html`
      <header class=${this.idle && onPiece ? 'idle' : ''}>
        <a class="brand" href=${libraryHref}>MNX <b>Studio</b></a>
        <span class="title" title=${this.pieceTitle}>${this.pieceTitle}</span>
        ${onPiece
          ? html`<select aria-label="Staff view" .value=${this.view} @change=${this.setView}>
              ${VIEWS.map(v => html`<option value=${v} ?selected=${v === this.view}>${v === 'auto' ? 'auto view' : v}</option>`)}
            </select>`
          : nothing}
        ${onPiece ? html`<a class="button" href=${libraryHref}>Library</a>` : nothing}
        ${email ? html`<span class="who">${email}</span>` : nothing}
        ${email || this.session?.kind === 'not-permitted'
          ? html`<button @click=${this.signOut}>Sign out</button>`
          : nothing}
      </header>
      <main>${this.renderPage()}</main>
      <footer class=${this.idle && onPiece ? 'idle' : ''} ?hidden=${!onPiece}><mnx-player></mnx-player></footer>
    `;
  }

  private renderPage() {
    const session = this.session;
    if (!session) return html`<p class="notice" role="status">Loading…</p>`;
    if (session.kind === 'signed-out')
      return html`<div class="notice">
        <h1>Signed out</h1>
        <p>Your session has ended. Sign in again to open your library.</p>
        <button @click=${signIn}>Sign in</button>
      </div>`;
    if (session.kind === 'unavailable')
      return html`<div class="notice">
        <h1>Library unavailable</h1>
        <p>${session.message}</p>
        <button @click=${() => location.reload()}>Try again</button>
      </div>`;
    if (session.kind === 'not-permitted' || this.route.page === 'not-permitted')
      return html`<div class="notice">
        <h1>Not permitted</h1>
        <p>You signed in, but this address is not on the studio's member list. Ask the operator to enable it, then sign in again.</p>
        <button @click=${this.signOut}>Sign out</button>
      </div>`;
    if (this.route.page === 'piece')
      return html`<mnx-studio-piece
        .client=${this.client}
        .pieceId=${this.route.id}
        .player=${this.player}
        .view=${this.view}
        @piece-title=${(e: CustomEvent<string>) => (this.pieceTitle = e.detail)}
      ></mnx-studio-piece>`;
    return html`<mnx-studio-library .client=${this.client}></mnx-studio-library>`;
  }
}
