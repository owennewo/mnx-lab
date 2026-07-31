// One scenario, deep-linkable: #/scenario/<id>?view=notation|tab|both|compare|json.
// The compare view is the review surface — our render beside the spec's
// reference engraving (served by a dev-only middleware from the pinned
// vendor/mnx checkout; in a static deploy the reference pane degrades to a
// note). Rendering goes through the elements/ score viewer, property-driven.
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { corpus, type ScenarioEntry } from '../corpus/corpus.ts';
import { classify } from './queue.ts';
import { designTokens, sharedChrome, scrollbars } from '../elements/tokens.ts';
import { scenarioHref } from './WorkbenchApp.ts';
import type { MnxDocument, MnxStructure } from '../model/mnx.ts';
import { resolvePinnedErrors, type PinnedError } from '../model/pinnedErrors.ts';
import type { ViewMode } from '../elements/ScoreViewer.ts';
import '../elements/ScoreViewer.ts';

type PageView = ViewMode | 'compare' | 'json';

@customElement('mnx-scenario-page')
export class ScenarioPage extends LitElement {
  @property({ type: String }) scenarioId = '';
  @property({ type: String }) view = '';

  @state() private doc: MnxDocument | null = null;
  @state() private rawScore = '';
  @state() private pinnedErrors: PinnedError[] = [];
  @state() private referenceFailed = false;

  static styles = [
    designTokens,
    sharedChrome,
    scrollbars,
    css`
      :host {
        display: grid;
        grid-template-rows: auto 1fr;
        height: 100%;
        overflow: hidden;
      }

      .head {
        padding: 16px 24px 12px;
        border-bottom: 1px solid var(--line);
      }

      .head h1 {
        font-family: var(--serif);
        font-weight: 500;
        font-size: 20px;
        margin: 0;
        display: flex;
        align-items: baseline;
        gap: 12px;
        flex-wrap: wrap;
      }

      .head .id {
        font-family: var(--mono);
        font-size: 11.5px;
        color: var(--ink-3);
      }

      .head p {
        font-size: 12.5px;
        color: var(--ink-2);
        line-height: 1.55;
        margin: 6px 0 10px;
        max-width: 78ch;
        text-wrap: pretty;
      }

      .badges {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
        font-family: var(--mono);
        font-size: 10.5px;
      }

      .badge {
        border: 1px solid var(--line-strong);
        border-radius: 999px;
        padding: 2px 9px;
        color: var(--ink-2);
      }

      .badge.verified {
        color: var(--st-verified);
        border-color: currentColor;
      }

      .badge.attention {
        color: var(--st-gap);
        border-color: currentColor;
      }

      .badge a {
        color: inherit;
        text-decoration: none;
      }

      .tabs {
        display: flex;
        gap: 2px;
        margin-top: 12px;
      }

      .tabs a {
        font-size: 12px;
        padding: 5px 12px;
        border-radius: 7px 7px 0 0;
        color: var(--ink-2);
        text-decoration: none;
        border: 1px solid transparent;
        border-bottom: none;
      }

      .tabs a[aria-current='true'] {
        color: var(--accent-fg);
        background: var(--surface);
        border-color: var(--line);
      }

      .body {
        overflow: hidden;
        min-height: 0;
      }

      .compare {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0;
        height: 100%;
        overflow: hidden;
      }

      .compare > div {
        overflow: auto;
        min-width: 0;
      }

      .compare .side-cap {
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-3);
        padding: 10px 16px 0;
      }

      .compare .ref {
        border-left: 1px solid var(--line);
        background: var(--bg);
      }

      .compare .ref img {
        display: block;
        max-width: calc(100% - 52px);
        margin: 26px;
        background: var(--paper);
        border-radius: 10px;
        box-shadow: var(--shadow);
        padding: 20px;
      }

      .ref-missing {
        margin: 26px;
        padding: 22px;
        border: 1px dashed var(--line-strong);
        border-radius: 10px;
        font-size: 12.5px;
        color: var(--ink-2);
        line-height: 1.55;
      }

      .json {
        height: 100%;
        overflow: auto;
        margin: 0;
        padding: 18px 24px;
        box-sizing: border-box;
        font-family: var(--mono);
        font-size: 11.5px;
        line-height: 1.5;
        color: var(--ink);
        background: var(--surface);
      }

      .missing {
        padding: 40px;
        color: var(--ink-2);
      }
    `
  ];

