// #/piece/<id> — one piece, fullscreen. Fetches the canonical FILE through the
// library's read route (a .gp for a Soundslice piece), converts it in the
// importers' clean-room worker — the service stores the source, the reader
// converts — and mounts it in the score frame: <mnx-document-viewer> filling
// the pane, <mnx-player> in the frame's bottom strip, wired through the
// plain-DOM host binding the embed face exports. It began read-only; it now
// EDITS and SAVES (see the dated notes below) — what it still owns for itself
// is only per-browser preferences: the staff view, the display settings, zoom
// and spacing.
//
// The chrome is the frame's (roadmap/inprogress/core-score-frame.md): the
// library page's tools row above the score and the player's tray below, hidden
// and shown together by the focus mark on the pane's corner (one toggle since
// 2026-09-15; the edge grips went). This page supplies what the frame prints
// and stores what it changes. Trimmed 2026-09-13: the tools row carries the way
// back, the title, Zoom, Settings, Tags and the theme toggle — the tag chips
// went (the Tags sheet shows them), the staff view lives in Settings alone,
// and the account menu is the library page's (a piece is not where you sign
// out). 2026-09-14: what plays left the tray for the tools row — a Source
// button that names it, opening the Source sheet (choose, edit, add) in the
// frame's side slot beside Instruments; the recording editor opens there too.
// 2026-09-17: the tray's sync bar makes a recording's sync here; this page is
// the host that stores it (roadmap/complete/studio-sync-bar.md).
// 2026-09-17, later: the page EDITS. The Details sheet (the document's own
// metadata) came first, with the save session that stores its work as `.gp`
// checkpoints with nobody asked to save (roadmap/complete/studio-save-pipeline.md);
// then versions, revert and delete (roadmap/complete/studio-piece-lifecycle.md);
// then the editor's mount — notes from the keyboard, the rung inspector on Enter,
// the lyric editor on Shift+L (roadmap/complete/core-editor-element-promotion.md).
// Every document change arrives through ONE door, `showDocument`, from the
// editor binding's `onChange`; previews (an older version, the lyric editor's
// scratch) set `this.doc` directly and are never told to the save session.
import { LitElement, css, html, nothing } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { customElement, property, query, state } from 'lit/decorators.js';
import { LibraryClient, LibraryRequestError, type LibrarySnapshot, type ProjectedTag } from '../../../src/storage/libraryClient.ts';
import { documentTitle, documentArtist, type MnxDocument, type MnxStructure } from '../../../src/model/mnx.ts';
import { derivedLibraryTags } from '../../../src/model/libraryTags.ts';
import type { WorkChange } from '../../../src/edit/ops.ts';
import type { EditorIntent } from '../../../src/edit/intents.ts';
import { refusalNotice, type RefusalReason } from '../../../src/edit/clipboardFeedback.ts';
import type { EditorBinding } from '../../../src/elements/editorHost.ts';
import { MemorySelectionClipboardStore } from '../../../src/edit/selectionClipboard.ts';
import './KeysSheet.ts';
import { SaveSession, StaleWriteError, type SaveState } from '../../../src/storage/saveSession.ts';
import { indexedDbRecoveryStore } from '../../../src/storage/recoveryStore.ts';
import { saveChip, savedAge } from '../../../src/storage/saveChip.ts';
import { pieceVersions } from '../../../src/storage/versions.ts';
import { checkForStorage, type StorageLoss } from '../../../src/importers/storageCheck.ts';
import { type DisplayOptions } from '../../../src/engine/displayOptions.ts';
import type { RenderScale } from '../../../src/engine/render/scale.ts';
import { openLocalFile } from '../../../src/importers/localFile.ts';
import { bindPlayback } from '../../../src/elements/playbackHost.ts';
import { normalizeDisplayPreferences } from '../../../src/elements/displayDefaults.ts';
import type { DocumentViewer, ViewMode, ViewSetting } from '../../../src/elements/DocumentViewer.ts';
import type { RecordingSource } from '../../../src/audio/playbackBackend.ts';
import type { Player, SyncEdit } from '../../../src/elements/Player.ts';
import { isImportedSync, storedScoreShape, storedSyncSegments } from '../../../src/model/recordingAttachment.ts';
import { performedShape } from '../../../src/audio/scoreShape.ts';
import { SYNC_SEGMENTS_FORMAT, type StudioSyncPayload } from '../../../src/model/syncSegments.ts';
import type { ZoomPadChange } from '../../../src/elements/ZoomPad.ts';
import { libraryReturnHref, returnToLibrary } from './StudioApp.ts';
import { nextTheme, readTheme, resolvedTheme, setTheme, themeGlyph, type ThemeSetting } from './theme.ts';
import { isKitPart, type PartMix } from '../../../src/audio/partMix.ts';
import './EditPieceSheet.ts';
import './RecordingsSheet.ts';
import './InstrumentsSheet.ts';
import { sourceGlyph } from './SourceSheet.ts';
import './SaveSheet.ts';
import { BUILD } from './build.ts';
import { pieceFilename } from './pieceFile.ts';
import { JUST_DELETED_KEY, libraryHref, pieceHref } from './StudioApp.ts';
import type { EditPieceSnapshot } from './EditPieceSheet.ts';
import type { InstrumentPart } from './InstrumentsSheet.ts';

import { VIEW_KEY, DISPLAY_KEY, UNROLLED_KEY, STAFF_SP_KEY, SPACE_SP_KEY, SPACING_MODE_KEY, FOCUSED_KEY, write, readView, readDisplay, readUnrolled, readSpacingMode, readStaffSp, readSpaceSp, readFocused, readParts, writeParts, normalizePiecePrefs, canonicalJson, type PiecePreferences } from './scorePreferences.ts';

const back = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"></path></svg>`;
/** Instruments: three faders, each knob at its own level. */
const mixerGlyph = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4v5M6 13v7M12 4v11M12 19v1M18 4v1M18 9v11"></path><circle cx="6" cy="11" r="2"></circle><circle cx="12" cy="17" r="2"></circle><circle cx="18" cy="7" r="2"></circle></svg>`;
const keysGlyph = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8"></path></svg>`;
const saveGlyph = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"></path></svg>`;
/** Cut and copied selections, for this tab: a bar copied in one piece can be pasted into the next. */
const selectionClipboard = new MemorySelectionClipboardStore();
/** The selection ladder's rungs, as a person would say them. */
const RUNG_NAMES: Record<string, string> = { note: 'a note', event: 'a beat', voiceMeasure: 'a voice in a bar', partMeasure: 'a part’s bar', measure: 'a bar', document: 'the whole piece' };
/** Unsaved edits, on this device only, until the next checkpoint. One store for every piece. */
const recoveryStore = indexedDbRecoveryStore<MnxStructure>();
const pencilGlyph = html`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4z"></path><path d="M13 7l4 4"></path></svg>`;

