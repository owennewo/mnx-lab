// Feature-by-feature converter support — derived, never declared.
//
// Every other support matrix in the world is a table someone typed once. This
// one is generated (`npm run update:converter-matrix`) by putting all 125
// committed MNX documents through each converter's round trip and comparing
// which schema objects came back, so a cell cannot drift from the code without
// a red test.
//
// The tiers are ordered by what a reader should do about them, not by severity
// in the abstract:
//
//   lossy      the conversion SUCCEEDED and quietly dropped something. The
//              dangerous cell, and the top of the work queue
//   error      the converter threw on every document carrying it
//   extension  it survives only under `_x.mnxLab` — that is a SPEC gap, and it
//              belongs to spec/proposals/, not to a converter's backlog
//   untested   no document exercises it. Not the same as unsupported, and the
//              cell a hand-written table always fakes as a tick
//   supported  every document carrying it kept it
//
// Each non-supported cell names the first document that lost the feature, so
// the page is a set of starting points rather than a scoreboard.
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import matrix from '../corpus/generated/converter-matrix.json';
import { designTokens, sharedChrome, scrollbars } from '../elements/tokens.ts';
import { scenarioHref, objectsHref } from './WorkbenchApp.ts';

type Verdict = 'supported' | 'lossy' | 'extension' | 'error' | 'untested';

interface Cell {
  verdict: Verdict;
  carried?: number;
  survived?: number;
  evidence?: string;
}

interface Lane {
  key: string;
  label: string;
  counts: Record<Verdict, number>;
  rows: Record<string, Cell>;
  failures: string[];
}

const REPORT = matrix as unknown as {
  sources: number;
  rows: number;
  lanes: Lane[];
};

/** Work-queue order: what to look at first, not alphabetical severity. */
const TIERS: { verdict: Verdict; title: string; blurb: string }[] = [
  {
    verdict: 'lossy',
    title: 'Lossy',
    blurb: 'The conversion succeeded and dropped it. Nothing fails; the music is simply thinner.'
  },
  {
    verdict: 'error',
    title: 'Errors',
    blurb: 'The converter threw on every document carrying this.'
  },
  {
    verdict: 'extension',
    title: 'Carried as an extension',
    blurb:
      'Survives only under _x.mnxLab — the standard cannot hold it. A spec gap, so these feed spec/proposals/ rather than a converter backlog.'
  },
  {
    verdict: 'untested',
    title: 'Untested',
    blurb: 'No document in the corpus exercises this, so nothing is known either way.'
  },
  {
    verdict: 'supported',
    title: 'Supported',
    blurb: 'Every document carrying this kept it through the round trip.'
  }
];

@customElement('mnx-converters-page')
export class ConvertersPage extends LitElement {
  @state() private lane = REPORT.lanes[0]?.key ?? '';

  static styles = [
    designTokens,
    sharedChrome,
    scrollbars,
    css`
      :host {
        display: block;
        height: 100%;
        overflow-y: auto;
        padding: 30px 38px;
        box-sizing: border-box;
      }
      h1 {
        font-size: 19px;
        font-weight: 600;
        margin: 0 0 6px;
      }
      .lede {
        max-width: 62ch;
        margin: 0 0 20px;
        color: var(--ink-2);
        line-height: 1.5;
      }
      .lanes {
        display: flex;
        gap: 6px;
        margin-bottom: 20px;
        flex-wrap: wrap;
      }
      .lane {
        font: inherit;
        padding: 5px 12px;
        border-radius: 999px;
        border: 1px solid var(--rule);
        background: transparent;
        color: var(--ink-2);
        cursor: pointer;
      }
      .lane[aria-pressed='true'] {
        background: var(--ink-1);
        color: var(--bg-1);
        border-color: var(--ink-1);
      }
      .totals {
        display: flex;
        gap: 18px;
        flex-wrap: wrap;
        margin-bottom: 24px;
        padding-bottom: 18px;
        border-bottom: 1px solid var(--rule);
      }
      .total {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .total b {
        font-size: 22px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .total span {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--ink-3);
      }
      section {
        margin-bottom: 26px;
      }
      h2 {
        font-size: 14px;
        font-weight: 600;
        margin: 0 0 3px;
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      h2 em {
        font-style: normal;
        font-variant-numeric: tabular-nums;
        color: var(--ink-3);
        font-weight: 400;
      }
      .blurb {
        margin: 0 0 10px;
        color: var(--ink-3);
        max-width: 66ch;
        line-height: 1.45;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
        gap: 4px 14px;
      }
      li {
        display: flex;
        align-items: baseline;
        gap: 7px;
        padding: 3px 0;
        border-bottom: 1px solid color-mix(in srgb, var(--rule) 45%, transparent);
        min-width: 0;
      }
      .name {
        font-family: var(--mono);
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      a.name {
        color: inherit;
        text-decoration: none;
      }
      a.name:hover {
        text-decoration: underline;
      }
      .ext {
        color: var(--ink-2);
      }
      .where {
        margin-left: auto;
        font-size: 11px;
        color: var(--ink-3);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 46%;
      }
      .where a {
        color: inherit;
      }
      .ratio {
        font-size: 11px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .failures {
        margin: 0;
        padding: 10px 12px;
        border: 1px solid var(--rule);
        border-radius: 6px;
        font-size: 12px;
        color: var(--ink-2);
      }
      .failures code {
        font-family: var(--mono);
        font-size: 11px;
      }
    `
  ];

