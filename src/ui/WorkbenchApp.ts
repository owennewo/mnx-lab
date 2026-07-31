// The workbench shell — a clean-room, review-first rebuild (structure-lab).
// Home is the attention queue; every scenario + view mode has a stable
// deep-linkable URL (#/scenario/<id>?view=…). The shell is a leaf: it
// consumes corpus/ and elements/, and nothing imports it.
//
// The workbench has NO backend: everything on screen is committed JSON
// served statically; verification state is display-only (mutations happen
// through the harness scripts, in git).
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { corpus, corpusManifest, coverage, type ScenarioEntry } from '../corpus/corpus.ts';
import { buildQueue } from './queue.ts';
import { designTokens, sharedChrome, scrollbars } from '../elements/tokens.ts';
import './QueueHome.ts';
import './ScenarioPage.ts';

export interface Route {
  page: 'home' | 'scenario';
  id?: string;
  view?: string;
}

export function parseHash(hash: string): Route {
  const m = /^#\/scenario\/([^?]+)(?:\?view=([a-z-]+))?$/.exec(hash);
  if (m) return { page: 'scenario', id: decodeURIComponent(m[1]), view: m[2] };
  return { page: 'home' };
}

export function scenarioHref(id: string, view?: string): string {
  return `#/scenario/${encodeURIComponent(id).replace(/%2F/g, '/')}${view ? `?view=${view}` : ''}`;
}

@customElement('mnx-workbench')
export class WorkbenchApp extends LitElement {
  @state() private route: Route = parseHash(location.hash);
  @state() private query = '';

  private onHashChange = () => {
    this.route = parseHash(location.hash);
  };

  static styles = [
    designTokens,
    sharedChrome,
    scrollbars,
    css`
      :host {
        display: grid;
        grid-template-rows: auto 1fr;
        grid-template-columns: 270px 1fr;
        grid-template-areas:
          'header header'
          'rail main';
        height: 100vh;
        background: var(--bg);
        color: var(--ink);
        font-family: var(--sans);
      }

      header {
        grid-area: header;
        display: flex;
        align-items: baseline;
        gap: 14px;
        padding: 10px 18px;
        border-bottom: 1px solid var(--line);
      }

      header .brand {
        font-family: var(--serif);
        font-size: 17px;
        font-weight: 500;
      }

      header .brand a {
        color: inherit;
        text-decoration: none;
      }

      header .facts {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-3);
        display: flex;
        gap: 14px;
        margin-left: auto;
      }

      nav {
        grid-area: rail;
        overflow-y: auto;
        background: var(--bg-rail);
        border-right: 1px solid var(--line);
        padding: 12px 0 24px;
      }

      main {
        grid-area: main;
        overflow: hidden;
        min-width: 0;
      }

      .queue-link {
        display: block;
        margin: 0 10px 10px;
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 12.5px;
        font-weight: 500;
        color: var(--ink);
        text-decoration: none;
        border: 1px solid var(--line);
      }

      .queue-link:hover {
        border-color: var(--accent);
      }

      .queue-link .count {
        font-family: var(--mono);
        color: var(--accent);
      }

      .search {
        display: block;
        width: calc(100% - 20px);
        margin: 0 10px 12px;
        padding: 6px 9px;
        font: inherit;
        font-size: 12px;
        color: var(--ink);
        background: transparent;
        border: 1px solid var(--line);
        border-radius: 7px;
        box-sizing: border-box;
      }

      .cat {
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-3);
        padding: 10px 18px 4px;
      }

      .item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 18px;
        font-size: 12.5px;
        color: var(--ink);
        text-decoration: none;
      }

      .item:hover {
        background: var(--hover);
      }

      .item[aria-current='true'] {
        background: var(--hover);
        color: var(--accent);
      }

      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .dot.verified {
        background: var(--st-verified);
      }

      .dot.rendered {
        background: var(--st-rendered);
      }

      .dot.valid,
      .dot.draft {
        background: var(--ink-3);
      }

      .dot.invalid {
        background: var(--st-gap);
        border-radius: 2px;
        transform: rotate(45deg);
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this.onHashChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.onHashChange);
  }

  private grouped(): Map<string, ScenarioEntry[]> {
    const q = this.query.toLowerCase();
    const groups = new Map<string, ScenarioEntry[]>();
    for (const e of corpus) {
      if (q && !e.id.toLowerCase().includes(q) && !e.meta.title.toLowerCase().includes(q)) {
        continue;
      }
      const list = groups.get(e.category) ?? [];
      list.push(e);
      groups.set(e.category, list);
    }
    return groups;
  }

  render() {
    const queue = buildQueue(corpus);
    const attention = queue.blocked.length + queue.stale.length + queue.neverSeen.length;
    const active = this.route.page === 'scenario' ? this.route.id : null;

    return html`
      <header>
        <span class="brand"><a href="#/">MNX Lab — workbench</a></span>
        <span class="facts">
          <span>MNX v${corpusManifest.mnxVersion} · ext v${corpusManifest.extensionVersion}</span>
          <span>coverage ${coverage.covered}/${coverage.total} $defs</span>
          <span>${corpus.length} scenarios</span>
        </span>
      </header>
      <nav>
        <a class="queue-link" href="#/">
          Attention queue —
          <span class="count">${attention === 0 ? 'empty' : attention}</span>
          <span style="color: var(--ink-3)">(${queue.currentCount} current)</span>
        </a>
        <input
          class="search"
          type="search"
          placeholder="Filter scenarios…"
          .value=${this.query}
          @input=${(e: InputEvent) => (this.query = (e.target as HTMLInputElement).value)}
        />
        ${[...this.grouped()].map(
          ([category, entries]) => html`
            <div class="cat">${category}</div>
            ${entries.map(
              e => html`
                <a class="item" href=${scenarioHref(e.id)} aria-current=${e.id === active}>
                  <span
                    class="dot ${e.invalidByDesign ? 'invalid' : e.meta.status}"
                    title=${e.invalidByDesign ? 'invalid by design' : e.meta.status}
                  ></span>
                  ${e.meta.title}
                </a>
              `
            )}
          `
        )}
      </nav>
      <main>
        ${this.route.page === 'scenario'
          ? html`<mnx-scenario-page
              .scenarioId=${this.route.id ?? ''}
              .view=${this.route.view ?? ''}
            ></mnx-scenario-page>`
          : html`<mnx-queue-home></mnx-queue-home>`}
      </main>
    `;
  }
}
