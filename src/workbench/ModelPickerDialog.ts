// The model picker — the selector's query dialog (the picker surface of
// roadmap/complete/core-assist-model-selector.md, incubating in workbench/).
// The criteria widgets ARE the requirements definition wearing controls: the
// effective-price slider is a ceiling on the workload blend, the minimums are
// hard floors, and the ranked list below is selectModels() verbatim — top n,
// best pre-selected. Modeled on CommandPalette's modal idiom.
//
// Catalog policy is snapshot-as-floor: the dialog opens on the committed
// snapshot and only reaches the network when the refresh action is pressed.
// Query params persist per browser (localStorage) — presentation, like the
// theme; the committed roster stays the reviewed default a fresh browser
// starts from.
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { designTokens, sharedChrome, scrollbars } from '../elements/tokens.ts';
import {
  selectModels,
  type ModelRequirements,
  type ScoredModel,
} from '../assist/modelSelect.ts';
import {
  snapshotCatalog,
  fetchLiveCatalog,
  isInteractiveEndpoint,
  SNAPSHOT_FETCHED_AT,
} from '../assist/modelCatalog.ts';
import type { CatalogModel } from '../assist/modelSelect.ts';

const QUERY_KEY = 'mnx-lab.assist-query';
const TOP_N = 10;

/** How many runners-up ride along as the request's fallback chain. The models
 *  ranked BELOW the pick, in order: picking row 3 rejects rows 1–2, so falling
 *  back to 4 is the only reading that respects the choice. Three deep because
 *  a chain is insurance against a rate limit, not a shopping list. */
const FALLBACK_DEPTH = 3;

/** The slider's discrete ceilings, $/Mtok blended; 0 = free-only, last = any.
 *  Logarithmic because price is: each notch roughly 3× the previous. */
const PRICE_STEPS = [0, 0.1, 0.3, 1, 3, 10, 30, Infinity];

/** Floors every query carries regardless of the widgets: the edit loop forces
 *  the update_document tool call, and its documents+schema prompt does not fit
 *  small windows. */
const BASE_REQUIREMENTS: ModelRequirements = {
  requiredParameters: ['tools'],
  minContext: 32768,
};

interface StoredQuery {
  priceStep: number;
  minTps: number;
  minIntelligence: number;
}

const DEFAULT_QUERY: StoredQuery = { priceStep: 4, minTps: 30, minIntelligence: 40 };

function readStoredQuery(): StoredQuery {
  try {
    const raw = localStorage.getItem(QUERY_KEY);
    if (!raw) return DEFAULT_QUERY;
    const parsed = JSON.parse(raw) as Partial<StoredQuery>;
    return {
      priceStep: Math.min(Math.max(Number(parsed.priceStep ?? DEFAULT_QUERY.priceStep), 0), PRICE_STEPS.length - 1),
      minTps: Math.max(Number(parsed.minTps ?? DEFAULT_QUERY.minTps), 0) || 0,
      minIntelligence: Math.max(Number(parsed.minIntelligence ?? DEFAULT_QUERY.minIntelligence), 0) || 0,
    };
  } catch {
    return DEFAULT_QUERY;
  }
}

function priceLabel(step: number): string {
  const v = PRICE_STEPS[step];
  if (v === 0) return 'free';
  if (v === Infinity) return 'any';
  return `≤ $${v}/Mtok`;
}

@customElement('mnx-model-picker')
export class ModelPickerDialog extends LitElement {
  @property({ type: String }) currentModel = '';

  @state() private query: StoredQuery = readStoredQuery();
  @state() private selected = 0;
  @state() private catalog: CatalogModel[] = snapshotCatalog();
  @state() private catalogState: 'snapshot' | 'loading' | 'live' | 'error' = 'snapshot';

