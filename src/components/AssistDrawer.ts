import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ChatPanel } from './ChatPanel.ts';
import { sharedChrome, scrollbars } from '../styles/tokens.ts';
import './ChatPanel.ts';

/**
 * The Assist drawer — AI editing, demoted to context (DIRECTION.md §6).
 * Corpus documents are read-only: with a scenario open the drawer offers
 * "fork to a sketch" instead of a chat box; only a sketch (a transient
 * editable copy) gets the chat panel. Chat can therefore never mutate the
 * corpus — the same invariant the old Library toggle enforced.
 */
@customElement('mnx-assist-drawer')
export class AssistDrawer extends LitElement {
  /** Title of the open scenario, or null when nothing is selected. */
  @property({ type: String }) scenarioTitle: string | null = null;
  /** Whether the open scenario renders (a non-rendering exhibit can't fork). */
  @property({ type: Boolean }) canFork = false;
  @property({ type: Boolean }) isSketch = false;

  /** The inner chat panel, for the app's imperative streaming updates. */
  get chatPanel(): ChatPanel | null {
    return this.shadowRoot?.querySelector('mnx-chat-panel') ?? null;
  }

  static styles = [
    sharedChrome,
    scrollbars,
    css`
      :host {
        position: fixed;
        top: var(--header-h);
        bottom: var(--footer-h);
        right: 0;
        z-index: 30;
      }

      .drawer-veil {
        position: fixed;
        inset: var(--header-h) 0 var(--footer-h) 0;
        background: oklch(0 0 0 / 0.12);
      }

      .drawer {
        position: fixed;
        top: var(--header-h);
        bottom: var(--footer-h);
        right: 0;
        width: 392px;
        max-width: 96vw;
        background: var(--surface);
        border-left: 1px solid var(--line);
        box-shadow: var(--drawer-shadow);
        display: flex;
        flex-direction: column;
      }

      .drawer-hdr {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 13px 16px;
        border-bottom: 1px solid var(--line);
      }

      .drawer-hdr .dh-t {
        font-weight: 600;
        font-size: 13.5px;
      }

      .drawer-hdr .dh-sub {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--ink-3);
        white-space: nowrap;
      }

      .drawer-hdr .dh-x {
        margin-left: auto;
      }

      .drawer-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 0;
      }

      .drawer-body.chat {
        padding: 0;
        overflow: hidden;
      }

      .exhibit-note {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 14px 16px;
        background: var(--bg);
      }

      .exhibit-note h4 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12.5px;
        margin: 0 0 7px;
      }

      .exhibit-note p {
        font-size: 12px;
        line-height: 1.6;
        color: var(--ink-2);
        margin: 0 0 8px;
        text-wrap: pretty;
      }

      .exhibit-note p:last-child {
        margin-bottom: 0;
      }

      .fork-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        height: 34px;
        border-radius: 7px;
        background: var(--accent);
        color: oklch(0.99 0 0);
        font-size: 12.5px;
        font-weight: 500;
        width: 100%;
      }

      .fork-btn:hover {
        filter: brightness(1.08);
      }

      .downstream-note {
        font-size: 11px;
        color: var(--ink-3);
        line-height: 1.55;
      }

      mnx-chat-panel {
        flex: 1;
        min-height: 0;
      }
    `
  ];

  render() {
    return html`
      <div class="drawer-veil" @click=${this.emitClose}></div>
      <div class="drawer">
        <div class="drawer-hdr">
          <div>
            <div class="dh-t">Assist</div>
            <div class="dh-sub">AI edit · downstream · sketches only</div>
          </div>
          <button class="tb-btn dh-x" @click=${this.emitClose}>close</button>
        </div>
        ${this.isSketch
          ? html`
              <div class="drawer-body chat">
                <mnx-chat-panel></mnx-chat-panel>
              </div>
            `
          : html`
              <div class="drawer-body">
                <div class="exhibit-note">
                  <h4><span class="gapdia"></span>Corpus documents are read-only</h4>
                  <p>
                    ${this.scenarioTitle
                      ? html`<b>${this.scenarioTitle}</b> is a library exhibit — chat edits can
                          never target the corpus. Fork it to a sketch to experiment; the scenario
                          stays untouched.`
                      : 'Select a scenario first, then fork it to an editable sketch.'}
                  </p>
                  ${this.scenarioTitle && this.canFork
                    ? html`<button class="fork-btn" @click=${this.emitFork}>Fork to a sketch →</button>`
                    : this.scenarioTitle
                      ? html`<p>This exhibit doesn’t render — nothing to sketch from yet.</p>`
                      : nothing}
                </div>
                <p class="downstream-note">
                  Editing and AI are deliberately downstream (vision §goals 6–7): they assume the
                  renderer is already trustworthy. The assist loop is a pure function of the
                  document — it proposes a new MNX document; everything re-derives from it.
                </p>
              </div>
            `}
      </div>
    `;
  }

  private emitFork() {
    this.dispatchEvent(new CustomEvent('fork-requested', { bubbles: true, composed: true }));
  }

  private emitClose() {
    this.dispatchEvent(new CustomEvent('drawer-closed', { bubbles: true, composed: true }));
  }
}

export default AssistDrawer;
