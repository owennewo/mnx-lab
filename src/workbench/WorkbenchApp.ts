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
import { keyIsOurs } from './keyScope.ts';
import type { EditorIntent } from '../edit/intents.ts';
import { MemorySelectionClipboardStore } from '../edit/selectionClipboard.ts';
import type { PaletteItem } from './CommandPalette.ts';
import './CommandPalette.ts';
import { completePkceLanding, parkLanding } from './assistCredentials.ts';
import './QueueHome.ts';
import { SETUP_POPOVER_COMMANDS, type ScenarioPage } from './ScenarioPage.ts';
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

const RAIL_HIDDEN_KEY = 'mnx-lab.rail-hidden';
const THEME_KEY = 'mnx-lab.theme';

function readTheme(): ThemeSetting {
  const v = localStorage.getItem(THEME_KEY);
  return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto';
}

/** Same three-value vocabulary as `<mnx-score-viewer>.theme`, deliberately —
 *  two names for one idea is how a chrome and its score end up disagreeing. */
export type ThemeSetting = 'auto' | 'light' | 'dark';

@customElement('mnx-workbench')
export class WorkbenchApp extends LitElement {
  @state() private route: Route = parseHash(location.hash);
  @state() private query = '';
  /** One clipboard outlives every route/page/session but deliberately not the
   *  application. It stores the serialized clip only; ScenarioPage receives
   *  the transport seam, never a shared mutable model object. */
  private readonly selectionClipboard = new MemorySelectionClipboardStore();
  /** The palette overlay: 'goto' (Ctrl+G, and `/` when no editor claims it),
   *  or 'commands' when go-to's `>` prefix asks for the command list. The
   *  tray's `global` tab is the editor-side door to those same commands. */
  @state() private palette: 'commands' | 'goto' | null = null;
  /** Rail visibility (Ctrl+B / the header chevron) — remembered per browser;
   *  a UI preference, so localStorage, not the document store. */
  @state() private railHidden = localStorage.getItem(RAIL_HIDDEN_KEY) === '1';

  private toggleRail() {
    this.railHidden = !this.railHidden;
    localStorage.setItem(RAIL_HIDDEN_KEY, this.railHidden ? '1' : '0');
    this.toggleAttribute('rail-hidden', this.railHidden);
  }

  /** THE THEME (roadmap/proposed/core-modernist-dark.md).
   *
   *  The dark half existed in the token sheet from the start and nothing could
   *  turn it on: `resolved-theme` appeared exactly once in the codebase, in its
   *  own selector. This is the switch it was waiting for.
   *
   *  Two mechanisms, and both are needed. `resolved-theme` selects the token
   *  block — an ATTRIBUTE, so `auto` has to be resolved here rather than left
   *  to a media query. `color-scheme` (declared in CSS off the same attribute)
   *  then re-resolves every `light-dark()` pair below us, which is what carries
   *  the SCORE with the chrome: `color-scheme` is an inherited property and
   *  crosses shadow boundaries, so `<mnx-score-viewer theme="auto">` picks up
   *  the app's choice without a single prop being threaded. It also pins native
   *  widgets — the HUD's instrument `<select>` and capo input, and scrollbars —
   *  which would otherwise stay light under dark chrome. */
  @state() private theme: ThemeSetting = readTheme();
  private darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  private resolvedTheme(): 'light' | 'dark' {
    return this.theme === 'auto' ? (this.darkQuery.matches ? 'dark' : 'light') : this.theme;
  }

  private applyTheme() {
    this.setAttribute('resolved-theme', this.resolvedTheme());
  }

  private setTheme(next: ThemeSetting) {
    this.theme = next;
    localStorage.setItem(THEME_KEY, next);
    this.applyTheme();
  }

  /** Only meaningful while the setting is `auto`; harmless otherwise. */
  private onSchemeChange = () => {
    if (this.theme === 'auto') this.applyTheme();
  };

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

      /* Declaring color-scheme is what carries the SCORE with the chrome:
         light-dark() resolves against the used scheme, and the property is
         inherited, so it crosses into <mnx-score-viewer>'s shadow root and
         re-resolves scoreTokens in one stroke. It also pins native widgets —
         the HUD's <select> and capo input, and the scrollbars. */
      :host([resolved-theme='light']) {
        color-scheme: light;
      }

      :host([resolved-theme='dark']) {
        color-scheme: dark;
      }

      /* The rail folds away (Ctrl+B / the header chevron) — all width goes
         to the score. */
      :host([rail-hidden]) {
        grid-template-columns: 0 1fr;
      }

      :host([rail-hidden]) nav {
        display: none;
      }