  static styles = [
    designTokens,
    sharedChrome,
    scrollbars,
    css`
      :host {
        position: fixed;
        inset: 0;
        z-index: 40;
      }

      .backdrop {
        position: absolute;
        inset: 0;
        background: color-mix(in oklab, var(--bg), transparent 35%);
      }

      .card {
        position: relative;
        margin: 10vh auto 0;
        width: min(640px, calc(100vw - 48px));
        background: var(--surface);
        border: 1px solid var(--line-strong);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow);
        overflow: hidden;
        outline: none;
      }

      .criteria {
        display: grid;
        grid-template-columns: max-content 1fr max-content;
        align-items: center;
        gap: 8px 12px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
      }

      .criteria input[type='range'] {
        width: 100%;
        accent-color: var(--accent);
      }

      .criteria input[type='number'] {
        width: 72px;
        justify-self: start;
        font-family: var(--mono);
        font-size: 12px;
        color: var(--ink);
        background: transparent;
        border: 1px solid var(--line);
        padding: 3px 6px;
        outline: none;
      }

      .crit-val {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-2);
        white-space: nowrap;
      }

      ul {
        list-style: none;
        margin: 0;
        padding: 6px 0;
        max-height: 40vh;
        overflow-y: auto;
      }

      li {
        display: flex;
        align-items: baseline;
        gap: 10px;
        padding: 6px 14px;
        font-size: 12.5px;
        color: var(--ink);
        cursor: pointer;
      }

      li[aria-selected='true'] {
        background: var(--hover);
        color: var(--accent);
      }

      li .meta {
        margin-left: auto;
        font-family: var(--mono);
        font-size: 10px;
        color: var(--ink-3);
        white-space: nowrap;
      }

      li .unknown {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--ink-3);
      }

      .empty {
        padding: 10px 14px 12px;
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-3);
      }

      .foot {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        border-top: 1px solid var(--line);
        font-family: var(--mono);
        font-size: 10px;
        color: var(--ink-3);
      }

      .foot .keys {
        margin-left: auto;
      }

      .foot button {
        font: inherit;
        color: var(--ink-2);
        background: transparent;
        border: 1px solid var(--line);
        padding: 2px 8px;
        cursor: pointer;
      }

      .foot button:hover {
        color: var(--accent);
        border-color: var(--accent);
      }
    `,
  ];

  firstUpdated() {
    this.renderRoot.querySelector<HTMLElement>('.card')?.focus();
  }

  private requirements(): ModelRequirements {
    const ceiling = PRICE_STEPS[this.query.priceStep];
    return {
      ...BASE_REQUIREMENTS,
      ...(ceiling === Infinity ? {} : { maxEffectivePrice: ceiling }),
      ...(this.query.minTps > 0 ? { minTokensPerSecond: this.query.minTps } : {}),
      ...(this.query.minIntelligence > 0 ? { minIntelligence: this.query.minIntelligence } : {}),
    };
  }

  private results(): ScoredModel[] {
    // Batch endpoints are filtered here rather than by a requirement: they are
    // not worse on any dimension, they are answering a different question.
    const offerable = this.catalog.filter(m => isInteractiveEndpoint(m.id));
    return selectModels(this.requirements(), offerable).slice(0, TOP_N);
  }

  private setQuery(patch: Partial<StoredQuery>) {
    this.query = { ...this.query, ...patch };
    this.selected = 0;
    try {
      localStorage.setItem(QUERY_KEY, JSON.stringify(this.query));
    } catch {
      /* private mode — the query just doesn't persist */
    }
  }

  private close() {
    this.dispatchEvent(new CustomEvent('picker-close', { bubbles: true, composed: true }));
  }

  private pick(result: ScoredModel) {
    const ranked = this.results();
    const at = ranked.findIndex(r => r.model.id === result.model.id);
    const fallbacks = ranked
      .slice(at + 1, at + 1 + FALLBACK_DEPTH)
      .map(r => r.model.id);
    this.dispatchEvent(
      new CustomEvent('model-pick', {
        detail: { id: result.model.id, fallbacks },
        bubbles: true,
        composed: true,
      }),
    );
    this.close();
  }

  private async refreshLive() {
    this.catalogState = 'loading';
    try {
      this.catalog = await fetchLiveCatalog();
      this.catalogState = 'live';
    } catch {
      this.catalogState = 'error';
    }
    this.selected = 0;
  }

