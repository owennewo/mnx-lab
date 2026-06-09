import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';

export interface ChatMessage {
  sender: 'user' | 'assistant' | 'system';
  text: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  sender: 'system',
  text: 'Welcome to MNX Editor AI Assistant. Ask me to edit notes, transpose, add chords, or transform notation.'
};

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
  private messages: ChatMessage[] = [WELCOME_MESSAGE];

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

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-sidebar);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border-right: 1px solid var(--border-color);
      padding: 16px;
      gap: 16px;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 12px;
    }

    .header wa-icon {
      color: var(--primary-glow);
    }

    .message-log {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .message {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 0.9rem;
      line-height: 1.4;
      animation: fadeIn 0.25s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message.user {
      align-self: flex-end;
      background: var(--primary-glow);
      color: oklch(0.98 0 0);
      border-bottom-right-radius: 2px;
    }

    .message.assistant {
      align-self: flex-start;
      background: oklch(0.22 0.02 256);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-bottom-left-radius: 2px;
    }

    .message.system {
      align-self: center;
      background: oklch(0.18 0.02 256 / 0.4);
      color: var(--text-muted);
      border: 1px dashed var(--border-color);
      font-style: italic;
      text-align: center;
      max-width: 95%;
    }

    .suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .suggestions wa-button {
      --wa-button-font-size-small: 0.76rem;
      --wa-button-padding-small: 4px 10px;
    }

    .input-area {
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: oklch(0.18 0.02 256 / 0.6);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 8px;
    }

    .input-row {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }

    textarea {
      flex: 1;
      height: 60px;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-family: var(--font-family-sans);
      font-size: 0.9rem;
      resize: none;
      outline: none;
      padding: 4px;
    }

    textarea::placeholder {
      color: var(--text-muted);
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
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
      background: oklch(0.22 0.02 256 / 0.6);
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
      background: oklch(0.10 0.02 256 / 0.9);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      font-size: 12px;
      line-height: 1;
      padding: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .attachment-thumb .remove-btn:hover {
      background: oklch(0.6 0.18 20);
    }

    .vision-warning {
      font-size: 0.72rem;
      color: oklch(0.78 0.14 60);
      background: oklch(0.25 0.06 60 / 0.35);
      border: 1px solid oklch(0.45 0.10 60 / 0.5);
      padding: 4px 8px;
      border-radius: 4px;
      margin-top: 6px;
    }

    .message {
      white-space: pre-wrap;
    }

    .input-footer {
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-top: 1px solid var(--border-color);
      padding-top: 8px;
    }

    .model-selectors {
      display: flex;
      gap: 12px;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .model-select-group {
      display: flex;
      align-items: center;
      gap: 4px;
      background: oklch(0.22 0.02 256 / 0.5);
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      flex: 1;
      min-width: 100px;
    }

    .model-select-label {
      font-size: 0.68rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }

    .model-selector {
      font-size: 0.72rem;
      color: var(--text-primary);
      background: transparent;
      border: none;
      outline: none;
      cursor: pointer;
      width: 100%;
      text-overflow: ellipsis;
    }

    .model-selector option {
      background: var(--bg-app);
      color: var(--text-primary);
    }

    .recording-pulse {
      animation: record-pulse-glow 1.5s infinite;
      color: oklch(0.6 0.18 20) !important;
    }

    @keyframes record-pulse-glow {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.15); opacity: 0.75; }
    }
  `;

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
    this.messages = [WELCOME_MESSAGE];
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
        <wa-icon name="chat-square-dots-fill"></wa-icon>
        <span>AI Music Assistant</span>
        <wa-button
          circle
          size="small"
          variant="neutral"
          style="margin-left: auto;"
          title="Copy conversation JSON (raw LLM messages)"
          ?disabled=${this.transcripts.length === 0}
          @click=${this.copyConversation}
        >
          <wa-icon name="clipboard"></wa-icon>
        </wa-button>
        <wa-button
          circle
          size="small"
          variant="neutral"
          title="Clear conversation"
          ?disabled=${this.messages.length <= 1 || this.isProcessing}
          @click=${this.clearHistory}
        >
          <wa-icon name="arrow-counterclockwise"></wa-icon>
        </wa-button>
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
          ? html`
              <div class="message assistant" style="display: flex; align-items: center; gap: 8px;">
                <wa-spinner style="font-size: 1rem;"></wa-spinner>
                <span>
                  Editing notation...
                  <span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 4px;">
                    ${this.formatProgressLabel()}
                  </span>
                </span>
              </div>
            `
          : ''}
      </div>

      <div class="suggestions">
        <wa-button size="small" variant="neutral" pill @click=${() => this.applySuggestion('Transpose up 2 semitones')}>
          Transpose Up Step
        </wa-button>
        <wa-button size="small" variant="neutral" pill @click=${() => this.applySuggestion('Make the last measure a whole note E3')}>
          Set E3 Ending
        </wa-button>
        <wa-button size="small" variant="neutral" pill @click=${() => this.applySuggestion('Double the length of the scale by appending octave 4 scale')}>
          Add Octave
        </wa-button>
      </div>

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
            placeholder=${this.isTranscribing ? 'Transcribing...' : 'Ask AI to edit notation... (paste images to attach)'}
            .value=${this.chatInputValue}
            @input=${(e: any) => this.chatInputValue = e.target.value}
            @keydown=${this.handleKeyDown}
            @paste=${this.handlePaste}
            ?disabled=${this.isProcessing || this.isTranscribing}
          ></textarea>

          <wa-button
            circle
            size="small"
            variant="neutral"
            @click=${this.toggleRecording}
            ?disabled=${this.isProcessing || this.isTranscribing}
          >
            <wa-icon 
              name="mic-fill" 
              class=${this.isRecording ? 'recording-pulse' : ''}
            ></wa-icon>
          </wa-button>

          <wa-button
            circle
            size="small"
            variant="brand"
            @click=${this.handleSubmit}
            ?disabled=${(!this.chatInputValue.trim() && this.attachedImages.length === 0) || this.isProcessing || this.isTranscribing}
          >
            <wa-icon name="send-fill"></wa-icon>
          </wa-button>
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
            <div class="status-indicators" style="display: flex; gap: 8px; justify-content: flex-end; font-size: 0.72rem; margin-top: 4px;">
              ${this.isRecording ? html`<span style="color: oklch(0.6 0.18 20);">Recording...</span>` : ''}
              ${this.isTranscribing ? html`<span style="color: var(--primary-glow);">Transcribing...</span>` : ''}
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
