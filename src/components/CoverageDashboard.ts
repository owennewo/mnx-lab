import { LitElement, html, css, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { corpus, corpusManifest, coverage } from '../library/corpus.ts';
import { sharedChrome, scrollbars } from '../styles/tokens.ts';

const STATUS_ORDER: [string, string][] = [
  ['verified', 'var(--st-verified)'],
  ['rendered', 'var(--st-rendered)'],
  ['valid', 'var(--st-valid)'],
  ['draft', 'var(--st-draft)']
];

/**
 * The empty state IS the coverage dashboard (DIRECTION.md §7): spec coverage
 * is the project's progress metric, so it's what you see when nothing is
 * selected. All numbers derive from the live corpus metadata.
 */
@customElement('mnx-coverage-dashboard')
export class CoverageDashboard extends LitElement {
  static styles = [
    sharedChrome,
    scrollbars,
    css`
      :host {
        display: block;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 40px 48px;
        height: 100%;
      }

      .ov-inner {
        max-width: 880px;
        margin: 0 auto;
      }

      .ov-kicker {
        font-family: var(--mono);
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin: 0 0 10px;
      }

      .ov-title {
        font-family: var(--serif);
        font-size: 30px;
        font-weight: 500;
        margin: 0 0 12px;
        letter-spacing: -0.01em;
      }

      .ov-lede {
        font-size: 14px;
        line-height: 1.6;
        color: var(--ink-2);
        max-width: 64ch;
        margin: 0 0 28px;
        text-wrap: pretty;
      }

      .ov-tiles {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 28px;
      }

      .ov-tile {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 14px 16px;
        background: var(--surface);
      }

      .ov-tile .t-num {
        font-family: var(--serif);
        font-size: 27px;
        font-weight: 500;
        line-height: 1.1;
      }

      .ov-tile .t-lab {
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        margin-top: 5px;
        white-space: nowrap;
      }

      .ov-sec {
        margin-bottom: 28px;
      }

      .ov-sec h2 {
        font-size: 13px;
        font-weight: 600;
        margin: 0 0 4px;
      }

      .ov-sec .sec-sub {
        font-size: 12px;
        color: var(--ink-3);
        margin: 0 0 12px;
      }

      .defs-meta {
        display: flex;
        justify-content: space-between;
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-2);
        margin-bottom: 10px;
      }

      .defs-bar {
        height: 8px;
        border-radius: 4px;
        background: var(--line);
        overflow: hidden;
        margin-bottom: 10px;
      }

      .defs-bar i {
        display: block;
        height: 100%;
        background: var(--st-rendered);
      }

      .defs-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .dchip {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-2);
        border: 1px dashed var(--line-strong);
        border-radius: 4px;
        padding: 2px 7px;
        white-space: nowrap;
      }

      .cat-table {
        border: 1px solid var(--line);
        border-radius: 10px;
        overflow: hidden;
        background: var(--surface);
      }

      .cat-row {
        display: grid;
        grid-template-columns: 200px 1fr 110px;
        align-items: center;
        gap: 16px;
        padding: 9px 16px;
        width: 100%;
        text-align: left;
        border-bottom: 1px solid var(--line);
      }

      .cat-row:last-child {
        border-bottom: none;
      }

      .cat-row:hover:not(.empty) {
        background: var(--hover);
      }

      .cat-row.empty {
        color: var(--ink-3);
        cursor: default;
      }

      .cat-row .cr-id {
        font-family: var(--mono);
        font-size: 11px;
      }

      .cat-row .cr-bar {
        display: flex;
        height: 6px;
        border-radius: 3px;
        overflow: hidden;
        background: var(--line);
      }

      .cat-row .cr-bar i {
        display: block;
        height: 100%;
      }

      .cat-row .cr-count {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        text-align: right;
      }

      .ov-foot {
        font-size: 11px;
        color: var(--ink-3);
        line-height: 1.6;
        border-top: 1px solid var(--line);
        padding-top: 14px;
      }
    `
  ];

  render() {
    const all = corpus;
    const rendered = all.filter(
      e => e.meta.status === 'rendered' || e.meta.status === 'verified'
    ).length;
    const verified = all.filter(e => e.meta.status === 'verified').length;
    const gaps = all.filter(e => e.invalidByDesign).length;
    const pct = Math.round((100 * coverage.covered) / coverage.total);

    const cats = Object.keys(corpusManifest.categories)
      .map(id => ({ id, items: all.filter(e => e.category === id) }))
      .concat([{ id: 'spec', items: all.filter(e => e.ns === 'spec') }]);

    return html`
      <div class="ov-inner">
        <p class="ov-kicker">test bench · W3C MNX · guitar tab</p>
        <h1 class="ov-title">Turn any valid MNX into correct notation.</h1>
        <p class="ov-lede">
          The scenario library proves it: small MNX documents covering the spec, each with pinned
          verdicts, a committed layout snapshot, and a live render. Pick a scenario from the library
          — or start with the gaps the renderer hasn’t earned yet.
        </p>

        <div class="ov-tiles">
          <div class="ov-tile">
            <div class="t-num">${all.length}</div>
            <div class="t-lab">scenarios</div>
          </div>
          <div class="ov-tile">
            <div class="t-num">${rendered}</div>
            <div class="t-lab"><span class="pip" data-st="rendered"></span>rendered</div>
          </div>
          <div class="ov-tile">
            <div class="t-num">${verified}</div>
            <div class="t-lab"><span class="pip" data-st="verified"></span>verified</div>
          </div>
          <div class="ov-tile">
            <div class="t-num">${gaps}</div>
            <div class="t-lab"><span class="gapdia"></span>spec gaps</div>
          </div>
        </div>

        <div class="ov-sec">
          <h2>Feature-def coverage</h2>
          <p class="sec-sub">
            Measured against the schema’s $defs (plumbing excluded) — the uncovered list is the
            backlog.
          </p>
          <div class="defs-meta">
            <span>${coverage.covered} of ${coverage.total} feature defs exercised</span>
            <span>${pct}%</span>
          </div>
          <div class="defs-bar"><i style="width: ${pct}%"></i></div>
          <div class="defs-chips">
            ${coverage.uncovered.map(d => html`<span class="dchip">${d}</span>`)}
          </div>
        </div>

        <div class="ov-sec">
          <h2>By category</h2>
          <p class="sec-sub">
            Status per shelf — categories are a filing convention; the data model stays flat and
            facet-driven.
          </p>
          <div class="cat-table">
            ${cats.map(c => {
              const total = c.items.length;
              return html`
                <button
                  class="cat-row ${total ? '' : 'empty'}"
                  @click=${total ? () => this.emitSelect(c.items[0].id) : undefined}
                >
                  <span class="cr-id">${c.id}/</span>
                  <span class="cr-bar">
                    ${total
                      ? STATUS_ORDER.map(([st, color]) => {
                          const n = c.items.filter(e => e.meta.status === st).length;
                          return n
                            ? html`<i style="width: ${(100 * n) / total}%; background: ${color}"></i>`
                            : nothing;
                        })
                      : nothing}
                  </span>
                  <span class="cr-count">${total ? total : 'planned'}</span>
                </button>
              `;
            })}
          </div>
        </div>

        <p class="ov-foot">
          spec/ mirrors the MNX Community Group’s worked examples verbatim (synced
          ${corpusManifest.specSynced}, metadata generated — never hand-edited). W3C Community Group
          material, mirrored with attribution for conformance testing. Invalid-by-design exhibits
          feed w3c-cg/mnx#63.
        </p>
      </div>
    `;
  }

  private emitSelect(id: string) {
    this.dispatchEvent(
      new CustomEvent('scenario-selected', { detail: { id }, bubbles: true, composed: true })
    );
  }
}

export default CoverageDashboard;