      .rail-toggle {
        font-family: var(--mono);
        font-size: 12px;
        color: var(--ink-2);
        background: transparent;
        border: 1px solid var(--line-strong);
        border-radius: var(--radius-tab);
        padding: 1px 8px;
        cursor: pointer;
        align-self: center;
      }

      .rail-toggle:hover {
        color: var(--accent);
        border-color: var(--accent);
      }

      /* THE HEADER AS A BAND (workbench-chrome-language.md). Structurally this
         was always the panel's band 3 — pinned, never scrolling, naming what
         you are looking at — so it now says so: the context ground, and a full
         2px ink rule under it rather than a hairline. Alignment moves from
         baseline to centre because a band aligns its contents to itself. */
      header {
        grid-area: header;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 0 18px;
        min-height: 46px;
        background: var(--bg-context);
        border-bottom: var(--rule-w) solid var(--ink);
      }

      header .brand {
        font-family: var(--sans);
        font-size: 15px;
        /* 600, the weight .ctx-name uses for the thing being named. Not
           uppercase: this is a name, not a label. */
        font-weight: 600;
      }

      header .brand a {
        color: inherit;
        text-decoration: none;
      }

      /* The facts strip is a STAT STRIP, and the panel already decided what one
         looks like (.fact-k / .fact-v). Same two roles here, inline rather than
         in four columns. The values stay in Archivo rather than mono for the
         same reason the panel's do: a version and a count are facts being read,
         not identifiers being copied — two voices spends mono on ids, hashes
         and paths. */
      header .facts {
        display: flex;
        gap: 18px;
        margin-left: auto;
        align-items: baseline;
      }

      header .fact {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }

