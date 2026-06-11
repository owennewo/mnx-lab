import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { sharedChrome, scrollbars } from '../styles/tokens.ts';

export interface ChatMessage {
  sender: 'user' | 'assistant' | 'system';
  text: string;
}

// Substring patterns matching model ids that are likely to support image inputs.
// Used only as a warning hint — OpenRouter is the source of truth.
const VISION_MODEL_PATTERNS = [
  'gemini',
  'claude-3', 'claude-4', 'sonnet', 'opus', 'haiku',
  'gpt-4o', 'gpt-4-turbo', 'gpt-4.1', 'gpt-5',
  'o1', 'o3', 'o4',
  'kimi-k2',
  'qwen3',
  'pixtral', 'llava', '-vl', 'vision', 'multimodal'
];

function isLikelyVisionModel(id: string): boolean {
  const lower = id.toLowerCase();
  return VISION_MODEL_PATTERNS.some(p => lower.includes(p));
}

@customElement('mnx-chat-panel')
export class ChatPanel extends LitElement {
  @property({ type: Boolean })
  isProcessing = false;

  @property({ type: Number })
  tokensCount = 0;

  @property({ type: String })
  statusMessage = '';

  @state()
  private messages: ChatMessage[] = [];

  @state()
  private transcripts: any[] = [];

  @state()
  private chatInputValue = '';

  @state()
  private attachedImages: string[] = [];

  @state()
  private isRecording = false;

  @state()
  private isTranscribing = false;

  @state()
  private selectedModel = 'deepseek/deepseek-v4-flash';

  @state()
  private textModels: { id: string; name: string; provider: string }[] = [];

  @state()
  private transcribeModels: { id: string; name: string; provider: string }[] = [];

  @state()
  private selectedTranscribeModel = 'mistralai/voxtral-mini-transcribe';

