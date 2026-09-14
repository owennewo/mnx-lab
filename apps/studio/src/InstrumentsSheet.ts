// The Instruments sheet on a piece: one row per part, with the eye (take it off
// the score, it keeps playing), the speaker (mute it in the mix), its sound and
// its level beneath the tray's master volume. From the Instruments Panel design
// canvas (2026-09-14). It owns nothing: every change leaves as an event for the
// page to store and hand to the viewer and the player.
import { LitElement, css, html, nothing, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SAMPLE_PRESETS, type VoicePreset } from '../../../src/audio/sampleSelection.ts';
import type { PartMix, PartMixEntry } from '../../../src/audio/partMix.ts';

export interface InstrumentPart {
  /** The part's index in the document. */
  index: number;
  name: string;
  /** The sub-line: strings and capo, or "Percussion". */
  detail: string;
  /** Plays only kit voices, which always use the synth. */
  kit: boolean;
}

const SOUNDS: { id: VoicePreset; label: string }[] = [{ id: 'synth', label: 'Synth' }, ...SAMPLE_PRESETS];

const line = (d: string, px = 18) => svg`<svg width=${px} height=${px} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${d}></path></svg>`;
const cross = html`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;
const eye = (off: boolean) => svg`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>${off ? svg`<path d="M4 4l16 16"></path>` : nothing}</svg>`;
const speaker = (muted: boolean) => svg`<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"></path><path d=${muted ? 'M16 9l5 6M21 9l-5 6' : 'M16 9a4 4 0 0 1 0 6'} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const wave = line('M3 12h2l2-6 3 12 3-9 2 5 2-2h4', 16);

@customElement('mnx-studio-instruments')
export class InstrumentsSheet extends LitElement {
  @property({ attribute: false }) parts: readonly InstrumentPart[] = [];
  /** Part indices off the score (not `hidden`, which every element already owns). */
  @property({ attribute: false }) hiddenParts: readonly number[] = [];
  @property({ attribute: false }) mix: PartMix = {};
  /** False while a recording plays: it has no parts to mix. */
  @property({ type: Boolean }) mixAvailable = true;
  /** The recording playing, named in the notice when the mix is unavailable. */
  @property() sourceName = '';

  static styles = css`
    :host { box-sizing: border-box; display: flex; flex-direction: column; width: 380px; max-width: 100%; height: 100%; border-left: 1px solid var(--line); background: light-dark(oklch(0.975 0.003 60), oklch(0.205 0.004 60)); color: var(--ink); overflow: auto; }
    header { display: flex; align-items: center; gap: 10px; padding: 14px 18px 10px; }
    header b { font-weight: 600; font-size: 15px; flex: 1; }
    button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 3px; cursor: pointer; }
    button.plain { border: 0; padding: 4px; color: var(--ink-dim); display: inline-flex; }
    button:disabled { opacity: 0.4; cursor: default; }
    button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    section { padding: 4px 18px 14px; display: flex; flex-direction: column; gap: 8px; }
    .label { display: flex; align-items: baseline; gap: 8px; color: var(--ink-dim); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .label small { font-weight: 400; text-transform: none; letter-spacing: 0; }
    .notice { font-size: 13px; line-height: 1.5; padding: 10px; background: light-dark(#efeeeb, #343330); }
    .part { display: flex; flex-direction: column; gap: 10px; padding: 12px 0; border-bottom: 1px solid light-dark(oklch(0.9 0.003 60), oklch(0.27 0.004 60)); }
    .part:last-child { border-bottom: 0; }
    .top, .mix { display: flex; align-items: center; gap: 12px; }
    .mix { padding-left: 48px; }
    .square { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; flex: none; color: var(--ink-dim); }
    .square[aria-pressed='true'] { background: light-dark(oklch(0.9 0.004 60), oklch(0.26 0.006 60)); border-color: var(--ink-3); color: var(--ink); }
    .name { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .name b { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .name span { font-size: 12px; color: var(--ink-dim); }
    .off .name b { color: var(--ink-3); }
    .sound { display: inline-flex; align-items: center; gap: 6px; width: 168px; height: 32px; box-sizing: border-box; padding: 0 0 0 8px; border: 1px solid var(--line); border-radius: 3px; font-size: 13px; flex: none; color: var(--ink-3); }
    .sound select { flex: 1; min-width: 0; height: 100%; font: inherit; color: var(--ink); background: transparent; border: 0; padding: 0 4px 0 0; cursor: pointer; }
    .sound select option { color: var(--ink); background-color: var(--surface); }
    .sound .fixed { flex: 1; color: var(--ink); }
    .sound.disabled { opacity: 0.45; }
    input[type='range'] { flex: 1 1 auto; min-width: 0; margin: 0; accent-color: var(--accent); }
    .val { font: 500 12px/1 ui-monospace, 'SF Mono', Menlo, monospace; font-variant-numeric: tabular-nums; color: var(--ink-3); width: 3ch; text-align: right; flex: none; }
  `;

