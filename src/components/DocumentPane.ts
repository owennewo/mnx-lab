import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { buildJsonView, type JsonView } from '../utils/jsonView.ts';
import { sharedChrome, scrollbars } from '../styles/tokens.ts';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightLine(line: string): string {
  return escapeHtml(line).replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    m => {
      let cls = 'number';
      if (/^"/.test(m)) cls = /:$/.test(m) ? 'key' : 'string';
      else if (/true|false/.test(m)) cls = 'boolean';
      else if (/null/.test(m)) cls = 'null';
      return `<span class="json-${cls}">${m}</span>`;
    }
  );
}

/**
 * The persistent document split pane: score.mnx.json with line numbers,
 * syntax color, and anchored note lines. Lines bound to a note are clickable
 * (accent line number) and cross-select the notehead; the selected note's
 * line highlights in accent, a pinned validation error's line in oxide.
 */
@customElement('mnx-document-pane')
export class DocumentPane extends LitElement {
  @property({ attribute: false }) doc: unknown = null;
  @property({ type: String }) selectedKey: string | null = null;
  /** JSON pointer of a pinned validation error to highlight (oxide). */
  @property({ type: String }) errorPointer: string | null = null;

  private view: JsonView | null = null;
  private lastDoc: unknown = null;

  static styles = [
    sharedChrome,
    scrollbars,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        height: 100%;
        border-left: 1px solid var(--line);
        background: var(--surface);
      }

      .json-hdr {
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
        padding: 8px 12px;
        border-bottom: 1px solid var(--line);
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-2);
      }

      .json-hdr .jh-count {
        color: var(--ink-3);
        font-size: 10px;
      }

      .json-hdr .jh-x {
        margin-left: auto;
        display: flex;
        gap: 4px;
      }

      .json-hdr .tb-btn {
        height: 22px;
        padding: 0 8px;
        font-size: 11px;
      }

      .json-body {
        flex: 1;
        overflow: auto;
        padding: 8px 0;
        position: relative;
        font-family: var(--mono);
        font-size: 11px;
        line-height: 1.65;
      }

      .jline {
        display: flex;
        white-space: pre;
        padding: 0 12px 0 0;
      }

      .jline .ln {
        width: 38px;
        flex-shrink: 0;
        text-align: right;
        padding-right: 12px;
        color: var(--ink-3);
        opacity: 0.55;
        user-select: none;
      }

      .jline.anchored {
        cursor: pointer;
      }

      .jline.anchored:hover {
        background: var(--hover);
      }

      .jline.anchored .ln {
        color: var(--accent-fg);
        opacity: 0.9;
      }

      .jline.hl {
        background: color-mix(in oklab, var(--accent), transparent 84%);
        box-shadow: inset 2px 0 0 var(--accent-fg);
      }

      .jline.hl-err {
        background: color-mix(in oklab, var(--st-gap), transparent 84%);
        box-shadow: inset 2px 0 0 var(--st-gap);
      }

      .json-key {
        color: var(--accent-fg);
      }

      .json-string {
        color: var(--json-string);
      }

      .json-number {
        color: var(--json-number);
      }

      .json-boolean {
        color: var(--json-boolean);
      }

      .json-null {
        color: var(--ink-3);
        font-style: italic;
      }
    `
  ];

  willUpdate() {
    if (this.doc !== this.lastDoc) {
      this.lastDoc = this.doc;
      this.view = this.doc != null ? buildJsonView(this.doc) : null;
    }
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('selectedKey') || changed.has('errorPointer') || changed.has('doc')) {
      this.scrollToHighlight();
    }
  }

  private highlightedLine(): number {
    if (!this.view) return -1;
    if (this.errorPointer != null) {
      return this.view.lineByPointer.get(this.errorPointer) ?? -1;
    }
    if (this.selectedKey != null) {
      return this.view.noteLineByKey.get(this.selectedKey) ?? -1;
    }
    return -1;
  }

  private scrollToHighlight() {
    const line = this.highlightedLine();
    if (line < 0) return;
    const body = this.shadowRoot?.querySelector('.json-body') as HTMLElement | null;
    const el = body?.querySelector(`[data-ln="${line}"]`) as HTMLElement | null;
    if (body && el) {
      body.scrollTop = Math.max(0, el.offsetTop - body.clientHeight / 2);
    }
  }

  render() {
    const view = this.view;
    if (!view) return nothing;
    const hlLine = this.highlightedLine();
    const isErr = this.errorPointer != null;

    return html`
      <div class="json-hdr">
        <span>score.mnx.json</span>
        <span class="jh-count">${view.lines.length} lines</span>
        <span class="jh-x">
          <button class="tb-btn" @click=${() => navigator.clipboard?.writeText(view.text)}>
            copy
          </button>
          <button class="tb-btn" title="Close document pane" @click=${this.emitClose}>×</button>
        </span>
      </div>
      <div class="json-body">
        ${view.lines.map((l, i) => {
          const key = view.noteKeyByLine.get(i);
          const cls =
            'jline' +
            (key !== undefined ? ' anchored' : '') +
            (i === hlLine ? (isErr ? ' hl-err' : ' hl') : '');
          return html`
            <div
              class=${cls}
              data-ln=${i}
              title=${key !== undefined ? 'Click to select this note in the score' : ''}
              @click=${key !== undefined ? () => this.emitLine(key) : undefined}
            >
              <span class="ln">${i + 1}</span><code>${unsafeHTML(highlightLine(l) || ' ')}</code>
            </div>
          `;
        })}
      </div>
    `;
  }

  private emitLine(key: string) {
    this.dispatchEvent(
      new CustomEvent('document-line-selected', { detail: { key }, bubbles: true, composed: true })
    );
  }

  private emitClose() {
    this.dispatchEvent(new CustomEvent('document-pane-closed', { bubbles: true, composed: true }));
  }
}

export default DocumentPane;
