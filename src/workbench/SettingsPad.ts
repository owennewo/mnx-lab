import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { designTokens, sharedChrome } from '../elements/tokens.ts';
import type { ViewMode } from '../elements/DocumentViewer.ts';

/**
 * The document settings pad — third mark in the score-corner cluster, beside
 * the focus toggle and the zoom pad. A 26px gear that opens a small card of
 * document-display settings; today that card holds one row, SHOW —
 * notation | tab | both — which replaced the page-head view tabs, and it is
 * expected to grow more rows over time.
 *
 * **This is chrome, not surface** (docs/core-viewer-surface.md): the pad owns
 * no view state. The current view and the views a document can support come in
 * as properties, and each option is a real `<a>` to the href the host computes
 * (`hrefFor`), so the URL stays the single writer of the view — exactly the
 * contract the retired head tabs had, moved over the score. Living in the
 * cluster rather than the page head also keeps view switching reachable in
 * document focus, which the head tabs never were (the head is removed there).
 *
 * Poses follow the cluster's grammar: idle it is a quiet 26px mark (opacity
 * 0.55, like the focus toggle beside it), and hover/focus opens the card —
 * the same enter-to-open, leave-to-close contract as the zoom pad, so the two
 * neighbours feel like one control family. The card hangs from the mark on a
 * transparent bridge (`.drop`'s padding) so the pointer can cross the gap
 * without the whole thing closing underneath it.
 */
/** The full view vocabulary, in display order — what the SHOW row prints
 *  regardless of what this document can offer. */
const ALL_VIEWS: readonly ViewMode[] = ['notation', 'tab', 'both'];

@customElement('mnx-settings-pad')
export class SettingsPad extends LitElement {
  /** The view the score is drawing now. */
  @property({ type: String }) view: ViewMode = 'notation';

  /** The views this document can support — ['notation'] when no strings are
   *  known, all three otherwise. The host decides; the pad only renders.
   *  The SHOW row always prints all three: an unavailable view draws greyed
   *  with the reason in its tooltip, because a row holding a single live
   *  option reads as a broken control rather than as "this document has no
   *  fingerboard" — the fact the grey options exist to teach. */
  @property({ attribute: false }) views: ViewMode[] = ['notation'];

  /** Href for a view option, from whoever owns the routing. Options render as
   *  plain links so deep links, middle-click and history all keep working. */
  @property({ attribute: false }) hrefFor: ((view: ViewMode) => string) | null = null;

  @state() private open = false;

  static styles = [
    designTokens,
    sharedChrome,
    css`
      :host {
        display: block;
        position: relative;
        font-family: var(--sans);
      }

      /* The mark: same square as the focus toggle it sits beside. */
      button.gear {
        appearance: none;
        box-sizing: border-box;
        width: 26px;
        height: 26px;
        margin: 0;
        padding: 0;
        border: var(--rule-w) solid var(--line);
        border-radius: var(--radius-control);
        display: grid;
        place-items: center;
        background: var(--surface);
        color: var(--ink);
        opacity: 0.55;
        cursor: pointer;
        box-shadow: 0 2px 4px var(--shadow-far);
        transition:
          opacity 0.12s ease,
          color 0.12s ease,
          border-color 0.12s ease,
          background-color 0.12s ease;
      }

      :host([data-open]) button.gear,
      button.gear:hover,
      button.gear:focus-visible {
        opacity: 1;
        color: var(--accent);
        background: var(--row-current);
      }

      button.gear:focus-visible {
        outline: var(--rule-w) solid var(--focus-ring);
        outline-offset: 2px;
      }

      button.gear svg {
        display: block;
      }

      /* The transparent bridge between the mark and the card: part of the
         host's hit area, so crossing it does not fire pointerleave and close
         the card mid-journey. */
      .drop {
        position: absolute;
        top: 100%;
        right: 0;
        padding-top: 6px;
        z-index: 4;
      }

      .card {
        box-sizing: border-box;
        min-width: max-content;
        background: var(--surface);
        border: var(--rule-w) solid var(--ink);
        border-radius: var(--radius-card);
        box-shadow: 0 2px 4px var(--shadow-far), 0 12px 30px var(--shadow-far);
        padding: 8px 10px;
      }

      .setting {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .setting .lbl {
        font: 600 8px/1 var(--sans);
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--ink-2);
      }

      /* The options keep the retired head tabs' vocabulary — uppercase 600,
         tracked, active marked by a 2px underline rather than a box — at the
         card's smaller scale. */
      .options {
        display: flex;
        align-items: stretch;
      }

      .options a {
        font: 600 10px/1 var(--sans);
        letter-spacing: 0.11em;
        text-transform: uppercase;
        color: var(--ink-3);
        padding: 6px 8px;
        text-decoration: none;
        white-space: nowrap;
      }

      .options a:hover {
        text-decoration: none;
      }

      .options a:hover[aria-current='false'] {
        color: var(--ink);
        background: var(--bg-context);
      }

      .options a[aria-current='true'] {
        color: var(--accent-fg);
        box-shadow: inset 0 -2px 0 var(--accent);
      }

      .options a:focus-visible {
        outline: var(--rule-w) solid var(--focus-ring);
        outline-offset: -2px;
      }

      /* A view this document cannot offer: same slot, greyed, the reason in
         its tooltip. Not display:none — absence reads as a broken control,
         grey reads as "possible, not here". */
      .options .off {
        font: 600 10px/1 var(--sans);
        letter-spacing: 0.11em;
        text-transform: uppercase;
        color: var(--ink-faint);
        padding: 6px 8px;
        white-space: nowrap;
        cursor: help;
      }

      @media (prefers-reduced-motion: reduce) {
        button.gear {
          transition: none;
        }
      }
    `
  ];

  private gearGlyph() {
    // Eight teeth as a dashed stroke ring over the wheel — drawn, like every
    // glyph in this cluster, not imported. Dash+gap ≈ 2πr/8 keeps the teeth
    // even all the way round.
    return svg`
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="12" cy="12" r="8"
          fill="none" stroke="currentColor" stroke-width="3.4"
          stroke-dasharray="3.14 3.14" stroke-dashoffset="1.57"
        ></circle>
        <circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6"></circle>
        <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"></circle>
      </svg>
    `;
  }

  updated() {
    this.toggleAttribute('data-open', this.open);
  }

  render() {
    return html`
      <div
        @pointerenter=${() => (this.open = true)}
        @pointerleave=${() => (this.open = false)}
        @focusin=${() => (this.open = true)}
        @focusout=${() => (this.open = false)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Escape') this.open = false;
        }}
      >
        <button
          class="gear"
          title="Document settings"
          aria-label="Document settings"
          aria-expanded=${this.open}
          @click=${() => (this.open = true)}
        >
          ${this.gearGlyph()}
        </button>
        ${this.open
          ? html`
              <div class="drop">
                <div class="card">
                  <div class="setting">
                    <span class="lbl">Show</span>
                    <span class="options">
                      ${ALL_VIEWS.map(v =>
                        this.views.includes(v)
                          ? html`
                              <a
                                href=${this.hrefFor?.(v) ?? '#'}
                                aria-current=${v === this.view}
                              >${v}</a>
                            `
                          : html`
                              <span
                                class="off"
                                title="Needs known strings — declare strings[] in the document, or set a part's instrument override in the HUD"
                                aria-disabled="true"
                              >${v}</span>
                            `
                      )}
                    </span>
                  </div>
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-settings-pad': SettingsPad;
  }
}