  private onKey(event: KeyboardEvent) {
    // A modal owns its keystrokes: nothing the dialog sees may reach the
    // page's window-scoped keymap (Escape would also walk the selection
    // ladder; letters would fire shortcuts under the backdrop).
    event.stopPropagation();
    const inField = (event.composedPath()[0] as HTMLElement | undefined)?.tagName === 'INPUT';
    const items = this.results();
    if (event.code === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.code === 'Enter') {
      event.preventDefault();
      const item = items[Math.min(this.selected, items.length - 1)];
      if (item) this.pick(item);
    } else if (!inField && event.code === 'ArrowDown') {
      event.preventDefault();
      this.selected = Math.min(this.selected + 1, Math.max(items.length - 1, 0));
    } else if (!inField && event.code === 'ArrowUp') {
      event.preventDefault();
      this.selected = Math.max(this.selected - 1, 0);
    }
  }

  private catalogStatus(): string {
    switch (this.catalogState) {
      case 'snapshot':
        return `snapshot · ${SNAPSHOT_FETCHED_AT}`;
      case 'loading':
        return 'fetching live catalog…';
      case 'live':
        return `live · ${this.catalog.length} models`;
      case 'error':
        return 'live fetch failed — showing snapshot';
    }
  }

  render() {
    const items = this.results();
    const selected = Math.min(this.selected, Math.max(items.length - 1, 0));
    return html`
      <div class="backdrop" @click=${() => this.close()}></div>
      <div class="card" tabindex="-1" @keydown=${(e: KeyboardEvent) => this.onKey(e)}>
        <div class="criteria">
          <span class="band-label">effective price</span>
          <input
            type="range"
            min="0"
            max=${PRICE_STEPS.length - 1}
            step="1"
            .value=${String(this.query.priceStep)}
            @input=${(e: InputEvent) =>
              this.setQuery({ priceStep: Number((e.target as HTMLInputElement).value) })}
          />
          <span class="crit-val">${priceLabel(this.query.priceStep)}</span>

          <span class="band-label">min tokens/sec</span>
          <input
            type="number"
            min="0"
            step="10"
            .value=${String(this.query.minTps)}
            @input=${(e: InputEvent) =>
              this.setQuery({ minTps: Math.max(Number((e.target as HTMLInputElement).value) || 0, 0) })}
          />
          <span class="crit-val">${this.query.minTps === 0 ? 'no floor' : ''}</span>

          <span class="band-label">min intelligence</span>
          <input
            type="number"
            min="0"
            max="100"
            step="5"
            .value=${String(this.query.minIntelligence)}
            @input=${(e: InputEvent) =>
              this.setQuery({
                minIntelligence: Math.max(Number((e.target as HTMLInputElement).value) || 0, 0),
              })}
          />
          <span class="crit-val">${this.query.minIntelligence === 0 ? 'no floor' : ''}</span>
        </div>
        ${items.length === 0
          ? html`<div class="empty">no model meets these requirements — loosen a criterion</div>`
          : html`
              <ul role="listbox">
                ${items.map(
                  (item, i) => html`
                    <li
                      role="option"
                      aria-selected=${i === selected}
                      @pointerenter=${() => (this.selected = i)}
                      @click=${() => this.pick(item)}
                    >
                      ${item.model.name}
                      ${item.model.id === this.currentModel
                        ? html`<span class="unknown">(current)</span>`
                        : nothing}
                      ${item.flags.length
                        ? html`<span class="unknown" title=${item.flags.join(', ')}>?</span>`
                        : nothing}
                      <span class="meta">
                        ${item.effectivePrice === 0
                          ? 'free'
                          : `$${item.effectivePrice.toFixed(2)}/Mtok`}
                        · ${item.model.tokensPerSecond !== undefined ? `${item.model.tokensPerSecond}t/s` : '?t/s'}
                        · ${item.model.intelligenceIndex !== undefined ? `ii${item.model.intelligenceIndex}` : 'ii?'}
                      </span>
                    </li>
                  `,
                )}
              </ul>
            `}
        <div class="foot">
          <span>${this.catalogStatus()}</span>
          <button @click=${() => this.refreshLive()} ?disabled=${this.catalogState === 'loading'}>
            refresh live
          </button>
          <span class="keys">↑↓ choose · enter select · esc close</span>
        </div>
      </div>
    `;
  }
}
