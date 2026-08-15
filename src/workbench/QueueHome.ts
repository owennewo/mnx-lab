// The workbench home surface: the attention queue, ordered by attention —
// blocked (crashes / never rendered) first, then stale (with provenance),
// then never-seen; current items are counted, not shown. Approvals happen in
// conversation via the /verify skill; this page only shows the state.
import { LitElement, html, css, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { corpus } from '../corpus/corpus.ts';
import { buildQueue, type QueueItem } from './queue.ts';
import { designTokens, sharedChrome, scrollbars } from '../elements/tokens.ts';
import { scenarioHref } from './WorkbenchApp.ts';

@customElement('mnx-queue-home')
export class QueueHome extends LitElement {
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
        font-family: var(--sans);
        font-weight: 500;
        font-size: 24px;
        margin: 0 0 6px;
      }

      .subtitle {
        font-size: 13px;
        color: var(--ink-2);
        margin: 0 0 26px;
        max-width: 64ch;
        line-height: 1.55;
      }

      .subtitle code {
        font-family: var(--mono);
        font-size: 12px;
      }

      section {
        margin-bottom: 26px;
        max-width: 860px;
      }

      h2 {
        font-size: 12px;
        font-family: var(--mono);
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--ink-2);
        margin: 0 0 8px;
        display: flex;
        gap: 8px;
        align-items: center;
      }

      h2 .n {
        color: var(--accent);
      }

      .rows {
        border: 1px solid var(--line);
        border-radius: var(--radius-panel);
        overflow: hidden;
        background: var(--surface);
      }

      .row {
        display: grid;
        grid-template-columns: minmax(200px, 1fr) 2fr;
        gap: 12px;
        padding: 10px 14px;
        border-top: 1px solid var(--line);
        text-decoration: none;
        color: var(--ink);
        font-size: 12.5px;
        align-items: baseline;
      }

      .row:first-child {
        border-top: none;
      }

      .row:hover {
        background: var(--hover);
      }

      .row .id {
        font-family: var(--mono);
        font-size: 11.5px;
        color: var(--accent-fg);
      }

      .row .why {
        color: var(--ink-2);
      }

      .empty {
        border: 1px dashed var(--line-strong);
        border-radius: var(--radius-card);
        padding: 34px;
        max-width: 860px;
        text-align: center;
        color: var(--ink-2);
        font-size: 13px;
      }

      .empty .big {
        font-family: var(--sans);
        font-size: 19px;
        color: var(--ink);
        display: block;
        margin-bottom: 6px;
      }
    `
  ];

  private section(title: string, items: QueueItem[]) {
    if (items.length === 0) return nothing;
    return html`
      <section>
        <h2><span class="n">${items.length}</span> ${title}</h2>
        <div class="rows">
          ${items.map(
            i => html`
              <a class="row" href=${scenarioHref(i.entry.id, 'compare')}>
                <span class="id">${i.entry.id}</span>
                <span class="why">${i.detail}</span>
              </a>
            `
          )}
        </div>
      </section>
    `;
  }

  render() {
    const queue = buildQueue(corpus);
    const attention = queue.blocked.length + queue.stale.length + queue.neverSeen.length;

    return html`
      <h1>How is the work getting on?</h1>
      <p class="subtitle">
        The queue is derived from committed provenance: <code>status</code> plus the
        <code>verification</code> record in each scenario's <code>meta.json</code>. The workbench
        never writes this state — approvals happen in conversation (<code>/verify</code>), and land
        as git diffs through the harness scripts.
      </p>
      ${attention === 0
        ? html`
            <div class="empty">
              <span class="big">The queue is empty.</span>
              ${queue.currentCount} scenario${queue.currentCount === 1 ? '' : 's'} verified and
              current.
            </div>
          `
        : html`
            ${this.section('blocked — crashed or never rendered', queue.blocked)}
            ${this.section('stale — changed since approval', queue.stale)}
            ${this.section('never seen — awaiting first approval', queue.neverSeen)}
          `}
    `;
  }
}
