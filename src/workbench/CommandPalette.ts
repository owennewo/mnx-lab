// The command palette — the workbench's one prompt (survey §8.5, §3.8; the
// same-widget-as-the-rail-filter idea from §6.1). One grammar, two entry
// points: Ctrl+G opens bare (go-to), and its `>` prefix reaches the same
// global command list the tray shows on its `global` tab. The
// component is deliberately dumb: the shell supplies a provider that turns
// the query into runnable items; all routing/intent knowledge stays outside.
// (The AI prompt mode is a separate roadmap item — core-editor-ai-prompt.md.)
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { designTokens, scrollbars } from '../elements/tokens.ts';

export interface PaletteItem {
  label: string;
  /** Right-aligned annotation: a key hint, an id, a category. */
  hint?: string;
  run: () => void;
}

@customElement('mnx-command-palette')
export class CommandPalette extends LitElement {
  @property({ attribute: false }) provider: (query: string) => PaletteItem[] = () => [];
  @property({ type: String }) initialQuery = '';

  @state() private query = '';
  @state() private selected = 0;

  static styles = [
    designTokens,
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
        margin: 12vh auto 0;
        width: min(560px, calc(100vw - 48px));
        background: var(--surface);
        border: 1px solid var(--line-strong);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow);
        overflow: hidden;
      }

      input {
        width: 100%;
        box-sizing: border-box;
        font-family: var(--mono);
        font-size: 13px;
        color: var(--ink);
        background: transparent;
        border: none;
        border-bottom: 1px solid var(--line);
        outline: none;
        padding: 12px 14px;
      }

      ul {
        list-style: none;
        margin: 0;
        padding: 6px 0;
        max-height: 42vh;
        overflow-y: auto;
      }

      li {
        display: flex;
        align-items: baseline;
        gap: 12px;
        padding: 6px 14px;
        font-size: 12.5px;
        color: var(--ink);
        cursor: pointer;
      }

      li[aria-selected='true'] {
        background: var(--hover);
        color: var(--accent);
      }

      li .hint {
        margin-left: auto;
        font-family: var(--mono);
        font-size: 10px;
        color: var(--ink-3);
        white-space: nowrap;
      }

      .empty {
        padding: 10px 14px 12px;
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-3);
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    this.query = this.initialQuery;
  }

  firstUpdated() {
    const input = this.renderRoot.querySelector<HTMLInputElement>('input');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  private close() {
    this.dispatchEvent(new CustomEvent('palette-close', { bubbles: true, composed: true }));
  }

  private runItem(item: PaletteItem) {
    this.close();
    item.run();
  }

  private onKey(event: KeyboardEvent) {
    const items = this.provider(this.query);
    if (event.code === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.code === 'ArrowDown') {
      event.preventDefault();
      this.selected = Math.min(this.selected + 1, Math.max(items.length - 1, 0));
    } else if (event.code === 'ArrowUp') {
      event.preventDefault();
      this.selected = Math.max(this.selected - 1, 0);
    } else if (event.code === 'Enter') {
      event.preventDefault();
      const item = items[Math.min(this.selected, items.length - 1)];
      if (item) this.runItem(item);
    }
  }

  render() {
    const items = this.provider(this.query);
    const selected = Math.min(this.selected, Math.max(items.length - 1, 0));
    return html`
      <div class="backdrop" @click=${() => this.close()}></div>
      <div class="card">
        <input
          .value=${this.query}
          placeholder="type to go to — scenario, bar number, def:<object> · > for commands"
          @input=${(e: InputEvent) => {
            this.query = (e.target as HTMLInputElement).value;
            this.selected = 0;
          }}
          @keydown=${(e: KeyboardEvent) => this.onKey(e)}
        />
        ${items.length === 0
          ? html`<div class="empty">nothing matches</div>`
          : html`
              <ul role="listbox">
                ${items.map(
                  (item, i) => html`
                    <li
                      role="option"
                      aria-selected=${i === selected}
                      @pointerenter=${() => (this.selected = i)}
                      @click=${() => this.runItem(item)}
                    >
                      ${item.label}
                      ${item.hint ? html`<span class="hint">${item.hint}</span>` : nothing}
                    </li>
                  `
                )}
              </ul>
            `}
      </div>
    `;
  }
}
