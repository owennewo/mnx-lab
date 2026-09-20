import { LitElement, html, css, svg, nothing } from 'lit';
import { designTokens } from './tokens.ts';
import { customElement, property, state } from 'lit/decorators.js';
import type { Performance, PerformanceMeasure } from '../audio/performanceTypes.ts';
import type { LoopRegion } from '../audio/transport.ts';
import { PlaybackSession, type PlaybackSnapshot } from '../audio/playbackSession.ts';
import { type RecordingSource, type PlaybackBackend, type ScorePosition, type ScoreLoop } from '../audio/playbackBackend.ts';
import { RecordingBackend } from '../audio/recordingBackend.ts';
import { NativeYouTubePort } from '../audio/native/youtube.ts';
import { youtubeVideoId } from '../audio/youtubeUrl.ts';
import { HtmlAudioPort } from '../audio/native/htmlAudio.ts';
import { SynthBackend } from '../audio/native/synthBackend.ts';
import { createRecordingSync } from '../audio/recordingSync.ts';
import { scorePositionAt } from '../audio/scorePosition.ts';
import { linearizePasses } from '../model/passes.ts';
import {
  SAMPLE_PRESETS,
  type SamplePreset,
  type VoicePreset,
} from '../audio/sampleSelection.ts';
import type { SamplePackLoader } from '../audio/native/samplePacks.ts';
import { partBuses, partLevel, partSound, requiredPresets, voicePresetFor, type PartMix } from '../audio/partMix.ts';
import { formatPlaybackPosition, formatScorePlaybackPosition, measureAt, placeLabel, playbackPositionParts, scorePlaybackPositionParts, widestPlaceLabel, type PlaybackPositionParts } from '../audio/playbackPosition.ts';
import { ZERO, type Rational } from '../audio/time.ts';
import type { MnxStructure } from '../model/mnx.ts';
import type { PlaybackUpdate } from './mnxContext.ts';
import { ClickTrack } from '../audio/native/click.ts';
import { beatTimes, decodeSyncSegments, defaultBeatUnit, emptySyncSegments, playingSyncpoints, syncpointsFromSegments, type SyncSegments } from '../model/syncSegments.ts';
import type { SoundsliceSyncpoint } from '../model/recordingSync.ts';
import type { SyncChange } from './SyncBar.ts';
import { isTextEntry, realTarget } from './keyScope.ts';
import './SyncBar.ts';

/** What a host persists when the sync bar commits an edit. */
export interface SyncEdit { sourceId: string; segments: SyncSegments; syncpoints: SoundsliceSyncpoint[] | null }

