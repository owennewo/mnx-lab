// The studio shell: fullscreen by default — the score is the page. On a piece
// the page IS the score frame (roadmap/inprogress/core-score-frame.md): the
// frame's own strips carry the title, the way back, the tools and the player,
// so the shell's header is for the other pages only. Nothing fades on a timer
// any more — a tap never restarted it. Hash routes
// (roadmap/inprogress/studio-shell.md):
//   #/                 the library (tag-filtered browse); its view rides along as
//                      #/?tag=list:80s&sort=title&q=words, so a way back returns to it
//   #/piece/<id>       one piece, viewer + player filling the viewport
//   #/new              make a piece (roadmap/complete/studio-piece-create.md)
//   #/not-permitted    Access admitted the address, D1 did not
import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LibraryClient, type LibrarySort } from '../../../src/storage/libraryClient.ts';
import { loadSession, signIn, type Session } from './session.ts';
import { nextTheme, readTheme, resolvedTheme, setTheme, themeGlyph, type ThemeSetting } from './theme.ts';
import './LibraryPage.ts';
import './PiecePage.ts';
import './AliasesPage.ts';
import './NewPiecePage.ts';

export type Route =
  | { page: 'library' }
  | { page: 'piece'; id: string }
  | { page: 'aliases' }
  | { page: 'new' }
  | { page: 'not-permitted' };

export function parseHash(hash: string): Route {
  const piece = /^#\/piece\/([^/?#]+)$/.exec(hash);
  if (piece) return { page: 'piece', id: decodeURIComponent(piece[1]) };
  if (hash === '#/not-permitted') return { page: 'not-permitted' };
  if (hash === '#/aliases') return { page: 'aliases' };
  if (hash === '#/new') return { page: 'new' };
  return { page: 'library' };
}

export const libraryHref = '#/';
export const aliasesHref = '#/aliases';
export const newPieceHref = '#/new';
export const pieceHref = (id: string): string => `#/piece/${encodeURIComponent(id)}`;

/** What the library's URL carries: enough to put the same list back. */
export interface LibraryView {
  filters: string[];
  sort: LibrarySort;
  query: string;
}

export function parseLibraryHash(hash: string): LibraryView {
  const params = new URLSearchParams(/^#\/\?(.*)$/.exec(hash)?.[1] ?? '');
  const sort = params.get('sort');
  return { filters: params.getAll('tag'), sort: sort === 'title' || sort === 'artist' ? sort : 'recent', query: params.get('q') ?? '' };
}

export function libraryViewHref(view: LibraryView): string {
  const params = new URLSearchParams();
  view.filters.forEach(tag => params.append('tag', tag));
  if (view.sort !== 'recent') params.set('sort', view.sort);
  if (view.query) params.set('q', view.query);
  const search = params.toString();
  return search ? `#/?${search}` : libraryHref;
}

// The way back to the library: the view it last showed, and whether the entry
// behind this one in history IS that library — then back is history.back(), so
// the app's link and the browser's button leave history in the same place.
const libraryReturn = { href: libraryHref, behind: false };
export const libraryReturnHref = (): string => libraryReturn.href;
export const rememberLibraryHref = (href: string): void => void (libraryReturn.href = href);
export function returnToLibrary(event: MouseEvent) {
  if (!libraryReturn.behind || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  history.back();
}

@customElement('mnx-studio')
export class StudioApp extends LitElement {
  private readonly client = new LibraryClient();
  @state() private session: Session | null = null;
  @state() private route: Route = parseHash(location.hash);
  /** The theme, read again whenever the header returns — the piece page has
   *  its own toggle over the same stored setting. */
  @state() private theme: ThemeSetting = readTheme();

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
    button.theme {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-transform: capitalize;
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
    const from = this.route.page;
    this.route = parseHash(location.hash);
    libraryReturn.behind = from === 'library' && this.route.page !== 'library';
    this.theme = readTheme();
  };

  private cycleTheme() {
    this.theme = nextTheme(this.theme);
    setTheme(this.theme);
  }

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
    const themeSentence = `Theme: ${this.theme}${this.theme === 'auto' ? ` (now ${resolvedTheme(this.theme)})` : ''} — click for ${nextTheme(this.theme)}`;
    return html`
      ${onPiece
        ? nothing
        : html`<header>
            <a class="brand" href=${libraryHref}>MNX <b>Studio</b></a>
            <span class="title"></span>
            ${this.route.page === 'aliases' || this.route.page === 'new' ? html`<a class="button" href=${libraryReturnHref()} @click=${returnToLibrary}>Library</a>` : nothing}
            ${this.route.page === 'library' && email ? html`<a class="button" href=${newPieceHref}>New piece</a>` : nothing}
            <button class="theme" title=${themeSentence} aria-label=${themeSentence} @click=${this.cycleTheme}>${themeGlyph(this.theme)}<span>${this.theme}</span></button>
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
      ></mnx-studio-piece>`;
    if (this.route.page === 'aliases') return html`<mnx-studio-aliases .client=${this.client}></mnx-studio-aliases>`;
    if (this.route.page === 'new') return html`<mnx-studio-new-piece .client=${this.client}></mnx-studio-new-piece>`;
    return html`<mnx-studio-library .client=${this.client}></mnx-studio-library>`;
  }
}
