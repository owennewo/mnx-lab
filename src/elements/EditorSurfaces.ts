/**
 * The layer the editor's surfaces live in: the rung inspector over the score,
 * wherever the selection is. `bindEditor` creates one inside the container a
 * host gives it and puts the surfaces in it.
 *
 * It exists for one reason. The inspector INHERITS the design system's palette
 * rather than declaring it — in the workbench the tokens come down from the
 * app host, and a `designTokens` block inside the inspector would pin it light
 * (harness/conformance/design-tokens.test.ts holds it to that). A host that is
 * not the workbench declares other tokens or none, so this element is the
 * ancestor that declares them: custom properties inherit through the flat tree,
 * and `light-dark()` follows the page's colour scheme on its own.
 */
import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { designTokens } from './tokens.ts';

@customElement('mnx-editor-surfaces')
export class EditorSurfaces extends LitElement {
  static styles = [designTokens, css`
    :host { position: absolute; inset: 0; z-index: 5; display: block; pointer-events: none; background: none; }
    ::slotted(*) { pointer-events: auto; }
  `];
  render() { return html`<slot></slot>`; }
}

declare global {
  interface HTMLElementTagNameMap { 'mnx-editor-surfaces': EditorSurfaces }
}
