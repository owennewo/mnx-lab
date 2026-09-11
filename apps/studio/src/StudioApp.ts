// The studio shell: fullscreen by default — the score is the page. On a piece
// the page IS the score frame (roadmap/inprogress/core-score-frame.md): the
// frame's own grips carry the title, the way back, the tools and the player,
// so the shell's header is for the other pages only. Nothing fades on a timer
// any more — a tap never restarted it. Three hash routes
// (roadmap/inprogress/studio-shell.md):
//   #/                 the library (tag-filtered browse)
//   #/piece/<id>       one piece, viewer + player filling the viewport
//   #/not-permitted    Access admitted the address, D1 did not
import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LibraryClient } from '../../../src/storage/libraryClient.ts';
import { loadSession, signIn, type Session } from './session.ts';
import './LibraryPage.ts';
import './PiecePage.ts';
import './AliasesPage.ts';

export type Route =
  | { page: 'library' }
  | { page: 'piece'; id: string }
  | { page: 'aliases' }
  | { page: 'not-permitted' };

export function parseHash(hash: string): Route {
  const piece = /^#\/piece\/([^/?#]+)$/.exec(hash);
  if (piece) return { page: 'piece', id: decodeURIComponent(piece[1]) };
  if (hash === '#/not-permitted') return { page: 'not-permitted' };
  if (hash === '#/aliases') return { page: 'aliases' };
  return { page: 'library' };
}

export const libraryHref = '#/';
export const aliasesHref = '#/aliases';
export const pieceHref = (id: string): string => `#/piece/${encodeURIComponent(id)}`;

@customElement('mnx-studio')
export class StudioApp extends LitElement {
  private readonly client = new LibraryClient();
  @state() private session: Session | null = null;
  @state() private route: Route = parseHash(location.hash);

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
    /* A piece is the frame, and the frame is its own scroll container. */
    main.piece {
      overflow: hidden;
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
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this.onHashChange);
    void loadSession(this.client).then(session => {
      this.session = session;
      if (session.kind === 'not-permitted' && this.route.page !== 'not-permitted') location.hash = '#/not-permitted';
    });
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.onHashChange);
    super.disconnectedCallback();
  }

  private signOut() {
    this.client.signOut();
  }

  render() {
    const email = this.session?.kind === 'signed-in' ? this.session.email : '';
    const onPiece = this.route.page === 'piece' && this.session?.kind === 'signed-in';
    return html`
      ${onPiece
        ? nothing
        : html`<header>
            <a class="brand" href=${libraryHref}>MNX <b>Studio</b></a>
            <span class="title"></span>
            ${this.route.page === 'aliases' ? html`<a class="button" href=${libraryHref}>Library</a>` : nothing}
            ${email ? html`<span class="who">${email}</span>` : nothing}
            ${email || this.session?.kind === 'not-permitted'
              ? html`<button @click=${this.signOut}>Sign out</button>`
              : nothing}
          </header>`}
      <main class=${onPiece ? 'piece' : ''}>${this.renderPage()}</main>
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
        .email=${session.email}
      ></mnx-studio-piece>`;
    if (this.route.page === 'aliases') return html`<mnx-studio-aliases .client=${this.client}></mnx-studio-aliases>`;
    return html`<mnx-studio-library .client=${this.client}></mnx-studio-library>`;
  }
}