  private entry(): ScenarioEntry | null {
    return corpus.find(e => e.id === this.scenarioId) ?? null;
  }

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('scenarioId')) {
      this.doc = null;
      this.rawScore = '';
      this.pinnedErrors = [];
      this.referenceFailed = false;
      void this.loadScore();
    }
  }

  private async loadScore() {
    const entry = this.entry();
    if (!entry) return;
    const score = (await entry.loadScore()) as MnxStructure;
    if (entry.id !== this.scenarioId) return; // navigated away meanwhile
    this.doc = {
      id: entry.id,
      name: entry.meta.title,
      lastUpdated: 0,
      mnxJson: score
    };
    this.rawScore = JSON.stringify(score, null, 2);
    if (entry.invalidByDesign) {
      this.pinnedErrors = await resolvePinnedErrors(score, entry.meta.expect.errors ?? []);
    }
  }

  private activeView(entry: ScenarioEntry): PageView {
    const allowed: PageView[] = entry.hasTab
      ? ['notation', 'tab', 'both', 'compare', 'json']
      : ['notation', 'compare', 'json'];
    return allowed.includes(this.view as PageView) ? (this.view as PageView) : 'notation';
  }

  private viewer(entry: ScenarioEntry, viewMode: ViewMode) {
    return html`
      <mnx-score-viewer
        .mnxDoc=${this.doc}
        .viewMode=${viewMode}
        .hasTab=${entry.hasTab}
        .invalidByDesign=${entry.invalidByDesign}
        .pinnedErrors=${this.pinnedErrors}
      ></mnx-score-viewer>
    `;
  }

  render() {
    const entry = this.entry();
    if (!entry) {
      return html`<div class="missing">No scenario with id “${this.scenarioId}”.</div>`;
    }
    const view = this.activeView(entry);
    const item = classify(entry);
    const verification = entry.meta.verification;
    const views: PageView[] = entry.hasTab
      ? ['notation', 'tab', 'both', 'compare', 'json']
      : ['notation', 'compare', 'json'];

    return html`
      <div class="head">
        <h1>${entry.meta.title} <span class="id">${entry.id}</span></h1>
        <p>${entry.meta.description}</p>
        <div class="badges">
          <span class="badge ${item.state === 'current' ? 'verified' : 'attention'}">
            ${item.state === 'current' ? entry.meta.status : item.state} — ${item.detail}
          </span>
          ${verification?.primitivesHash
            ? html`<span class="badge">${verification.primitivesHash}</span>`
            : nothing}
          <span class="badge">${entry.meta.source}</span>
          ${entry.meta.schema === 'proposed'
            ? html`<span class="badge attention">proposed schema</span>`
            : nothing}
          ${entry.specRef
            ? html`<span class="badge"><a href=${entry.specRef} target="_blank">spec ↗</a></span>`
            : nothing}
          ${entry.issueRef
            ? html`<span class="badge"><a href=${entry.issueRef} target="_blank">issue ↗</a></span>`
            : nothing}
        </div>
        <div class="tabs">
          ${views.map(
            v => html`
              <a href=${scenarioHref(entry.id, v)} aria-current=${v === view}>
                ${v === 'compare' ? 'compare · spec reference' : v}
              </a>
            `
          )}
        </div>
      </div>
      <div class="body">
        ${view === 'json'
          ? html`<pre class="json">${this.rawScore}</pre>`
          : view === 'compare'
            ? html`
                <div class="compare">
                  <div>
                    <div class="side-cap">our render</div>
                    ${this.viewer(entry, 'notation')}
                  </div>
                  <div class="ref">
                    <div class="side-cap">spec reference engraving</div>
                    ${entry.ns === 'spec' && !this.referenceFailed
                      ? html`<img
                          src=${`/spec-media/${entry.id.replace(/^spec\//, '')}.png`}
                          alt="Reference engraving from the MNX spec"
                          @error=${() => (this.referenceFailed = true)}
                        />`
                      : html`<div class="ref-missing">
                          ${entry.ns === 'spec'
                            ? html`Reference engraving unavailable — it is served from the pinned
                              <code>vendor/mnx</code> checkout by a dev-only middleware, so it only
                              appears under <code>npm run dev</code>.`
                            : html`A lab scenario has no spec reference engraving — compare against
                              the committed golden via the harness
                              (<code>npm run verify:scenarios</code> shows what changed).`}
                        </div>`}
                  </div>
                </div>
              `
            : this.viewer(entry, view)}
      </div>
    `;
  }
}
