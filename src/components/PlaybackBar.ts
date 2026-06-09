import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { playbackStateContext } from '../contexts/mnxContext.ts';
import type { PlaybackState } from '../contexts/mnxContext.ts';

@customElement('mnx-playback-bar')
export class PlaybackBar extends LitElement {
  @consume({ context: playbackStateContext, subscribe: true })
  @property({ attribute: false })
  playbackState!: PlaybackState;

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 6px 16px;
      background: oklch(0.2 0.02 256 / 0.45);
      border-radius: 20px;
      border: 1px solid var(--border-color);
      box-shadow: inset 0 1px 1px oklch(1 0 0 / 0.1);
    }
    
    .slider-container {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    wa-slider {
      width: 90px;
      --track-color-active: var(--primary-glow);
      --track-color-inactive: oklch(0.28 0.02 256 / 0.5);
    }

    .tempo-val, .vol-val {
      width: 52px;
      text-align: right;
      font-family: var(--font-family-mono);
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .divider {
      width: 1px;
      height: 20px;
      background: var(--border-color);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: oklch(0.4 0 0);
      box-shadow: 0 0 4px oklch(0.4 0 0 / 0.5);
      transition: background 0.3s, box-shadow 0.3s;
    }

    .status-dot.active {
      background: oklch(0.75 0.18 150); /* green */
      box-shadow: 0 0 10px oklch(0.75 0.18 150 / 0.8);
      animation: pulse-glow 2s infinite;
    }
  `;

  render() {
    const isPlaying = this.playbackState?.playing ?? false;
    const tempo = this.playbackState?.tempo ?? 120;
    const volume = this.playbackState?.volume ?? -10;

    return html`
      <wa-button 
        circle 
        size="small" 
        variant=${isPlaying ? 'warning' : 'neutral'}
        @click=${this.handlePlayClick}
      >
        <wa-icon name=${isPlaying ? 'pause-fill' : 'play-fill'}></wa-icon>
      </wa-button>

      <wa-button 
        circle 
        size="small" 
        variant="neutral"
        @click=${this.handleStopClick}
      >
        <wa-icon name="stop-fill"></wa-icon>
      </wa-button>

      <div class="divider"></div>

      <div class="slider-container">
        <span>Tempo</span>
        <wa-slider
          min="50"
          max="220"
          value=${tempo}
          @wa-input=${this.handleTempoInput}
        ></wa-slider>
        <span class="tempo-val">${tempo} bpm</span>
      </div>

      <div class="divider"></div>

      <div class="slider-container">
        <span>Volume</span>
        <wa-slider
          min="-35"
          max="0"
          value=${volume}
          @wa-input=${this.handleVolumeInput}
        ></wa-slider>
        <span class="vol-val">${volume} dB</span>
      </div>

      <div class="divider"></div>

      <div class="status-dot ${isPlaying ? 'active' : ''}"></div>
    `;
  }

  private handlePlayClick() {
    this.dispatchEvent(new CustomEvent('play-toggled', { bubbles: true, composed: true }));
  }

  private handleStopClick() {
    this.dispatchEvent(new CustomEvent('stop-requested', { bubbles: true, composed: true }));
  }

  private handleTempoInput(e: any) {
    const bpm = Number(e.target.value);
    this.dispatchEvent(new CustomEvent('tempo-changed', {
      detail: { bpm },
      bubbles: true,
      composed: true
    }));
  }

  private handleVolumeInput(e: any) {
    const volume = Number(e.target.value);
    this.dispatchEvent(new CustomEvent('volume-changed', {
      detail: { volume },
      bubbles: true,
      composed: true
    }));
  }
}
export default PlaybackBar;
