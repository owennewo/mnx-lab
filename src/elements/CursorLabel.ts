/**
 * The label beside the cursor — roadmap/proposed/core-single-cursor.md rule 8.
 *
 * One short-lived line: *Pass 2* when a move changed the pass or went where the
 * written order does not, *Not played* on a bar no performance reaches, and
 * *Pause to edit* when an edit key is refused during playback. It hangs just
 * above the cursor (or, while the music plays, the playhead) and fades on its
 * own. It is chrome, not a surface: it takes no pointer and no focus.
 *
 * Like the rung inspector it lives in `<mnx-editor-surfaces>` and inherits the
 * palette from there, so it declares no tokens of its own.
 */
import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { OverlayAnchor } from './overlayPlacement.ts';

/** How long a label stays up, in ms — a starting value to tune by hand. */
export const CURSOR_LABEL_MS = 1100;

@customElement('mnx-cursor-label')
export class CursorLabel extends LitElement {
  @property() text = '';
  /** The cursor's box in the overlay's coordinates; null docks the label top-centre. */
  @property({ attribute: false }) anchor: OverlayAnchor | null = null;

  static styles = css`
    :host {
      position: absolute;
      z-index: 31;
      pointer-events: none;
      transform: translate(-50%, -100%);
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--ink);
      color: var(--surface);
      font: 600 12px/1.5 var(--sans);
      white-space: nowrap;
      animation: fade ${CURSOR_LABEL_MS}ms ease-in forwards;
    }
    :host([hidden]) { display: none; }
    @keyframes fade {
      0%, 70% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;

  protected updated() {
    const a = this.anchor;
    this.style.left = a ? `${a.x + a.width / 2}px` : '50%';
    this.style.top = a ? `${Math.max(0, a.y - 6)}px` : '24px';
  }

  /** Show `text` again from the start of its fade. */
  flash(text: string, anchor: OverlayAnchor | null) {
    this.text = text;
    this.anchor = anchor;
    this.hidden = false;
    // Restart the fade: an animation does not replay on a property change.
    this.style.animation = 'none';
    void this.offsetWidth;
    this.style.animation = '';
  }

  render() {
    return html`${this.text}`;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'mnx-cursor-label': CursorLabel }
}
