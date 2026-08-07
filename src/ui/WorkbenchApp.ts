// The workbench shell — a clean-room, review-first rebuild (structure-lab).
// Home is the attention queue; every scenario + view mode has a stable
// deep-linkable URL (#/scenario/<id>?view=…). The shell is a leaf: it
// consumes corpus/ and elements/, and nothing imports it.
//
// The workbench has NO backend: everything on screen is committed JSON
// served statically; verification state is display-only (mutations happen
// through the harness scripts, in git).
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { corpus, corpusManifest, coverage, type ScenarioEntry } from '../corpus/corpus.ts';
import { groupScenarios } from '../corpus/groups.ts';
import { buildQueue, classify } from './queue.ts';
import { designTokens, sharedChrome, scrollbars } from '../elements/tokens.ts';
import { resolveShellAction, strokeOf } from '../edit/keymap.ts';
import type { EditorIntent } from '../edit/intents.ts';
import type { PaletteItem } from './CommandPalette.ts';
import './CommandPalette.ts';
import './QueueHome.ts';
import './ScenarioPage.ts';
import './ObjectsPage.ts';

export interface Route {
  page: 'home' | 'scenario' | 'objects';
  id?: string;
  view?: string;
  /** The schema object on #/objects/<def>; absent on the index itself. */
  def?: string;
}

export function parseHash(hash: string): Route {
  const scenario = /^#\/scenario\/([^?]+)(?:\?view=([a-z-]+))?$/.exec(hash);
  if (scenario) return { page: 'scenario', id: decodeURIComponent(scenario[1]), view: scenario[2] };
  const objects = /^#\/objects(?:\/([a-z0-9-]+))?$/.exec(hash);
  if (objects) return { page: 'objects', def: objects[1] };
  return { page: 'home' };
}

export function scenarioHref(id: string, view?: string): string {
  return `#/scenario/${encodeURIComponent(id).replace(/%2F/g, '/')}${view ? `?view=${view}` : ''}`;
}

export function objectsHref(def?: string): string {
  return def ? `#/objects/${def}` : '#/objects';
}

/**
 * The rail's filter syntax. A bare word matches id/title; `def:<name>` narrows
 * to the scenarios exercising a schema object.
 *
 * Deliberately ONE filter mechanism rather than a second "filter mode" beside
 * the search box: clicking an object tag writes `def:<name>` into the box, so
 * what filtered the list is always visible, editable and clearable by the
 * control the reader already knows.
 */
export const DEF_QUERY_PREFIX = 'def:';

export function matchesQuery(entry: ScenarioEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (q.startsWith(DEF_QUERY_PREFIX)) {
    const def = q.slice(DEF_QUERY_PREFIX.length);
    return !def || entry.featureDefs.some(d => d.toLowerCase().includes(def));
  }
  return entry.id.toLowerCase().includes(q) || entry.meta.title.toLowerCase().includes(q);
}

@customElement('mnx-workbench')
export class WorkbenchApp extends LitElement {
  @state() private route: Route = parseHash(location.hash);
  @state() private query = '';
  /** The palette overlay: 'commands' (Ctrl+K, `>` prefilled) or 'goto' (Ctrl+G). */
  @state() private palette: 'commands' | 'goto' | null = null;

  private onHashChange = () => {
    this.route = parseHash(location.hash);
    // #/objects/<def> IS the filter: the URL drives the rail so that "show me
    // this object's examples" is deep-linkable rather than transient state.
    // Only ever clobber a def: query — a hand-typed search survives navigation.
    if (this.route.page === 'objects' && this.route.def) {
      this.query = `${DEF_QUERY_PREFIX}${this.route.def}`;
    } else if (this.query.startsWith(DEF_QUERY_PREFIX)) {
      this.query = '';
    }
  };