      header .fact-k {
        font: 600 9.5px/1 var(--sans);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--ink-3);
      }

      header .fact-v {
        font: 600 12px/1.2 var(--sans);
        color: var(--ink-2);
        font-variant-numeric: tabular-nums;
      }

      /* The coverage fraction was always a tease; make it the door. */
      header a.fact-v {
        text-decoration: underline;
        text-decoration-color: var(--line-strong);
        text-underline-offset: 3px;
      }

      header a.fact-v:hover {
        color: var(--accent-fg);
        text-decoration-color: var(--accent);
      }

      /* THE RAIL, BANDED (workbench-chrome-language.md). The whole nav used to
         be one scroll; it is now the panel's frame mirrored — a pinned context
         band (the queue link and the filter) over the ONE scrolling body. The
         right edge is a full rule, so the score sits between two 2px rules of
         equal weight instead of a hairline on one side and .panel's rule on the
         other. */
      nav {
        grid-area: rail;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
        background: var(--bg-rail);
        border-right: var(--rule-w) solid var(--ink);
      }

      /* Band 3: pinned, so the filter you are typing into cannot scroll away
         from the list it filters. */
      .rail-context {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px;
        background: var(--bg-context);
        border-bottom: var(--rule-w) solid var(--ink);
      }

      /* Band 4 — the only scrolling region in the rail. */
      .rail-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 4px 0 24px;
      }

      main {
        grid-area: main;
        overflow: hidden;
        min-width: 0;
      }

      /* Inside the band, so it carries the band's own surface rather than a
         margin. The context bar's buttons are the nearest relative in the
         panel; this one is a full-width destination rather than an action, so
         it keeps prose case and the reading size. */
      .queue-link {
        display: block;
        padding: 7px 10px;
        font-size: 12.5px;
        font-weight: 500;
        color: var(--ink);
        text-decoration: none;
        background: var(--surface);
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
        width: 100%;
        padding: 6px 9px;
        font: inherit;
        font-size: 12px;
        color: var(--ink);
        background: var(--surface);
        border: 1px solid var(--line);
        box-sizing: border-box;
      }

      .search:focus-visible {
        outline: var(--rule-w) solid var(--focus-ring);
        outline-offset: 1px;
      }

      /* Type comes from .band-label; only the layout is local — the count sits
         out at the right margin, which the section headings elsewhere do not
         do. */
      .cat {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 14px 18px 5px;
      }

      /* Left padding is 16 rather than 18 because .row-state draws a 2px edge
         on EVERY row: the text stays put when a row becomes current, which is
         the whole reason that primitive reserves the edge. */
      .item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 18px 4px 16px;
        font-size: 12.5px;
        color: var(--ink);
        text-decoration: none;
      }

      /* Queue state, by shape as well as colour. */
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
        box-sizing: border-box;
      }

      /* THE FOUR STATES, in one accent (workbench-queue-pips.md). Reading down
         the rail the marks go: a red haloed dot you cannot miss, a dark ring, a
         solid mid dot, a pale dot asking for nothing. Colour names only the
         first; the rest is lightness and shape, so the column still sorts with
         the colour taken away. */

      /* Stop. The one saturated mark, and the only haloed one - the halo used
         to sit on current, which is the state wanting the LEAST attention. */
      .dot.blocked {
        background: var(--st-blocked);
        box-shadow: 0 0 0 2px color-mix(in oklab, var(--st-blocked), transparent 72%);
      }

      /* Approved once, output has moved since — hollow: the ring is still
         there, the substance isn't. Darkest of the inks, because after a hard
         block this is the most actionable thing on the list: somebody already
         judged it and it changed underneath them. */
      .dot.stale {
        background: transparent;
        border: 2px solid var(--st-stale);
      }

      /* Renders, but no human has ever signed it off: present, unjudged. */
      .dot.never-seen {
        background: var(--st-unseen);
      }

      /* Approved and still matching its goldens - nothing to do, so it recedes.
         The queue counts these and deliberately does not list them. */
      .dot.current {
        background: var(--st-current);
      }

      /* Orthogonal to state: rejected by the schema on purpose. */
      .dot.by-design {
        border-radius: var(--radius-hair);
        transform: rotate(45deg);
      }

      .label {
        flex: 1;
        min-width: 0;
      }

      /* Provenance chips, and deliberately the panel's .def chip in miniature —
         mono on --surface inside a hairline, because both are machine-owned
         words attached to something a person is reading. */
      .tag {
        flex-shrink: 0;
        font-family: var(--mono);
        font-size: 9px;
        letter-spacing: 0.04em;
        color: var(--ink-3);
        background: var(--surface);
        border: 1px solid var(--line);
        padding: 0 4px;
        line-height: 1.5;
      }

      /* Provenance, not a queue state - but a proposed-schema scenario is an
         unusual thing to be looking at, so it earns the accent. */
      .tag.proposed {
        color: var(--accent-fg);
        border-color: color-mix(in oklab, var(--accent), transparent 55%);
      }

      .cat-n {
        margin-left: auto;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this.onHashChange);
    window.addEventListener('keydown', this.onKeyDown);
    this.darkQuery.addEventListener('change', this.onSchemeChange);

    this.toggleAttribute('rail-hidden', this.railHidden);
    this.applyTheme();
    // If this load is OpenRouter's PKCE callback (`?code=` in the search —
    // the hash router never sees it), exchange the code and return to the
    // route the connect started from (core-assist-byok.md).
    void completePkceLanding().then(landing => {
      if (landing.kind === 'none') return;
      parkLanding(landing);
      if (landing.returnHash && landing.returnHash !== location.hash) location.hash = landing.returnHash;
      else this.onHashChange();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.darkQuery.removeEventListener('change', this.onSchemeChange);
    window.removeEventListener('hashchange', this.onHashChange);
    window.removeEventListener('keydown', this.onKeyDown);

  }

  /** The shell's keys: `/` opens a command surface (the tray, else go-to),
   *  Ctrl+G opens go-to (whose `>` prefix reaches commands), Ctrl+B folds
   *  the rail — all resolved through the keymap module's shell table, which
   *  stays the sole KeyboardEvent interpreter. Everything score-shaped is the
   *  scenario page's keymap, not ours. */
  private onKeyDown = (event: KeyboardEvent) => {
    // The SHELL's bindings are page-level by nature (the rail, the palette,
    // go-to), so they keep document scope — `host: null`
    // (core-editor-focus-scope.md: shell bindings do not travel to embeds,
    // which is why they live here and not in an element-tier layer).
    if (!keyIsOurs(event, null)) return;
    const action = resolveShellAction(strokeOf(event));
    if (action === 'selectionTray') {
      // `/` belongs to the selection (core-selection-tray-visuals.md): a
      // scenario page whose editor holds the keyboard claims this cancelable
      // intent and opens the tray.
      //
      // Unclaimed — the queue, the coverage map, a scenario with no session —
      // it opens go-to instead. That is deliberately the SAME job slash used
      // to do from the rail: type a few letters, land on a scenario. The
      // mechanism changes (a jump, not a filter) and the reach widens (bars
      // and objects too), but the muscle memory survives, which is the whole
      // reason slash was worth taking.
      event.preventDefault();
      const claimed = !window.dispatchEvent(
        new CustomEvent('mnx-tray-intent', { cancelable: true })
      );
      if (!claimed) this.palette = 'goto';
      return;
    }
    if (action === 'commandPalette' || action === 'goTo') {
      event.preventDefault();
      this.palette = action === 'commandPalette' ? 'commands' : 'goto';
      return;
    }
    if (action === 'toggleRail') {
      event.preventDefault();
      this.toggleRail();
      return;
    }
    if (action === 'togglePanel') {
      // The panel belongs to the scenario page, so the shell asks it rather
      // than mirroring its state — and a no-op anywhere else is right: on
      // #/objects there is no panel to fold.
      const page = this.scenarioPage();
      if (!page) return;
      event.preventDefault();
      page.togglePanel();
      return;
    }
  };

  /** The mounted scenario page, when one is routed. */
  private scenarioPage(): ScenarioPage | null {
    return this.renderRoot?.querySelector<ScenarioPage>('mnx-scenario-page') ?? null;
  }

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
      nav('go: objects coverage', objectsHref()),
      {
        label: `view: ${this.railHidden ? 'show' : 'hide'} scenario rail`,
        hint: 'Ctrl+B',
        run: () => this.toggleRail()
      },
      // Offered only where there is a panel to fold — the palette lists what
      // it can actually do, and on #/objects this row would be a dead entry.
      ...(this.scenarioPage()
        ? [
            {
              label: `view: ${this.scenarioPage()!.panelIsHidden ? 'show' : 'hide'} score panel`,
              hint: 'Ctrl+Alt+B',
              run: () => this.scenarioPage()?.togglePanel()
            }
          ]
        : []),
      // The theme's only control, and deliberately no keystroke: the free-key
      // budget belongs to the element-ops campaign, and a theme switch is not
      // a thing you reach for mid-edit. All three settings are offered rather
      // than a toggle, because `auto` is a real third answer — "follow the
      // machine" — and a two-state toggle cannot express it.
      ...(['auto', 'light', 'dark'] as const)
        .filter(t => t !== this.theme)
        .map(t => ({
          label: `view: theme ${t}${t === 'auto' ? ` (now ${this.resolvedTheme()})` : ''}`,
          run: () => this.setTheme(t)
        }))
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
        action('edit: revert edits', 'revert')
      );
      // ALL NINE setup popovers, from the one table the page also uses
      // (workbench-score-panel.md, step C). The palette used to carry four of
      // them by hand while the rest were reachable only from the `actions`
      // tab; that tab is retired, so the gap had to close first — and driving
      // both from one list is what stops it reopening.
      for (const p of SETUP_POPOVER_COMMANDS) {
        if (p.needsTab && !entry.hasTab) continue;
        items.push(action(p.label, p.action, p.stroke));
      }
      if (entry.hasTab)
        items.push(
          // The staffKind toggles keep SURFACE_INTENTS honest: the palette
          // really emits setStaffKind (element-ops exemplar — the kind gates
          // the tab/both projections, so it is document data, not view state).
          intent('setup: tab staff — both', { type: 'setStaffKind', kind: 'both' }),
          intent('setup: tab staff — tab', { type: 'setStaffKind', kind: 'tab' }),
          intent('setup: tab staff — notation', { type: 'setStaffKind', kind: 'notation' })
        );
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
    // The current row is the SHARED row state (sharedChrome's .row-state /
    // .row-current), not a rail-local tint: it is the same "this is the one"
    // the ops list and the HUD's active rung draw. Adopting it here is what
    // stops the rail from spelling the state a fourth way.
    const current = e.id === active;
    return html`
      <a
        class="item row-state ${current ? 'row-current' : ''}"
        href=${scenarioHref(e.id)}
        aria-current=${current}
      >
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
        <button
          class="rail-toggle"
          title="${this.railHidden ? 'show' : 'hide'} the scenario rail (Ctrl+B)"
          @click=${() => this.toggleRail()}
        >
          ${this.railHidden ? '⟩' : '⟨'}
        </button>
        <span class="brand"><a href="#/">MNX Lab — workbench</a></span>
        <span class="facts">
          <span class="fact">
            <span class="fact-k">MNX</span>
            <span class="fact-v">v${corpusManifest.mnxVersion}</span>
          </span>
          <span class="fact">
            <span class="fact-k">ext</span>
            <span class="fact-v">v${corpusManifest.extensionVersion}</span>
          </span>
          <span class="fact">
            <span class="fact-k">coverage</span>
            <a class="fact-v" href=${objectsHref()} title="every non-plumbing $def, by coverage"
              >${coverage.covered}/${coverage.total}</a
            >
          </span>
          <span class="fact">
            <span class="fact-k">scenarios</span>
            <span class="fact-v">${corpus.length}</span>
          </span>
        </span>
      </header>
      <nav>
        <div class="rail-context">
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
        </div>
        <div class="rail-body">
          ${[...this.grouped()].map(
            ([group, entries]) => html`
              <div class="cat band-label">
                ${group}<span class="cat-n">${entries.length}</span>
              </div>
              ${entries.map(e => this.railItem(e, active))}
            `
          )}
        </div>
      </nav>
      <main>
        ${this.route.page === 'scenario'
          ? html`<mnx-scenario-page
              .scenarioId=${this.route.id ?? ''}
              .view=${this.route.view ?? ''}
              .selectionClipboard=${this.selectionClipboard}
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
