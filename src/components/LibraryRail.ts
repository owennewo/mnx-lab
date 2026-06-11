import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  corpus,
  corpusManifest,
  coverage,
  filterCorpus,
  statusCounts,
  type Facet,
  type ScenarioEntry,
  type StatusFilter
} from '../library/corpus.ts';
import { sharedChrome, scrollbars } from '../styles/tokens.ts';

/**
 * The permanent library rail: one flat filtered list, shelved by the active
 * facet (category / status / source / $def). Browsing it is the app's primary
 * loop — it is navigation, not a panel (DIRECTION.md §1).
 */
@customElement('mnx-library-rail')
export class LibraryRail extends LitElement {
  @property({ type: String }) selectedId: string | null = null;
  @property({ type: String }) facet: Facet = 'category';
  @property({ type: String }) status: StatusFilter = 'all';
  @property({ type: String }) query = '';
  @property({ type: Boolean }) idRefsOnly = false;
  /** ≤980px overlay state (controlled by the app shell). */
  @property({ type: Boolean, reflect: true }) open = false;
  /** Embed-gallery trim: hides the shelve-by row. */
  @property({ type: Boolean }) compact = false;

  static styles = [
    sharedChrome,
    scrollbars,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        height: 100%;
        background: var(--bg-rail);
        border-right: 1px solid var(--line);
      }

      .rail-filters {
        padding: 10px 10px 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        border-bottom: 1px solid var(--line);
      }

      .search {
        position: relative;
        width: 100%;
      }

      .search input {
        width: 100%;
        height: 30px;
        padding: 0 28px 0 10px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: var(--surface);
        font-size: 12.5px;
        outline: none;
      }

      .search input:focus {
        border-color: var(--accent-fg);
      }

      .search kbd {
        position: absolute;
        right: 7px;
        top: 6px;
        font-family: var(--mono);
        font-size: 10px;
        color: var(--ink-3);
        border: 1px solid var(--line);
        border-radius: 3px;
        padding: 0 5px;
        line-height: 16px;
        background: var(--bg);
      }

      .chiprow {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }

      .grp-row {
        align-items: center;
      }

      .grp-label {
        font-family: var(--mono);
        font-size: 9.5px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-right: 2px;
      }

      .rail-list {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 4px 8px 12px;
      }

      .ns-head {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        align-items: baseline;
        gap: 8px;
        font-family: var(--mono);
        font-size: 11px;
        font-weight: 600;
        color: var(--ink);
        background: var(--bg-rail);
        padding: 12px 6px 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ns-head span {
        font-family: var(--sans);
        font-weight: 400;
        font-size: 10.5px;
        color: var(--ink-3);
      }

      .cat-head {
        display: flex;
        align-items: baseline;
        gap: 7px;
        padding: 9px 6px 3px;
      }

      .cat-head .cat-id {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-2);
        font-weight: 500;
        white-space: nowrap;
      }

      .cat-head .cat-count {
        margin-left: auto;
        font-family: var(--mono);
        font-size: 10px;
        color: var(--ink-3);
      }

      .srow {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 5px 8px;
        border-radius: 6px;
        text-align: left;
        border: none;
        position: relative;
      }

      .srow:hover {
        background: var(--hover);
      }

      .srow.on {
        background: color-mix(in oklab, var(--accent), transparent 89%);
      }

      .srow.on::before {
        content: '';
        position: absolute;
        left: 0;
        top: 5px;
        bottom: 5px;
        width: 2px;
        border-radius: 2px;
        background: var(--accent-fg);
      }

      .srow-t {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12.5px;
      }

      .srow.on .srow-t {
        color: var(--ink);
      }

