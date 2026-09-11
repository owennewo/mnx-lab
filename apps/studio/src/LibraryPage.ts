// #/ — the library, Option A (roadmap: studio-library-navigation): a rail where
// every dimension is one line reading `Artist: All` until opened, values with
// counts from the facets route, the chosen value held on the line; sort as one
// click beside the search; rows with the chips a person scans by.
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LibraryClient, LibraryRequestError, type LibraryFacet, type LibraryPiece, type LibrarySort } from '../../../src/storage/libraryClient.ts';
import { pieceHref, aliasesHref } from './StudioApp.ts';
import { FAVOURITE, RAIL_HIDDEN, RAIL_ORDER, chipText, dimensionLabel, parseTag, relativeTime } from './labels.ts';

const SORTS: { id: LibrarySort; label: string }[] = [{ id: 'recent', label: 'Recent' }, { id: 'title', label: 'Title' }, { id: 'artist', label: 'Artist' }];
const MAX_FILTERS = 12;
const tagOf = (dimension: string, value: string) => `${dimension}:${value}`;

const star = (filled: boolean) => html`<svg width="18" height="18" viewBox="0 0 24 24" fill=${filled ? 'var(--accent)' : 'none'} stroke=${filled ? 'var(--accent)' : 'var(--ink-dim)'} stroke-width="1.6" stroke-linejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"></path></svg>`;
const chevron = (open: boolean) => html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d=${open ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'}></path></svg>`;
const cross = html`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;

@customElement('mnx-studio-library')
export class LibraryPage extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @state() private filters: string[] = [];
  @state() private sort: LibrarySort = 'recent';
  @state() private query = '';
  @state() private pieces: LibraryPiece[] = [];
  @state() private next: string | null = null;
  @state() private facets: LibraryFacet[] = [];
  @state() private total = 0;
  @state() private open: string | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private suggestions: LibraryFacet[] = [];
  private generation = 0;

  static styles = css`
    :host { display: flex; min-height: 100%; }
    a { color: inherit; text-decoration: none; }
    a:hover { color: var(--accent); }
    button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 3px; padding: 5px 9px; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: default; }
    .rail { width: 232px; flex: none; padding: 64px 16px 24px 24px; border-right: 1px solid var(--line); display: flex; flex-direction: column; gap: 4px; overflow: auto; }
    .line { display: flex; align-items: center; gap: 6px; padding: 7px 8px; border-radius: 3px; border: 0; width: 100%; text-align: left; }
    .line:hover { background: var(--bar); }
    .line .dim { color: var(--ink-dim); }
    .line .val { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .line .count { color: var(--ink-dim); font-size: 12px; }
    .line .icon { color: var(--ink-dim); display: inline-flex; }
    .group { display: flex; flex-direction: column; border-radius: 3px; background: light-dark(oklch(0.94 0.003 60), oklch(0.215 0.004 60)); padding: 2px 0 6px; }
    .option { display: flex; justify-content: space-between; gap: 8px; padding: 5px 8px 5px 22px; border: 0; border-radius: 0; width: 100%; text-align: left; }
    .option:hover, .option.chosen { background: light-dark(oklch(0.9 0.004 60), oklch(0.26 0.006 60)); }
    .option .count { color: var(--ink-dim); font-size: 12px; }
    .rule { height: 1px; background: var(--line); margin: 8px 0; }
    .foot { margin-top: auto; display: flex; align-items: center; gap: 8px; padding: 5px 8px; color: var(--ink-dim); font-size: 13px; }
    .main { flex: 1; min-width: 0; padding: 60px 32px 24px; display: flex; flex-direction: column; gap: 14px; overflow: auto; }
    .tools { display: flex; align-items: center; gap: 12px; }
    .search { flex: 1; display: flex; align-items: center; gap: 10px; border: 1px solid var(--line); border-radius: 3px; padding: 0 10px; }
    .search input { flex: 1; min-width: 0; font: inherit; color: inherit; background: transparent; border: 0; padding: 7px 0; outline: none; }
    .search svg { color: var(--ink-dim); flex: none; }
    .sort { display: flex; border: 1px solid var(--line); border-radius: 3px; overflow: hidden; }
    .sort button { border: 0; border-radius: 0; padding: 7px 12px; font-size: 13px; color: var(--ink-dim); }
    .sort button + button { border-left: 1px solid var(--line); }
    .sort button.on { color: var(--ink); background: light-dark(oklch(0.9 0.004 60), oklch(0.26 0.006 60)); }
    .head { display: flex; align-items: baseline; gap: 12px; }
    h1 { font-size: 1.4rem; font-weight: 600; margin: 0; }
    .muted { color: var(--ink-dim); }
    .chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 10px; border: 1px solid var(--line); border-radius: 3px; background: light-dark(oklch(0.9 0.004 60), oklch(0.26 0.006 60)); font-size: 13px; }
    .chip .dim { color: var(--ink-dim); }
    .chip button { border: 0; padding: 0 2px; display: inline-flex; color: var(--ink-dim); }
    ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
    li { display: flex; align-items: center; gap: 16px; padding: 12px 4px; border-bottom: 1px solid var(--line); }
    li .star { border: 0; padding: 2px; display: inline-flex; flex: none; }
    li .who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    li .who a { font-weight: 500; }
    li .who small { color: var(--ink-dim); font-size: 13px; }
    li .tags { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    li .tags button { padding: 2px 8px; font-size: 12px; color: var(--ink-dim); }
    li .when { width: 88px; text-align: right; color: var(--ink-dim); font-size: 12px; flex: none; }
    .error { color: #b91c1c; }
    @media (max-width: 720px) { .rail { display: none; } }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load(more = false) {
    const generation = ++this.generation;
    this.busy = true; this.error = '';
    try {
      const [{ total, facets }, page] = await Promise.all([
        more ? Promise.resolve({ total: this.total, facets: this.facets }) : this.client.facets(this.filters),
        this.client.pieces(this.filters, more ? (this.next ?? '') : '', this.sort),
      ]);
      if (generation !== this.generation) return;
      this.total = total; this.facets = facets;
      this.pieces = more ? [...this.pieces, ...page.pieces] : page.pieces;
      this.next = page.next;
      // Plain words filter what is loaded; keep loading while a search has more to see.
      if (this.query && !parseTag(this.query) && this.next && this.pieces.length < 500) void this.load(true);
    } catch (error) {
      if (generation !== this.generation) return;
      this.error = error instanceof Error ? error.message : 'The library is unavailable.';
      if (error instanceof LibraryRequestError && error.status === 403) location.hash = '#/not-permitted';
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private setFilters(filters: string[]) {
    this.filters = filters.slice(0, MAX_FILTERS); this.open = null;
    void this.load();
  }
  private choose(dimension: string, value: string | null) {
    const rest = this.filters.filter(f => !f.startsWith(`${dimension}:`));
    this.setFilters(value === null ? rest : [...rest, tagOf(dimension, value)]);
  }
  private setSort(sort: LibrarySort) { this.sort = sort; void this.load(); }

  private async onInput(event: Event) {
    this.query = (event.target as HTMLInputElement).value;
    const tag = parseTag(this.query) ?? (this.query.endsWith(':') ? { dimension: this.query.slice(0, -1).trim().toLowerCase(), value: '' } : null);
    if (!tag) { this.suggestions = []; if (this.next) void this.load(true); return; }
    const query = this.query;
    try { const { tags } = await this.client.tags(`${tag.dimension}:${tag.value}`); if (query === this.query) this.suggestions = tags; }
    catch { /* completion is a convenience */ }
  }
  private onSubmit(event: Event) {
    event.preventDefault();
    const tag = parseTag(this.query);
    if (!tag) return;
    if (!this.filters.includes(tagOf(tag.dimension, tag.value))) this.choose(tag.dimension, tag.value);
    this.query = ''; this.suggestions = [];
  }

  private async toggleFavourite(piece: LibraryPiece) {
    const change = piece.favourite ? { remove: [FAVOURITE] } : { add: [FAVOURITE] };
    try {
      const { snapshot } = await this.client.changeTags(piece.id, piece.revision, change);
      this.pieces = this.pieces.map(p => p.id === piece.id ? { ...p, favourite: !piece.favourite, revision: snapshot.piece.revision } : p);
      const { total, facets } = await this.client.facets(this.filters); this.total = total; this.facets = facets;
      if (this.filters.includes(tagOf(FAVOURITE.dimension, FAVOURITE.value)) && piece.favourite) this.pieces = this.pieces.filter(p => p.id !== piece.id);
    } catch (error) {
      this.error = error instanceof LibraryRequestError && error.status === 409 ? 'This piece changed elsewhere; reload to see it.' : (error instanceof Error ? error.message : 'Could not change the tag.');
    }
  }

  /** The rail's dimensions: those the facets know, in the fixed order first. */
  private railDimensions(): string[] {
    const present = new Set(this.facets.map(f => f.dimension));
    for (const f of this.filters) present.add(f.slice(0, f.indexOf(':')));
    const rest = [...present].filter(d => !RAIL_HIDDEN.has(d) && !RAIL_ORDER.includes(d)).sort();
    return [...RAIL_ORDER.filter(d => present.has(d)), ...rest];
  }
  private chosen(dimension: string): string | null {
    const f = this.filters.find(f => f.startsWith(`${dimension}:`));
    return f ? f.slice(dimension.length + 1) : null;
  }
  private count(dimension: string, value: string): number {
    return this.facets.find(f => f.dimension === dimension && f.value === value)?.pieces ?? 0;
  }

  private visible(): LibraryPiece[] {
    const words = parseTag(this.query) ? '' : this.query.trim().toLowerCase();
    if (!words) return this.pieces;
    return this.pieces.filter(p => (p.title ?? '').toLowerCase().includes(words) || (p.artist ?? '').toLowerCase().includes(words));
  }

  render() {
    const favouriteOn = this.filters.includes(tagOf(FAVOURITE.dimension, FAVOURITE.value));
    const shown = this.visible();
    return html`
      <nav class="rail" aria-label="Browse">
        <button class="line" @click=${() => this.choose(FAVOURITE.dimension, favouriteOn ? null : FAVOURITE.value)}>
          <span class="icon">${star(favouriteOn)}</span><span class="val">Favourites</span><span class="count">${this.count(FAVOURITE.dimension, FAVOURITE.value) || ''}</span>
          ${favouriteOn ? html`<span class="icon">${cross}</span>` : nothing}
        </button>
        <div class="rule"></div>
        ${this.railDimensions().map(dimension => {
          const value = this.chosen(dimension); const open = this.open === dimension && value === null;
          const values = this.facets.filter(f => f.dimension === dimension).sort((a, b) => b.pieces - a.pieces || a.value.localeCompare(b.value));
          const line = html`<button class="line" aria-expanded=${open} @click=${() => value !== null ? this.choose(dimension, null) : (this.open = open ? null : dimension)}>
            <span class="dim">${dimensionLabel(dimension)}:</span><span class="val">${value === null ? 'All' : chipText(dimension, value)}</span>
            <span class="icon">${value !== null ? cross : chevron(open)}</span></button>`;
          return open ? html`<div class="group">${line}
              <button class="option chosen" @click=${() => (this.open = null)}><span>All</span><span class="count">${this.total}</span></button>
              ${values.map(f => html`<button class="option" @click=${() => this.choose(dimension, f.value)}><span>${chipText(dimension, f.value)}</span><span class="count">${f.pieces}</span></button>`)}
            </div>` : line;
        })}
        <a class="foot" href=${aliasesHref}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h11M4 12h16M4 17h8"></path></svg>
          <span>Tag aliases</span>
        </a>
      </nav>
      <div class="main">
        <div class="tools">
          <form class="search" @submit=${this.onSubmit}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"></circle><path d="M20 20l-4.2-4.2"></path></svg>
            <input aria-label="Search titles and artists, or type a tag" placeholder="Search, or type a tag — capo:3, tuning-name:drop D" list="suggest" maxlength="512" .value=${this.query} @input=${this.onInput} />
            <datalist id="suggest">${this.suggestions.map(f => html`<option value=${tagOf(f.dimension, f.value)}>${f.pieces} piece${f.pieces === 1 ? '' : 's'}</option>`)}</datalist>
          </form>
          <div class="sort" role="group" aria-label="Sort">${SORTS.map(s => html`<button class=${this.sort === s.id ? 'on' : ''} @click=${() => this.setSort(s.id)}>${s.label}</button>`)}</div>
        </div>
        <div class="head">
          <h1>Library</h1>
          <span class="muted">${this.filters.length || this.query ? `${shown.length} of ${this.total}` : `${this.total} piece${this.total === 1 ? '' : 's'}`}</span>
        </div>
        ${this.filters.length ? html`<div class="chips">
          ${this.filters.map(f => { const colon = f.indexOf(':'); const d = f.slice(0, colon); const v = f.slice(colon + 1);
            return html`<span class="chip"><span class="dim">${dimensionLabel(d).toLowerCase()}</span><span>${chipText(d, v)}</span><button aria-label=${`Remove filter ${f}`} @click=${() => this.choose(d, null)}>${cross}</button></span>`; })}
          <button style="border: 0; color: var(--ink-dim); font-size: 13px;" @click=${() => this.setFilters([])}>Clear</button>
        </div>` : nothing}
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${this.busy && !this.pieces.length ? html`<p class="muted" role="status">Loading…</p>` : nothing}
        <ul>${shown.map(p => html`<li>
          <button class="star" aria-label=${p.favourite ? 'Remove from favourites' : 'Add to favourites'} aria-pressed=${p.favourite} @click=${() => this.toggleFavourite(p)}>${star(p.favourite)}</button>
          <div class="who"><a href=${pieceHref(p.id)}>${p.title ?? p.id}</a>${p.artist ? html`<small>${p.artist}</small>` : nothing}</div>
          <div class="tags">${p.chips.map(c => html`<button title=${`Filter by ${dimensionLabel(c.dimension).toLowerCase()}`} @click=${() => this.choose(c.dimension, c.value)}>${chipText(c.dimension, c.value)}</button>`)}</div>
          <span class="when">${relativeTime(p.opened_at)}</span>
        </li>`)}</ul>
        ${!this.busy && !this.error && !shown.length ? html`<p class="muted">${this.filters.length || this.query ? 'No matching pieces.' : 'Your library is empty.'}</p>` : nothing}
        ${this.next && !this.query ? html`<div><button ?disabled=${this.busy} @click=${() => this.load(true)}>More</button></div>` : nothing}
      </div>
    `;
  }
}
