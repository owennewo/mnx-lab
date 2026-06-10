import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * Browses the scenario corpus (scenarios/ at the repo root — see
 * clean_room_impl/04-scenario-library.md). Metadata is bundled eagerly
 * (it's small); score documents load on demand. Selecting a scenario emits
 * `scenario-selected` with { id, meta, mnxJson } — the host app shows it as
 * a transient document without touching saved scores.
 */

interface ScenarioEntry {
  id: string;
  group: string;
  meta: any;
  loadScore: () => Promise<unknown>;
}

const metaModules = import.meta.glob('../../scenarios/{lab,spec}/**/meta.json', {
  eager: true,
  import: 'default'
}) as Record<string, any>;

const scoreModules = import.meta.glob('../../scenarios/{lab,spec}/**/score.mnx.json', {
  import: 'default'
}) as Record<string, () => Promise<unknown>>;

function buildEntries(): ScenarioEntry[] {
  const entries: ScenarioEntry[] = [];
  for (const metaPath of Object.keys(metaModules).sort()) {
    const rel = metaPath.replace(/^.*?scenarios\//, '').replace(/\/meta\.json$/, '');
    const segments = rel.split('/').map(s => s.replace(/^\d+-/, ''));
    const scorePath = metaPath.replace(/meta\.json$/, 'score.mnx.json');
    const loader = scoreModules[scorePath];
    if (!loader) continue;
    entries.push({
      id: segments.join('/'),
      group: segments.slice(0, -1).join('/'),
      meta: metaModules[metaPath],
      loadScore: loader
    });
  }
  // lab/ (ours) first, then spec/, groups in path order
  return entries.sort((a, b) =>
    a.group === b.group ? 0 : (a.group.startsWith('lab') === b.group.startsWith('lab')
      ? a.group.localeCompare(b.group)
      : a.group.startsWith('lab') ? -1 : 1)
  );
}

@customElement('mnx-scenario-gallery')
export class ScenarioGallery extends LitElement {
  @property({ type: String })
  selectedId: string | null = null;

  @state()
  private entries: ScenarioEntry[] = buildEntries();

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      padding: 16px;
      box-sizing: border-box;
      gap: 10px;
    }

    .gallery-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    .gallery-title {
      font-size: 1.05rem;
      font-weight: 700;
    }

    .gallery-counts {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-right: 4px;
    }

    .group-header {
      position: sticky;
      top: 0;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      background: var(--bg-app);
      padding: 10px 4px 4px;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid transparent;
      font-size: 0.86rem;
    }

    .row:hover {
      background: rgba(255, 255, 255, 0.04);
    }

    .row.selected {
      background: rgba(99, 102, 241, 0.12);
      border-color: var(--primary-glow);
    }

    .validity-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .validity-dot.valid { background: oklch(0.75 0.17 150); }
    .validity-dot.invalid { background: oklch(0.65 0.2 25); }

    .row-title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chip {
      font-size: 0.62rem;
      padding: 1px 6px;
      border-radius: 999px;
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .chip.rendered { color: oklch(0.8 0.12 150); border-color: oklch(0.5 0.1 150); }
    .chip.verified { color: oklch(0.8 0.12 230); border-color: oklch(0.5 0.1 230); }
    .chip.spec-gap { color: oklch(0.75 0.15 25); border-color: oklch(0.5 0.12 25); }
  `;

  render() {
    const groups = new Map<string, ScenarioEntry[]>();
    for (const e of this.entries) {
      if (!groups.has(e.group)) groups.set(e.group, []);
      groups.get(e.group)!.push(e);
    }
    const rendered = this.entries.filter(e => e.meta.status === 'rendered' || e.meta.status === 'verified').length;

    return html`
      <div class="gallery-header">
        <span class="gallery-title">Scenario Library</span>
        <span class="gallery-counts">${this.entries.length} scenarios · ${rendered} rendered</span>
      </div>
      <div class="list">
        ${[...groups.entries()].map(
          ([group, items]) => html`
            <div class="group-header">${group}</div>
            ${items.map(e => this.renderRow(e))}
          `
        )}
      </div>
    `;
  }

  private renderRow(e: ScenarioEntry) {
    const invalid = e.meta.expect?.standard === 'invalid' || e.meta.expect?.extension === 'invalid';
    return html`
      <div
        class="row ${this.selectedId === e.id ? 'selected' : ''}"
        title=${e.meta.description ?? ''}
        @click=${() => this.select(e)}
      >
        <span class="validity-dot ${invalid ? 'invalid' : 'valid'}"></span>
        <span class="row-title">${e.meta.title}</span>
        ${invalid ? html`<span class="chip spec-gap">invalid by design</span>` : ''}
        <span class="chip ${e.meta.status}">${e.meta.status}</span>
      </div>
    `;
  }

  private async select(entry: ScenarioEntry) {
    try {
      const mnxJson = await entry.loadScore();
      this.dispatchEvent(
        new CustomEvent('scenario-selected', {
          detail: { id: entry.id, meta: entry.meta, mnxJson },
          bubbles: true,
          composed: true
        })
      );
    } catch (err) {
      console.error(`Failed to load scenario ${entry.id}`, err);
    }
  }
}

export default ScenarioGallery;