  private setMix(index: number, change: Partial<PartMixEntry>) {
    const next: PartMix = { ...this.mix, [index]: { ...this.mix[index], ...change } };
    this.dispatchEvent(new CustomEvent<PartMix>('mix-change', { detail: next, bubbles: true, composed: true }));
  }

  private toggleHidden(index: number) {
    const next = this.hiddenParts.includes(index) ? this.hiddenParts.filter((i) => i !== index) : [...this.hiddenParts, index];
    this.dispatchEvent(new CustomEvent<number[]>('hidden-change', { detail: next, bubbles: true, composed: true }));
  }

  private row(part: InstrumentPart, visibleCount: number) {
    const hidden = this.hiddenParts.includes(part.index);
    const entry = this.mix[part.index] ?? {};
    const muted = entry.muted ?? false;
    const volume = Math.round((entry.volume ?? 1) * 100);
    const lastVisible = !hidden && visibleCount === 1;
    const off = !this.mixAvailable;
    return html`<div class=${hidden ? 'part off' : 'part'} role="group" aria-label=${part.name}>
      <div class="top">
        <button class="square" type="button" aria-pressed=${hidden} ?disabled=${lastVisible}
          aria-label=${hidden ? `Show ${part.name} on the score` : `Hide ${part.name} from the score`}
          title=${lastVisible ? 'One part stays on the score' : hidden ? 'Show on the score' : 'Hide from the score'}
          @click=${() => this.toggleHidden(part.index)}>${eye(hidden)}</button>
        <div class="name"><b>${part.name}</b><span>${hidden ? 'Hidden · still plays' : part.detail}</span></div>
        <button class="square" type="button" aria-pressed=${muted} ?disabled=${off}
          aria-label=${muted ? `Unmute ${part.name}` : `Mute ${part.name}`} title=${muted ? 'Unmute' : 'Mute'}
          @click=${() => this.setMix(part.index, { muted: !muted })}>${speaker(muted)}</button>
      </div>
      <div class="mix">
        ${part.kit
          ? html`<span class=${off ? 'sound disabled' : 'sound'} title="Percussion always plays the synth kit">${wave}<span class="fixed">Kit · Synth</span></span>`
          : html`<label class=${off ? 'sound disabled' : 'sound'} title="Sound">${wave}<select aria-label=${`${part.name} sound`} ?disabled=${off}
              @change=${(e: Event) => this.setMix(part.index, { sound: (e.target as HTMLSelectElement).value as VoicePreset })}>
              ${SOUNDS.map((s) => html`<option value=${s.id} ?selected=${(entry.sound ?? 'synth') === s.id}>${s.label}</option>`)}
            </select></label>`}
        <input type="range" min="0" max="1" step="0.05" aria-label=${`${part.name} volume`} ?disabled=${off || muted}
          .value=${String(entry.volume ?? 1)}
          @input=${(e: Event) => this.setMix(part.index, { volume: Number((e.target as HTMLInputElement).value) })} />
        <span class="val">${muted ? '—' : volume}</span>
      </div>
    </div>`;
  }

  render() {
    const visibleCount = this.parts.filter((p) => !this.hiddenParts.includes(p.index)).length;
    return html`
      <header><b>Instruments</b><button class="plain" type="button" aria-label="Close instruments" @click=${() => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))}>${cross}</button></header>
      <section>
        ${this.mixAvailable
          ? nothing
          : html`<div class="notice" role="status">Playing ${this.sourceName ? html`<b>${this.sourceName}</b>` : 'a recording'}. A recording has no separate parts, so sound, volume and mute apply when the source is Synth. Hiding still works.</div>`}
        <div class="label"><span>Parts</span><small>the eye hides from the score, the speaker mutes the mix</small></div>
        <div>${this.parts.map((part) => this.row(part, visibleCount))}</div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-studio-instruments': InstrumentsSheet;
  }
}
