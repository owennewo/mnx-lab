import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { provide } from '@lit/context';
import {
  mnxDocumentContext,
  playbackStateContext,
  selectionContext
} from '../contexts/mnxContext.ts';
import type {
  PlaybackState,
  SelectionContext
} from '../contexts/mnxContext.ts';
import { MnxDocument } from '../types/mnx.ts';
import { DocumentController } from '../controllers/DocumentController.ts';
import { PlaybackController } from '../controllers/PlaybackController.ts';
import './PlaybackBar.ts';
import './ScoreViewer.ts';
import './ChatPanel.ts';
import './ScenarioGallery.ts';

@customElement('mnx-editor-app')
export class MnxEditorApp extends LitElement {
  // Setup providers
  @provide({ context: mnxDocumentContext })
  @state()
  documentState: MnxDocument | null = null;

  @provide({ context: playbackStateContext })
  @state()
  playbackState: PlaybackState = {
    playing: false,
    tempo: 120,
    volume: -10,
    playheadTime: 0,
    activeNoteIds: []
  };

  @provide({ context: selectionContext })
  @state()
  selectionState: SelectionContext = {
    activePartId: null,
    activeMeasureIndex: null,
    activeVoiceIndex: null,
    activeEventIndex: null,
    selectedNoteIds: []
  };

  @state()
  viewMode: 'notation' | 'tab' | 'both' | 'json' = 'notation';

  // Library (scenario corpus) browsing. While a scenario is active the score
  // viewer shows it as a TRANSIENT document — saved scores are untouched.
  // Closing the library clears the scenario, so the chat panel (and its
  // updateScore path) can never operate on corpus documents.
  @state()
  showLibrary = false;

  @state()
  activeScenario: { id: string; meta: any; mnxJson: any } | null = null;