      .srow-sub {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--ink-3);
      }

      .mini-tag {
        font-family: var(--mono);
        font-size: 9px;
        color: var(--ink-3);
        border: 1px solid var(--line);
        border-radius: 3px;
        padding: 0 4px;
        line-height: 14px;
        flex-shrink: 0;
      }

      .mini-tag.gap {
        color: var(--st-gap);
        border-color: color-mix(in oklab, var(--st-gap), transparent 55%);
      }

      .srow.planned {
        color: var(--ink-3);
        font-size: 12px;
        font-style: italic;
        cursor: default;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
      }

      .srow.planned:hover {
        background: none;
      }

      .srow.planned.defrow {
        display: flex;
        align-items: center;
        gap: 8px;
        font-style: normal;
        font-family: var(--mono);
        font-size: 11px;
      }

      .rail-foot {
        border-top: 1px solid var(--line);
        padding: 10px 14px;
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
      }

      .rail-foot:hover {
        background: var(--hover);
      }

      .rail-foot .cov-label {
        display: flex;
        justify-content: space-between;
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-2);
        white-space: nowrap;
        gap: 8px;
      }

      .cov-bar {
        height: 4px;
        border-radius: 2px;
        background: var(--line);
        overflow: hidden;
      }

      .cov-bar i {
        display: block;
        height: 100%;
        background: var(--st-rendered);
        border-radius: 2px;
      }
    `
  ];

  private get filter() {
    return { status: this.status, query: this.query, idRefsOnly: this.idRefsOnly };
  }

  private get isFiltering() {
    return this.status !== 'all' || this.query !== '' || this.idRefsOnly;
  }

  focusSearch() {
    this.shadowRoot?.querySelector('input')?.focus();
  }

  render() {
    const counts = statusCounts();
    const vis = filterCorpus(this.filter);
    const CHIPS: [StatusFilter, string, number][] = [
      ['all', 'All', counts.all],
      ['verified', 'Verified', counts.verified],
      ['rendered', 'Rendered', counts.rendered],
      ['needs', 'Needs work', counts.needs],
      ['gaps', 'Spec gaps', counts.gaps]
    ];
    const FACETS: [Facet, string][] = [
      ['category', 'category'],
      ['status', 'status'],
      ['source', 'source'],
      ['def', '$def']
    ];

    return html`
      <div class="rail-filters">
        <div class="search">
          <input
            .value=${this.query}
            placeholder=${this.facet === 'def' ? 'Filter — try “slur” or “tie”…' : 'Filter scenarios…'}
            @input=${(e: Event) => this.emitFilter({ query: (e.target as HTMLInputElement).value })}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
            }}
          />
          <kbd>/</kbd>
        </div>
        <div class="chiprow">
          ${CHIPS.map(
            ([k, label, n]) => html`
              <button
                class="fchip ${this.status === k ? 'on' : ''}"
                @click=${() => this.emitFilter({ status: k })}
              >
                ${label} <b>${n}</b>
              </button>
            `
          )}
          <button
            class="fchip ${this.idRefsOnly ? 'on' : ''}"
            title="Only scenarios exercising cross-references (ids) — the ones most likely to break a renderer"
            @click=${() => this.emitFilter({ idRefsOnly: !this.idRefsOnly })}
          >
            id-refs <b>${counts.idRefs}</b>
          </button>
        </div>
        ${this.compact
          ? nothing
          : html`
              <div class="chiprow grp-row">
                <span class="grp-label">shelve by</span>
                ${FACETS.map(
                  ([k, label]) => html`
                    <button
                      class="fchip ${this.facet === k ? 'on' : ''}"
                      @click=${() => this.emitFilter({ facet: k })}
                    >
                      ${label}
                    </button>
                  `
                )}
              </div>
            `}
      </div>

      <div class="rail-list">
        ${this.renderBody(vis)}
        ${this.isFiltering && vis.length === 0
          ? html`<div class="srow planned">nothing matches — clear filters</div>`
          : nothing}
      </div>

      <button class="rail-foot" title="Open the coverage dashboard" @click=${this.emitDashboard}>
        <span class="cov-label">
          <span>${coverage.covered} / ${coverage.total} feature defs</span>
          <span>coverage →</span>
        </span>
        <span class="cov-bar"><i style="width: ${(100 * coverage.covered) / coverage.total}%"></i></span>
      </button>
    `;
  }

  private renderBody(vis: ScenarioEntry[]): TemplateResult {
    switch (this.facet) {
      case 'status':
        return this.renderByStatus(vis);
      case 'source':
        return this.renderBySource(vis);
      case 'def':
        return this.renderByDef(vis);
      default:
        return this.renderByCategory(vis);
    }
  }

  private renderByCategory(vis: ScenarioEntry[]): TemplateResult {
    const visSet = new Set(vis);
    const labCats = Object.keys(corpusManifest.categories).map(id => {
      const items = corpus.filter(e => e.category === id);
      return { id, title: corpusManifest.categories[id], items, vis: items.filter(e => visSet.has(e)) };
    });
    const specVis = vis.filter(e => e.ns === 'spec');

    return html`
      <div class="ns-head">lab/ <span>hand-authored</span></div>
      ${labCats.map(cat => {
        if (this.isFiltering && cat.vis.length === 0) return nothing;
        const renderedN = cat.items.filter(
          e => e.meta.status === 'rendered' || e.meta.status === 'verified'
        ).length;
        return html`
          <div>
            <div class="cat-head" title=${cat.title}>
              <span class="cat-id">${cat.id.replace('lab/', '')}</span>
              <span class="cat-count">${cat.items.length ? `${renderedN}/${cat.items.length}` : ''}</span>
            </div>
            ${cat.items.length === 0
              ? html`<div class="srow planned">planned — no scenarios yet</div>`
              : cat.vis.map(e => this.renderRow(e))}
          </div>
        `;
      })}
      ${!this.isFiltering || specVis.length > 0
        ? html`
            <div class="ns-head">
              spec/ <span>W3C mirror · read-only · synced ${corpusManifest.specSynced}</span>
            </div>
            ${specVis.map(e => this.renderRow(e))}
          `
        : nothing}
    `;
  }

  private renderByStatus(vis: ScenarioEntry[]): TemplateResult {
    const shelves: [string, string][] = [
      ['verified', 'human-approved'],
      ['rendered', 'snapshot committed'],
      ['valid', 'validates, no render'],
      ['draft', 'work in progress']
    ];
    const invalid = vis.filter(e => e.invalidByDesign);
    return html`
      <div class="ns-head">by status <span>lifecycle: draft → valid → rendered → verified</span></div>
      ${shelves.map(([st, sub]) => {
        const items = vis.filter(e => e.meta.status === st && !e.invalidByDesign);
        if (!items.length) return nothing;
        return html`
          <div>
            <div class="cat-head" title=${sub}>
              <span class="cat-id">${st}</span>
              <span class="cat-count">${items.length}</span>
            </div>
            ${items.map(e => this.renderRow(e, e.ns))}
          </div>
        `;
      })}
      ${invalid.length
        ? html`
            <div>
              <div class="cat-head" title="spec-gap exhibits">
                <span class="cat-id">invalid by design</span>
                <span class="cat-count">${invalid.length}</span>
              </div>
              ${invalid.map(e => this.renderRow(e, e.ns))}
            </div>
          `
        : nothing}
    `;
  }

  private renderBySource(vis: ScenarioEntry[]): TemplateResult {
    const shelves: [string, string][] = [
      ['spec-example', 'mirrored from w3c-cg/mnx'],
      ['hand-written', 'authored here'],
      ['converter', 'from real MusicXML — none yet'],
      ['llm', 'model-generated — none yet']
    ];
    return html`
      <div class="ns-head">by source <span>evidential weight for the CG post</span></div>
      ${shelves.map(([src, sub]) => {
        const items = vis.filter(e => e.meta.source === src || e.meta.source.startsWith(`${src}:`));
        if (!items.length && this.isFiltering) return nothing;
        return html`
          <div>
            <div class="cat-head" title=${sub}>
              <span class="cat-id">${src}</span>
              <span class="cat-count">${items.length || ''}</span>
            </div>
            ${items.length
              ? items.map(e => this.renderRow(e, e.ns))
              : html`<div class="srow planned">${sub}</div>`}
          </div>
        `;
      })}
    `;
  }

  private renderByDef(vis: ScenarioEntry[]): TemplateResult {
    const map = new Map<string, ScenarioEntry[]>();
    for (const e of vis) {
      for (const d of e.featureDefs) {
        if (!map.has(d)) map.set(d, []);
        map.get(d)!.push(e);
      }
    }
    const defs = [...map.keys()].sort();
    return html`
      <div class="ns-head">by $def <span>feature defs only — plumbing excluded</span></div>
      ${defs.map(
        d => html`
          <div>
            <div class="cat-head" title="Scenarios exercising the “${d}” schema def">
              <span class="cat-id">${d}</span>
              <span class="cat-count">${map.get(d)!.length}</span>
            </div>
            ${map.get(d)!.map(e => this.renderRow(e, e.ns))}
          </div>
        `
      )}
      ${defs.length === 0 ? html`<div class="srow planned">no feature defs match</div>` : nothing}
      ${!this.isFiltering
        ? html`
            <div>
              <div class="ns-head">uncovered <span>the backlog — no scenario yet</span></div>
              ${coverage.uncovered.map(
                d => html`
                  <div class="srow planned defrow"><span class="pip" data-st="draft"></span>${d}</div>
                `
              )}
            </div>
          `
        : nothing}
    `;
  }

  private renderRow(e: ScenarioEntry, sub?: string): TemplateResult {
    return html`
      <button
        class="srow ${this.selectedId === e.id ? 'on' : ''}"
        title=${e.meta.description}
        @click=${() => this.emitSelect(e.id)}
      >
        ${e.invalidByDesign
          ? html`<span class="gapdia"></span>`
          : html`<span class="pip" data-st=${e.meta.status}></span>`}
        <span class="srow-t">
          ${e.meta.title}${sub ? html`<span class="srow-sub"> · ${sub}</span>` : nothing}
        </span>
        ${e.invalidByDesign ? html`<span class="mini-tag gap">gap</span>` : nothing}
        ${e.hasTab ? html`<span class="mini-tag">tab</span>` : nothing}
      </button>
    `;
  }

  private emitSelect(id: string) {
    this.dispatchEvent(
      new CustomEvent('scenario-selected', { detail: { id }, bubbles: true, composed: true })
    );
  }

  private emitDashboard() {
    this.dispatchEvent(
      new CustomEvent('dashboard-requested', { bubbles: true, composed: true })
    );
  }

  private emitFilter(detail: Record<string, unknown>) {
    this.dispatchEvent(
      new CustomEvent('library-filter-changed', { detail, bubbles: true, composed: true })
    );
  }
}

export default LibraryRail;