  static styles = [
    designTokens,
    sharedChrome,
    scrollbars,
    css`
      :host {
        display: grid;
        grid-template-rows: auto 1fr;
        grid-template-columns: 270px 1fr;
        grid-template-areas:
          'header header'
          'rail main';
        height: 100vh;
        background: var(--bg);
        color: var(--ink);
        font-family: var(--sans);
      }

      header {
        grid-area: header;
        display: flex;
        align-items: baseline;
        gap: 14px;
        padding: 10px 18px;
        border-bottom: 1px solid var(--line);
      }

      header .brand {
        font-family: var(--serif);
        font-size: 17px;
        font-weight: 500;
      }

      header .brand a {
        color: inherit;
        text-decoration: none;
      }

      header .facts {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-3);
        display: flex;
        gap: 14px;
        margin-left: auto;
      }

      /* The coverage fraction was always a tease; make it the door. */
      header .facts .cov {
        color: inherit;
        text-decoration: none;
        border-bottom: 1px dotted var(--line-strong);
      }

      header .facts .cov:hover {
        color: var(--accent);
      }

      nav {
        grid-area: rail;
        overflow-y: auto;
        background: var(--bg-rail);
        border-right: 1px solid var(--line);
        padding: 12px 0 24px;
      }

      main {
        grid-area: main;
        overflow: hidden;
        min-width: 0;
      }

      .queue-link {
        display: block;
        margin: 0 10px 10px;
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 12.5px;
        font-weight: 500;
        color: var(--ink);
        text-decoration: none;
        border: 1px solid var(--line);
      }

      .queue-link:hover {
        border-color: var(--accent);
      }

      .queue-link .count {
        font-family: var(--mono);
        color: var(--accent);
      }

      .search {
        display: block;
        width: calc(100% - 20px);
        margin: 0 10px 12px;
        padding: 6px 9px;
        font: inherit;
        font-size: 12px;
        color: var(--ink);
        background: transparent;
        border: 1px solid var(--line);
        border-radius: 7px;
        box-sizing: border-box;
      }

      .cat {
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-3);
        padding: 10px 18px 4px;
      }

      .item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 18px;
        font-size: 12.5px;
        color: var(--ink);
        text-decoration: none;
      }

      .item:hover {
        background: var(--hover);
      }

      .item[aria-current='true'] {
        background: var(--hover);
        color: var(--accent);
      }

      /* Queue state, by shape as well as colour. */
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
        box-sizing: border-box;
      }

      /* Approved and still matching its goldens. */
      .dot.current {
        background: var(--st-verified);
        box-shadow: 0 0 0 2px color-mix(in oklab, var(--st-verified), transparent 78%);
      }

      /* Approved once, output has moved since — hollow: the ring is still
         there, the substance isn't. */
      .dot.stale {
        background: transparent;
        border: 2px solid var(--st-verified);
      }

      /* Renders, but no human has ever signed it off. */
      .dot.never-seen {
        background: var(--st-rendered);
      }

      .dot.blocked {
        background: var(--st-gap);
      }

      /* Orthogonal to state: rejected by the schema on purpose. */
      .dot.by-design {
        border-radius: 2px;
        transform: rotate(45deg);
      }

      .label {
        flex: 1;
        min-width: 0;
      }

      .tag {
        flex-shrink: 0;
        font-family: var(--mono);
        font-size: 9px;
        letter-spacing: 0.04em;
        color: var(--ink-3);
        border: 1px solid var(--line);
        border-radius: 4px;
        padding: 0 4px;
        line-height: 1.5;
      }

      .tag.proposed {
        color: var(--st-gap);
        border-color: color-mix(in oklab, var(--st-gap), transparent 55%);
      }

      .cat-n {
        float: right;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this.onHashChange);
    window.addEventListener('keydown', this.onKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.onHashChange);
    window.removeEventListener('keydown', this.onKeyDown);
  }

  /** The shell's keys: `/` focuses the rail filter (survey §6.1), Ctrl+K /
   *  Ctrl+G open the palette (resolved through the keymap module's shell
   *  table — it stays the sole KeyboardEvent interpreter). Everything
   *  score-shaped is the scenario page's keymap, not ours. */
  private onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    const target = event.composedPath()[0];
    if (target instanceof HTMLElement) {
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable)
        return;
    }
    const action = resolveShellAction(strokeOf(event));
    if (action === 'commandPalette' || action === 'goTo') {
      event.preventDefault();
      this.palette = action === 'commandPalette' ? 'commands' : 'goto';
      return;
    }
    if (event.code === 'Slash' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const search = this.renderRoot.querySelector<HTMLInputElement>('.search');
      if (search) {
        event.preventDefault();
        search.focus();
        search.select();
      }
    }
  };

  // ── The palette's provider: one grammar. `>` prefix = commands; bare text
  // is go-to — bar numbers move the editor cursor, `def:` opens coverage, and
  // anything else matches scenarios with the rail filter's own matcher, so
  // the palette and the rail agree about what a query means.
  private paletteItems = (query: string): PaletteItem[] => {
    const q = query.trim();
    if (q.startsWith('>')) return this.commandItems(q.slice(1).trim().toLowerCase());
    return this.goToItems(q);
  };

  private commandItems(filter: string): PaletteItem[] {
    const intent = (label: string, detail: EditorIntent, hint?: string): PaletteItem => ({
      label,
      hint,
      run: () => window.dispatchEvent(new CustomEvent('mnx-palette-intent', { detail }))
    });
    const action = (label: string, detail: string, hint?: string): PaletteItem => ({
      label,
      hint,
      run: () => window.dispatchEvent(new CustomEvent('mnx-palette-action', { detail }))
    });
    const nav = (label: string, hash: string, hint?: string): PaletteItem => ({
      label,
      hint,
      run: () => (location.hash = hash)
    });

    const items: PaletteItem[] = [
      nav('go: attention queue', '#/'),
      nav('go: objects coverage', objectsHref())
    ];
    const entry =
      this.route.page === 'scenario' ? corpus.find(e => e.id === this.route.id) : undefined;
    if (entry) {
      // Tab/both require known strings; the palette can't see the loaded doc,
      // so it uses the extension-data approximation. A tab link that turns
      // out unavailable falls back to the document's default view.
      const views = entry.hasTab
        ? ['notation', 'tab', 'both', 'compare', 'json']
        : ['notation', 'compare', 'json'];
      for (const v of views) items.push(nav(`view: ${v}`, scenarioHref(entry.id, v)));
      items.push(
        intent('edit: undo', { type: 'undo' }, 'Ctrl+Z'),
        intent('edit: redo', { type: 'redo' }, 'Ctrl+Y'),
        intent('edit: add bar', { type: 'appendMeasure' }, 'Shift+M'),
        intent('edit: toggle tie', { type: 'toggleTie' }, 'T'),
        action('edit: copy trace', 'copyTrace'),
        action('edit: revert edits', 'revert'),
        action('setup: time signature…', 'timeSignaturePopover', 'Shift+T')
      );
      if (entry.hasTab) items.push(action('setup: tuning…', 'tuningPopover', 'Shift+U'));
    }
    return items.filter(i => i.label.toLowerCase().includes(filter));
  }

  private goToItems(q: string): PaletteItem[] {
    const items: PaletteItem[] = [];
    const bar = /^(\d+)$/.exec(q);
    if (bar && this.route.page === 'scenario') {
      const n = Number(bar[1]);
      if (n >= 1) {
        items.push({
          label: `go to bar ${n}`,
          hint: 'moves the cursor',
          run: () =>
            window.dispatchEvent(
              new CustomEvent('mnx-palette-intent', {
                detail: { type: 'goToMeasure', measureIndex: n - 1 }
              })
            )
        });
      }
    }
    if (q.toLowerCase().startsWith(DEF_QUERY_PREFIX)) {
      const def = q.slice(DEF_QUERY_PREFIX.length).trim();
      if (def) {
        items.push({
          label: `objects: ${def}`,
          hint: 'coverage map + rail filter',
          run: () => (location.hash = objectsHref(def))
        });
      }
    }
    for (const e of corpus.filter(e => matchesQuery(e, q)).slice(0, 12)) {
      items.push({ label: e.meta.title, hint: e.id, run: () => (location.hash = scenarioHref(e.id)) });
    }
    return items;
  }

  private grouped(): Map<string, ScenarioEntry[]> {
    const matches = corpus.filter(e => matchesQuery(e, this.query));
    // Topic groups, not the authoring category — see src/corpus/groups.ts.
    // Lab and spec interleave here, which is the point; `origin` carries the
    // provenance the old lab/spec headers used to imply.
    return groupScenarios(matches, e => e.id);
  }

  /**
   * One rail row, carrying two orthogonal signals.
   *
   * The DOT is the scenario's place in the attention queue — the same
   * `classify()` the queue home and the scenario page use, so one vocabulary
   * across the workbench. It used to show the raw `status`, which collapsed
   * *stale* (approved once, output has since moved) and *never seen* into a
   * single "rendered" dot: the exact distinction the provenance record exists
   * to make. Shape carries it as well as colour, so it survives a colourblind
   * reader and a greyscale screenshot.
   *
   * The TAGS are provenance. `spec` means mirrored from the pinned release by
   * `sync:spec`, which owns that tree byte-for-byte — the strongest thing a
   * reader can know about a scenario is whether hand-editing it is allowed.
   * That used to be implied by the lab/… vs spec header; now that topic groups
   * interleave the two, it has to be said explicitly. `proposed` means the
   * scenario is judged by a proposed schema, so a validation verdict on it is
   * evidence about the spec, not about us.
   */
  private railItem(e: ScenarioEntry, active: string | null) {
    const { state, detail } = classify(e);
    const record = e.meta.verification;
    return html`
      <a class="item" href=${scenarioHref(e.id)} aria-current=${e.id === active}>
        <span
          class="dot ${state}${e.invalidByDesign ? ' by-design' : ''}"
          title=${`${detail}${e.invalidByDesign ? ' · invalid by design' : ''}${
            record?.renderHash ? '' : record ? ' · no renderHash yet' : ''
          }`}
        ></span>
        <span class="label">${e.meta.title}</span>
        ${e.meta.schema === 'proposed'
          ? html`<span class="tag proposed" title="judged by a proposed schema">proposed</span>`
          : nothing}
        ${e.ns === 'spec'
          ? html`<span class="tag" title="mirrored from the pinned spec — sync:spec owns it"
              >spec</span
            >`
          : nothing}
      </a>
    `;
  }

  render() {
    const queue = buildQueue(corpus);
    const attention = queue.blocked.length + queue.stale.length + queue.neverSeen.length;
    const active = (this.route.page === 'scenario' ? this.route.id : null) ?? null;

    return html`
      <header>
        <span class="brand"><a href="#/">MNX Lab — workbench</a></span>
        <span class="facts">
          <span>MNX v${corpusManifest.mnxVersion} · ext v${corpusManifest.extensionVersion}</span>
          <a class="cov" href=${objectsHref()}
            >coverage ${coverage.covered}/${coverage.total} $defs</a
          >
          <span>${corpus.length} scenarios</span>
        </span>
      </header>
      <nav>
        <a class="queue-link" href="#/">
          Attention queue —
          <span class="count">${attention === 0 ? 'empty' : attention}</span>
          <span style="color: var(--ink-3)">(${queue.currentCount} current)</span>
        </a>
        <input
          class="search"
          type="search"
          placeholder="Filter scenarios…"
          .value=${this.query}
          @input=${(e: InputEvent) => (this.query = (e.target as HTMLInputElement).value)}
        />
        ${[...this.grouped()].map(
          ([group, entries]) => html`
            <div class="cat">${group}<span class="cat-n">${entries.length}</span></div>
            ${entries.map(e => this.railItem(e, active))}
          `
        )}
      </nav>
      <main>
        ${this.route.page === 'scenario'
          ? html`<mnx-scenario-page
              .scenarioId=${this.route.id ?? ''}
              .view=${this.route.view ?? ''}
            ></mnx-scenario-page>`
          : this.route.page === 'objects'
            ? html`<mnx-objects-page .def=${this.route.def ?? ''}></mnx-objects-page>`
            : html`<mnx-queue-home></mnx-queue-home>`}
      </main>
      ${this.palette
        ? html`<mnx-command-palette
            .provider=${this.paletteItems}
            .initialQuery=${this.palette === 'commands' ? '> ' : ''}
            @palette-close=${() => (this.palette = null)}
          ></mnx-command-palette>`
        : nothing}
    `;
  }
}