  // Instantiated controllers
  private documentController = new DocumentController(this);
  private playbackController = new PlaybackController(this);

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      background: var(--bg-app);
      font-family: var(--font-family-sans);
      color: var(--text-primary);
    }

    .toolbar {
      height: 64px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 20px;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border-bottom: 1px solid var(--border-color);
      z-index: 10;
    }

    .logo-section {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, var(--text-primary) 30%, var(--primary-glow));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .logo-section wa-icon {
      color: var(--primary-glow);
      -webkit-text-fill-color: initial;
    }

    .workspace {
      flex: 1;
      height: calc(100vh - 64px - 32px);
    }

    wa-split-panel {
      height: 100%;
    }

    .editor-pane {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px;
      gap: 12px;
      overflow: hidden;
    }

    .editor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .view-toggle-group {
      display: flex;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      padding: 2px;
      border: 1px solid var(--border-color);
      gap: 4px;
    }

    .score-title {
      font-size: 1.25rem;
      font-weight: 600;
    }

    .scenario-badges {
      margin-left: 10px;
      display: inline-flex;
      gap: 6px;
      vertical-align: middle;
    }

    .badge {
      font-size: 0.66rem;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid var(--border-color);
      color: var(--text-muted);
    }

    .badge.mono {
      font-family: var(--font-family-mono);
    }

    .badge.ok {
      color: oklch(0.8 0.13 150);
      border-color: oklch(0.5 0.1 150);
    }

    .badge.bad {
      color: oklch(0.75 0.16 25);
      border-color: oklch(0.5 0.13 25);
    }

    .status-bar {
      height: 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 16px;
      font-size: 0.76rem;
      color: var(--text-muted);
      background: oklch(0.12 0.02 256);
      border-top: 1px solid var(--border-color);
    }

    .status-group {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-item span.highlight {
      color: var(--text-secondary);
      font-family: var(--font-family-mono);
    }
  `;

  willUpdate() {
    // Keep provider states synchronized with underlying controllers.
    // An active library scenario overrides the saved document as a
    // transient, never-persisted view.
    this.documentState = this.activeScenario
      ? {
          id: `scenario:${this.activeScenario.id}`,
          name: this.activeScenario.meta.title,
          lastUpdated: 0,
          mnxJson: this.activeScenario.mnxJson
        }
      : this.documentController.currentDocument;

    this.playbackState = {
      playing: this.playbackController.isPlaying,
      tempo: this.playbackController.tempo,
      volume: this.playbackController.volume,
      playheadTime: this.playbackController.playheadBeat,
      activeNoteIds: this.playbackController.activeNoteIds
    };
  }

  render() {
    const isPlaying = this.playbackState.playing;
    const selectedNoteText = this.selectionState.selectedNoteIds.length > 0 
      ? `Selected: Note ID [${this.selectionState.selectedNoteIds[0]}] (Measure ${Number(this.selectionState.activeMeasureIndex) + 1})`
      : 'No selection';

    return html`
      <!-- Header Toolbar -->
      <header class="toolbar">
        <div class="logo-section">
          <wa-icon name="music-note-beamed"></wa-icon>
          <span>MNX Notation Editor</span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <wa-dropdown @wa-select=${this.handleScoreSelect}>
            <wa-button slot="trigger" caret size="small" variant="neutral">
              ${this.documentController.isLoading ? 'Loading...' : (this.documentState?.name || 'Select Score')}
            </wa-button>
            <wa-dropdown-item value="new-score">New Score</wa-dropdown-item>
            <wa-divider></wa-divider>
            ${this.documentController.documentsList.map(
              doc => html`
                <wa-dropdown-item value=${doc.id}>${doc.name}</wa-dropdown-item>
              `
            )}
          </wa-dropdown>
          <wa-button
            size="small"
            variant=${this.showLibrary ? 'brand' : 'neutral'}
            @click=${this.handleLibraryToggle}
          >
            <wa-icon name="collection" style="margin-right: 4px;"></wa-icon>
            Library
          </wa-button>
        </div>

        <mnx-playback-bar
          @play-toggled=${this.handlePlayToggle}
          @stop-requested=${this.handleStopRequest}
          @tempo-changed=${this.handleTempoChange}
          @volume-changed=${this.handleVolumeChange}
        ></mnx-playback-bar>
      </header>

      <!-- Main Split Workspace -->
      <main class="workspace">
        <wa-split-panel position="35">
          <div slot="start" style="height: 100%; overflow: hidden; display: flex; flex-direction: column;">
            ${this.showLibrary
              ? html`<mnx-scenario-gallery
                  .selectedId=${this.activeScenario?.id ?? null}
                  @scenario-selected=${this.handleScenarioSelected}
                ></mnx-scenario-gallery>`
              : html`<mnx-chat-panel
                  @chat-command-submitted=${this.handleChatCommand}
                ></mnx-chat-panel>`}
          </div>
          <div slot="end" class="editor-pane">
            <div class="editor-header">
              <span class="score-title">
                ${this.documentState?.name || 'Blank Score'}
                ${this.activeScenario
                  ? html`<span class="scenario-badges">
                      <span class="badge mono">${this.activeScenario.id}</span>
                      <span class="badge ${this.activeScenario.meta.expect?.standard === 'valid' ? 'ok' : 'bad'}">
                        MNX ${this.activeScenario.meta.expect?.standard}
                      </span>
                      ${this.activeScenario.meta.expect?.extension !== 'n/a'
                        ? html`<span class="badge ${this.activeScenario.meta.expect?.extension === 'valid' ? 'ok' : 'bad'}">
                            _x.tab ${this.activeScenario.meta.expect?.extension}
                          </span>`
                        : ''}
                      <span class="badge">${this.activeScenario.meta.status}</span>
                    </span>`
                  : ''}
              </span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <wa-button
                  circle
                  size="small"
                  variant="neutral"
                  title="Copy score JSON"
                  ?disabled=${!this.documentState}
                  @click=${this.handleCopyScoreJson}
                >
                  <wa-icon name="clipboard"></wa-icon>
                </wa-button>
                <div class="view-toggle-group">
                  <wa-button
                    size="small"
                    variant=${this.viewMode === 'notation' ? 'brand' : 'neutral'}
                    @click=${() => this.viewMode = 'notation'}
                  >Notation</wa-button>
                  <wa-button
                    size="small"
                    variant=${this.viewMode === 'tab' ? 'brand' : 'neutral'}
                    @click=${() => this.viewMode = 'tab'}
                  >Tab</wa-button>
                  <wa-button
                    size="small"
                    variant=${this.viewMode === 'both' ? 'brand' : 'neutral'}
                    @click=${() => this.viewMode = 'both'}
                  >Both</wa-button>
                  <wa-button
                    size="small"
                    variant=${this.viewMode === 'json' ? 'brand' : 'neutral'}
                    @click=${() => this.viewMode = 'json'}
                  >JSON</wa-button>
                </div>
              </div>
            </div>
            <mnx-score-viewer
              .viewMode=${this.viewMode}
              @note-selected=${this.handleNoteSelect}
            ></mnx-score-viewer>
          </div>
        </wa-split-panel>
      </main>

      <!-- Footer Status Bar -->
      <footer class="status-bar">
        <div class="status-group">
          <div class="status-item">
            <span>DB Status:</span>
            <span class="highlight">Synced</span>
          </div>
          <div class="status-item">
            <span>Audio context:</span>
            <span class="highlight">${isPlaying ? 'Active' : 'Ready'}</span>
          </div>
        </div>
        <div class="status-group">
          <span>${selectedNoteText}</span>
        </div>
      </footer>
    `;
  }

  private handlePlayToggle() {
    if (this.documentState) {
      this.playbackController.play(this.documentState.mnxJson);
    }
  }

  private handleStopRequest() {
    this.playbackController.stop();
  }

  private handleTempoChange(e: CustomEvent) {
    this.playbackController.setTempo(e.detail.bpm);
  }

  private handleVolumeChange(e: CustomEvent) {
    this.playbackController.setVolume(e.detail.volume);
  }

  private handleLibraryToggle() {
    this.showLibrary = !this.showLibrary;
    if (!this.showLibrary) {
      // Leaving the library returns to the saved document, so chat edits can
      // never target a corpus scenario.
      this.activeScenario = null;
      this.playbackController.stop();
    }
  }

  private handleScenarioSelected(e: CustomEvent) {
    this.activeScenario = e.detail;
    this.playbackController.stop();
    this.selectionState = {
      activePartId: null,
      activeMeasureIndex: null,
      activeVoiceIndex: null,
      activeEventIndex: null,
      selectedNoteIds: []
    };
  }

  private handleScoreSelect(e: any) {
    const value = e.detail.item.value;
    this.activeScenario = null;
    if (value === 'new-score') {
      this.documentController.createNewScore('Untitled');
    } else {
      this.documentController.loadDocument(value);
    }
    this.playbackController.stop();
    this.selectionState = {
      activePartId: null,
      activeMeasureIndex: null,
      activeVoiceIndex: null,
      activeEventIndex: null,
      selectedNoteIds: []
    };
  }

  private async handleCopyScoreJson() {
    if (!this.documentState) return;
    await navigator.clipboard.writeText(JSON.stringify(this.documentState.mnxJson, null, 2));
  }

  private handleNoteSelect(e: CustomEvent) {
    const { noteId, measureIdx, noteIdx } = e.detail;
    
    // Toggle note selection
    if (this.selectionState.selectedNoteIds.includes(noteId)) {
      this.selectionState = {
        activePartId: null,
        activeMeasureIndex: null,
        activeVoiceIndex: null,
        activeEventIndex: null,
        selectedNoteIds: []
      };
    } else {
      this.selectionState = {
        activePartId: 'guitar-part',
        activeMeasureIndex: measureIdx,
        activeVoiceIndex: 0,
        activeEventIndex: noteIdx,
        selectedNoteIds: [noteId]
      };
    }
    
    this.requestUpdate();
  }

  private async handleChatCommand(e: CustomEvent) {
    const { prompt, model, attachedImages = [] } = e.detail;
    if (!this.documentState) return;

    const chatPanel = this.shadowRoot?.querySelector('mnx-chat-panel');
    if (chatPanel) {
      (chatPanel as any).isProcessing = true;
      (chatPanel as any).tokensCount = 0;
      (chatPanel as any).statusMessage = '';
    }

    try {
      const response = await fetch('/api/edit-notation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userPrompt: prompt,
          mnxJson: this.documentState.mnxJson,
          selectionContext: {
            activePartId: this.selectionState.activePartId,
            activeMeasureIndex: this.selectionState.activeMeasureIndex,
            activeVoiceIndex: this.selectionState.activeVoiceIndex,
            activeEventIndex: this.selectionState.activeEventIndex,
            selectedNoteIds: this.selectionState.selectedNoteIds,
            playerPlayheadTime: this.playbackController.playheadBeat
          },
          model: model,
          attachedImages: attachedImages
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Server returned status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';
      let doneData: any = null;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const chunk = JSON.parse(trimmed);
              if (chunk.type === 'progress') {
                if (chatPanel) {
                  (chatPanel as any).tokensCount = chunk.tokens;
                  if (chunk.status !== undefined) {
                    (chatPanel as any).statusMessage = chunk.status;
                  }
                }
              } else if (chunk.type === 'done') {
                doneData = chunk;
              }
            } catch (e) {
              console.error('Failed to parse NDJSON line:', trimmed, e);
            }
          }
        }
      }

      if (chatPanel && doneData) {
        (chatPanel as any).appendTranscript({
          timestamp: Date.now(),
          userPrompt: prompt,
          model,
          mockMode: doneData.mockMode === true,
          success: doneData.success,
          attemptsUsed: doneData.attemptsUsed ?? null,
          messages: doneData.messages ?? null,
          toolCallArguments: doneData.toolCallArguments ?? null,
          assistantContent: doneData.assistantContent ?? null,
          explanation: doneData.explanation ?? null,
          error: doneData.error ?? null,
          updatedMnxJson: doneData.updatedMnxJson ?? null
        });
      }

      const modelSaid = (doneData?.assistantContent || '').trim();
      const noEdits = doneData?.explanation === 'Completed instruction (no edits made).';

      if (doneData && doneData.success && doneData.updatedMnxJson && !noEdits) {
        await this.documentController.updateScore(doneData.updatedMnxJson);
        if (chatPanel) {
          const parts: string[] = [];
          if (modelSaid) parts.push(modelSaid);
          parts.push(doneData.explanation || 'Score updated.');
          (chatPanel as any).appendMessage('assistant', parts.join('\n\n'));
        }
      } else if (doneData && doneData.success && noEdits) {
        // Model went through cleanly but emitted no tool call — usually because it
        // refused, spoke instead of tool-calling, or (with image input) the model
        // wasn't actually multimodal. Surface whatever it said, fall back to a
        // clearer label than the canned server message.
        if (chatPanel) {
          const msg = modelSaid
            ? `Model didn't edit the score. It said:\n\n${modelSaid}`
            : 'Model returned no tool call and no text. This usually means the selected model declined to call the edit tool — try a different model, especially if you attached an image to a non-vision model.';
          (chatPanel as any).appendMessage('assistant', msg);
        }
      } else {
        const errMsg = doneData?.error || 'Failed to modify notation.';
        if (chatPanel) {
          const fullMsg = modelSaid
            ? `Error: ${errMsg}\n\nModel said:\n${modelSaid}`
            : 'Error: ' + errMsg;
          (chatPanel as any).appendMessage('assistant', fullMsg);
        }
      }
    } catch (err: any) {
      if (chatPanel) {
        (chatPanel as any).appendMessage('assistant', 'Network Error: ' + err.message);
      }
    } finally {
      if (chatPanel) {
        (chatPanel as any).isProcessing = false;
      }
    }
  }
}
export default MnxEditorApp;