  private get current(): Lane | undefined {
    return REPORT.lanes.find(lane => lane.key === this.lane) ?? REPORT.lanes[0];
  }

  /** A scenario id links to its page; a fixture has no page to link to. */
  private evidenceLink(evidence: string) {
    if (evidence.startsWith('fixtures/')) return html`${evidence}`;
    return html`<a href=${scenarioHref(evidence)}>${evidence}</a>`;
  }

  private renderRow(name: string, cell: Cell) {
    const isExtension = name.startsWith('_x.mnxLab.');
    return html`<li>
      ${isExtension
        ? html`<span class="name ext">${name}</span>`
        : html`<a class="name" href=${objectsHref(name)} title="coverage for ${name}">${name}</a>`}
      ${cell.carried !== undefined && cell.verdict !== 'untested'
        ? html`<span class="ratio">${cell.survived}/${cell.carried}</span>`
        : null}
      ${cell.evidence
        ? html`<span class="where"
            >${cell.verdict === 'extension' ? 'seen in' : 'lost in'}
            ${this.evidenceLink(cell.evidence)}</span
          >`
        : null}
    </li>`;
  }

  render() {
    const lane = this.current;
    if (!lane) return html`<p class="lede">No converter lanes are scored yet.</p>`;
    const entries = Object.entries(lane.rows) as [string, Cell][];

    return html`
      <h1>Converter support</h1>
      <p class="lede">
        Every cell is derived by putting all ${REPORT.sources} committed MNX documents
        through the converter and comparing what came back — never declared, so it cannot
        drift from the code without failing a test. <strong>Extension</strong> rows are a
        gap in the standard rather than in our code, and <strong>untested</strong> is not
        the same as unsupported.
      </p>

      ${REPORT.lanes.length > 1
        ? html`<div class="lanes">
            ${REPORT.lanes.map(
              option => html`<button
                class="lane"
                aria-pressed=${option.key === lane.key}
                @click=${() => (this.lane = option.key)}
              >
                ${option.label}
              </button>`
            )}
          </div>`
        : null}

      <div class="totals">
        ${TIERS.map(
          tier => html`<div class="total">
            <b>${lane.counts[tier.verdict]}</b><span>${tier.title}</span>
          </div>`
        )}
      </div>

      ${lane.failures.length
        ? html`<p class="failures">
            <strong>${lane.failures.length}</strong> document${lane.failures.length === 1
              ? ''
              : 's'}
            could not be converted at all:
            ${lane.failures.map(failure => html`<br /><code>${failure}</code>`)}
          </p>`
        : null}

      ${TIERS.map(tier => {
        const rows = entries.filter(([, cell]) => cell.verdict === tier.verdict);
        if (!rows.length) return null;
        return html`<section>
          <h2>${tier.title} <em>${rows.length}</em></h2>
          <p class="blurb">${tier.blurb}</p>
          <ul>
            ${rows.map(([name, cell]) => this.renderRow(name, cell))}
          </ul>
        </section>`;
      })}
    `;
  }
}
