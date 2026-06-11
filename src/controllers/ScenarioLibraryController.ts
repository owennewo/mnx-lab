import { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  corpus,
  coverage,
  filterCorpus,
  statusCounts,
  type Facet,
  type LibraryFilter,
  type ScenarioEntry,
  type StatusFilter,
  type StatusCounts,
  type Coverage
} from '../library/corpus.ts';

export interface ActiveScenario {
  entry: ScenarioEntry;
  mnxJson: unknown;
  notes: string | null;
}

/**
 * Owns corpus browsing state: the flat filter (status chips + query +
 * id-refs toggle), the shelving facet, and the selected scenario (whose
 * score/notes load on demand). Follows the project's controller pattern —
 * mutate here, mirror via host.requestUpdate(), consume as plain data.
 */
export class ScenarioLibraryController implements ReactiveController {
  host: ReactiveControllerHost;

  facet: Facet = 'category';
  status: StatusFilter = 'all';
  query = '';
  idRefsOnly = false;

  active: ActiveScenario | null = null;
  isLoading = false;

  readonly entries: ScenarioEntry[] = corpus;
  readonly counts: StatusCounts = statusCounts();
  readonly coverage: Coverage = coverage;

  private loadToken = 0;

  constructor(host: ReactiveControllerHost) {
    (this.host = host).addController(this);
  }

  hostConnected() {}

  get filter(): LibraryFilter {
    return { status: this.status, query: this.query, idRefsOnly: this.idRefsOnly };
  }

  get isFiltering(): boolean {
    return this.status !== 'all' || this.query !== '' || this.idRefsOnly;
  }

  visible(): ScenarioEntry[] {
    return filterCorpus(this.filter);
  }

  setFacet(facet: Facet) {
    this.facet = facet;
    this.host.requestUpdate();
  }

  setStatus(status: StatusFilter) {
    this.status = status;
    this.host.requestUpdate();
  }

  setQuery(query: string) {
    this.query = query;
    this.host.requestUpdate();
  }

  toggleIdRefs() {
    this.idRefsOnly = !this.idRefsOnly;
    this.host.requestUpdate();
  }

  /** Def-chip click on the scenario page: shelve by $def and search for it. */
  shelveByDef(def: string) {
    this.facet = 'def';
    this.status = 'all';
    this.idRefsOnly = false;
    this.query = def;
    this.host.requestUpdate();
  }

  async select(id: string | null) {
    if (id === null) {
      this.active = null;
      this.host.requestUpdate();
      return;
    }
    const entry = this.entries.find(e => e.id === id);
    if (!entry) return;
    const token = ++this.loadToken;
    this.isLoading = true;
    this.host.requestUpdate();
    try {
      const [mnxJson, notes] = await Promise.all([
        entry.loadScore(),
        entry.loadNotes ? entry.loadNotes() : Promise.resolve(null)
      ]);
      if (token !== this.loadToken) return; // a newer selection won
      this.active = { entry, mnxJson, notes };
    } catch (err) {
      console.error(`Failed to load scenario ${id}`, err);
    } finally {
      if (token === this.loadToken) {
        this.isLoading = false;
        this.host.requestUpdate();
      }
    }
  }

  /** Step selection through the current filtered flat list (j/k, arrows). */
  step(dir: 1 | -1): string | null {
    const vis = this.visible();
    if (vis.length === 0) return null;
    const i = vis.findIndex(e => e.id === this.active?.entry.id);
    const next = i < 0 ? (dir > 0 ? 0 : vis.length - 1) : Math.max(0, Math.min(vis.length - 1, i + dir));
    return vis[next].id;
  }
}