@customElement('mnx-studio-piece')
export class PiecePage extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @property({ type: String }) pieceId = '';
  @state() private snapshot: LibrarySnapshot | null = null;
  @state() private recordings: readonly RecordingSource[] = [];
  @state() private doc: MnxDocument | null = null;
  @state() private error = '';
  @state() private loading = true;
  @state() private editOpen = false;
  /** The recording editor (edit or add), in the side slot. */
  @state() private recordingsOpen = false;
  @state() private sourceOpen = false;
  @state() private instrumentsOpen = false;
  @state() private saveOpen = false;
  @state() private keysOpen = false;
  /** What a copy, cut or paste did, or why it did not; it names the last outcome and leaves. */
  @state() private clipboardNotice = '';
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  /** The save session's state, for the chip; null until a piece with a stored score is open. */
  @state() private save: SaveState | null = null;
  /** The last checkpoint's losses in full; the state carries their shapes. */
  @state() private losses: readonly StorageLoss[] = [];
  /** What the importer said when the stored file was opened. Shown, never stored. */
  @state() private conversionNotes: readonly string[] = [];
  /** The score as a recording sees it — each performed bar's length (src/audio/scoreShape.ts). */
  @state() private scoreShape = '';
  /** An older version on screen instead of the current document. Looking changes nothing. */
  @state() private viewing: { id: string; label: string; document: MnxStructure } | null = null;
  /** Another tab holds this piece's edit lock. */
  @state() private readOnly = false;
  /** The chip's clock; coarse, so the tray is not re-rendered every second. */
  @state() private now = Date.now();
  /** The recording the editor shows — not necessarily the one playing. */
  @state() private editingRecordingId: string | null = null;
  /** The piece's parts as the reader left them: off the score, and the mix. */
  @state() private hiddenParts: readonly number[] = [];
  @state() private partMix: PartMix = {};
  /** What is playing — a recording has no parts to mix. */
  @state() private playbackKind: string | undefined;
  @state() private selectedRecordingId: string | null = null;
  @state() private addingRecording = false;
  @state() private recordingWarning: { id: string; message: string } | null = null;
  @state() private theme: ThemeSetting = readTheme();
  @state() private view: ViewSetting = readView();
  @state() private display: DisplayOptions = readDisplay();
  @state() private unrolled = readUnrolled();
  @state() private staffSp: number | null = readStaffSp();
  @state() private densityH: number | null = readSpaceSp();
  @state() private spacingMode: 'natural' | 'fill' = readSpacingMode();
  @state() private effectiveStaffSp = 1;
  /** Whether the reader left the score focused (the frame's strips hidden) — a per-browser preference. */
  @state() private focused = readFocused();
  @query('mnx-document-viewer') private viewer!: DocumentViewer;
  @query('mnx-player') private player!: Player;
  private binding: ReturnType<typeof bindPlayback> | null = null;
  private generation = 0;
  /** The sync bar's latest unsaved edit; saves are debounced and serial. */
  private pendingSync: (SyncEdit & { piece: string }) | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | undefined;
  private syncSaving = false;
  /** The owner's setup for this piece, debounced the same way; the last write wins. */
  private pendingPrefs: { piece: string; prefs: PiecePreferences } | null = null;
  private prefsTimer: ReturnType<typeof setTimeout> | undefined;
  /** What the library holds, canonically serialized, so an unchanged setup writes nothing. */
  private savedPrefs = '';
  // ── editing and saving (roadmap: studio-save-pipeline) ───────────────────
  /** The editor's mount (src/elements/editorHost.ts), loaded only for a piece that can be edited: one history for notes and metadata alike. */
  private editor: EditorBinding | null = null;
  /**
   * A touch device plays; it does not edit
   * ([studio-editor-touch](../../../roadmap/rejected/studio-editor-touch.md)).
   * Studio's editing is a keyboard instrument — every verb is a keystroke — so
   * where the primary pointer is coarse this page never binds the editor at
   * all: no cursor, no lock, no chunk loaded, and the sheets that edit say why.
   * Read once, because the answer is what kind of machine this is.
   */
  private readonly playOnly = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  private session: SaveSession<MnxStructure> | null = null;
  /** Once the document has been edited here, the heading reads the document, not the library's tags. */
  private touched = false;
  private pendingLosses: readonly StorageLoss[] = [];
  /** The kinds of loss already reported with evidence this session: a defect report is sent once per new kind, not per autosave. */
  private reportedLosses = new Set<string>();
  private pendingLossKind: string | null = null;
  private releaseLock: (() => void) | null = null;
  private ticker: ReturnType<typeof setInterval> | undefined;
  /** Every write this page makes to the piece, one at a time: they all move one revision. */
  private writes: Promise<unknown> = Promise.resolve();
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.writes.then(job, job);
    this.writes = run.catch(() => {});
    return run;
  }
  private readonly onHidden = () => { if (document.visibilityState === 'hidden') void this.session?.flush(); };
  private readonly onPageHide = () => void this.session?.flush();

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
    mnx-score-frame {
      height: 100%;
    }
    /* The viewer is its own scroll container at the pane's full height; its
       5px of padding must count inside that height, or the pane overflows by
       10px and grows a second scrollbar beside the viewer's own. */
    mnx-document-viewer {
      display: block;
      height: 100%;
      box-sizing: border-box;
    }
    mnx-document-viewer[hidden] {
      display: none;
    }
    .notice {
      max-width: 36rem;
      margin: 20vh auto 0;
      padding: 0 24px;
      color: var(--ink-dim);
    }
    .notice h1 {
      font-size: 1.4rem;
      color: var(--ink);
      margin: 0 0 12px;
    }
    .notice a {
      color: inherit;
    }
    /* The theme toggle: a word and a mark, at the end of the tools row. The
       word is part of the control — three settings cannot be read off an
       icon, and auto has to say which way it currently resolves. */
    /* The save chip sits beside the title — the frame's chips slot — so it is on
       screen at any width; the tools row is where things go to be clipped. */
    button.save {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 6px;
      border: 0;
      border-radius: 3px;
      background: transparent;
      font: inherit;
      font-size: 13px;
      color: var(--ink-3, var(--ink-dim));
      white-space: nowrap;
      cursor: pointer;
    }
    button.save:hover,
    button.save[aria-pressed='true'] {
      background: light-dark(oklch(0.93 0.003 60), oklch(0.27 0.004 60));
    }
    button.save:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 1px;
    }
    button.save svg {
      width: 15px;
      height: 15px;
    }
    /* Where the editor's surfaces hang: over the whole score pane, passing every pointer through. */
    .editor-overlay {
      position: absolute;
      inset: 0;
      z-index: 4;
      pointer-events: none;
    }
    .clip-notice {
      position: absolute;
      z-index: 5;
      left: 50%;
      bottom: 12px;
      transform: translateX(-50%);
      margin: 0;
      padding: 6px 12px;
      border: 1px solid var(--line);
      border-radius: 3px;
      background: var(--bar, light-dark(#fff, #222));
      font-size: 13px;
      pointer-events: none;
    }
    .viewing {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin: 0;
      /* The frame's focus mark sits on the pane's top-right corner. */
      padding: 8px 56px 8px 14px;
      border-bottom: 1px solid var(--line);
      background: light-dark(oklch(0.95 0.02 85), oklch(0.3 0.03 85));
      font-size: 13px;
    }
    .viewing span {
      flex: 1;
      min-width: 12rem;
    }
    .viewing button {
      font: inherit;
      color: inherit;
      background: transparent;
      border: 1px solid var(--line);
      border-radius: 3px;
      padding: 4px 10px;
      cursor: pointer;
    }
    .viewing button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    button.save.risk {
      color: var(--accent);
    }
    button.save.warn {
      color: light-dark(#a12121, #ffb4ab);
    }
    .theme span {
      text-transform: capitalize;
    }
  `;

  private cycleTheme() {
    this.theme = nextTheme(this.theme);
    setTheme(this.theme);
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this.onHidden);
    window.addEventListener('pagehide', this.onPageHide);
    this.ticker = setInterval(() => { if (this.save) this.now = Date.now(); }, 30_000);
  }

  disconnectedCallback() {
    document.removeEventListener('visibilitychange', this.onHidden);
    window.removeEventListener('pagehide', this.onPageHide);
    clearInterval(this.ticker);
    this.endSession();
    void this.flushSync();
    void this.flushPrefs();
    ++this.generation;
    this.binding?.dispose();
    this.binding = null;
    super.disconnectedCallback();
  }

  // The viewer and the player are always in the DOM (the viewer hidden until a
  // document arrives) so the binding is made once and survives piece-to-piece
  // navigation.
  protected updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('pieceId')) void this.load();
    let fresh = false;
    if (!this.binding && this.player && this.viewer) {
      this.binding = bindPlayback(this, this.viewer, this.player);
      fresh = true;
    }
    if (this.binding && this.doc && (fresh || changed.has('doc'))) this.present(this.doc);
    // The pane, the lock or an older version on screen changed what the keys may do and where the cursor may show.
    if (this.editor && (changed.has('view') || changed.has('viewing') || changed.has('readOnly')))
      void this.viewer?.updateComplete.then(() => this.editor?.refresh());
  }

  private async load() {
    this.endSession();
    void this.flushSync();
    void this.flushPrefs();
    const generation = ++this.generation;
    this.binding?.dispose(); this.binding = null;
    this.player?.stop();
    if (this.player) this.player.performance = null;
    this.recordings = []; this.snapshot = null;
    this.doc = null;
    this.error = '';
    this.loading = true;
    this.editOpen = false; this.recordingsOpen = false; this.sourceOpen = false; this.saveOpen = false; this.keysOpen = false; this.selectedRecordingId = null; this.editingRecordingId = null; this.addingRecording = false;
    ({ hidden: this.hiddenParts, mix: this.partMix } = readParts(this.pieceId));
    try {
      const readPair = () => Promise.all([
        this.client.canonical(this.pieceId),
        this.client.piece(this.pieceId).then(r => r.snapshot, () => null),
      ]);
      let [canonical, snapshot] = await readPair();
      const mismatched = () => snapshot && canonical.renditionId !== undefined && canonical.renditionId !== snapshot.piece.canonical_rendition_id;
      // Immutable rendition identity pairs the file with its metadata even when
      // the canonical pointer changes between the two parallel reads.
      for (let attempt = 0; mismatched() && attempt < 2; attempt++) [canonical, snapshot] = await readPair();
      if (mismatched()) throw new Error('The score changed while opening. Reopen the piece to review its current timings.');
      const { bytes, filename } = canonical;
      if (generation !== this.generation) return;
      this.snapshot = snapshot;
      this.setRecordings(snapshot);
      // The library remembers what was opened; the recent sort reads it. Never blocking.
      void this.client.opened(this.pieceId).catch(() => {});
      const opened = await openLocalFile(new File([bytes], filename));
      if (generation !== this.generation) return;
      let mnxJson = opened.document;
      this.conversionNotes = opened.warnings;
      if (snapshot && canonical.renditionId) {
        const recovered = await this.beginSession(this.pieceId, mnxJson, canonical.renditionId);
        if (generation !== this.generation) return;
        if (recovered) mnxJson = recovered;
      }
      this.doc = {
        id: `library:${this.pieceId}`,
        name: (this.touched ? documentTitle(mnxJson) : null) ?? this.tag('title') ?? documentTitle(mnxJson) ?? opened.name,
        lastUpdated: Date.now(),
        mnxJson,
      };
      void this.applyPrefs(snapshot, mnxJson.parts.length, generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.error = error instanceof Error ? error.message : 'The library is unavailable.';
      if (error instanceof LibraryRequestError && error.status === 403) location.hash = '#/not-permitted';
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  // ── editing and saving ──────────────────────────────────────────────────
  // Nobody is asked to save. The session is told when the document changes and
  // does the rest: a local recovery record while edits are unsaved, a `.gp`
  // checkpoint after a pause, and the round trip measured every time
  // (src/storage/saveSession.ts holds the logic; these are its ports).

  /** Start saving for the piece just opened. Returns this device's unsaved edits, if it has any to continue from. */
  private async beginSession(pieceId: string, document: MnxStructure, renditionId: string): Promise<MnxStructure | null> {
    // A play-only device takes no lock: holding it would lock a real editor out from elsewhere.
    this.readOnly = this.playOnly || !(await this.takeLock(pieceId));
    const revisionOf = async () => (this.snapshot?.piece.id === pieceId ? this.snapshot : (await this.client.piece(pieceId)).snapshot).piece.revision;
    const session = new SaveSession<MnxStructure>(pieceId, document, { renditionId }, {
      prepare: async doc => {
        const result = await checkForStorage(doc);
        this.pendingLosses = result.losses;
        const derivedTags = this.projection(doc);
        const title = derivedTags.find(t => t.dimension === 'title')?.value ?? 'Untitled';
        return { file: { filename: pieceFilename(title), bytes: result.bytes, producerVersion: BUILD, producerOptions: result.options }, check: result.check, derivedTags,
          evidence: this.evidenceFor(doc, result.check) };
      },
      save: checkpoint => this.enqueue(async () => {
        try {
          const saved = await this.client.saveCheckpoint(pieceId, { expectedRevision: await revisionOf(), derivedFrom: checkpoint.derivedFrom,
            file: checkpoint.file, derivedTags: checkpoint.derivedTags, check: checkpoint.check, name: checkpoint.name, evidence: checkpoint.evidence });
          if (checkpoint.evidence && this.pendingLossKind) this.reportedLosses.add(this.pendingLossKind);
          if (this.pieceId === pieceId && this.session === session) { this.snapshot = saved.snapshot; this.losses = this.pendingLosses; }
          return { renditionId: saved.snapshot.piece.canonical_rendition_id!, unchanged: saved.unchanged };
        } catch (error) {
          if (error instanceof LibraryRequestError && error.status === 409) throw new StaleWriteError();
          throw error;
        }
      }),
      current: async () => {
        const fresh = (await this.client.piece(pieceId)).snapshot;
        if (this.pieceId === pieceId && this.session === session) { this.snapshot = fresh; this.setRecordings(fresh); }
        return { renditionId: fresh.piece.canonical_rendition_id ?? null };
      },
      recovery: recoveryStore, now: () => Date.now(), build: BUILD,
      schedule: (fn, ms) => { const timer = setTimeout(fn, ms); return () => clearTimeout(timer); }
    }, state => { if (this.session === session) { this.save = state; this.now = Date.now(); } });
    this.session = session;
    this.save = session.snapshot;
    this.losses = []; this.touched = false; this.viewing = null; this.reportedLosses.clear();
    let live = document;
    let found = this.readOnly ? null : await session.recoverable().catch(() => null);
    if (found) {
      const record = found.record.document as MnxStructure | undefined;
      if (record && typeof record === 'object' && record.mnx && Array.isArray(record.parts) && record.global) {
        live = found.record.document; this.touched = true;
        if (found.stale) this.saveOpen = true;
      } else {
        const unreadable = found; found = null;
        // Not something this build can open: hand it over as a file rather than guess at it.
        this.download(new Blob([JSON.stringify(unreadable.record.document, null, 2)], { type: 'application/json' }), `${pieceId}.recovered.json`);
        await session.discardRecovery();
        this.error = 'Unsaved edits from this device could not be opened here, so they were downloaded as a file.';
      }
    }
    // The editor's mount is its own chunk: a piece that only plays never loads it — which on a
    // touch device is every piece. The session still exists, and stays idle with nothing to save.
    if (this.playOnly) {
      this.editor?.dispose(); this.editor = null;
      session.adopt(live);
      return null;
    }
    // It copies the document it is given, so the save session is told which object IS the saved
    // one (or the recovered one) from here on.
    const { bindEditor } = await import('../../../src/elements/editorHost.ts');
    if (this.session !== session) return null;
    this.editor?.dispose();
    const editor = bindEditor(this.viewer, this.viewer, live, {
      documentId: '', onChange: doc => this.showDocument(doc),
      overlay: this.renderRoot.querySelector<HTMLElement>('.editor-overlay') ?? undefined,
      title: () => (this.doc ? documentTitle(this.doc.mnxJson) : null) ?? this.tag('title') ?? 'Untitled',
      // The lyric editor's live preview: drawn, never told to the save session.
      onPreview: preview => { if (this.doc && this.editor) this.doc = { ...this.doc, lastUpdated: Date.now(), mnxJson: preview ?? this.editor.document }; },
      clipboard: selectionClipboard,
      onNotice: notice => this.showNotice(notice.message),
      onState: () => { if (this.keysOpen || this.editOpen) this.requestUpdate(); },
      onRefused: (intent, reason) => this.sayRefused(intent, reason),
      readOnly: () => this.readOnly, suspended: () => !!this.viewing
    });
    this.editor = editor;
    if (found) session.recover({ ...found.record, document: editor.document }, found.stale);
    else session.adopt(editor.document);
    return editor.document;
  }

  /**
   * A defect report for the operator: the document this save was exported from,
   * sent only when the round trip lost or changed something, and only the first
   * time this session that this KIND of loss is seen (or the save is a named
   * version) — an autosave every half minute must not store the score each time.
   */
  private evidenceFor(doc: MnxStructure, check: { verdict: string; differences: { path: string; kind: string }[]; warnings: string[] }): string | null {
    this.pendingLossKind = null;
    if (check.verdict !== 'differs') return null;
    const kind = JSON.stringify([check.differences.filter(d => d.kind !== 'gained').map(d => `${d.kind} ${d.path}`).sort(), [...check.warnings].map(w => w.replace(/\d+/g, '#')).sort()]);
    if (this.reportedLosses.has(kind)) return null;
    // Marked reported only when the save lands: a failed save retries with its evidence.
    this.pendingLossKind = kind;
    const text = JSON.stringify(doc);
    return text.length <= 1024 * 1024 ? text : null;
  }

  /**
   * The library's tags as this document says them. A Soundslice piece keeps its
   * title and artist in the SIDECAR — its `.gp` may hold neither — so a tag that
   * came from there and that the document does not contradict is kept, as stored.
   * A tag Studio itself projected is the document's: clear the artist and the
   * tag goes; go back to a version without one and it goes too.
   */
  private projection(doc: MnxStructure): ProjectedTag[] {
    const tags: ProjectedTag[] = derivedLibraryTags(doc);
    for (const held of this.snapshot?.tags ?? [])
      if (held.origin === 'derived' && held.source_ref === 'sidecar' && ['title', 'artist'].includes(held.dimension) && !tags.some(t => t.dimension === held.dimension))
        tags.push({ dimension: held.dimension, value: held.value, kept: true });
    return tags;
  }

  /** Leaving the piece: save what is unsaved, then let go. The record stays until that save lands. */
  private endSession() {
    const session = this.session;
    this.session = null; this.save = null;
    this.editor?.dispose(); this.editor = null;
    if (session) void session.flush().finally(() => session.dispose());
    this.releaseLock?.(); this.releaseLock = null;
  }

  /** One editing tab per piece on this device; a second one reads. No Web Locks, no second-tab protection. */
  private takeLock(pieceId: string): Promise<boolean> {
    this.releaseLock?.(); this.releaseLock = null;
    if (!navigator.locks) return Promise.resolve(true);
    return new Promise(resolve => {
      void navigator.locks.request(`mnx-studio.piece.${pieceId}`, { ifAvailable: true }, lock => {
        resolve(!!lock);
        return lock ? new Promise<void>(release => (this.releaseLock = release)) : undefined;
      }).catch(() => resolve(true));
    });
  }

  private download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  /** An edit, an undo or a redo: the one way the document changes on this page. */
  private showDocument(mnxJson: MnxStructure) {
    if (!this.doc) return;
    this.touched = true;
    this.doc = { ...this.doc, name: documentTitle(mnxJson) ?? this.doc.name, lastUpdated: Date.now(), mnxJson };
    this.session?.documentChanged(mnxJson);
  }
  /** A sheet's edit goes through the same funnel as a key: the editor's session, which reports back through `showDocument`. */
  /**
   * Why an edit did not happen, in the line the page already uses for delete's
   * sentence. It exists because the opposite was genuinely baffling: on a piece
   * held open in another tab the cursor still moved — navigation is allowed
   * read-only — so a fret typed at a cursor sitting exactly where you put it
   * vanished, and the only clue was a chip beside the title.
   *
   * Navigation that simply ran out of score is NOT a refusal and says nothing;
   * a notice on every press of the last bar would be noise. Everything that
   * means *you cannot do that* speaks.
   */
  private sayRefused(intent: EditorIntent, reason: RefusalReason) {
    const notice = refusalNotice(intent, reason);
    if (notice) this.showNotice(notice.message);
  }

  /** One line, one timer — delete's sentence, a refusal and the clipboard share it. */
  private showNotice(message: string) {
    this.clipboardNotice = message;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => (this.clipboardNotice = ''), 4000);
  }

  private applyIntent(intent: EditorIntent) { this.editor?.handleIntent(intent); this.requestUpdate(); }
  private undoEdit() { this.editor?.undo(); this.requestUpdate(); }
  private redoEdit() { this.editor?.redo(); this.requestUpdate(); }

  // ── versions: look at one, go back to one ───────────────────────────────
  // The service keeps every save; the pointer names the current one. Looking at
  // an older version puts ITS document on screen and tells the save session
  // nothing; making it current moves the pointer and reopens the piece.

  private versions() { return pieceVersions(this.snapshot?.renditions ?? [], this.snapshot?.piece.canonical_rendition_id); }

  private async viewVersion(id: string) {
    const version = this.versions().find(v => v.id === id), doc = this.doc, generation = this.generation;
    if (!version || !doc || this.session?.dirty) return;
    try {
      this.player?.pause();
      const opened = await openLocalFile(new File([await this.client.rendition(id)], `${id}.${version.format}`));
      if (generation !== this.generation) return;
      this.viewing = { id, label: `${version.label} · ${savedAge(Date.parse(version.createdAt), Date.now())}`, document: opened.document };
      this.doc = { ...doc, name: documentTitle(opened.document) ?? doc.name, lastUpdated: Date.now(), mnxJson: opened.document };
    } catch (error) {
      this.error = `That version could not be opened: ${error instanceof Error && error.message ? error.message : 'the library is unavailable.'}`;
    }
  }
  private closeVersion() {
    const current = this.session?.document;
    if (!this.viewing || !this.doc || !current) return;
    this.viewing = null;
    this.doc = { ...this.doc, name: documentTitle(current) ?? this.doc.name, lastUpdated: Date.now(), mnxJson: current };
  }
  private async makeVersionCurrent(id: string) {
    const viewing = this.viewing, session = this.session, snapshot = this.snapshot;
    if (!viewing || viewing.id !== id || !session || !snapshot || this.readOnly || session.dirty || !session.baseRenditionId) return;
    const derivedTags = this.projection(viewing.document);
    try {
      await this.enqueue(() => this.client.revertTo(snapshot.piece.id, (this.snapshot ?? snapshot).piece.revision, session.baseRenditionId!, id, derivedTags));
      this.session = null; session.dispose();
      await this.load();
    } catch (error) {
      this.error = `That version was not made current: ${error instanceof LibraryRequestError && error.status === 409 ? 'this piece was saved somewhere else — reopen it.' : error instanceof Error && error.message ? error.message : 'the library is unavailable.'}`;
    }
  }

  /** Delete the piece: save what is unsaved first (a restore brings back what was SAVED), then leave for the library, which offers the undo. */
  private async deletePiece() {
    const session = this.session, snapshot = this.snapshot;
    if (!snapshot || this.readOnly) return;
    const title = (this.doc ? documentTitle(this.doc.mnxJson) : null) ?? this.tag('title') ?? 'Untitled';
    try {
      await session?.flush();
      await this.enqueue(() => this.client.deletePiece(snapshot.piece.id, (this.snapshot ?? snapshot).piece.revision));
      await session?.discardRecovery().catch(() => {});
      this.session = null; session?.dispose();
      try { sessionStorage.setItem(JUST_DELETED_KEY, JSON.stringify({ id: snapshot.piece.id, title })); } catch { /* the Deleted pieces page still has it */ }
      location.hash = libraryHref;
    } catch (error) {
      this.error = `The piece was not deleted: ${error instanceof Error && error.message ? error.message : 'the library is unavailable.'}`;
    }
  }

  /** A conflict, settled by keeping this device's document: it becomes a new piece, and the record goes. */
  private async saveMineAsCopy() {
    const session = this.session, doc = this.doc;
    if (!session || !doc) return;
    try {
      const result = await checkForStorage(session.document);
      const title = `${documentTitle(session.document) ?? this.tag('title') ?? doc.name} (copy)`;
      const tags = derivedLibraryTags(session.document).filter(t => t.dimension !== 'title');
      const { snapshot } = await this.client.createPiece({ filename: pieceFilename(title), bytes: result.bytes, producerVersion: BUILD, producerOptions: result.options },
        [{ dimension: 'title', value: title }, ...tags]);
      await session.discardRecovery();
      this.session = null; session.dispose();
      location.hash = pieceHref(snapshot.piece.id);
    } catch (error) {
      this.error = `The copy was not made: ${error instanceof Error ? error.message : 'the library is unavailable.'}`;
    }
  }
  /** Let this device's unsaved edits go and open what the library holds. */
  private async discardMine() {
    const session = this.session;
    if (!session) return;
    await session.discardRecovery().catch(() => {});
    this.session = null; session.dispose();
    await this.load();
  }

  /** Hand the document to the viewer and the player through one binding. The
   *  viewer resolves the view, and the views it can offer, from the document
   *  it now has — so the frame is rendered once more to ask it. */
  private present(doc: MnxDocument) {
    // A document without a performance needs no notice: the player's readout
    // already says so, and the score shows either way.
    this.binding!.setDocument(doc);
    const { performance, writtenBarDurations } = this.player;
    const shapeBefore = this.scoreShape;
    this.scoreShape = performance && writtenBarDurations ? performedShape(performance, writtenBarDurations) : '';
    // A bar added or removed, a repeat, a meter: the edits a sync and a reader feel most. Save them at once
    // rather than after the pause (studio authoring campaign, clause 6 — owed since the save pipeline).
    if (shapeBefore && this.scoreShape !== shapeBefore && this.touched && !this.viewing && this.session?.dirty) void this.session.checkpoint();
    void this.stampImportedSyncs();
    this.requestUpdate();
  }

  // ── imported syncs: remember the bars they were good for ────────────────
  // A Soundslice sync addresses performed bars by index and has nothing to
  // re-derive from, so the only way to know the bars moved under it is to
  // remember the shape it was last known good for. Nothing stamps them on the
  // way in (the operator ingest knows no score), so Studio does on first sight:
  // the sync plays today, and from here on a bar inserted, a repeat added or a
  // re-export with different bars shows in the Source sheet. Once per recording.
  private async stampImportedSyncs() {
    const piece = this.snapshot?.piece.id, shape = this.scoreShape, generation = this.generation;
    if (!piece || !shape || this.readOnly) return;
    for (const row of this.snapshot!.recordings.filter(r => isImportedSync(r) && storedScoreShape(r.provenance) === null)) {
      try {
        const saved = await this.enqueue(async () => {
          const current = this.snapshot?.piece.id === piece ? this.snapshot : null;
          if (!current || generation !== this.generation) return null;
          return this.client.saveRecording(piece, row.id, current.piece.revision, { name: row.name || 'Recording', scoreShape: shape });
        });
        if (!saved || generation !== this.generation) return;
        this.snapshot = { ...saved.snapshot, tags: saved.snapshot.tags ?? this.snapshot?.tags ?? [] };
        this.setRecordings(this.snapshot);
      } catch { return; /* a stamp is a convenience: the next open tries again */ }
    }
  }

  private tag(dimension: string): string | null {
    return this.snapshot?.tags.find(t => t.dimension === dimension)?.shown ?? null;
  }

  private setRecordings(snapshot: LibrarySnapshot | null) {
    const recordings: RecordingSource[] = (snapshot?.recordings ?? []).filter(r => r.kind === 'audio' || (r.kind === 'youtube' && r.external_id)).map(r => {
      let syncpoints: unknown = null;
      try { syncpoints = r.syncpoints === null ? null : JSON.parse(r.syncpoints); } catch { syncpoints = r.syncpoints; }
      const syncSegments = storedSyncSegments(r.provenance) ?? undefined;
      return r.kind === 'youtube' ? { kind: 'youtube', id: r.id, name: r.name || 'YouTube recording', video: r.external_id!, syncpoints, syncSegments } : { kind: 'audio', id: r.id, name: r.name || 'Audio recording', media: this.client.recordingUrl(r.id), syncpoints, syncSegments };
    });
    if (JSON.stringify(recordings) !== JSON.stringify(this.recordings)) this.recordings = recordings;
  }
  private async refreshSnapshot() {
    const generation = this.generation;
    try {
      const snapshot = (await this.client.piece(this.pieceId)).snapshot;
      if (generation !== this.generation) return;
      const pointer = snapshot.piece.canonical_rendition_id;
      if (this.snapshot?.piece.canonical_rendition_id !== pointer && pointer !== this.session?.baseRenditionId) {
        // Saved somewhere else. Clean, reopen it; with edits here, keep them — the next checkpoint reports the conflict.
        if (!this.session?.dirty) { await this.load(); return; }
      }
      this.player?.pause(); this.snapshot = snapshot; this.setRecordings(snapshot);
    } catch { /* keep what we have */ }
  }

  // ── the sync bar's edits, stored in the library ─────────────────────────
  // The player has already applied the edit to what is playing; this only
  // persists it. The segments ride as the sync's provenance beside the derived
  // tuples, through the same route a recording's name is saved by.
  private onSyncEdit(event: CustomEvent<SyncEdit>) {
    if (this.readOnly) return;
    this.pendingSync = { ...event.detail, piece: this.snapshot?.piece.id ?? this.pieceId };
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => void this.flushSync(), 700);
  }
  private async flushSync() {
    clearTimeout(this.syncTimer);
    const edit = this.pendingSync, snapshot = this.snapshot;
    if (this.syncSaving || !edit || !snapshot) return;
    const piece = edit.piece;
    const row = snapshot.recordings.find(r => r.id === edit.sourceId);
    this.pendingSync = null;
    if (!row || snapshot.piece.id !== piece) return;
    this.syncSaving = true;
    const generation = this.generation;
    const rawSync: StudioSyncPayload = { format: SYNC_SEGMENTS_FORMAT, segments: edit.segments, syncpoints: edit.syncpoints };
    const save = (revision: number) => this.client.saveRecording(piece, row.id, revision, { name: row.name || 'Recording', rawSync });
    try {
      // In the page's one write queue: a checkpoint and a sync save move the same revision.
      const saved = await this.enqueue(async () => {
        try { return await save((this.snapshot?.piece.id === piece ? this.snapshot : snapshot).piece.revision); }
        catch (error) {
          // Another save (a tag, the recording's name) moved the revision: the
          // segments are still this reader's latest intent, so retry on the new one.
          if (!(error instanceof LibraryRequestError) || error.status !== 409) throw error;
          return save((await this.client.piece(piece)).snapshot.piece.revision);
        }
      });
      if (generation !== this.generation) return;
      this.snapshot = { ...saved.snapshot, tags: saved.snapshot.tags ?? this.snapshot?.tags ?? [] };
      this.setRecordings(this.snapshot);
      if (this.error.startsWith('The sync was not saved')) this.error = '';
    } catch (error) {
      if (generation === this.generation) this.error = `The sync was not saved: ${error instanceof Error ? error.message : 'the library is unavailable.'}`;
    } finally {
      this.syncSaving = false;
      if (this.pendingSync && generation === this.generation) void this.flushSync();
    }
  }

  // ── what the frame changes, stored per browser ──────────────────────────

  private onViewChange(event: CustomEvent<ViewMode>) {
    this.view = event.detail;
    write(VIEW_KEY, this.view);
  }
  private setDisplay(next: DisplayOptions) {
    this.display = normalizeDisplayPreferences(next);
    write(DISPLAY_KEY, JSON.stringify(this.display));
  }
  private onDisplayChange(event: CustomEvent<DisplayOptions>) {
    this.setDisplay(event.detail);
  }
  private onFocusChange(event: CustomEvent<boolean>) {
    this.focused = event.detail;
    write(FOCUSED_KEY, String(this.focused));
  }

  private onUnrolledChange(event: CustomEvent<boolean>) {
    this.unrolled = event.detail;
    write(UNROLLED_KEY, String(this.unrolled));
  }
  private onZoomChange(event: CustomEvent<ZoomPadChange>) {
    const { staffSp, densityH } = event.detail;
    this.staffSp = staffSp;
    this.densityH = densityH;
    // Null restores the product default on the next load; numeric choices are
    // persisted exactly as requested.
    write(STAFF_SP_KEY, staffSp === null ? null : String(staffSp));
    write(SPACE_SP_KEY, densityH === null ? null : String(densityH));
  }
  private onSpacingModeChange(event: CustomEvent<'natural' | 'fill'>) {
    this.spacingMode = event.detail;
    write(SPACING_MODE_KEY, this.spacingMode);
  }
  private readonly densitySteps = () => this.viewer?.densitySteps() ?? null;

  // ── the side panels: one at a time ──────────────────────────────────────

  private openPanel(which: 'edit' | 'source' | 'instruments' | 'recording' | 'save' | 'keys' | null) {
    this.keysOpen = which === 'keys';
    this.saveOpen = which === 'save';
    this.editOpen = which === 'edit';
    this.sourceOpen = which === 'source';
    this.instrumentsOpen = which === 'instruments';
    this.recordingsOpen = which === 'recording';
  }
  /** The editor on one recording, read fresh so its revision is current. */
  private async editRecording(id: string) {
    const generation = this.generation;
    this.player?.pause();
    await this.refreshSnapshot();
    if (generation !== this.generation) return;
    this.addingRecording = false;
    this.editingRecordingId = id;
    this.openPanel('recording');
  }
  private addRecording() {
    this.player?.pause();
    this.addingRecording = true;
    this.editingRecordingId = null;
    this.openPanel('recording');
    void this.refreshSnapshot();
  }

  // ── the owner's own setup for this piece ────────────────────────────────
  // Which source they last played and how they left the Instruments sheet,
  // kept per owner and piece in the library beside `opened_at` (docs/studio-
  // storage.md) so it holds across devices and survives a cleared browser.
  // localStorage stays the cache underneath: it paints the sheet before the
  // snapshot lands, and it is the whole story for a shell with no library.

  /** What the library kept, applied once the document's parts are known. */
  private async applyPrefs(snapshot: LibrarySnapshot | null, partCount: number, generation: number) {
    const stored = normalizePiecePrefs(snapshot?.prefs);
    this.savedPrefs = canonicalJson(stored);
    if (stored.parts && stored.parts.count === partCount) {
      this.hiddenParts = stored.parts.hidden;
      this.partMix = stored.parts.mix;
      writeParts(this.pieceId, { hidden: stored.parts.hidden, mix: stored.parts.mix });
    } else if (!stored.parts && (this.hiddenParts.length || Object.keys(this.partMix).length)) {
      // Nothing stored yet and this browser remembers a mix: seed the library
      // from it, so the setup made before preferences moved up is not lost.
      this.schedulePrefs();
    }
    await this.cueStoredSource(stored.source, generation);
  }
  /** The source they last played, CUED and left paused — opening a piece never
   *  starts anything. A recording since deleted is ignored, and the player's own
   *  reconciliation leaves the synth selected. */
  private async cueStoredSource(id: string | undefined, generation: number) {
    if (!id || id === 'synth' || !this.recordings.some(r => r.id === id)) return;
    await this.updateComplete;
    await this.player?.updateComplete;
    if (generation !== this.generation) return;
    await this.player?.selectSource(id);
    // Selecting carries the intent to play — that is what makes switching source
    // mid-piece continue — so opening a piece pauses after the handoff. A piece
    // that opens playing is never what was asked for.
    this.player?.pause();
  }
  private currentPrefs(): PiecePreferences {
    const touched = this.hiddenParts.length > 0 || Object.keys(this.partMix).length > 0;
    return {
      ...(this.selectedRecordingId ? { source: this.selectedRecordingId } : {}),
      // The rendition the mix was left against — provenance for `count`, and
      // meaningless without it.
      ...(touched && this.snapshot?.piece.canonical_rendition_id ? { rendition: this.snapshot.piece.canonical_rendition_id } : {}),
      ...(touched ? { parts: { hidden: [...this.hiddenParts], mix: this.partMix, count: this.doc?.mnxJson.parts.length ?? 0 } } : {}),
    };
  }
  private schedulePrefs() {
    if (!this.snapshot) return;
    this.pendingPrefs = { piece: this.pieceId, prefs: this.currentPrefs() };
    clearTimeout(this.prefsTimer);
    this.prefsTimer = setTimeout(() => void this.flushPrefs(), 700);
  }
  private async flushPrefs() {
    clearTimeout(this.prefsTimer);
    const pending = this.pendingPrefs;
    this.pendingPrefs = null;
    if (!pending) return;
    const text = canonicalJson(pending.prefs);
    if (text === this.savedPrefs) return;
    this.savedPrefs = text;
    // A convenience, never a gate: a failed write is retried by the next change
    // and is never shown — the piece and its edits are unaffected either way.
    try { await this.client.savePrefs(pending.piece, pending.prefs); }
    catch { if (this.pieceId === pending.piece) this.savedPrefs = ''; }
  }

  // ── the Instruments sheet ───────────────────────────────────────────────

  private setParts(hidden: readonly number[], mix: PartMix) {
    this.hiddenParts = hidden;
    this.partMix = mix;
    writeParts(this.pieceId, { hidden, mix });
    this.schedulePrefs();
  }
  private instrumentParts(doc: MnxDocument): InstrumentPart[] {
    const performance = this.player?.performance ?? null;
    return doc.mnxJson.parts.map((part, index) => {
      const lab = part._x?.mnxLab;
      const kit = 'kit' in part || (performance ? isKitPart(performance, index) : false);
      const strings = lab?.strings?.length;
      const detail = kit
        ? 'Percussion'
        : [strings ? `${strings} strings` : '', lab?.capo ? `Capo ${lab.capo}` : '', (part.staves ?? 1) > 1 ? `${part.staves} staves` : '']
            .filter(Boolean)
            .join(' · ');
      return { index, name: part.name || `Part ${index + 1}`, detail, kit };
    });
  }

  render() {
    // Edited here, the heading reads the document; the library's tags catch up at the next save.
    // An older version on screen is read the same way: its own document, then what only the sidecar knows.
    const fromDocument = this.touched || !!this.viewing;
    const sidecar = (dimension: string) => this.snapshot?.tags.find(t => t.dimension === dimension && t.origin === 'derived' && t.source_ref === 'sidecar')?.shown ?? null;
    const title = this.doc ? (fromDocument ? documentTitle(this.doc.mnxJson) ?? sidecar('title') : this.tag('title')) ?? this.doc.name : '';
    const artist = this.doc ? (fromDocument ? documentArtist(this.doc.mnxJson) ?? sidecar('artist') : this.tag('artist') ?? documentArtist(this.doc.mnxJson)) ?? '' : '';
    const chip = this.save ? saveChip(this.save, this.now) : null;
    const activeId = this.selectedRecordingId ?? 'synth';
    const activeRecording = this.snapshot?.recordings.find(r => r.id === this.selectedRecordingId);
    const playable = this.snapshot?.recordings.filter(r => this.recordings.some(s => s.id === r.id)) ?? [];
    const themeNext = nextTheme(this.theme);
    const themeSentence = `Theme: ${this.theme}${this.theme === 'auto' ? ` (now ${resolvedTheme(this.theme)})` : ''} — click for ${themeNext}`;
    // The viewer is queried, not stored: before the first render there is none.
    const viewer = this.viewer as DocumentViewer | null;
    return html`
      <mnx-score-frame
        .heading=${title}
        .subheading=${artist}
        .view=${viewer?.resolvedView() ?? 'notation'}
        .views=${viewer?.availableViews() ?? ['notation']}
        .display=${this.display}
        .unrolled=${this.unrolled}
        .staffSp=${this.staffSp}
        .densityH=${this.densityH}
        .spacingMode=${this.spacingMode}
        .effectiveStaffSp=${this.effectiveStaffSp}
        .densitySteps=${this.densitySteps}
        .pads=${!!this.doc}
        .staffView=${false}
        .focused=${this.focused}
        @focus-change=${this.onFocusChange}
        @view-change=${this.onViewChange}
        @display-change=${this.onDisplayChange}
        @unrolled-change=${this.onUnrolledChange}
        @zoom-change=${this.onZoomChange}
        @spacing-mode-change=${this.onSpacingModeChange}
      >
        <a slot="back" href=${libraryReturnHref()} @click=${returnToLibrary}>${back}<span>Library</span></a>
        ${this.doc
          ? html`<button slot="title-action" class="edit-piece" type="button" aria-label="Edit piece"
              aria-expanded=${this.editOpen} @click=${() => this.openPanel(this.editOpen ? null : 'edit')}>${pencilGlyph}</button>
            <button slot="actions" type="button" aria-pressed=${this.sourceOpen || this.recordingsOpen}
              aria-label=${`Source: ${activeRecording?.name ?? 'Synth'}`} @click=${() => this.openPanel(this.sourceOpen ? null : 'source')}>
              ${sourceGlyph(activeRecording ? (activeRecording.kind === 'youtube' ? 'youtube' : 'audio') : 'synth')}<span>Source · ${activeRecording?.name ?? (this.snapshot && !this.recordings.length ? 'Synth · add a recording' : 'Synth')}</span>
            </button>
            <button slot="actions" type="button" aria-pressed=${this.instrumentsOpen} @click=${() => this.openPanel(this.instrumentsOpen ? null : 'instruments')}>
              ${mixerGlyph}<span>Instruments · ${this.doc.mnxJson.parts.length}</span>
            </button>
            ${this.save
              ? html`${this.playOnly ? nothing : html`<button slot="actions" type="button" aria-pressed=${this.keysOpen} @click=${() => this.openPanel(this.keysOpen ? null : 'keys')}>
                  ${keysGlyph}<span>Keys</span>
                </button>`}
                <span slot="chips">
                  <button type="button" class=${`save ${chip!.tone}`} data-save=${this.save.status} aria-pressed=${this.saveOpen} @click=${() => this.openPanel(this.saveOpen ? null : 'save')}>
                    ${saveGlyph}<span>${this.playOnly ? 'Play only on this device' : this.readOnly ? 'Open in another tab · read only' : chip!.text}</span>
                  </button>
                </span>`
              : nothing}`
          : nothing}
        <button slot="menu" class="theme" type="button" title=${themeSentence} aria-label=${themeSentence} @click=${this.cycleTheme}>
          ${themeGlyph(this.theme)}<span>${this.theme}</span>
        </button>

        ${this.loading ? html`<p class="notice" role="status">Loading…</p>` : nothing}
        ${!this.loading && !this.doc
          ? html`<div class="notice">
              <h1>Could not open this piece</h1>
              <p role="alert">${this.error}</p>
              <p><a href=${libraryReturnHref()} @click=${returnToLibrary}>Back to the library</a></p>
            </div>`
          : nothing}
        ${this.doc && this.error ? html`<p class="notice" role="alert">${this.error}</p>` : nothing}
        ${this.viewing ? html`<p class="viewing" role="status"><span>Looking at an older version: <b>${this.viewing.label}</b>. Nothing has changed.</span>
          <button type="button" @click=${() => this.closeVersion()}>Back to current</button>
          <button type="button" ?disabled=${this.readOnly} @click=${() => void this.makeVersionCurrent(this.viewing!.id)}>Make this the current version</button></p>` : nothing}
        ${this.clipboardNotice ? html`<p class="clip-notice" role="status">${this.clipboardNotice}</p>` : nothing}
        <div class="editor-overlay"></div>
        <mnx-document-viewer
          ?hidden=${!this.doc}
          .view=${this.view}
          .unrolled=${this.unrolled}
          .lyrics=${this.display.lyrics}
          .timeSignatures=${this.display.timeSignatures}
          .clefs=${this.display.clefs}
          .scoreTitle=${this.display.title}
          .barNumbers=${this.display.barNumbers}
          .instrumentNames=${this.display.instrumentNames}
          .beams=${this.display.beams}
          .zoom=${this.staffSp}
          .densityH=${this.densityH}
          .spacingMode=${this.spacingMode}
          .hiddenParts=${this.hiddenParts}
          @render-scale=${(e: CustomEvent<RenderScale>) => (this.effectiveStaffSp = e.detail.staffSp)}
        ></mnx-document-viewer>
        <mnx-player slot="player" .recordings=${this.recordings} .syncWarningsInPanel=${true}
          .partMix=${this.partMix} .soundControl=${false} .sourceControl=${false}
          .syncEditable=${!!this.snapshot} @sync-edit=${this.onSyncEdit} @sync-refresh=${this.onSyncEdit}
          @playback-position=${(e: CustomEvent<{ sourceId?: string; kind?: string; syncWarning?: string }>) => {
            const { sourceId, kind, syncWarning } = e.detail;
            if (kind !== this.playbackKind) this.playbackKind = kind;
            if (this.recordingWarning?.id === sourceId && this.recordingWarning?.message === syncWarning) return;
            this.recordingWarning = sourceId && syncWarning ? { id: sourceId, message: syncWarning } : null;
          }}
          @source-selected=${(e: CustomEvent<{ id: string }>) => {
            this.selectedRecordingId = e.detail.id === 'synth' ? null : e.detail.id;
            this.schedulePrefs();
          }}>
        </mnx-player>
        ${this.sourceOpen && this.doc
          ? html`<mnx-studio-source slot="side"
              .recordings=${playable}
              .document=${this.doc}
              .activeId=${activeId}
              .syncWarning=${this.recordingWarning?.id === activeId ? this.recordingWarning.message : ''}
              .canAdd=${!!this.snapshot}
              .scoreShape=${this.scoreShape}
              @source-choose=${(e: CustomEvent<{ id: string }>) => void this.player?.selectSource(e.detail.id)}
              @recording-edit=${(e: CustomEvent<{ id: string }>) => void this.editRecording(e.detail.id)}
              @recording-add=${() => this.addRecording()}
              @close=${() => (this.sourceOpen = false)}></mnx-studio-source>`
          : nothing}
        ${this.recordingsOpen && this.snapshot && this.doc ? keyed(this.addingRecording ? 'new' : this.editingRecordingId, html`<mnx-studio-recordings slot="side" .syncWarning=${!this.addingRecording && this.recordingWarning?.id === this.editingRecordingId ? this.recordingWarning.message : ''} .recordingId=${this.addingRecording ? null : this.editingRecordingId} .client=${this.client} .snapshot=${this.snapshot} .document=${this.doc}
          @recordings-changed=${async (e: CustomEvent<LibrarySnapshot>) => { this.player?.pause(); if (this.snapshot?.piece.canonical_rendition_id !== e.detail.piece.canonical_rendition_id) { await this.load(); return; } this.snapshot = { ...e.detail, tags: this.snapshot?.tags ?? [] }; this.setRecordings(e.detail); }}
          @recording-saved=${async (e: CustomEvent<{ id: string }>) => { if (!this.snapshot?.recordings.some(r => r.id === e.detail.id)) return; this.addingRecording = false; this.editingRecordingId = e.detail.id; this.selectedRecordingId = e.detail.id; await this.updateComplete; await this.player?.updateComplete; await this.player?.selectSource(e.detail.id); }}
          @recording-deleted=${() => {
            // Back to the list; playback falls back to Synth only when the deleted recording was playing.
            const wasPlaying = this.editingRecordingId !== null && this.editingRecordingId === this.selectedRecordingId;
            this.addingRecording = false; this.editingRecordingId = null; this.openPanel('source');
            if (wasPlaying) { this.selectedRecordingId = null; void this.player?.selectSource('synth'); }
          }}
          @back=${() => this.openPanel('source')}
          @close=${() => (this.recordingsOpen = false)}></mnx-studio-recordings>`) : nothing}
        ${this.editOpen && this.doc
          ? html`<mnx-studio-edit-piece slot="side"
              .client=${this.client}
              .snapshot=${this.snapshot}
              .work=${this.doc.mnxJson._x?.mnxLab?.work}
              .readOnly=${this.readOnly || !!this.viewing}
              .readOnlyReason=${this.viewing ? 'This is an older version. Go back to the current one to edit, or make this one current.' : this.playOnly ? 'This device plays. Open the piece on a computer with a keyboard to edit it.' : ''}
              .canDelete=${!!this.snapshot && !!this.session && !this.viewing}
              .canUndo=${!!this.editor?.canUndo}
              .canRedo=${!!this.editor?.canRedo}
              @work-change=${(e: CustomEvent<WorkChange>) => this.applyIntent({ type: 'setWork', work: e.detail })}
              @tags-changed=${(e: CustomEvent<EditPieceSnapshot>) => { if (this.snapshot) this.snapshot = { ...this.snapshot, ...e.detail, piece: { ...this.snapshot.piece, ...e.detail.piece } }; void this.refreshSnapshot(); }}
              @aliases-changed=${() => this.refreshSnapshot()}
              @undo=${() => this.undoEdit()}
              @redo=${() => this.redoEdit()}
              @piece-delete=${() => void this.deletePiece()}
              @close=${() => (this.editOpen = false)}></mnx-studio-edit-piece>`
          : nothing}
        ${this.keysOpen && this.editor
          ? html`<mnx-studio-keys slot="side"
              .groups=${this.editor.keys()}
              .level=${RUNG_NAMES[this.editor.session.selectionLevel] ?? ''}
              .readOnly=${this.readOnly || !!this.viewing}
              @close=${() => (this.keysOpen = false)}></mnx-studio-keys>`
          : nothing}
        ${this.saveOpen && this.save
          ? html`<mnx-studio-save slot="side"
              .save=${this.save}
              .losses=${this.losses}
              .conversionNotes=${this.conversionNotes}
              .now=${this.now}
              .readOnly=${this.readOnly}
              .versions=${this.versions()}
              .viewingId=${this.viewing?.id ?? null}
              @version-view=${(e: CustomEvent<{ id: string }>) => void this.viewVersion(e.detail.id)}
              @version-close=${() => this.closeVersion()}
              @version-restore=${(e: CustomEvent<{ id: string }>) => void this.makeVersionCurrent(e.detail.id)}
              @save-now=${() => void this.session?.checkpoint()}
              @save-version=${(e: CustomEvent<{ name: string }>) => void this.session?.checkpoint(e.detail.name)}
              @save-copy=${() => void this.saveMineAsCopy()}
              @discard-mine=${() => void this.discardMine()}
              @close=${() => (this.saveOpen = false)}></mnx-studio-save>`
          : nothing}
        ${this.instrumentsOpen && this.doc
          ? html`<mnx-studio-instruments slot="side"
              .parts=${this.instrumentParts(this.doc)}
              .hiddenParts=${this.hiddenParts}
              .mix=${this.partMix}
              .mixAvailable=${!this.playbackKind || this.playbackKind === 'synth'}
              .sourceName=${this.recordings.find(r => r.id === this.player?.sourceId)?.name ?? ''}
              @hidden-change=${(e: CustomEvent<number[]>) => this.setParts(e.detail, this.partMix)}
              @mix-change=${(e: CustomEvent<PartMix>) => this.setParts(this.hiddenParts, e.detail)}
              @close=${() => (this.instrumentsOpen = false)}></mnx-studio-instruments>`
          : nothing}
      </mnx-score-frame>
    `;
  }
}