  @query('textarea')
  textarea!: HTMLTextAreaElement;

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  static styles = [
    sharedChrome,
    scrollbars,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 12px;
        gap: 10px;
        background: var(--surface);
      }

      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: flex-end;
      }

      .message-log {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow-y: auto;
        padding-right: 4px;
      }

      .message {
        max-width: 88%;
        border-radius: 10px;
        padding: 9px 12px;
        font-size: 12.5px;
        line-height: 1.55;
        white-space: pre-wrap;
      }

      .message.user {
        align-self: flex-end;
        background: var(--accent);
        color: oklch(0.98 0 0);
        border-bottom-right-radius: 3px;
      }

      .message.assistant {
        align-self: flex-start;
        background: var(--bg);
        border: 1px solid var(--line);
        border-bottom-left-radius: 3px;
        color: var(--ink-2);
      }

      .message.system {
        align-self: flex-start;
        background: var(--bg);
        border: 1px dashed var(--line);
        color: var(--ink-3);
        max-width: 95%;
      }

      .progress {
        align-self: flex-start;
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-3);
        padding: 4px 2px;
      }

      .suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .sugg {
        font-size: 11px;
        color: var(--accent-fg);
        border: 1px solid color-mix(in oklab, var(--accent-fg), transparent 60%);
        border-radius: 999px;
        padding: 3px 10px;
      }

      .sugg:hover {
        background: color-mix(in oklab, var(--accent), transparent 90%);
      }

      .input-area {
        display: flex;
        flex-direction: column;
        gap: 8px;
        border-top: 1px solid var(--line);
        padding-top: 10px;
      }

      .input-row {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }

      textarea {
        flex: 1;
        resize: none;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--bg);
        padding: 8px 10px;
        font-size: 12.5px;
        outline: none;
        min-height: 36px;
        max-height: 110px;
        line-height: 1.4;
      }

      textarea:focus {
        border-color: var(--accent-fg);
      }

      textarea::placeholder {
        color: var(--ink-3);
      }

      .icon-btn {
        height: 34px;
        width: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--line);
        border-radius: 7px;
        color: var(--ink-2);
        background: var(--surface);
        flex-shrink: 0;
      }

      .icon-btn:hover:not(:disabled) {
        background: var(--hover);
        color: var(--ink);
      }

      .icon-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .send-btn {
        height: 34px;
        padding: 0 14px;
        border-radius: 7px;
        background: var(--accent);
        color: oklch(0.99 0 0);
        font-size: 12.5px;
        flex-shrink: 0;
      }

      .send-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .attachments {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        padding-bottom: 4px;
      }

      .attachment-thumb {
        position: relative;
        width: 56px;
        height: 56px;
        border: 1px solid var(--line);
        border-radius: 6px;
        overflow: hidden;
        background: var(--bg);
      }

      .attachment-thumb img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }

      .attachment-thumb .remove-btn {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--surface);
        border: 1px solid var(--line);
        color: var(--ink);
        font-size: 12px;
        line-height: 1;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .attachment-thumb .remove-btn:hover {
        color: var(--st-gap);
        border-color: var(--st-gap);
      }

      .vision-warning {
        font-size: 11px;
        color: var(--st-valid);
        border: 1px solid color-mix(in oklab, var(--st-valid), transparent 50%);
        padding: 4px 8px;
        border-radius: 4px;
      }

      .input-footer {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .model-selectors {
        display: flex;
        gap: 8px;
        justify-content: space-between;
        flex-wrap: wrap;
      }

      .model-select-group {
        display: flex;
        align-items: center;
        gap: 4px;
        background: var(--bg);
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid var(--line);
        flex: 1;
        min-width: 100px;
      }

      .model-select-label {
        font-family: var(--mono);
        font-size: 9.5px;
        color: var(--ink-3);
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.05em;
        white-space: nowrap;
      }

      .model-selector {
        font-size: 11px;
        color: var(--ink);
        background: transparent;
        border: none;
        outline: none;
        cursor: pointer;
        width: 100%;
        text-overflow: ellipsis;
      }

      .model-selector option {
        background: var(--surface);
        color: var(--ink);
      }

      .recording-pulse {
        animation: record-pulse 1.5s infinite;
        color: var(--st-gap) !important;
      }

      @keyframes record-pulse {
        0%,
        100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.15);
          opacity: 0.75;
        }
      }

      .status-indicators {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        font-family: var(--mono);
        font-size: 10.5px;
      }
    `
  ];

  async connectedCallback() {
    super.connectedCallback();
    const savedTextModel = localStorage.getItem('last-text-model');
    if (savedTextModel) this.selectedModel = savedTextModel;
    const savedTranscribeModel = localStorage.getItem('last-transcribe-model');
    if (savedTranscribeModel) this.selectedTranscribeModel = savedTranscribeModel;
    try {
      const response = await fetch('/api/models');
      if (response.ok) {
        const data = await response.json();
        this.textModels = data.text || [];
        this.transcribeModels = data.transcribe || [];
        // Ensure default values match loaded models if available
        if (this.textModels.length > 0 && !this.textModels.some(m => m.id === this.selectedModel)) {
          this.selectedModel = this.textModels[0].id;
        }
        if (this.transcribeModels.length > 0 && !this.transcribeModels.some(m => m.id === this.selectedTranscribeModel)) {
          this.selectedTranscribeModel = this.transcribeModels[0].id;
        }
      }
    } catch (e) {
      console.error('Failed to load models list', e);
      // Fallback defaults
      this.textModels = [
        { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'DeepSeek' },
        { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'Google' },
        { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic' }
      ];
      this.transcribeModels = [
        { id: 'mistralai/voxtral-mini-transcribe', name: 'Voxtral Mini Transcribe', provider: 'Mistral' }
      ];
    }
  }

  private clearHistory() {
    this.messages = [];
    this.transcripts = [];
  }

  private formatTokens(n: number): string {
    if (n < 1000) return String(n);
    return (n / 1000).toFixed(1) + 'k';
  }

  private formatProgressLabel(): string {
    const status = this.statusMessage || 'thinking...';
    if (this.tokensCount > 0) {
      return `(${status} · ${this.formatTokens(this.tokensCount)} tokens)`;
    }
    return `(${status})`;
  }

  private async copyConversation() {
    if (this.transcripts.length === 0) return;
    await navigator.clipboard.writeText(JSON.stringify(this.transcripts, null, 2));
  }

  // Public method for main app to append a full LLM-exchange transcript
  appendTranscript(entry: any) {
    this.transcripts = [...this.transcripts, entry];
  }

  // Public method for main app to append messages
  appendMessage(sender: 'user' | 'assistant' | 'system', text: string) {
    this.messages = [...this.messages, { sender, text }];
    // Wait for DOM update, then scroll to bottom
    setTimeout(() => {
      const log = this.shadowRoot?.querySelector('.message-log');
      if (log) log.scrollTop = log.scrollHeight;
    }, 50);
  }

  render() {
    return html`
      <div class="header">
        <button
          class="tb-btn"
          title="Copy conversation JSON (raw LLM messages)"
          ?disabled=${this.transcripts.length === 0}
          @click=${this.copyConversation}
        >
          copy transcript
        </button>
        <button
          class="tb-btn"
          title="Clear conversation"
          ?disabled=${this.messages.length === 0 || this.isProcessing}
          @click=${this.clearHistory}
        >
          clear
        </button>
      </div>

      <div class="message-log">
        ${this.messages.map(
          msg => html`
            <div class="message ${msg.sender}">
              ${msg.text}
            </div>
          `
        )}
        ${this.isProcessing
          ? html`<div class="progress">editing document ${this.formatProgressLabel()}</div>`
          : ''}
      </div>

      ${!this.isProcessing && this.messages.length < 2
        ? html`
            <div class="suggestions">
              ${['raise everything a step', 'make the last note flat', 'lower it a third'].map(
                s => html`<button class="sugg" @click=${() => this.applySuggestion(s)}>${s}</button>`
              )}
            </div>
          `
        : ''}

      <div class="input-area">
        ${this.attachedImages.length > 0 ? html`
          <div class="attachments">
            ${this.attachedImages.map((src, i) => html`
              <div class="attachment-thumb">
                <img src=${src} alt="pasted image" />
                <button
                  class="remove-btn"
                  title="Remove image"
                  @click=${() => this.removeAttachment(i)}
                >×</button>
              </div>
            `)}
          </div>
        ` : ''}
        <div class="input-row">
          <textarea
            rows="1"
            placeholder=${this.isTranscribing ? 'Transcribing…' : 'Describe an edit to the sketch…'}
            .value=${this.chatInputValue}
            @input=${(e: any) => this.chatInputValue = e.target.value}
            @keydown=${this.handleKeyDown}
            @paste=${this.handlePaste}
            ?disabled=${this.isProcessing || this.isTranscribing}
          ></textarea>

          <button
            class="icon-btn"
            title="Dictate an edit"
            @click=${this.toggleRecording}
            ?disabled=${this.isProcessing || this.isTranscribing}
          >
            <wa-icon
              name="mic-fill"
              class=${this.isRecording ? 'recording-pulse' : ''}
            ></wa-icon>
          </button>

          <button
            class="send-btn"
            @click=${this.handleSubmit}
            ?disabled=${(!this.chatInputValue.trim() && this.attachedImages.length === 0) || this.isProcessing || this.isTranscribing}
          >
            Send
          </button>
        </div>

        <div class="input-footer">
          <div class="model-selectors">
            <div class="model-select-group">
              <span class="model-select-label">Edit:</span>
              <select
                class="model-selector"
                @change=${(e: any) => {
                  this.selectedModel = e.target.value;
                  localStorage.setItem('last-text-model', e.target.value);
                }}
              >
                ${this.textModels.map(m => html`
                  <option value=${m.id} ?selected=${m.id === this.selectedModel}>${m.name} (${m.provider})</option>
                `)}
              </select>
            </div>
            <div class="model-select-group">
              <span class="model-select-label">Audio:</span>
              <select
                class="model-selector"
                @change=${(e: any) => {
                  this.selectedTranscribeModel = e.target.value;
                  localStorage.setItem('last-transcribe-model', e.target.value);
                }}
              >
                ${this.transcribeModels.map(m => html`
                  <option value=${m.id} ?selected=${m.id === this.selectedTranscribeModel}>${m.name} (${m.provider})</option>
                `)}
              </select>
            </div>
          </div>

          ${this.attachedImages.length > 0 && !isLikelyVisionModel(this.selectedModel) ? html`
            <div class="vision-warning">
              ⚠ <strong>${this.selectedModel}</strong> may not support image input — your attached image will likely be ignored. Try a Gemini, Claude, or GPT-4o model.
            </div>
          ` : ''}

          ${this.isRecording || this.isTranscribing ? html`
            <div class="status-indicators">
              ${this.isRecording ? html`<span style="color: var(--st-gap);">recording…</span>` : ''}
              ${this.isTranscribing ? html`<span style="color: var(--accent-fg);">transcribing…</span>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private applySuggestion(suggestion: string) {
    this.chatInputValue = suggestion;
    if (this.textarea) this.textarea.focus();
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.handleSubmit();
    }
  }

  private handleSubmit() {
    const text = this.chatInputValue.trim();
    const images = this.attachedImages;
    if (!text && images.length === 0) return;
    if (this.isProcessing) return;

    this.chatInputValue = '';
    this.attachedImages = [];
    const previewText = images.length > 0
      ? `${text || '(no text)'}  [${images.length} image${images.length === 1 ? '' : 's'} attached]`
      : text;
    this.appendMessage('user', previewText);

    this.dispatchEvent(
      new CustomEvent('chat-command-submitted', {
        detail: {
          prompt: text,
          model: this.selectedModel,
          attachedImages: images
        },
        bubbles: true,
        composed: true
      })
    );
  }

  private handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItems = Array.from(items).filter(
      i => i.kind === 'file' && i.type.startsWith('image/')
    );
    if (imageItems.length === 0) return;
    e.preventDefault();
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          this.attachedImages = [...this.attachedImages, reader.result];
        }
      };
      reader.readAsDataURL(file);
    }
  }

  private removeAttachment(index: number) {
    this.attachedImages = this.attachedImages.filter((_, i) => i !== index);
  }

  private async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };
      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        await this.transcribeAudio(audioBlob);
      };
      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (err) {
      console.error('Failed to start audio recording', err);
    }
  }

  private stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  private async transcribeAudio(blob: Blob) {
    this.isTranscribing = true;
    try {
      const formData = new FormData();
      formData.append('file', blob, 'voice.webm');
      formData.append('model', this.selectedTranscribeModel);

      const response = await fetch('/api/voice-transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        if (data.text) {
          this.chatInputValue = data.text;
          if (this.textarea) this.textarea.focus();
        }
      } else {
        console.error('Voice transcription server error:', data.error);
      }
    } catch (e) {
      console.error('Failed to transcribe voice audio', e);
    } finally {
      this.isTranscribing = false;
    }
  }
}
export default ChatPanel;
