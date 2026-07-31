// The workbench shell — a clean-room, review-first rebuild (structure-lab).
// Home is the attention queue; every scenario + view mode has a stable
// deep-linkable URL (#/scenario/<id>?view=…). The shell is a leaf: it
// consumes corpus/ and elements/, and nothing imports it.
//
// The workbench has NO backend: everything on screen is committed JSON
// served statically; verification state is display-only (mutations happen
// through the harness scripts, in git).
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { corpus, corpusManifest, coverage, type ScenarioEntry } from '../corpus/corpus.ts';
import { groupScenarios } from '../corpus/groups.ts';
import { buildQueue, classify } from './queue.ts';
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

      /* Queue state, by shape as well as colour. */
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
        box-sizing: border-box;
      }

      /* Approved and still matching its goldens. */
      .dot.current {
        background: var(--st-verified);
        box-shadow: 0 0 0 2px color-mix(in oklab, var(--st-verified), transparent 78%);
      }

      /* Approved once, output has moved since — hollow: the ring is still
         there, the substance isn't. */
      .dot.stale {
        background: transparent;
        border: 2px solid var(--st-verified);
      }

      /* Renders, but no human has ever signed it off. */
      .dot.never-seen {
        background: var(--st-rendered);
      }

      .dot.blocked {
        background: var(--st-gap);
      }

      /* Orthogonal to state: rejected by the schema on purpose. */
      .dot.by-design {
        border-radius: 2px;
        transform: rotate(45deg);
      }

      .label {
        flex: 1;
        min-width: 0;
      }

      .tag {
        flex-shrink: 0;
        font-family: var(--mono);
        font-size: 9px;
        letter-spacing: 0.04em;
        color: var(--ink-3);
        border: 1px solid var(--line);
        border-radius: 4px;
        padding: 0 4px;
        line-height: 1.5;
      }

      .tag.proposed {
        color: var(--st-gap);
        border-color: color-mix(in oklab, var(--st-gap), transparent 55%);
      }

      .cat-n {
        float: right;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
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
    const matches = corpus.filter(
      e => !q || e.id.toLowerCase().includes(q) || e.meta.title.toLowerCase().includes(q)
    );
    // Topic groups, not the authoring category — see src/corpus/groups.ts.
    // Lab and spec interleave here, which is the point; `origin` carries the
    // provenance the old lab/spec headers used to imply.
    return groupScenarios(matches, e => e.id);
  }

  /**
   * One rail row, carrying two orthogonal signals.
   *
   * The DOT is the scenario's place in the attention queue — the same
   * `classify()` the queue home and the scenario page use, so one vocabulary
   * across the workbench. It used to show the raw `status`, which collapsed
   * *stale* (approved once, output has since moved) and *never seen* into a
   * single "rendered" dot: the exact distinction the provenance record exists
   * to make. Shape carries it as well as colour, so it survives a colourblind
   * reader and a greyscale screenshot.
   *
   * The TAGS are provenance. `spec` means mirrored from the pinned release by
   * `sync:spec`, which owns that tree byte-for-byte — the strongest thing a
   * reader can know about a scenario is whether hand-editing it is allowed.
   * That used to be implied by the lab/… vs spec header; now that topic groups
   * interleave the two, it has to be said explicitly. `proposed` means the
   * scenario is judged by a proposed schema, so a validation verdict on it is
   * evidence about the spec, not about us.
   */
  private railItem(e: ScenarioEntry, active: string | null) {
    const { state, detail } = classify(e);
    const record = e.meta.verification;
    return html`
      <a class="item" href=${scenarioHref(e.id)} aria-current=${e.id === active}>
        <span
          class="dot ${state}${e.invalidByDesign ? ' by-design' : ''}"
          title=${`${detail}${e.invalidByDesign ? ' · invalid by design' : ''}${
            record?.renderHash ? '' : record ? ' · no renderHash yet' : ''
          }`}
        ></span>
        <span class="label">${e.meta.title}</span>
        ${e.meta.schema === 'proposed'
          ? html`<span class="tag proposed" title="judged by a proposed schema">proposed</span>`
          : nothing}
        ${e.ns === 'spec'
          ? html`<span class="tag" title="mirrored from the pinned spec — sync:spec owns it"
              >spec</span
            >`
          : nothing}
      </a>
    `;
  }

  render() {
    const queue = buildQueue(corpus);
    const attention = queue.blocked.length + queue.stale.length + queue.neverSeen.length;
    const active = (this.route.page === 'scenario' ? this.route.id : null) ?? null;

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
          ([group, entries]) => html`
            <div class="cat">${group}<span class="cat-n">${entries.length}</span></div>
            ${entries.map(e => this.railItem(e, active))}
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