@customElement('mnx-player')
export class Player extends LitElement {
  @property({ attribute: false }) performance: Performance | null = null;
  @property({ attribute: false }) document: MnxStructure | undefined;
  @property({ type: String }) documentId = '';
  /** The sound for every part the mix does not choose one for. */
  @property({ attribute: 'voice-preset' }) voicePreset: VoicePreset = 'synth';
  /** Per-part level, mute and sound beneath the master volume, keyed by part
   *  index (src/audio/partMix.ts). Synth only: a recording has no parts. */
  @property({ attribute: false }) partMix: PartMix = {};
  /** Whether the tray offers the Sound selector. A host with its own
   *  per-part sound control (studio's Instruments sheet) turns it off. */
  @property({ attribute: false }) soundControl = true;
  /** Whether the tray offers the Source select and its `source-tools` slot. A
   *  host that chooses sources elsewhere (studio's Source sheet) turns it off;
   *  `selectSource()` is the same either way. */
  @property({ attribute: false }) sourceControl = true;
  @property({ attribute: 'sample-base' }) sampleBase: string | undefined;
  @property({ attribute: false }) sampleBases: Partial<Record<SamplePreset, string>> | undefined;
  @property({ attribute: false }) sampleLoader: SamplePackLoader | undefined;
  @property({ attribute: false }) writtenBarDurations: readonly Rational[] | undefined;
  @property({ attribute: false }) recordings: readonly RecordingSource[] = [];
  /** Host supplies recording management; standalone players omit the add action. */
  @property({ type: Boolean }) canAddRecording = false;
  /** A host recording panel owns score-alignment warnings. */
  @property({ type: Boolean }) syncWarningsInPanel = false;
  /** A host that stores what the sync bar makes (`sync-edit`) opts in; the
   *  tray then offers the rail/sync toggle while a recording is the source. */
  @property({ type: Boolean }) syncEditable = false;
  /** The tray's bar shows the recording's time and its cut lines, not the rail. */
  @state() private syncMode = false;
  @state() private clickOn = false;
  /** The active recording's segments as edited here; the host's copy follows. */
  @state() private liveSegments: SyncSegments | null = null;
  private liveSegmentsFor = '';
  /** Syncpoints already applied in place, so the host echoing them back in
   *  `recordings` does not tear the source down. */
  private appliedSync = new Map<string, string>();
  private clickTrack?: ClickTrack;
  private get loading() { return this.status?.loading ?? false; }
  @property({ type: Number }) initialOrdinal: number | null = null;
  @state() private status: PlaybackSnapshot | undefined;
  @state() private localError = '';
  private get error() { return this.localError || this.status?.error || (this.status?.alignmentIssue ? '' : this.status?.issue) || ''; }
  @state() private rate = 1;
  /** Default synth/audio controls; other backends advertise their own rates. */
  static readonly RATE_MIN = 0.25;
  static readonly RATE_MAX = 2;
  static readonly RATE_STEP = 0.05;
  @state() private volume = 0.7;
  private session?: PlaybackSession;
  private revision = 0;
  private youtubeNoticeHidden = false;
  /** Set by a score frame that hosts video and disclosure together. */
  @property({ attribute: false }) videoPaneHosted = false;
  get youtubeRegionVisible() { return !!(this.youtubeNotice || this.playback?.kind === 'youtube'); }
  @state() private youtubeNotice = false;
  private lastUpdate = '';
  private lastOrdinal: number | null = null;
  /**
   * The tray, in the library page's vocabulary (roadmap/inprogress/core-score-frame.md;
   * redesigned on the Playback Tray canvas, 2026-09-13): the shared tokens,
   * 40px controls so the tray is catchable on glass, the transport as glyphs
   * on the accent, and a RAIL over the written bars in place of a slider —
   * one column per bar, one lane per pass, so an exact bar and pass is one
   * click and a hover names it. The readout prints the place alone; rate
   * and volume are value buttons whose controls open in overlays above the
   * tray — the frame the tray lives in is a strip over the score, not a
   * panel beside it.
   */
  static styles = [
    designTokens,
    css`
    :host {
      display: block;
      container-type: inline-size;
      font: 14px/1.4 var(--sans);
      color: var(--ink);
      --player-ground: light-dark(oklch(0.9 0.004 60), oklch(0.26 0.006 60));
    }
    /* Sound, rate and volume travel together: inline in the one-row tray,
       a right-aligned line of their own in the stacked form. */
    .settings {
      display: contents;
    }
    /* The stacked form, below the score frame's breakpoint: transport and
       readout, then the rail on a line of its own without its labels, then
       the settings. */
    @container (max-width: 1000px) {
      .rail,
      mnx-sync-bar {
        flex: 1 1 100%;
        order: 1;
        padding: 4px 0;
      }
      .rail .lab {
        display: none;
      }
      .rail .cell {
        grid-row: 1;
        height: max(18px, var(--rail-cell, 14px));
      }
      .settings {
        display: flex;
        flex: 1 1 100%;
        order: 2;
        justify-content: flex-end;
        gap: 10px;
      }
    }
    .youtube-panel { margin-top: 12px; }
    .youtube-surface { width: min(100%, 480px); min-width: 200px; height: clamp(200px, 56.25vw, 270px); position: relative; z-index: 10; }
    .youtube-panel p { max-width: 60ch; }
    .youtube-panel a { color: inherit; }
    .youtube-notice { max-width: 65ch; }
    .controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    button,
    select,
    input {
      font: inherit;
      color: inherit;
      accent-color: var(--accent);
    }
    button,
    select,
    label.select {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 40px;
      box-sizing: border-box;
      background: transparent;
      border: 1px solid var(--line);
      border-radius: 3px;
      padding: 0 12px;
      cursor: pointer;
      white-space: nowrap;
    }
    button:hover:not(:disabled) {
      border-color: var(--ink-3);
    }
    button.icon {
      width: 40px;
      padding: 0;
      justify-content: center;
    }
    /* The host's own control beside the source switcher — studio's way into
       its recordings sheet, where the sources the switcher lists are managed.
       An empty slot is nothing; the workbench slots nothing. */
    ::slotted([slot='source-tools']) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      box-sizing: border-box;
      padding: 0;
      background: transparent;
      border: 1px solid var(--line);
      border-radius: 3px;
      color: inherit;
      cursor: pointer;
    }
    ::slotted([slot='source-tools']:hover) {
      border-color: var(--ink-3);
    }
    ::slotted([slot='source-tools'][aria-pressed='true']) {
      background: var(--player-ground);
      border-color: var(--ink-3);
    }
    button.primary {
      width: 48px;
      height: 48px;
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    button:focus-visible,
    select:focus-visible,
    input:focus-visible {
      outline: var(--rule-w) solid var(--focus-ring);
      outline-offset: 2px;
    }
    label.select {
      padding: 0 4px 0 12px;
      color: var(--ink-3);
    }
    label.select select {
      border: 0;
      padding: 0 4px;
      height: 100%;
      color: var(--ink);
    }
    /* Native popups can use a light system background even in a dark host.
       Pair the option text with an opaque surface in both themes. */
    select option {
      color: var(--ink);
      background-color: var(--surface);
    }
    /* The readout is sized by the widest label the performance can print
       (stacked under it, invisible) so the scrubber beside it never moves
       as the beat ticks from 4 to 4.5. */
    output {
      display: inline-grid;
      font: 500 13px/1 var(--mono);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    output > span,
    .place > span {
      grid-area: 1 / 1;
    }
    output > .widest,
    .place > .widest {
      visibility: hidden;
    }
    .place {
      display: inline-grid;
    }
    output.none {
      font: inherit;
      color: var(--ink-3);
    }
    /* ── the rail ──
       A grid: section labels on the first row, one cell per written bar on
       the second, each cell a column of lanes (one per visit). The lit lane
       is the playhead; played lanes carry the accent dimmed into the ground;
       a lane reached by a jump carries a thin inner outline. Hovering or
       focusing a lane shows its card above the tray. */
    .rail {
      position: relative;
      outline: none; /* focusable so a click in it lets Space play; never reached by Tab, so no ring to draw */
      flex: 1 1 160px;
      min-width: 120px;
      align-self: stretch;
      display: grid;
      gap: 0 var(--rail-gap, 2px);
      align-items: end;
      padding: 2px 0;
      box-sizing: border-box;
    }
    .rail .lab {
      grid-row: 1;
      font: 600 10px/1 var(--sans);
      letter-spacing: 0.11em;
      text-transform: uppercase;
      color: var(--ink-3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 0 0 4px 4px;
      border-left: 1px solid var(--line-strong);
      pointer-events: none;
    }
    .rail .cell {
      grid-row: 2;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 2px;
      height: var(--rail-cell, 14px);
    }
    .rail .cell.first {
      box-shadow: -2px 0 0 var(--line-strong);
    }
    .lane {
      display: block;
      position: relative;
      flex: 1 1 0;
      min-height: 2px;
      height: auto;
      width: 100%;
      padding: 0;
      border: 0;
      border-radius: 1px;
      background: var(--line);
    }
    .lane.partial {
      width: var(--w);
      margin-left: var(--x);
    }
    .lane.played {
      background: color-mix(in oklab, var(--accent), var(--player-ground) 45%);
    }
    .lane.jumped {
      box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ink), transparent 60%);
    }
    .lane[aria-current='true'] {
      background: var(--accent);
      box-shadow: none;
    }
    .lane:hover,
    .lane:focus-visible {
      outline: 2px solid var(--ink);
      outline-offset: 1px;
      z-index: 2;
    }
    .lane::after {
      content: attr(data-tip);
      position: absolute;
      left: 50%;
      bottom: calc(100% + 24px);
      transform: translateX(-50%);
      display: none;
      padding: 6px 10px;
      white-space: nowrap;
      font: 500 12px/1 var(--mono);
      font-variant-numeric: tabular-nums;
      color: var(--ink);
      background: var(--player-ground);
      border: 1px solid var(--line);
      border-radius: 3px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18), 0 6px 18px rgba(0, 0, 0, 0.22);
      z-index: 6;
    }
    .lane:hover::after,
    .lane:focus-visible::after {
      display: block;
    }
    /* Beside the rail's left edge a card would hang off the tray; keep the
       first columns' cards inside it. */
    .rail .cell:nth-child(-n + 4) .lane::after {
      left: 0;
      transform: none;
    }
    .rail .cell:nth-last-child(-n + 4) .lane::after {
      left: auto;
      right: 0;
      transform: none;
    }
    /* ── rate and volume ──
       A value button on the tray — glyph and the number — and its control
       in an overlay above the tray: rate has preset chips and the fine
       slider, volume a mute and the slider. */
    button.value {
      gap: 6px;
      font: 500 13px/1 var(--mono);
      font-variant-numeric: tabular-nums;
    }
    button.on {
      background: var(--player-ground);
    }
    /* Rail or sync bar: two joined icon buttons beside the readout. */
    .bar-toggle {
      display: inline-flex;
    }
    .bar-toggle button + button {
      margin-left: -1px;
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
    .bar-toggle button:first-child {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
    .bar-toggle button[aria-pressed='true'] {
      background: var(--player-ground);
      border-color: var(--ink-3);
    }
    .anchor {
      position: relative;
      display: inline-flex;
    }
    .pop {
      position: absolute;
      bottom: calc(100% + 8px);
      right: 0;
      z-index: 5;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      box-sizing: border-box;
      background: var(--player-ground);
      border: 1px solid var(--line);
      border-radius: 3px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18), 0 6px 18px rgba(0, 0, 0, 0.22);
    }
    .pop[hidden] {
      display: none !important;
    }
    .pop.rate {
      width: min(400px, calc(100vw - 32px));
    }
    .pop.volume {
      width: min(240px, calc(100vw - 32px));
    }
    .pop.line,
    .pop .line {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
    }
    .pop input[type='range'] {
      flex: 1 1 auto;
      min-width: 0;
      margin: 0;
    }
    .pop .val {
      font: 500 12px/1 var(--mono);
      font-variant-numeric: tabular-nums;
      color: var(--ink-3);
      min-width: 5ch;
      text-align: right;
    }
    .chips {
      display: flex;
      gap: 4px;
    }
    .chip {
      flex: 1 1 0;
      height: 32px;
      padding: 0 8px;
      justify-content: center;
      font: 500 12px/1 var(--mono);
      color: var(--ink-2);
    }
    .chip.icon {
      flex: none;
      width: 32px;
    }
    .chip[aria-pressed='true'] {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    label.select {
      gap: 6px;
    }
    th {
      color: var(--ink-3);
      font-weight: 400;
      font-size: 12px;
    }
    tr[aria-current='true'] {
      background: var(--row-current);
    }
    td button {
      width: 100%;
      height: 36px;
      text-align: left;
      border: 0;
      padding: 0 4px;
    }
    p {
      margin: 8px 0 0;
      color: var(--ink-2);
    }
  `
  ];
  /** Which overlay is open — rate or volume; it closes on click-away or Escape. */
  @state() private openPop: 'rate' | 'volume' | null = null;
  private readonly onClickAway = (event: PointerEvent) => {
    if (!this.openPop) return;
    const inside = event.composedPath().some((n) => n instanceof HTMLElement && n.classList.contains('anchor'));
    if (!inside) this.openPop = null;
  };
  private readonly onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.openPop) {
      this.openPop = null;
      event.stopPropagation();
    }
    if (this.isSpaceForUs(event)) { event.preventDefault(); event.stopPropagation(); this.toggle(); }
  };
  /** Chrome activates a focused button on Space's keydown being unprevented, Firefox on its keyup: both are taken. */
  private readonly onKeyup = (event: KeyboardEvent) => { if (this.isSpaceForUs(event)) { event.preventDefault(); event.stopPropagation(); } };
  /**
   * Space plays or pauses wherever focus is inside the player — the rail, the sync bar, a tray button — with two
   * exceptions: a text field (a segment's name) keeps its space, and a modified stroke is somebody else's. It
   * overrides a focused button's own activation on purpose: after clicking a segment label or a rail lane, Space
   * means play, not "press that again" (Enter still presses it). Focus outside the player never reaches here,
   * so the editor's own Space — toggleNote, a provisional binding — is untouched.
   */
  private isSpaceForUs(event: KeyboardEvent) {
    return event.key === ' ' && !event.defaultPrevented && !event.isComposing && !event.metaKey && !event.ctrlKey && !event.altKey
      && !isTextEntry(realTarget(event));
  }
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onClickAway);
    this.addEventListener('keydown', this.onKeydown);
    this.addEventListener('keyup', this.onKeyup);
    try {
      this.rate = Number(localStorage.getItem('mnx-player-rate')) || 1;
      this.volume = Number(localStorage.getItem('mnx-player-volume') ?? 0.7);
      this.youtubeNoticeHidden = localStorage.getItem('mnx-player-youtube-terms-hidden') === 'true';
    } catch {}
    this.rate = Player.snapRate(this.rate);
    this.volume = Number.isFinite(this.volume) ? Math.min(1, Math.max(0, this.volume)) : 0.7;
    if (this.hasUpdated) this.install();
  }
  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.onClickAway);
    this.removeEventListener('keydown', this.onKeydown);
    this.removeEventListener('keyup', this.onKeyup);
    this.teardown();
    super.disconnectedCallback();
  }
  /** The widest readout label, refreshed only when the performance changes:
   *  the widest place plus the longer insertion word when the performance
   *  holds or graces anywhere, so the rail beside it never moves. */
  private widest = '';
  private widestPlace = '';

  protected willUpdate(changed: Map<PropertyKey, unknown>) {
    if (this.syncMode && this.liveSegmentsFor !== this.sourceId) this.loadSegments();
    if (changed.has('performance') || changed.has('document') || changed.has('writtenBarDurations')) {
      this.widestPlace = this.performance ? widestPlaceLabel(this.performance, this.document) : '';
      const kinds = new Set(this.performance?.sourceMap.map((s) => s.kind) ?? []);
      this.widest = this.widestPlace + (kinds.has('makeTime') ? ' · grace' : kinds.has('fermata') ? ' · hold' : '');
      this.buildRail();
    }
  }

  protected updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('youtubeNotice')) {
      this.dispatchEvent(new CustomEvent('video-notice-changed', { bubbles: true, composed: true }));
    }
    // An edit — the same document, a new performance — keeps the session and hands the
    // backend the performance in place (core-player-live-edit). Another document, a
    // performance appearing or vanishing, or new sample options install afresh.
    const scoreMoved = changed.has('performance') || changed.has('document') || changed.has('writtenBarDurations');
    const reinstall =
      changed.has('documentId') ||
      changed.has('sampleBase') ||
      changed.has('sampleBases') ||
      changed.has('sampleLoader') ||
      (scoreMoved && (!this.session || !this.performance));
    if (!reinstall && scoreMoved) this.replacePerformance();
    if (reinstall) {
      this.install();
      if (this.initialOrdinal !== null) this.seek(this.initialOrdinal);
      // A performance arriving or leaving is a fact the chrome around the
      // player needs (the score frame's grip enables on it), and the state
      // frame it would ride on is deduplicated away when nothing else moved.
      this.dispatchEvent(
        new CustomEvent('performance-changed', {
          detail: { documentId: this.documentId, available: this.performance !== null },
          bubbles: true,
          composed: true,
        }),
      );
    } else if (scoreMoved) {
      this.dispatchEvent(new CustomEvent('performance-changed', {
        detail: { documentId: this.documentId, available: this.performance !== null }, bubbles: true, composed: true,
      }));
    } else if (changed.has('initialOrdinal') && this.initialOrdinal !== null)
      this.seek(this.initialOrdinal);
    if (!reinstall && changed.has('recordings') && this.session) {
      const id = this.session.backend.id;
      if (!this.sameMediaWithAppliedSync(id, changed.get('recordings') as readonly RecordingSource[] | undefined)) {
        this.session.pause();
        if (id !== 'synth') void this.selectSource(this.recordings.some(r => r.id === id) ? id : 'synth', true);
      }
    }
    if (this.syncMode && (this.sourceId === 'synth' || !this.syncEditable)) this.setSyncMode(false);
    if (!reinstall && changed.has('partMix') && this.session?.backend instanceof SynthBackend)
      this.applyPartLevels(this.session.backend);
    const sounds = this.soundSignature();
    const soundsMoved = sounds !== this.lastSounds;
    this.lastSounds = sounds;
    if (!reinstall && soundsMoved && this.session?.backend instanceof SynthBackend) {
      const resume = this.playback?.wantsPlayback;
      this.pause();
      this.session.backend.sink.setVoicePreset(this.sinkPreset(), this.requiredSamples());
      this.localError = '';
      if (resume) void this.play();
    }
  }
  private publish() {
    const status = this.status;
    const visible = status && !status.hidePlayhead && (status.state !== 'stopped' || status.highlight.length > 0);
    const current = status?.transport && this.performance ? measureAt(this.performance, status.transport.position)?.ordinal
      : status?.scorePosition?.ordinal;
    const ordinal = visible && current !== undefined && current < (this.performance?.measures.length ?? 0) ? current : null;
    const bounds = status?.mediaBounds;
    const recordingBookends = bounds && !status?.syncIssue ? {
      preRollSeconds: Math.max(0, bounds.startSeconds),
      postRollSeconds: Math.max(0, (bounds.durationSeconds ?? bounds.endSeconds) - bounds.endSeconds)
    } : null;
    const detail: PlaybackUpdate = { documentId: this.documentId, ordinal, highlight: [...(status?.highlight ?? [])],
      playing: status?.wantsPlayback ?? false, recordingBookends, mediaPhase: status?.mediaPhase ?? null };
    this.dispatchEvent(new CustomEvent('playback-position', { detail: {
      documentId: this.documentId, sourceId: status?.sourceId, kind: status?.kind,
      syncWarning: status?.alignmentIssue || status?.syncIssue,
      scorePosition: status?.scorePosition ?? null, mediaTime: status?.mediaTime,
      mediaPhase: status?.mediaPhase, mediaBounds: status?.mediaBounds,
    }, bubbles: true, composed: true }));
    const signature = JSON.stringify(detail);
    if (signature !== this.lastUpdate) {
      this.lastUpdate = signature;
      this.dispatchEvent(new CustomEvent('playback-state-changed', { detail, bubbles: true, composed: true }));
    }
    if (ordinal !== this.lastOrdinal) {
      this.lastOrdinal = ordinal;
      this.dispatchEvent(new CustomEvent('bar', { detail: { documentId: this.documentId, ordinal }, bubbles: true, composed: true }));
    }
  }
  private teardown() {
    this.clickTrack?.dispose(); this.clickTrack = undefined; this.clickOn = false;
    this.syncMode = false; this.liveSegments = null; this.liveSegmentsFor = ''; this.appliedSync.clear(); this.derivedFor.clear();
    this.youtubeNotice = false;
    this.revision++;
    this.session?.dispose(); this.session = undefined;
    this.status = undefined; this.lastOrdinal = null; this.publish();
  }
  /** Each voice's timbre: its part's sound, kit voices always on the synth. */
  private sinkPreset(): VoicePreset | ((voice: string) => VoicePreset) {
    return this.performance ? voicePresetFor(this.performance, this.partMix, this.voicePreset) : 'synth';
  }
  private requiredSamples(): SamplePreset[] {
    return this.performance ? requiredPresets(this.performance, this.partMix, this.voicePreset) : [];
  }
  /** What every voice plays, so a mix change that moves only a level never
   *  pauses to swap sounds. */
  private lastSounds = '';
  private soundSignature(): string {
    return JSON.stringify(this.performance?.voices.map((v) => (v.kit ? 'synth' : partSound(this.partMix, v.partIndex, this.voicePreset))) ?? []);
  }
  private applyPartLevels(backend: SynthBackend) {
    for (const part of new Set(this.performance?.voices.map((v) => v.partIndex)))
      backend.sink.setBusLevel(String(part), partLevel(this.partMix[part]));
  }
  private install() {
    this.teardown(); this.localError = '';
    if (!this.performance || !this.isConnected) return;
    const revision = this.revision;
    // The factory reads the performance when it is CALLED: after an edit the session is kept
    // (`replacePerformance`) and a later select must see the score as it is now.
    const factory = (id: string): PlaybackBackend => {
      const performance = this.performance;
      if (!performance) throw new Error('There is no performance to play.');
      if (id === 'synth') {
        const buses = partBuses(performance);
        const synth = new SynthBackend(performance, {
          volume: this.volume, voicePreset: this.sinkPreset(), sampleBase: this.sampleBase,
          sampleBases: this.sampleBases, samplePresets: this.requiredSamples(), sampleLoader: this.sampleLoader,
          voiceBus: voice => buses.get(voice),
        }, event => {
          if (revision === this.revision && event.kind === 'onset') this.dispatchEvent(new CustomEvent('onset', {
            detail: { ...event, documentId: this.documentId }, bubbles: true, composed: true,
          }));
        });
        this.applyPartLevels(synth);
        return synth;
      }
      const matches = this.recordings.filter(r => r.id === id);
      if (!id || matches.length !== 1) throw new Error('The selected recording is unavailable or has a duplicate identity.');
      const source = matches[0];
      // A Studio sync plays by its SEGMENTS, derived against the bars as they are
      // now — the stored tuples are a cache that bars written since leave stale.
      // The recording's length is not known yet; `refreshDerivedSync` derives
      // again when it is, because an open last segment runs to the media's end.
      const playing = playingSyncpoints(source, segments => this.barBeats(segments));
      if (playing.segments) { this.appliedSync.set(id, JSON.stringify(playing.syncpoints)); this.derivedFor.delete(id); }
      const sync = this.document && this.writtenBarDurations
        ? createRecordingSync(playing.syncpoints, { performance, writtenBarDurations: this.writtenBarDurations }, linearizePasses(this.document)) : null;
      const media = source.kind === 'audio' ? new HtmlAudioPort(source.media) : new NativeYouTubePort(youtubeVideoId(source.video), async () => {
        // A surrounding score frame supplies a stable mount before iframe creation.
        // Standalone players retain their own inline surface.
        const region: { mount?: Promise<HTMLElement> } = {};
        this.dispatchEvent(new CustomEvent('video-region-changed', { detail: region, bubbles: true, composed: true }));
        this.videoPaneHosted = !!region.mount;
        const external = await region.mount;
        await this.updateComplete;
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (revision !== this.revision || this.sourceId !== id) throw new Error('YouTube selection cancelled.');
        const container = external ?? this.renderRoot.querySelector<HTMLElement>('.youtube-surface');
        if (!container) throw new Error('Show the YouTube video region before loading.');
        return container;
      });
      return new RecordingBackend(id, media, performance, sync?.ok ? sync.value : null,
        sync && !sync.ok ? sync.diagnostic.message : !sync ? 'Score timing information is unavailable for this recording.' : undefined);
    };
    this.session = new PlaybackSession(factory('synth'), factory, () => {
      if (revision !== this.revision || !this.session) return;
      this.status = this.session.snapshot; this.rate = this.status.rate; this.volume = this.status.volume; this.refreshDerivedSync(); this.publish();
    });
    this.session.setRate(this.rate); this.session.setVolume(this.volume);
    this.session.stop();
    this.status = this.session.snapshot; this.publish();
  }
  /**
   * An edit: the same document with a new performance. The session and its backend stay;
   * the backend takes the performance in place. A recording's sync is derived again against
   * the bars as they are now — the sync bar's live segments, the stored segments, or an
   * imported sync's tuples as they were — exactly as the factory derives it on first
   * selection, and the host hears through `sync-refresh` when the stored tuples went stale.
   */
  private replacePerformance() {
    const session = this.session, performance = this.performance;
    if (!session || !performance) return;
    const backend = session.backend;
    if (backend instanceof SynthBackend) backend.replacePerformance(performance);
    else if (backend instanceof RecordingBackend) {
      const source = this.activeRecording, id = backend.id, duration = this.status?.mediaDuration;
      if (!source) return;
      const live = this.liveSegmentsFor === id ? this.liveSegments : null;
      const derived = live
        ? { segments: live, syncpoints: syncpointsFromSegments(live, this.barBeats(live), duration) }
        : playingSyncpoints(source, segments => this.barBeats(segments), duration);
      const points = derived.syncpoints;
      const sync = points && this.document && this.writtenBarDurations
        ? createRecordingSync(points, { performance, writtenBarDurations: this.writtenBarDurations }, linearizePasses(this.document)) : null;
      backend.replacePerformance(performance, sync?.ok ? sync.value : null, sync && !sync.ok ? sync.diagnostic.message : undefined);
      if (derived.segments) {
        const json = JSON.stringify(points);
        this.appliedSync.set(id, json);
        if (duration) this.derivedFor.set(id, duration);
        if (this.syncEditable && json !== JSON.stringify(source.syncpoints ?? null))
          this.dispatchEvent(new CustomEvent<SyncEdit>('sync-refresh', { detail: { sourceId: id, segments: derived.segments, syncpoints: points as SyncEdit['syncpoints'] }, bubbles: true, composed: true }));
      }
    }
    this.status = session.snapshot; this.publish();
  }
  /** Legacy synth view. Use playback/scorePosition for all source kinds. */
  get snapshot() { return this.session?.snapshot.transport; }
  get position(): Rational { return this.snapshot?.position ?? ZERO; }
  get playback() { return this.session?.snapshot; }
  get scorePosition() { return this.playback?.scorePosition ?? null; }
  get sourceId() { return this.session?.backend.id ?? 'synth'; }
  /** The readout's fields when the position is a place in the score — the
   *  synth's position, or recorded audio inside its sync — else null. */
  get positionParts(): PlaybackPositionParts | null {
    if (!this.performance) return null;
    const status = this.playback;
    if (!status || status.kind === 'synth') return playbackPositionParts(this.performance, this.position, this.document);
    if (status.scorePosition) {
      const parts = scorePlaybackPositionParts(this.performance, status.scorePosition, this.document);
      return parts ? { ...parts, insertion: null } : null;
    }
    return null;
  }
  get positionLabel() {
    if (!this.performance) return 'No performance available';
    const status = this.playback;
    if (!status || status.kind === 'synth') return formatPlaybackPosition(this.performance, this.position, this.document);
    if (status.scorePosition) return formatScorePlaybackPosition(this.performance, status.scorePosition, this.document);
    const time = Math.max(0, status.mediaTime ?? 0);
    const duration = status.mediaPhase === 'pre-roll' ? status.mediaBounds?.startSeconds
      : status.mediaPhase === 'post-roll' && status.mediaBounds?.durationSeconds !== undefined
        ? status.mediaBounds.durationSeconds - status.mediaBounds.endSeconds : undefined;
    if ((status.mediaPhase === 'pre-roll' || status.mediaPhase === 'post-roll') && duration !== undefined) {
      const seconds = Math.max(1, Math.round(duration));
      return `${status.mediaPhase === 'pre-roll' ? 'Pre-roll' : 'Post-roll'} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
    return `${status.kind === 'youtube' ? 'YouTube' : 'Audio'} ${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')} · no score position`;
  }
  async selectSource(id: string, replace = false) {
    this.localError = '';
    const source = this.recordings.find(r => r.id === id);
    if (id !== 'synth' && !source) return false;
    if (!replace || id !== this.sourceId) {
      this.dispatchEvent(new CustomEvent('source-selected', { detail: { id }, bubbles: true, composed: true }));
    }
    if (source?.kind === 'youtube') {
      // YouTube selection is cue-only. Pausing first both prevents an automatic
      // start and preserves the current score position for the handoff.
      this.pause();
      if (!this.youtubeNoticeHidden) {
        this.youtubeNotice = true;
        this.dispatchEvent(new CustomEvent('video-region-changed', { bubbles: true, composed: true }));
      }
    }
    if (source?.kind !== 'youtube') this.youtubeNotice = false;
    return await this.session?.select(id, replace) ?? false;
  }
  async play() { this.localError = ''; if (this.status?.needsStart && this.status.alignmentIssue) await this.session?.start(); else await this.session?.play(); }
  pause() { this.session?.pause(); }
  stop() { this.localError = ''; this.session?.stop(); }
  toggle() { if (this.playback?.wantsPlayback) this.pause(); else void this.play(); }
  private hideYouTubeNotice() {
    this.youtubeNoticeHidden = true;
    this.youtubeNotice = false;
    try {
      localStorage.setItem('mnx-player-youtube-terms-hidden', 'true');
    } catch {}
  }
  /** Show the shared disclosure from either the inline player or a host video pane. */
  showYouTubeNotice() {
    this.youtubeNotice = true;
    this.dispatchEvent(new CustomEvent('video-region-changed', { bubbles: true, composed: true }));
  }
  async startSource() { this.localError = ''; await this.session?.start(); }
  seek(ordinal: number) {
    const measure = this.performance?.measures.find(m => m.ordinal === ordinal);
    if (!measure || !this.session) return false;
    const target = { ordinal, metricOffset: measure.from };
    // An explicit bar click includes the grace/hold at its start. Handoffs
    // deliberately omit this edge because they must not guess within an insertion.
    const edge = this.session.backend instanceof SynthBackend ? 'before' : undefined;
    const problem = this.session.backend.canSeek(target, edge);
    if (problem) { this.localError = ''; void this.session.seek(target, edge); return false; }
    void this.session.seek(target, edge);
    this.localError = '';
    this.dispatchEvent(new CustomEvent('seek', { detail: { documentId: this.documentId, ordinal }, bubbles: true, composed: true }));
    return true;
  }
  async seekScorePosition(position: ScorePosition) { this.localError = ''; return await this.session?.seek(position) ?? false; }
  setScoreLoop(loop?: ScoreLoop) { this.session?.setLoop(loop); }
  /** Existing API takes expanded synth positions; media endpoints must map uniquely. */
  setLoop(loop?: LoopRegion) {
    if (!this.session || !this.performance) return;
    if (this.session.backend instanceof SynthBackend) { this.session.backend.transport.setLoop(loop); return; }
    if (!loop) { this.session.setLoop(); return; }
    const start = scorePositionAt(this.performance, loop.start), end = scorePositionAt(this.performance, loop.end);
    if (!start.ok || !end.ok) throw new Error(!start.ok ? start.diagnostic.message : !end.ok ? end.diagnostic.message : 'Invalid loop.');
    this.session.setLoop({ start: start.value, end: end.value });
  }
  /** Clamp to the slider's range and land on its 0.05 grid, so a stored or
   *  dragged value never carries float noise into the readout. */
  static snapRate(value: number): number {
    if (!Number.isFinite(value)) return 1;
    const clamped = Math.min(Player.RATE_MAX, Math.max(Player.RATE_MIN, value));
    // Divide by the grid's reciprocal: 23 / 20 is the double nearest 1.15,
    // where 23 * 0.05 is not.
    const perUnit = Math.round(1 / Player.RATE_STEP);
    return Math.round(clamped * perUnit) / perUnit;
  }
  private changeRate(event: Event) {
    this.setRate(Number((event.target as HTMLInputElement).value));
  }
  private resetRate() {
    this.setRate(1);
  }
  private changeVolume(event: Event) {
    this.setVolume(Number((event.target as HTMLInputElement).value));
  }
  private static mediaClock(seconds: number) {
    const t = Math.max(0, seconds);
    return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  }
  private static glyph(d: string, px = 22) {
    return svg`<svg width=${px} height=${px} viewBox="0 0 24 24" aria-hidden="true"><path d=${d} fill="currentColor"></path></svg>`;
  }

  private static stroke(d: string, px = 18) {
    return svg`<svg width=${px} height=${px} viewBox="0 0 24 24" aria-hidden="true"><path d=${d} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
  }
  /** The live readout prints the place alone — `# 8.1` — plus a hold or
   *  grace when the playhead is inside one. Which pass this is lives in
   *  the rail (the lit lane), the lane's hover card and the output's
   *  accessible name; the readout does not repeat it. */
  private readout() {
    if (!this.performance) return nothing;
    const parts = this.positionParts;
    if (!parts) return this.positionLabel;
    const tail = parts.insertion ? ` · ${parts.insertion}` : '';
    return html`<span class="place"><span>${placeLabel(parts)}</span><span class="widest" aria-hidden="true">${this.widestPlace}</span></span>${tail}`;
  }

  // ── the rail ────────────────────────────────────────────────────────────
  // One column per WRITTEN bar, one lane per visit to it, so the rail reads
  // left to right like the page and a repeated bar stacks its passes. Lanes
  // are keyed on `occurrence`, which counts a bar's visits from 1 and never
  // repeats — the strain `iteration` resets when a jump fires, so after a
  // D.S. it would print "pass 2 of 2" twice. Sections come from the global
  // measures' `section` labels; a bar the walk never reaches keeps its
  // column, empty. Built once per performance, classed per frame.
  private railModel: {
    columns: number;
    gap: number;
    /** The lane column's height in px — the deepest stack, capped. */
    cell: number;
    labels: { at: number; span: number; text: string }[];
    cells: { first: boolean; lanes: { ordinal: number; tip: string; jumped: boolean; x: number; w: number }[] }[];
  } | null = null;

  private buildRail() {
    const performance = this.performance;
    if (!performance || performance.measures.length < 2) { this.railModel = null; return; }
    const globals = this.document?.global.measures ?? [];
    const maxIndex = performance.measures.reduce((max, m) => Math.max(max, m.measureIndex), 0);
    const columns = Math.max(globals.length, maxIndex + 1);
    const visits: PerformanceMeasure[][] = Array.from({ length: columns }, () => []);
    for (const m of performance.measures) visits[m.measureIndex]?.push(m);
    for (const list of visits) list.sort((a, b) => a.ordinal - b.ordinal);
    // The first arrival by a jump; every later revisit is a return.
    const entries = this.document ? linearizePasses(this.document).entries : [];
    const jumpAt = entries.findIndex((e) => e.via === 'jump');
    const sectionAt = (i: number) => globals[i]?.section?.label ?? '';
    const sectionOf = (i: number) => { for (let k = i; k >= 0; k--) { const s = sectionAt(k); if (s) return s; if (globals[k]?.section !== undefined) return ''; } return ''; };
    const labels: { at: number; span: number; text: string }[] = [];
    for (let i = 0; i < columns; i++) {
      const text = sectionAt(i);
      if (!text) continue;
      let span = 1;
      while (i + span < columns && !sectionAt(i + span)) span++;
      labels.push({ at: i, span, text: visits[i]!.length > 1 ? `${text} ×${visits[i]!.length}` : text });
    }
    const asNumber = (r: Rational) => Number(r.num) / Number(r.den);
    const cells = visits.map((list, i) => {
      const bar = String(globals[i]?.number ?? i + 1);
      const section = sectionOf(i);
      const written = this.writtenBarDurations?.[i];
      return {
        first: i > 0 && sectionOf(i - 1) !== section,
        lanes: list.map((m) => {
          const passes = list.length;
          const jumped = jumpAt >= 0 && m.ordinal >= jumpAt && m.occurrence > 1;
          const tip = `${section ? `${section} · ` : ''}# ${bar}${passes > 1 ? ` · pass ${m.occurrence} of ${passes}` : ''}${jumped ? ' · after the jump' : ''}`;
          let x = 0, w = 1;
          if (written && asNumber(written) > 0) {
            x = asNumber(m.from) / asNumber(written);
            w = Math.max(0.02, (asNumber(m.until) - asNumber(m.from)) / asNumber(written));
          }
          return { ordinal: m.ordinal, tip, jumped, x, w };
        }),
      };
    });
    // The cell height follows the deepest stack of visits (D2 on the Playback
    // Tray canvas, 2026-09-13): 6px per lane plus 2px gaps, from the 14px of a
    // piece without repeats up to a 38px cap — five passes at 6px — so the
    // tray thickens only when the piece demands it. Past the cap the lanes
    // share the height and the hover card carries the count.
    const deepest = cells.reduce((max, c) => Math.max(max, c.lanes.length), 1);
    const cell = Math.min(38, Math.max(14, deepest * 6 + (deepest - 1) * 2));
    this.railModel = { columns, gap: columns > 80 ? 1 : 2, cell, labels, cells };
  }

  private rail() {
    const model = this.railModel;
    if (!model) return nothing;
    const current = this.scorePosition?.ordinal ?? this.lastOrdinal ?? -1;
    return html`<div
      class="rail"
      role="group"
      aria-label="Position"
      tabindex="-1"
      style=${`grid-template-columns: repeat(${model.columns}, minmax(0, 1fr)); --rail-gap: ${model.gap}px; --rail-cell: ${model.cell}px;`}
    >
      ${model.labels.map((l) => html`<div class="lab" style=${`grid-column: ${l.at + 1} / span ${l.span};`}>${l.text}</div>`)}
      ${model.cells.map(
        (cell, i) => html`<div class=${cell.first ? 'cell first' : 'cell'} style=${`grid-column: ${i + 1};`}>
          ${cell.lanes.map(
            (lane) => html`<button
              type="button"
              class=${[
                'lane',
                lane.ordinal < current ? 'played' : '',
                lane.jumped ? 'jumped' : '',
                lane.x > 0 || lane.w < 1 ? 'partial' : '',
              ].join(' ')}
              style=${lane.x > 0 || lane.w < 1 ? `--x: ${(lane.x * 100).toFixed(2)}%; --w: ${(lane.w * 100).toFixed(2)}%;` : nothing}
              aria-label=${lane.tip}
              aria-current=${lane.ordinal === current ? 'true' : nothing}
              data-tip=${lane.tip}
              @click=${() => this.seek(lane.ordinal)}
            ></button>`,
          )}
        </div>`,
      )}
    </div>`;
  }

  // ── the sync bar ────────────────────────────────────────────────────────
  // The rail's slot, toggled to recording time, where a host that stores the
  // result lets a sync be made (roadmap/complete/studio-sync-bar.md). The
  // bar edits segments; this derives the tuples, applies them to the live
  // backend in place and reports both.
  private get recordingBackend() { return this.session?.backend instanceof RecordingBackend ? this.session.backend : null; }
  private get activeRecording() { return this.recordings.find(r => r.id === this.sourceId); }
  /** True when `recordings` changed only by echoing back a sync applied here. */
  private sameMediaWithAppliedSync(id: string, before: readonly RecordingSource[] | undefined) {
    const was = before?.find(r => r.id === id), now = this.recordings.find(r => r.id === id);
    if (!was || !now || was.kind !== now.kind || !this.appliedSync.has(id)) return false;
    const media = (r: RecordingSource) => r.kind === 'youtube' ? r.video : r.media;
    return media(was) === media(now) && JSON.stringify(now.syncpoints ?? null) === this.appliedSync.get(id);
  }
  /** The media length each source's tuples were last derived for. */
  private derivedFor = new Map<string, number>();
  /**
   * Once the playing recording's length is known: derive its tuples again (an
   * open last segment runs to the media's end), apply them if they moved, and
   * tell the host when what is STORED is not what plays — `sync-refresh`, the
   * same detail as `sync-edit`, so the host persists it the same way. Nothing
   * is announced while the sync bar is open: its own commits speak for it.
   */
  private refreshDerivedSync() {
    const backend = this.recordingBackend, duration = this.status?.mediaDuration, source = this.activeRecording;
    if (!backend || !source || !duration || !this.performance || this.derivedFor.get(backend.id) === duration) return;
    this.derivedFor.set(backend.id, duration);
    const playing = playingSyncpoints(source, segments => this.barBeats(segments), duration);
    if (!playing.segments || this.liveSegmentsFor === backend.id) return;
    const derived = JSON.stringify(playing.syncpoints);
    if (derived !== this.appliedSync.get(backend.id)) {
      this.appliedSync.set(backend.id, derived);
      const sync = playing.syncpoints && this.document && this.writtenBarDurations
        ? createRecordingSync(playing.syncpoints, { performance: this.performance, writtenBarDurations: this.writtenBarDurations }, linearizePasses(this.document)) : null;
      backend.replaceSync(sync?.ok ? sync.value : null, sync && !sync.ok ? sync.diagnostic.message : undefined);
    }
    if (this.syncEditable && derived !== JSON.stringify(source.syncpoints ?? null))
      this.dispatchEvent(new CustomEvent<SyncEdit>('sync-refresh', { detail: { sourceId: backend.id, segments: playing.segments, syncpoints: playing.syncpoints as SyncEdit['syncpoints'] }, bubbles: true, composed: true }));
  }
  private loadSegments() {
    const id = this.sourceId, stored = decodeSyncSegments(this.activeRecording?.syncSegments);
    this.liveSegmentsFor = id;
    this.liveSegments = stored.ok ? stored.value : emptySyncSegments(defaultBeatUnit(this.document?.global.measures[0]?.time));
  }
  /** Each performed bar's length in the segments' beats. */
  private barBeats(segments: SyncSegments): number[] {
    const durations = this.writtenBarDurations, unit = segments.beat[0] / segments.beat[1];
    if (!this.performance || !durations) return [];
    return this.performance.measures.map(m => { const d = durations[m.measureIndex]; return d ? Number(d.num) / Number(d.den) / unit : 0; });
  }
  private setSyncMode(on: boolean) {
    if (on === this.syncMode) return;
    this.syncMode = on; this.openPop = null;
    if (on) this.loadSegments();
    else { this.recordingBackend?.setMediaLoop(); this.setClick(false); }
  }
  private setClick(on: boolean) {
    this.clickOn = on;
    if (!on) { this.clickTrack?.stop(); return; }
    this.clickTrack ??= new ClickTrack(() => {
      const status = this.session?.snapshot;
      return !status || status.kind === 'synth' || status.mediaTime === undefined ? null
        : { mediaTime: status.mediaTime, rate: status.rate, playing: status.state === 'playing' };
    }, (from, to) => this.liveSegments ? beatTimes(this.liveSegments, from, to, this.status?.mediaDuration) : []);
    this.clickTrack.start();
  }
  private onSyncChange(event: CustomEvent<SyncChange>) {
    const { segments, commit } = event.detail, backend = this.recordingBackend;
    this.liveSegments = segments;
    if (!commit || !backend || !this.performance) return;
    const syncpoints = syncpointsFromSegments(segments, this.barBeats(segments), this.status?.mediaDuration);
    this.appliedSync.set(backend.id, JSON.stringify(syncpoints));
    const sync = syncpoints && this.document && this.writtenBarDurations
      ? createRecordingSync(syncpoints, { performance: this.performance, writtenBarDurations: this.writtenBarDurations }, linearizePasses(this.document)) : null;
    backend.replaceSync(sync?.ok ? sync.value : null, sync && !sync.ok ? sync.diagnostic.message : undefined);
    this.dispatchEvent(new CustomEvent<SyncEdit>('sync-edit', { detail: { sourceId: backend.id, segments, syncpoints }, bubbles: true, composed: true }));
  }
  private syncToggle() {
    if (!this.syncEditable || this.sourceId === 'synth') return nothing;
    return html`<span class="bar-toggle" role="group" aria-label="The bar shows">
      <button type="button" class="icon" aria-pressed=${!this.syncMode} aria-label="Rail: written bars" title="Rail: written bars"
        @click=${() => this.setSyncMode(false)}>${Player.stroke('M5 8v8M9.7 8v8M14.3 8v8M19 8v8')}</button>
      <button type="button" class="icon" aria-pressed=${this.syncMode} aria-label="Sync bar: recording time" title="Sync bar: recording time"
        @click=${() => this.setSyncMode(true)}>${Player.stroke('M3 12h18M8 6v12M16 6v12')}</button>
    </span>`;
  }
  private syncBar() {
    return html`<mnx-sync-bar
        .segments=${this.liveSegments ?? emptySyncSegments()}
        .duration=${this.status?.mediaDuration ?? 0}
        .time=${this.status?.mediaTime ?? 0}
        .rate=${this.rate}
        @sync-change=${this.onSyncChange}
        @sync-seek=${(e: CustomEvent<{ seconds: number }>) => void this.recordingBackend?.seekMedia(e.detail.seconds)}
        @sync-loop=${(e: CustomEvent<{ start: number; end: number } | null>) => this.recordingBackend?.setMediaLoop(e.detail ?? undefined)}
      ></mnx-sync-bar>
      <button type="button" class=${this.clickOn ? 'icon on' : 'icon'} aria-pressed=${this.clickOn} aria-label="Click on the beats" title="Click on the beats"
        @click=${() => this.setClick(!this.clickOn)}>${Player.stroke('M9 3h6l4 18H5zM12 15l5-9')}</button>`;
  }
  /** An imported sync has no segments to reopen: placing the start handle replaces it. */
  private get replacesImportedSync() {
    const source = this.activeRecording;
    return this.syncMode && !!source && Array.isArray(source.syncpoints) && source.syncpoints.length > 0
      && !source.syncSegments && !this.liveSegments?.cuts.length;
  }

  // ── rate and volume: a value on the tray, the control in an overlay ─────
  static readonly RATE_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  private setRate(value: number) {
    this.rate = this.status?.kind === 'youtube' ? value : Player.snapRate(value);
    this.rate = this.session?.setRate(this.rate) ?? this.rate;
    try {
      localStorage.setItem('mnx-player-rate', String(this.rate));
    } catch {}
  }

  private rateControl() {
    const caps = this.status?.capabilities.rate;
    const min = caps?.min ?? Player.RATE_MIN, max = caps?.max ?? Player.RATE_MAX, step = caps?.step ?? Player.RATE_STEP;
    const presets = caps?.values?.length ? [...caps.values] : Player.RATE_PRESETS.filter((r) => r >= min && r <= max);
    const open = this.openPop === 'rate';
    return html`<span class="anchor">
      <div class="pop rate" role="dialog" aria-label="Playback rate" ?hidden=${!open}>
        <div class="chips">
          ${presets.map(
            (r) => html`<button type="button" class="chip" aria-pressed=${Math.abs(r - this.rate) < 1e-9} @click=${() => this.setRate(r)}>${r}×</button>`,
          )}
        </div>
        ${caps?.values?.length
          ? nothing
          : html`<div class="line">
              <input
                aria-label="Playback rate"
                type="range"
                min=${min}
                max=${max}
                step=${step}
                .value=${String(this.rate)}
                @input=${this.changeRate}
                @dblclick=${this.resetRate}
              /><span class="val">${this.rate.toFixed(2)}×</span>
            </div>`}
      </div>
      <button
        type="button"
        class=${open ? 'value on' : 'value'}
        aria-haspopup="dialog"
        aria-expanded=${open}
        aria-label=${`Change playback rate, ${this.rate.toFixed(2)}×`}
        title="Playback rate"
        @click=${() => (this.openPop = open ? null : 'rate')}
      >${Player.stroke('M4.5 16.5a8.5 8.5 0 1 1 15 0M12 16.5l4-6')}<span>${this.rate.toFixed(2)}×</span></button>
    </span>`;
  }

  /** The level before a mute, so unmuting lands back where it was. */
  private volumeBeforeMute = 0.7;

  private setVolume(value: number) {
    this.volume = Math.min(1, Math.max(0, value));
    this.volume = this.session?.setVolume(this.volume) ?? this.volume;
    try {
      localStorage.setItem('mnx-player-volume', String(this.volume));
    } catch {}
  }

  private toggleMute() {
    if (this.volume > 0) { this.volumeBeforeMute = this.volume; this.setVolume(0); }
    else this.setVolume(this.volumeBeforeMute || 0.7);
  }

  private volumeControl() {
    const open = this.openPop === 'volume';
    const muted = this.volume === 0;
    const speaker = muted
      ? svg`<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"></path><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>`
      : svg`<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"></path><path d="M16 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
    return html`<span class="anchor">
      <div class="pop volume line" role="dialog" aria-label="Volume" ?hidden=${!open}>
        <button type="button" class="chip icon" aria-label=${muted ? 'Unmute' : 'Mute'} aria-pressed=${muted} @click=${() => this.toggleMute()}>${speaker}</button>
        <input
          aria-label="Volume"
          type="range"
          min="0"
          max="1"
          step=".05"
          .value=${String(this.volume)}
          @input=${this.changeVolume}
        /><span class="val">${Math.round(this.volume * 100)}</span>
      </div>
      <button
        type="button"
        class=${open ? 'value on' : 'value'}
        aria-haspopup="dialog"
        aria-expanded=${open}
        aria-label=${`Change volume, ${Math.round(this.volume * 100)}`}
        title="Volume"
        @click=${() => (this.openPop = open ? null : 'volume')}
      >${speaker}<span>${Math.round(this.volume * 100)}</span></button>
    </span>`;
  }

  /** One disclosure template, rendered by the player or its surrounding frame. */
  renderYouTubeNotice() {
    return this.youtubeNotice ? html`<section class="youtube-notice" aria-label="YouTube terms and privacy">
        <h3>YouTube terms and privacy</h3>
        <p>Loading connects to YouTube and Google, which may use cookies and show ads.</p>
        <p>By using YouTube, you agree to <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">YouTube's Terms</a>. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's Privacy Policy</a>.</p>
        <details>
          <summary>Privacy details</summary>
          <p>This player uses YouTube API Services. YouTube and Google receive your IP address, browser information and this site's origin. Browser privacy controls manage YouTube's cookies.</p>
          <p>Playback time and state stay in memory to follow the score; we do not save them or request YouTube account access. Rate, volume and whether this notice is hidden are saved in this browser; clearing site data resets them. The host supplies video links and score timings. Studio keeps these in your private library; contact your Studio operator for library deletion. Switching source or leaving the page destroys the video player.</p>
        </details>
        <button @click=${() => this.hideYouTubeNotice()}>Hide</button>
      </section>` : nothing;
  }

  render() {
    const playing = this.status?.wantsPlayback ?? false;
    return html` <div class="controls">
        <button
          class="primary"
          ?disabled=${!this.performance || (this.status?.needsStart && !this.status.alignmentIssue)}
          aria-label=${playing ? 'Pause' : 'Play'}
          title=${playing ? 'Pause' : 'Play'}
          @click=${() => (playing ? this.pause() : void this.play())}
        >
          ${playing ? Player.glyph('M7 5h3.5v14H7zM13.5 5H17v14h-3.5z') : Player.glyph('M8 5l11 7-11 7z')}
        </button>
        <button class="icon" ?disabled=${!this.performance} aria-label="Stop" title="Stop" @click=${() => this.stop()}>
          ${Player.glyph('M6 6h12v12H6z', 18)}
        </button>
        <output aria-live="off" class=${this.performance ? '' : 'none'} aria-label=${this.performance ? this.positionLabel : nothing}
          >${this.performance && this.syncMode
            ? html`<span>${Player.mediaClock(this.status?.mediaTime ?? 0)}</span><span class="widest" aria-hidden="true">88:88.8</span>`
            : this.performance
            ? html`<span>${this.readout()}</span
                ><span class="widest" aria-hidden="true">${this.widest}</span>`
            : 'No performance available'}</output
        >
        ${this.syncToggle()}
        ${this.syncMode ? this.syncBar() : this.rail()}
        ${this.sourceControl && (this.recordings.length || this.canAddRecording) ? html`<label class="select">Source<select aria-label="Playback source" ?disabled=${!this.performance}
          .value=${this.sourceId} @change=${(event: Event) => {
            const select = event.target as HTMLSelectElement;
            if (select.value === 'add-recording') {
              select.value = this.sourceId;
              this.dispatchEvent(new CustomEvent('add-recording', { bubbles: true, composed: true }));
            } else void this.selectSource(select.value);
          }}>
          <option value="synth" ?selected=${this.sourceId === 'synth'}>Synth</option>
          ${this.recordings.map(r => html`<option value=${r.id} ?selected=${this.sourceId === r.id}>${r.name}</option>`)}
          ${this.canAddRecording ? html`<option value="add-recording">Add recording…</option>` : nothing}
        </select></label>` : nothing}
        ${this.sourceControl ? html`<slot name="source-tools"></slot>` : nothing}
        <span class="settings">
        ${this.soundControl && this.sourceId === 'synth' ? html`<label class="select" title="Sound"
          >${Player.stroke('M3 12h2l2-6 3 12 3-9 2 5 2-2h4')}<select
            aria-label="Playback sound"
            .value=${this.voicePreset}
            @change=${(event: Event) => {
              this.voicePreset = (event.target as HTMLSelectElement).value as VoicePreset;
            }}
          >
            <option value="synth" ?selected=${this.voicePreset === 'synth'}>Synth</option>
            ${SAMPLE_PRESETS.map(
              (p) =>
                html`<option value=${p.id} ?selected=${this.voicePreset === p.id}>
                  ${p.label}
                </option>`,
            )}
          </select></label
        >` : nothing}
        ${this.rateControl()}
        ${this.volumeControl()}
        </span>
      </div>
      ${this.status?.kind === 'youtube' && !this.videoPaneHosted ? html`<section class="youtube-panel" aria-label="YouTube recording">
        <div class="youtube-surface"></div>
        <p>YouTube · <button @click=${() => this.youtubeNotice = !this.youtubeNotice}>Terms and privacy</button> · <button @click=${() => { this.pause(); void this.selectSource('synth'); }}>Close video</button></p>
      </section>` : nothing}
      ${this.videoPaneHosted ? nothing : this.renderYouTubeNotice()}
      ${this.loading
        ? html`<p role="status">
            Preparing ${this.sourceId === 'synth' && this.requiredSamples().length ? 'samples' : 'audio'}…
          </p>`
        : nothing}
      ${this.error ? html`<p role="alert">Playback unavailable: ${this.error}</p>` : nothing}
      ${this.status?.kind === 'youtube' && this.status.error ? html`<button @click=${() => void this.selectSource(this.sourceId, true)}>Retry video</button>` : this.status?.needsStart && !this.status.alignmentIssue ? html`<button @click=${() => void this.startSource()}>Start this source</button>` : nothing}
      ${this.replacesImportedSync ? html`<p role="status">This recording's imported sync has no segments to reopen. Placing the start handle replaces it.</p>` : nothing}
      ${!this.loading && this.status?.state === 'buffering' ? html`<p role="status">Buffering audio…</p>` : nothing}
      ${!this.syncWarningsInPanel && (this.status?.alignmentIssue || this.status?.syncIssue) && !this.error ? html`<p role="status">Score follow: ${this.status?.alignmentIssue || this.status?.syncIssue}</p>` : nothing}`;
  }
}
