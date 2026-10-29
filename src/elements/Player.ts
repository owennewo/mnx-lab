import { LitElement, html, css, svg, nothing, unsafeCSS } from 'lit';
import { designTokens } from './tokens.ts';
import { customElement, property, state } from 'lit/decorators.js';
import type { Performance, PerformanceMeasure } from '../audio/performanceTypes.ts';
import type { LoopRegion } from '../audio/transport.ts';
import { PlaybackSession, type PlaybackSnapshot } from '../audio/playbackSession.ts';
import { type RecordingSource, type PlaybackBackend, type ScorePosition, type ScoreLoop } from '../audio/playbackBackend.ts';
import { RecordingBackend, soundingAt, writtenByVisit, type WrittenByVisit } from '../audio/recordingBackend.ts';
import { NativeYouTubePort } from '../audio/native/youtube.ts';
import { youtubeVideoId } from '../audio/youtubeUrl.ts';
import { HtmlAudioPort } from '../audio/native/htmlAudio.ts';
import { HostBackend, type HostLayers } from '../audio/hostBackend.ts';
import { NativeHostPort } from '../audio/native/hostPort.ts';
import { createRecordingSync } from '../audio/recordingSync.ts';
import { scorePositionAt } from '../audio/scorePosition.ts';
import { linearizePasses } from '../model/passes.ts';
import { restSpansOf, restsAt, type RestSpan } from '../model/restSpans.ts';
import type { PartMix } from '../audio/partMix.ts';
import { formatPlaybackPosition, formatScorePlaybackPosition, measureAt, placeLabel, playbackPositionParts, scorePlaybackPositionParts, widestPlaceLabel, type PlaybackPositionParts } from '../audio/playbackPosition.ts';
import { ZERO, compare, type Rational } from '../audio/time.ts';
import { DEFAULT_TRAINER, PLAIN_LOOP, documentMeter, practiceRegion, type LoopBars, type MeterOf, type PracticeOptions, type PracticeThen } from '../audio/practice.ts';
import type { MnxStructure } from '../model/mnx.ts';
import type { PlaybackOccurrence, PlaybackUpdate } from './mnxContext.ts';
import { ClickTrack } from '../audio/native/click.ts';
import { beatTimes, decodeSyncSegments, defaultBeatUnit, emptySyncSegments, playingSyncpoints, syncpointsFromSegments, type SyncSegments } from '../model/syncSegments.ts';
import { screenWakeLock } from './screenWakeLock.ts';
import type { SoundsliceSyncpoint } from '../model/recordingSync.ts';
import type { SyncChange } from './SyncBar.ts';
import { isTextEntry, realTarget } from './keyScope.ts';
import './SyncBar.ts';

/** What a host persists when the sync bar commits an edit. */
/** The mix's layers (roadmap/inprogress/studio-mix-layers.md): the synth's notes and the click,
 *  each on or off, the click's level, and the recording's level under the master. Whether a
 *  recording plays is the source: one selected leads; `synth` means none does. */
export interface MixLayers extends HostLayers { recordingLevel: number }
export interface SyncEdit { sourceId: string; segments: SyncSegments; syncpoints: SoundsliceSyncpoint[] | null }

/** The tray's stacked form, for the control line `scope` names — written once,
 *  applied at two widths (see the styles). */
function stacked(scope: string) {
  const s = unsafeCSS(scope);
  return css`
    ${s} .rail,
    ${s} mnx-sync-bar {
      flex: 1 1 100%;
      order: -1;
      padding: 4px 0;
    }
    ${s} .rail .lab {
      display: none;
    }
    ${s} .rail .cell {
      grid-row: 1;
      height: max(18px, var(--rail-cell, 14px));
    }
    ${s} .rail {
      align-self: stretch;
    }
    ${s} .settings {
      display: flex;
      margin-left: auto;
      gap: 10px;
    }
    /* The control line holds the transport, the readout and both values. */
    ${s} .field.rate .box {
      min-width: 0;
    }
    ${s} .field.volume .box {
      min-width: 76px;
    }
    ${s} .field.mix {
      width: 120px;
    }
  `;
}

/** A player given a performance without its document: parts play their defaults (keys, kit). */
const NO_DOCUMENT = { parts: [] } as unknown as MnxStructure;

/** How long an edit's note waits for the performance that sounds it (`Player.audition`). */
const PENDING_AUDITION_MS = 2000;

/** Past this many passes a bar draws as one gauge rather than a lane each, so it never outgrows the tray. */
const GAUGE_PASSES = 6;

@customElement('mnx-player')
export class Player extends LitElement {
  @property({ attribute: false }) performance: Performance | null = null;
  @property({ attribute: false }) document: MnxStructure | undefined;
  @property({ type: String }) documentId = '';
  /** Per-part level, mute and instrument beneath the master volume, keyed by part index
   *  (src/audio/partMix.ts). Synth only: a recording has no parts. */
  @property({ attribute: false }) partMix: PartMix = {};
  /** An editor cursor's place (`CursorPlayback.place`). Not playing, the readout names it rather
   *  than the playhead: a recording's clock only lands near the note the cursor is on. */
  @property({ attribute: false }) cursorPlace: ScorePosition | null = null;
  /** The synth's sample rate (undefined: the device's). A change rebuilds the synth: an
   *  AudioContext's rate is fixed when it is made. */
  @property({ type: Number }) sampleRate: number | undefined;
  /** Sound a note the editor's cursor lands on (`audition`); a host's per-device choice. */
  @property({ type: Boolean }) auditionNotes = true;
  /** Whether the tray offers the Source select and its `source-tools` slot. A
   *  host that chooses sources elsewhere (studio's Source sheet) turns it off;
   *  `selectSource()` is the same either way. */
  @property({ attribute: false }) sourceControl = true;
  @property({ attribute: false }) writtenBarDurations: readonly Rational[] | undefined;
  @property({ attribute: false }) recordings: readonly RecordingSource[] = [];
  /** A host with a mixer of its own (studio's Mix panel): the tray's volume field becomes its
   *  handle — "Mix · <what plays>" — and a click asks the host to open it (`mixer-toggle`)
   *  instead of opening the volume overlay. `open` presses the field. */
  @property({ attribute: false }) mixer: { label: string; open: boolean } | null = null;
  /** A host with layers (studio): the synth plays along with a recording that leads, the click
   *  sounds every beat, and the tray's Mix field toggles the three (`layers-change`; the
   *  recording's toggle selects it, or the synth). Null: the synth plays only when it leads, as
   *  a player with no mixer always has. */
  @property({ attribute: false }) layers: MixLayers | null = null;
  /** The recording the tray's toggle turns on (the host's last choice); null: the first. */
  @property({ attribute: false }) recordingChoice: string | null = null;
  /** Host supplies recording management; standalone players omit the add action. */
  @property({ type: Boolean }) canAddRecording = false;
  /** A host recording panel owns score-alignment warnings. */
  @property({ type: Boolean }) syncWarningsInPanel = false;
  /** A host that stores what the sync bar makes (`sync-edit`) opts in; the
   *  tray then offers the rail/sync toggle while a recording is the source. */
  @property({ type: Boolean }) syncEditable = false;
  /** The bars a host's editor has selected (`CursorPlayback.range`): what the Loop button loops
   *  while the music is not playing. Null: the bar the cursor or the playhead is on. */
  @property({ attribute: false }) loopCandidate: LoopBars | null = null;
  /** The loop, as performed bars; null when there is none. */
  @state() private loopBars: LoopBars | null = null;
  /** The bars the practice is playing — the loop's, or where Advance has moved it to. */
  @state() private shownBars: LoopBars | null = null;
  /** How the loop is practised: count-in, repeats, then, gap, trainer. */
  @state() private practice: PracticeOptions = PLAIN_LOOP;
  /** A loop handle being dragged, and the bars it would make. */
  @state() private dragBars: { bars: LoopBars; edge: 'first' | 'last' } | null = null;
  private lastLoopSignature = '';
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
  /** Loading has gone on long enough to say so (`updated`). */
  @state() private preparingShown = false;
  private preparingTimer: ReturnType<typeof setTimeout> | undefined;
  @property({ type: Number }) initialOrdinal: number | null = null;
  @state() private status: PlaybackSnapshot | undefined;
  @state() private localError = '';
  private get error() { return this.localError || this.status?.error || (this.status?.alignmentIssue ? '' : this.status?.issue) || ''; }
  /** A video's failure is shown in the video's own region, not under the tray. */
  private get youtubeError() { return this.status?.kind === 'youtube' ? this.error : ''; }
  private shownYouTubeError = '';
  @state() private rate = 1;
  /** Default synth/audio controls; other backends advertise their own rates. */
  static readonly RATE_MIN = 0.25;
  static readonly RATE_MAX = 2;
  static readonly RATE_STEP = 0.05;
  @state() private volume = 0.7;
  private session?: PlaybackSession;
  /** With a recording as the source the session has no synth: one of the player's own sounds
   *  the notes the cursor lands on (roadmap: core-note-audition) and plays the synth and the
   *  click along with the recording (`layers`). Made when first wanted, kept while a recording is
   *  the source, dropped when the synth is again. */
  private auditioner?: HostBackend;
  /** What `applyLayers` last applied, so a session's frequent frames cost nothing. */
  private applied: { backend?: PlaybackBackend; key?: string; sync?: unknown; companion?: HostBackend; tuning?: number } = {};
  private applying = false;
  /** A note an edit made or changed, sounded once the edit reaches the performance. */
  private pendingAudition?: { noteKey: string; ordinal: number; at: number };
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
      position: relative;
      container-type: inline-size;
      font: 14px/1.4 var(--sans);
      color: var(--ink);
      --player-ground: light-dark(oklch(0.9 0.004 60), oklch(0.26 0.006 60));
    }
    /* Sound, rate and volume travel together: inline in the one-row tray,
       pushed to the end of the control line in the stacked form. */
    .settings {
      display: contents;
    }
    /* The stacked form: the rail (or the sync bar) becomes a full-width line
       on top, without its labels, and the transport, readout and settings
       share the line under it. The tray stays one row while the rail keeps
       about 240px beside them — sooner when it also carries a Source or Sound
       select or the bar toggle (.busy). It stacked at 1000px once, three lines
       deep, while the one still fitted. */
    @container (max-width: 780px) {
      ${stacked('.controls.busy')}
    }
    @container (max-width: 600px) {
      ${stacked('.controls')}
    }
    .youtube-panel { margin-top: 12px; }
    .youtube-surface { width: min(100%, 480px); min-width: 200px; height: clamp(200px, 56.25vw, 270px); position: relative; z-index: 10; }
    .youtube-panel p { max-width: 60ch; }
    .youtube-panel a { color: inherit; }
    .youtube-notice { max-width: 65ch; }
    /* ONE GRAMMAR (Studio tray & header canvas, 2026-10-16): every block on
       the line is the rail's shape — a 10px uppercase label over a value as
       tall as the rail's cells — so the readout, rate and volume line up
       with the section labels and the lanes instead of floating beside them
       as boxed buttons. The line is bottom-aligned; --tray-line is the
       cells' height, set from the rail. */
    .controls {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      flex-wrap: wrap;
      --tray-line: 30px;
    }
    .field {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      flex: none;
      height: auto;
      padding: 0;
      gap: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      text-align: left;
    }
    .field .lab,
    .rail .lab {
      font: 600 10px/1 var(--sans);
      letter-spacing: 0.11em;
      text-transform: uppercase;
      color: var(--ink-3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 0 0 4px 4px;
      border-left: 1px solid var(--line-strong);
    }
    .field .box {
      display: flex;
      align-items: center;
      gap: 8px;
      height: var(--tray-line);
      box-sizing: border-box;
      margin-left: 2px;
      padding: 0 8px;
      font: 600 13px/1 var(--mono);
      font-variant-numeric: tabular-nums;
      color: var(--ink);
    }
    /* The value you can change sits in a cell like the rail's. */
    button.field .box {
      justify-content: space-between;
      background: var(--tray-cell, var(--line));
    }
    button.field:hover:not(:disabled) .box,
    button.field.on .box {
      box-shadow: inset 0 0 0 1px var(--ink-3);
    }
    button.field.on {
      background: transparent;
    }
    button.field:focus-visible {
      outline-offset: 0;
    }
    .field.rate .box {
      min-width: 72px;
    }
    /* Volume: the level as a short run of cells, then the number. */
    .field.volume .box {
      background: transparent;
      padding: 0;
      min-width: 104px;
    }
    /* The mix handle: as wide as a name can be, the name ellipsized in its label. */
    .field.mix {
      width: 150px;
    }
    .field.mix .box {
      background: transparent;
      padding: 0 6px 0 4px;
    }
    /* Inset, so the pressed outline is never painted over by a lit cell. */
    .field.mix .meter {
      margin: 4px 0;
    }
    .field.mix.on .lab {
      color: var(--ink);
    }
    /* With layers (studio-mix-layers.md): three icon toggles under the label, then the master
       level, which opens the panel. */
    .field.layers {
      max-width: 220px;
    }
    .field.layers .box {
      padding: 0;
      gap: 2px;
    }
    .field.layers .box button.mix-open {
      width: auto;
      min-width: 52px;
      margin-left: 4px;
      padding: 0 6px 0 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      box-shadow: inset 0 0 0 1px var(--line-strong);
      color: var(--ink);
      font: 600 13px/1 var(--mono);
      font-variant-numeric: tabular-nums;
    }
    .field.layers .box button.mix-open[aria-expanded='true'] {
      box-shadow: inset 0 0 0 1px var(--ink-3);
    }
    .field.layers .box button[data-layer] {
      width: 42px;
      height: 100%;
      padding: 0;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 0;
      background: var(--tray-cell, var(--line));
      color: var(--ink-3);
    }
    .field.layers .box button[data-layer]:not([aria-pressed='true']):hover {
      color: var(--ink);
    }
    .field.layers .box button[aria-pressed='true'] {
      background: var(--ink);
      color: var(--player-ground);
    }
    /* On, a hover dims the glyph to mid grey: still legible, and plainly a response. */
    .field.layers .box button[aria-pressed='true']:hover {
      color: color-mix(in oklab, var(--player-ground), var(--ink) 45%);
    }
    .meter {
      display: flex;
      gap: 2px;
      flex: 1 1 auto;
      align-self: stretch;
    }
    .meter > span {
      flex: 1 1 0;
      background: var(--tray-cell, var(--line));
    }
    .meter > span.lit {
      background: var(--ink-2);
    }
    /* The readout stays a one-cell grid: the widest label it can print is
       stacked under it, invisible, so the rail beside it never moves. */
    .field.pos .box,
    .field.beat .box {
      display: grid;
      align-items: center;
      padding-left: 6px;
      font-size: 15px;
    }
    /* The beat, beside the bar under a label of its own: no word needed in the number. */
    .field.beat .box {
      color: var(--ink-2);
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
    /* Stop is a glyph beside Play, not a second box. */
    button.stop {
      width: 32px;
      height: 44px;
      border-color: transparent;
    }
    button.stop:hover:not(:disabled) {
      border-color: transparent;
      color: var(--accent);
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
      width: 44px;
      height: 44px;
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    /* The synth's audio thread is not keeping up (src/audio/hostStrain.ts): the border pulses. */
    button.primary.strained {
      animation: strained 0.9s ease-in-out infinite alternate;
    }
    @keyframes strained {
      from { box-shadow: 0 0 0 2px var(--player-ground), 0 0 0 4px transparent; }
      to { box-shadow: 0 0 0 2px var(--player-ground), 0 0 0 4px oklch(0.78 0.16 75); }
    }
    @media (prefers-reduced-motion: reduce) {
      button.primary.strained { animation: none; box-shadow: 0 0 0 2px var(--player-ground), 0 0 0 4px oklch(0.78 0.16 75); }
    }
    /* Shown only once preparing has taken a while (preparingShown), and floated over the score
       above the tray: a line of its own moved the tray for the moment a video takes to cue. */
    p.preparing {
      position: absolute;
      left: 12px;
      bottom: calc(100% + 8px);
      z-index: 5;
      margin: 0;
      padding: 5px 10px;
      font: 600 12px/1 var(--sans);
      color: var(--player-ground);
      background: var(--ink);
      border-radius: 2px;
      pointer-events: none;
      animation: preparing 0.15s ease both;
    }
    @keyframes preparing {
      from { opacity: 0; }
      to { opacity: 1; }
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
       as the beat ticks from 4 to 4½. */
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
    .place .beat {
      color: var(--ink-3);
    }
    .field.pos {
      position: relative;
    }
    .field.pos[data-tip]::after {
      content: attr(data-tip);
      position: absolute;
      left: 0;
      bottom: calc(100% + 10px);
      display: none;
      padding: 6px 10px;
      white-space: nowrap;
      font: 500 12px/1 var(--sans);
      color: var(--ink);
      background: var(--player-ground);
      border: 1px solid var(--line);
      border-radius: 3px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18), 0 6px 18px rgba(0, 0, 0, 0.22);
      z-index: 6;
      pointer-events: none;
    }
    .field.pos[data-tip]:hover::after {
      display: block;
    }
    .place sup {
      font-size: 0.7em;
      line-height: 0;
      vertical-align: 0.55em;
      margin-left: 1px;
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
      align-self: flex-end;
      display: grid;
      gap: 0 var(--rail-gap, 2px);
      align-items: end;
      padding: 0;
      box-sizing: border-box;
    }
    .rail .lab {
      grid-row: 1;
      pointer-events: none;
    }
    .rail .cell {
      grid-row: 2;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 2px;
      height: var(--tray-line, 30px);
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
      background: var(--tray-cell, var(--line));
    }
    /* A bar played more than six times: one gauge, filled by the passes played. */
    .gauge {
      position: relative;
      display: block;
      flex: 1 1 0;
      width: 100%;
      padding: 0;
      border: 0;
      border-radius: 1px;
      background: linear-gradient(to bottom,
        color-mix(in oklab, var(--accent), var(--player-ground) 45%) var(--fill),
        var(--tray-cell, var(--line)) var(--fill));
      box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ink), transparent 70%);
    }
    .gauge .mark {
      position: absolute;
      left: -1px;
      right: -1px;
      top: var(--at);
      height: max(3px, var(--pass));
      background: var(--accent);
    }
    .gauge:hover,
    .gauge:focus-visible {
      outline: 2px solid var(--ink);
      outline-offset: 1px;
      z-index: 2;
    }
    .gauge::after {
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
    .gauge:hover::after,
    .gauge:focus-visible::after {
      display: block;
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
    /* ── the loop ──
       The loop's lanes tinted, a bracket over its bars and a handle at each
       end (Loop practice canvas, 2026-10-22): a grip that rises above the
       tray, drawn 20px wide, caught 48 × 96. In playback's blue, as the
       score's marker is; the playhead's lane keeps the tray's accent. Neither
       sizes the rail's rows: a looping rail is as tall as a handle, its rows
       packed at the foot, so the section names stay on the lanes and the
       bracket runs between the two. A handle rises from the lanes' row, its
       stem stopping at the foot of the lane it holds (--lift: the lanes below
       it, as a fraction of the cell). */
    .rail.looping {
      min-height: 88px;
      align-content: end;
    }
    .lane.looped {
      background: color-mix(in oklab, var(--playback), var(--player-ground) 62%);
    }
    .lane.looped.played {
      background: color-mix(in oklab, var(--playback), var(--player-ground) 40%);
    }
    .lane.looped[aria-current='true'] {
      background: var(--accent);
    }
    .rail .loop-bracket {
      grid-row: 2;
      align-self: start;
      height: 2px;
      margin-top: -3px;
      background: var(--playback);
      pointer-events: none;
    }
    .rail .loop-handle {
      grid-row: 2;
      align-self: end;
      position: relative;
      z-index: 4;
      --drop: calc((var(--tray-line, 30px) + 2px) * var(--lift, 0));
      width: 24px;
      height: calc(88px - var(--drop));
      margin-top: calc(var(--tray-line, 30px) - 88px);
      margin-bottom: var(--drop);
      padding: 0;
      gap: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      display: flex;
      flex-direction: column;
      align-items: center;
      touch-action: none;
      cursor: ew-resize;
    }
    .rail .loop-handle.first {
      justify-self: start;
      margin-left: -12px;
    }
    .rail .loop-handle.last {
      justify-self: end;
      margin-right: -12px;
    }
    /* The catch is wider than the grip. */
    .rail .loop-handle::before {
      content: '';
      position: absolute;
      inset: -4px -12px;
    }
    .rail .loop-handle .grip {
      width: 20px;
      height: 20px;
      flex: none;
      border-radius: 3px;
      background: var(--playback);
    }
    .rail .loop-handle .stem {
      width: 2px;
      flex: 1 1 0;
      background: var(--playback);
    }
    .rail .loop-handle:focus-visible .grip {
      outline: 2px solid var(--ink);
      outline-offset: 2px;
    }
    .rail .loop-handle.dragging {
      filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
    }
    .rail .loop-card {
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      padding: 5px 9px;
      white-space: nowrap;
      font: 600 12px/1 var(--sans);
      color: #fff;
      background: var(--ink);
      border-radius: 2px;
      pointer-events: none;
    }
    .field.loop .box {
      padding: 0;
      gap: 0;
      background: var(--tray-cell, var(--line));
      min-width: 104px;
    }
    .field.loop.on .box {
      background: color-mix(in oklab, var(--playback), var(--player-ground) 88%);
      box-shadow: inset 0 0 0 1.5px var(--playback);
    }
    .field.loop.on .lab {
      color: var(--playback);
    }
    .field.loop .box button {
      height: 100%;
      border: 0;
      border-radius: 0;
      background: transparent;
      font: 600 13px/1 var(--mono);
      font-variant-numeric: tabular-nums;
    }
    .field.loop .box button.toggle {
      flex: 1 1 auto;
      gap: 6px;
      padding: 0 8px;
    }
    .field.loop.on .box button {
      color: var(--playback);
    }
    .field.loop .box button.more {
      flex: none;
      width: 26px;
      padding: 0;
      justify-content: center;
      border-left: 1px solid color-mix(in oklab, var(--ink), transparent 82%);
    }
    .field.loop .box button.more[aria-expanded='true'] {
      background: var(--playback);
      color: var(--player-ground);
    }
    .pop.loop {
      width: min(330px, calc(100vw - 32px));
      font: 13px/1.3 var(--sans);
    }
    .pop.loop .head {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .pop.loop .head b {
      font-size: 15px;
      font-weight: 600;
    }
    .pop.loop .head span {
      flex: 1 1 auto;
      color: var(--ink-3);
    }
    .pop.loop .head button {
      height: auto;
      padding: 0;
      border: 0;
      background: none;
      text-decoration: underline;
      font-size: 12px;
      color: var(--ink-2);
    }
    .pop.loop .row {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 28px;
    }
    .pop.loop .row > span:first-child {
      flex: 1 1 auto;
      color: var(--ink-2);
    }
    .seg {
      display: inline-flex;
    }
    .seg button {
      height: 26px;
      min-width: 34px;
      padding: 0 9px;
      margin-left: -1px;
      border-radius: 0;
      justify-content: center;
      font: 600 12px/1 var(--sans);
      color: var(--ink-2);
    }
    .seg button[aria-checked='true'] {
      position: relative;
      background: var(--ink);
      border-color: var(--ink);
      color: var(--player-ground);
    }
    .pop.loop .note {
      margin: 0;
      font-size: 12px;
      color: var(--ink-3);
    }
    .pop.loop .progress {
      display: flex;
      align-items: center;
      gap: 10px;
      font: 600 12px/1 var(--mono);
    }
    .pop.loop .progress .bars {
      flex: 1 1 auto;
      height: 6px;
      display: flex;
      gap: 2px;
    }
    .pop.loop .progress .bars span {
      flex: 1 1 0;
      background: var(--tray-cell, var(--line));
    }
    .pop.loop .progress .bars span.done {
      background: var(--ink);
    }
    .pop.loop .progress .bars span.now {
      background: var(--accent);
    }
    .pop.loop .rule {
      height: 1px;
      background: var(--line);
    }
    .pop.loop label.check {
      display: flex;
      align-items: center;
      gap: 8px;
      height: auto;
      padding: 0;
      border: 0;
    }
    .steppers {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
    }
    .stepper {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .stepper > span {
      font: 600 10px/1 var(--sans);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-3);
    }
    .stepper > div {
      display: flex;
      align-items: center;
      height: 28px;
      background: var(--tray-cell, var(--line));
    }
    .stepper output {
      flex: 1 1 auto;
      text-align: center;
      font: 600 12px/1 var(--mono);
      white-space: nowrap;
    }
    .stepper button {
      width: 22px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 0;
      justify-content: center;
      background: transparent;
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
    /* A phone's narrowest tray: the rate is its value alone, the play button
       drops to the tray's own 40px and the values close in, so the control
       line still holds at 320px. Last in the sheet, so it wins over the rules
       it narrows. */
    @container (max-width: 340px) {
      .controls,
      .controls .settings {
        gap: 6px;
      }
      button.primary {
        width: 40px;
        height: 40px;
      }
      .field.rate .box {
        min-width: 0;
      }
      .field.rate .box svg {
        display: none;
      }
      .controls .field.volume .box {
        min-width: 0;
      }
      .meter {
        flex: 0 0 36px;
      }
      .controls .field.mix {
        width: 96px;
      }
      button.stop {
        width: 24px;
      }
    }
  `
  ];
  /** Which overlay is open — rate or volume; it closes on click-away or Escape. */
  @state() private openPop: 'rate' | 'volume' | 'loop' | null = null;
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
      this.practice = Player.readPractice(localStorage.getItem('mnx-player-practice'));
    } catch {}
    this.rate = Player.snapRate(this.rate);
    this.volume = Number.isFinite(this.volume) ? Math.min(1, Math.max(0, this.volume)) : 0.7;
    if (this.hasUpdated) this.install();
  }
  disconnectedCallback() {
    clearTimeout(this.preparingTimer); this.preparingTimer = undefined;
    document.removeEventListener('pointerdown', this.onClickAway);
    this.removeEventListener('keydown', this.onKeydown);
    this.removeEventListener('keyup', this.onKeyup);
    this.teardown();
    this.wakeLock.dispose();
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
    // A prepared synth starts in tens of milliseconds, a video in a few hundred: say "Preparing"
    // only if it takes longer. Rendered hidden and faded in instead, the line held an empty bar
    // open under the tray in the meantime.
    if (this.loading && this.preparingTimer === undefined && !this.preparingShown)
      this.preparingTimer = setTimeout(() => { this.preparingTimer = undefined; this.preparingShown = this.loading; }, 350);
    if (!this.loading && (this.preparingTimer !== undefined || this.preparingShown)) {
      clearTimeout(this.preparingTimer); this.preparingTimer = undefined; this.preparingShown = false;
    }
    // The parked cursor decides what is lit, so a move of it is published like a move of the playhead.
    if (changed.has('cursorPlace')) this.publish();
    // A host video pane draws the notice and the video's failure from here: either changing redraws it.
    if (changed.has('youtubeNotice') || this.youtubeError !== this.shownYouTubeError) {
      this.shownYouTubeError = this.youtubeError;
      this.dispatchEvent(new CustomEvent('video-notice-changed', { bubbles: true, composed: true }));
    }
    // An edit — the same document, a new performance — keeps the session and hands the
    // backend the performance in place (core-player-live-edit). Another document, a
    // performance appearing or vanishing, or new sample options install afresh.
    const scoreMoved = changed.has('performance') || changed.has('document') || changed.has('writtenBarDurations');
    const reinstall =
      changed.has('documentId') ||
      (scoreMoved && (!this.session || !this.performance));
    if (!reinstall && scoreMoved) this.replacePerformance();
    const pending = this.pendingAudition;
    if (pending && scoreMoved) {
      this.pendingAudition = undefined;
      // An edit that never reached the performance says nothing about this one.
      if (Date.now() - pending.at < PENDING_AUDITION_MS) this.soundNote(pending.noteKey, pending.ordinal);
    }
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
    if (!reinstall && changed.has('sampleRate') && changed.get('sampleRate') !== this.sampleRate && this.session?.backend instanceof HostBackend) {
      this.session.pause();
      void this.selectSource('synth', true);
    }
    // The mix — levels, mutes, instruments — reconfigures the host in place.
    if (!reinstall && changed.has('partMix') && this.session?.backend instanceof HostBackend)
      this.session.backend.setPartMix(this.partMix);
    if (changed.has('partMix')) this.auditioner?.setPartMix(this.partMix);
    if (changed.has('sampleRate') && changed.get('sampleRate') !== this.sampleRate) this.dropAuditioner();
    // A recording's tuning arrives with the recordings: the companion follows it again when it moved.
    if (changed.has('layers') || changed.has('sampleRate') || changed.has('recordings')) this.applyLayers();
  }
  /** The performance's notes by visit, for the parked cursor's lamp. */
  private writtenCache: { performance: Performance; byVisit: WrittenByVisit } | null = null;
  /** Rests built once per document; the publish runs every beat. */
  private restCache: { doc: MnxStructure; spans: readonly RestSpan[] } | null = null;

  /**
   * THE SILENCE UNDER THE PLAYHEAD, as occurrences the paint can light.
   *
   * A rest sounds nothing, so it is not in the backend's `highlight` — that
   * list comes from note attacks and releases, and always will. But a reader
   * following the music wants to see WHERE the beat is during a bar's rest as
   * much as during its notes, so the written position the backend already
   * reports is intersected with the document's rests here and the result
   * joins the same channel. A rest lights exactly like a note, in its own
   * voice's colour, on whichever staves drew it.
   *
   * Nothing is published while the playhead is hidden or parked: `visible`
   * already decides that for the bar readout, and a rest lit by a stopped
   * transport would be a cursor pretending to be a performance.
   */
  private restsUnderPlayhead(position: ScorePosition | null): PlaybackOccurrence[] {
    const doc = this.document;
    if (!position || !doc || !this.performance) return [];
    // `ScorePosition.ordinal` names a performed VISIT; the rests are written,
    // so the visit is resolved back to the bar it is a copy of.
    const measure = this.performance.measures[position.ordinal];
    if (!measure) return [];
    if (this.restCache?.doc !== doc) this.restCache = { doc, spans: restSpansOf(doc) };
    return restsAt(this.restCache.spans, measure.measureIndex, position.metricOffset)
      .map(span => ({ noteKey: span.key, ordinal: position.ordinal }));
  }

  private soundingAt(at: ScorePosition): PlaybackOccurrence[] {
    const performance = this.performance!;
    if (this.writtenCache?.performance !== performance) this.writtenCache = { performance, byVisit: writtenByVisit(performance) };
    return soundingAt(this.writtenCache.byVisit, at);
  }

  private publish() {
    const status = this.status;
    const visible = status && !status.hidePlayhead && (status.state !== 'stopped' || status.highlight.length > 0);
    const current = status?.transport && this.performance ? measureAt(this.performance, status.transport.position)?.ordinal
      : status?.scorePosition?.ordinal;
    // Not playing, the cursor's exact place is what sounds and which visit it is: a playhead read
    // back from a recording's clock lands a hair short of the note it was parked on, which lit the
    // note before — and at a bar's first note, the visit before, and so the wrong verse's row.
    const parked = visible ? this.parkedCursor : null;
    const ordinal = parked ? parked.ordinal
      : visible && current !== undefined && current < (this.performance?.measures.length ?? 0) ? current : null;
    const bounds = status?.mediaBounds;
    const recordingBookends = bounds && !status?.syncIssue ? {
      preRollSeconds: Math.max(0, bounds.startSeconds),
      postRollSeconds: Math.max(0, (bounds.durationSeconds ?? bounds.endSeconds) - bounds.endSeconds)
    } : null;
    const detail: PlaybackUpdate = { documentId: this.documentId, ordinal,
      highlight: parked ? [...this.soundingAt(parked), ...this.restsUnderPlayhead(parked)]
        : [...(status?.highlight ?? []), ...this.restsUnderPlayhead(visible ? status?.scorePosition ?? null : null)],
      playing: status?.wantsPlayback ?? false, recordingBookends, mediaPhase: status?.mediaPhase ?? null };
    this.wakeLock.want(status?.wantsPlayback ?? false);
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
    this.loopBars = this.shownBars = null; this.dragBars = null;
    this.youtubeNotice = false;
    this.revision++;
    this.session?.dispose(); this.session = undefined;
    this.dropAuditioner(); this.pendingAudition = undefined;
    this.status = undefined; this.lastOrdinal = null; this.publish(); this.announceLoop();
  }
  /** Held while the transport wants playback — a stand's screen must not
   *  sleep mid-song. Driven from publish(), the one place that knows. */
  private readonly wakeLock = screenWakeLock();
  private install() {
    this.teardown(); this.localError = '';
    if (!this.performance || !this.isConnected) return;
    const revision = this.revision;
    // The factory reads the performance when it is CALLED: after an edit the session is kept
    // (`replacePerformance`) and a later select must see the score as it is now.
    const factory = (id: string): PlaybackBackend => {
      const performance = this.performance;
      if (!performance) throw new Error('There is no performance to play.');
      // The synth: its instrument host (src/audio/hostBackend.ts), loaded from beside the
      // page's synth shell or the embed's script (setSynthBase).
      if (id === 'synth') {
        const port = new NativeHostPort({ volume: this.volume, sampleRate: this.sampleRate, onError: message => { if (revision === this.revision) this.localError = message; } });
        return new HostBackend(performance, this.document ?? NO_DOCUMENT, port, { volume: this.volume, partMix: this.partMix }, event => {
          if (revision === this.revision && event.kind === 'onset') this.dispatchEvent(new CustomEvent('onset', {
            detail: { ...event, documentId: this.documentId }, bubbles: true, composed: true,
          }));
        });
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
      // No sync points is a recording without score following, not a sync issue.
      const sync = playing.syncpoints && this.document && this.writtenBarDurations
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
        sync && !sync.ok ? sync.diagnostic.message : !sync && playing.syncpoints ? 'Score timing information is unavailable for this recording.' : undefined);
    };
    this.session = new PlaybackSession(factory('synth'), factory, () => {
      if (revision !== this.revision || !this.session) return;
      this.status = this.session.snapshot; this.rate = this.status.rate; this.volume = this.status.volume; this.refreshDerivedSync(); this.followPractice(); this.publish();
      if (this.session.backend instanceof HostBackend) this.dropAuditioner();
      else this.auditioner?.setVolume(this.volume);
      this.applyLayers();
    });
    this.session.setRate(this.rate); this.session.setVolume(this.volume);
    this.session.stop();
    this.applied = {}; this.applyLayers();
    this.status = this.session.snapshot; this.publish();
  }
  /**
   * The layers onto the backends: the synth's and the click's levels on the synth that leads;
   * with a recording leading, its level, and the companion synth following it through its sync
   * while the synth or the click is on. Without a usable sync there is nothing to follow by.
   */
  private applyLayers() {
    const backend = this.session?.backend, layers = this.layers;
    if (!backend || !layers || this.applying) return;
    // What is applied is noted first: a backend that notifies as it is set must not loop back here.
    this.applying = true;
    try {
      const key = JSON.stringify(layers), before = this.applied, fresh = before.backend !== backend || before.key !== key;
      if (backend instanceof HostBackend) {
        this.applied = { backend, key };
        if (fresh) backend.setLayers(layers);
        return;
      }
      if (!(backend instanceof RecordingBackend)) return;
      const sync = backend.syncMap;
      if (!(layers.synth || layers.click) || !sync || !this.performance) {
        this.applied = { backend, key };
        if (fresh) backend.setLevel(layers.recordingLevel);
        this.auditioner?.followMedia(null);
        return;
      }
      const companion = this.companion(), tuning = this.activeRecording?.tuningCents ?? 0;
      this.applied = { backend, key, sync, companion, tuning };
      if (fresh) backend.setLevel(layers.recordingLevel);
      if (fresh || before.companion !== companion) companion.setLayers(layers);
      if (fresh || before.companion !== companion || before.sync !== sync || before.tuning !== tuning) {
        // A recording off concert pitch (its tuning, in cents) is followed that far off.
        companion.followMedia({ sync, tuningCents: tuning, read: () => {
          const s = backend.snapshot;
          return s.mediaTime === undefined ? null : { mediaTime: s.mediaTime, rate: s.rate, playing: s.state === 'playing' };
        } });
      }
    } finally { this.applying = false; }
  }
  /** The player's own synth while a recording is the source (`auditioner`). */
  private companion() {
    return this.auditioner ??= new HostBackend(this.performance!, this.document ?? NO_DOCUMENT,
      new NativeHostPort({ volume: this.volume, sampleRate: this.sampleRate }), { volume: this.volume, partMix: this.partMix }, () => {});
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
    this.auditioner?.replacePerformance(performance, this.document);
    if (backend instanceof HostBackend) { backend.replacePerformance(performance, this.document); this.reapplyLoop(); }
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
  /** The cursor's place while the music is not playing, when there is one in this performance. */
  private get parkedCursor(): ScorePosition | null {
    const at = this.cursorPlace;
    return at && !this.playback?.wantsPlayback && this.performance && at.ordinal < this.performance.measures.length ? at : null;
  }
  get positionParts(): PlaybackPositionParts | null {
    if (!this.performance) return null;
    const parked = this.parkedCursor;
    if (parked) { const parts = scorePlaybackPositionParts(this.performance, parked, this.document); return parts ? { ...parts, insertion: null } : null; }
    const status = this.playback;
    if (!status || status.kind === 'synth') return playbackPositionParts(this.performance, this.position, this.document);
    if (status.scorePosition) {
      const parts = scorePlaybackPositionParts(this.performance, status.scorePosition, this.document);
      return parts ? { ...parts, insertion: null } : null;
    }
    return null;
  }
  get positionLabel() {
    if (!this.performance) return 'Nothing to play';
    const parked = this.parkedCursor;
    if (parked) return formatScorePlaybackPosition(this.performance, parked, this.document);
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
    const selected = await this.session?.select(id, replace) ?? false;
    // A new source is a new backend: the loop is set on it afresh.
    if (selected) this.reapplyLoop();
    return selected;
  }
  async play() {
    this.localError = '';
    if (this.status?.needsStart && this.status.alignmentIssue) { await this.session?.start(); return; }
    await this.toLoopStart();
    // Within the gesture: a synth following a recording needs its audio running.
    if (this.applied.companion && this.applied.sync) void this.applied.companion.wake().catch(() => {});
    await this.session?.play();
  }
  /** A loop set, Play starts at its first bar — the bars it has got to, at the repeat it had
   *  reached. The run-out after a loop (Carry on) plays on from where it paused. */
  private async toLoopStart() {
    const bars = this.shownBars, session = this.session, measure = bars && this.performance?.measures[bars.first];
    if (!bars || !measure || !session || this.playback?.wantsPlayback || this.status?.transport?.loop?.visit.runOut) return;
    await session.seek({ ordinal: bars.first, metricOffset: measure.from });
  }
  pause() { this.session?.pause(); }
  /** Sound one written note on that visit with the synth (roadmap: core-note-audition) — the
   *  session's, or with a recording as the source one kept for this. Silent when switched off
   *  and while playing. */
  audition(noteKey: string, ordinal: number, options: { edited?: boolean } = {}): boolean {
    if (!this.auditionNotes || !this.session || !this.performance || this.playback?.wantsPlayback) return false;
    // An edit made or changed the note: the performance that sounds it is the one the edit
    // is about to hand over (`updated`), not the one playing now, which has the old pitch.
    if (options.edited) { this.pendingAudition = { noteKey, ordinal, at: Date.now() }; return true; }
    return this.soundNote(noteKey, ordinal);
  }
  private soundNote(noteKey: string, ordinal: number): boolean {
    const backend = this.session?.backend;
    if (backend instanceof HostBackend) { this.dropAuditioner(); return backend.audition(noteKey, ordinal); }
    if (!this.performance) return false;
    return this.companion().audition(noteKey, ordinal);
  }
  private dropAuditioner() { this.auditioner?.dispose(); this.auditioner = undefined; this.applied = { ...this.applied, companion: undefined }; }
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
  /**
   * Seek to a bar, or to a BEAT inside it.
   *
   * `metricOffset` is where in the written bar to land. It is what a press on
   * the score means — the reader pointed at a moment, not at a barline — and
   * without it a click halfway through a bar rewound the recording to the
   * bar's start, which reads as the scrubber refusing to move at all when the
   * press was already in the current bar.
   *
   * Clamped to the visit's own written slice: a mid-bar segno makes a bar's
   * copy start somewhere other than zero, and an offset outside `from…until`
   * is not a position this visit contains.
   */
  seek(ordinal: number, metricOffset?: Rational) {
    const measure = this.performance?.measures.find(m => m.ordinal === ordinal);
    if (!measure || !this.session) return false;
    // Playing, a seek out of the loop leaves it; paused, the loop stays and Play starts at it.
    const shown = this.shownBars;
    if (shown && this.playback?.wantsPlayback && (ordinal < shown.first || ordinal > shown.last)) this.setLoopBars(null);
    const within = metricOffset === undefined
      ? measure.from
      : compare(metricOffset, measure.from) < 0
        ? measure.from
        : compare(metricOffset, measure.until) > 0
          ? measure.until
          : metricOffset;
    const target = { ordinal, metricOffset: within };
    // An explicit bar click includes the grace/hold at its start. Handoffs
    // deliberately omit this edge because they must not guess within an insertion.
    const edge = this.session.backend instanceof HostBackend ? 'before' : undefined;
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
    if (this.session.backend instanceof HostBackend) { this.session.backend.transport.setLoop(loop); return; }
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
  /** The live readout, in two fields: BAR prints the bar with its time through raised (`9²`),
   *  BEAT the beat, then a hold or grace when the playhead is inside one. Each sizes itself by
   *  the widest it can print, so neither moves as the beat ticks. `of 6` stays in the hover
   *  cards and the accessible name. */
  private readout() {
    if (!this.performance) return nothing;
    const parts = this.positionParts;
    if (!parts) return this.positionLabel;
    const [bar] = Player.bare(placeLabel(parts)).split(' · ');
    // A bar the performance plays once needs no time through.
    return html`<span class="place"><span>${Player.barPass(parts.occurrences > 1 ? bar ?? '' : parts.bar)}</span><span class="widest" aria-hidden="true">${Player.barPass(Player.bare(this.widestPlace).split(' · ')[0] ?? '')}</span></span>`;
  }
  private beatReadout() {
    const parts = this.positionParts;
    if (!parts) return nothing;
    const tail = parts.insertion ? ` · ${parts.insertion}` : '';
    const widest = Player.bare(this.widest).split(' · ').slice(1).join(' · ').replace(/^beat /, '');
    return html`<span class="place"><span>${parts.beat}${tail}</span><span class="widest" aria-hidden="true">${widest}</span></span>`;
  }
  /** `9.2` as the readout prints it: the bar, its time through raised — `9²`. */
  private static barPass(bar: string) {
    const [written, pass] = bar.split('.');
    return html`${written}${pass ? html`<sup>${pass}</sup>` : nothing}`;
  }
  /** The readout's hover card, worded as the lyric margin's: which bar played, and which bar
   *  of the score and time through it that is. */
  private placeTip(): string | null {
    const parts = this.positionParts;
    if (!parts) return null;
    const nth = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
    const times = parts.occurrences > 1 ? `, ${nth(parts.occurrence)} time through of ${parts.occurrences}` : '';
    return `${nth(parts.ordinal + 1)} bar played · bar ${parts.bar} of the score${times}`;
  }
  /** The readout sits under its BAR label, so it drops the `#` the rail's cards and the accessible name keep. */
  private static bare(label: string) { return label.replace(/^# /, ''); }

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
    const looped = this.dragBars?.bars ?? this.shownBars;
    return html`<div
      class=${looped && !this.syncMode ? 'rail looping' : 'rail'}
      role="group"
      aria-label="Position"
      tabindex="-1"
      style=${`grid-template-columns: repeat(${model.columns}, minmax(0, 1fr)); --rail-gap: ${model.gap}px; --rail-cell: ${model.cell}px;`}
    >
      ${model.labels.map((l) => html`<div class="lab" style=${`grid-column: ${l.at + 1} / span ${l.span};`}>${l.text}</div>`)}
      ${model.cells.map(
        (cell, i) => html`<div class=${cell.first ? 'cell first' : 'cell'} style=${`grid-column: ${i + 1};`}>
          ${cell.lanes.length > GAUGE_PASSES ? this.gauge(cell.lanes, current) : cell.lanes.map(
            (lane) => html`<button
              type="button"
              class=${[
                'lane',
                lane.ordinal < current ? 'played' : '',
                lane.jumped ? 'jumped' : '',
                lane.x > 0 || lane.w < 1 ? 'partial' : '',
                looped && lane.ordinal >= looped.first && lane.ordinal <= looped.last ? 'looped' : '',
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
      ${this.loopOnRail()}
    </div>`;
  }

  /**
   * A bar played more than GAUGE_PASSES times, as one gauge rather than a lane per pass: it
   * fills from the top as its passes are played, the playhead's pass a mark across it. A
   * press seeks to the pass at that height, and the card names the pass under the pointer.
   */
  private gauge(lanes: { ordinal: number; tip: string }[], current: number) {
    const played = lanes.filter(lane => lane.ordinal < current).length;
    const now = lanes.findIndex(lane => lane.ordinal === current);
    const at = (event: MouseEvent) => {
      const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
      return lanes[Math.min(lanes.length - 1, Math.max(0, Math.floor((event.clientY - box.top) / box.height * lanes.length)))]!;
    };
    return html`<button
      type="button"
      class="gauge"
      style=${`--fill: ${(played / lanes.length * 100).toFixed(2)}%; --at: ${(Math.max(0, now) / lanes.length * 100).toFixed(2)}%; --pass: ${(100 / lanes.length).toFixed(2)}%;`}
      aria-label=${`${lanes[0]?.tip.split(' · ')[0] ?? ''} · ${lanes.length} times`}
      aria-current=${now >= 0 ? 'true' : nothing}
      data-tip=${(now >= 0 ? lanes[now] : lanes[Math.min(played, lanes.length - 1)])?.tip ?? ''}
      @mousemove=${(event: MouseEvent) => (event.currentTarget as HTMLElement).setAttribute('data-tip', at(event).tip)}
      @click=${(event: MouseEvent) => this.seek(at(event).ordinal)}
    >${now >= 0 ? html`<span class="mark"></span>` : nothing}</button>`;
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

  // ── the loop (roadmap/inprogress/studio-player-practice.md) ────────────
  // Whole performed bars, first to last. The Loop button takes the bar
  // playing, else the editor's selection as the host reports it, else the
  // bar the cursor or the playhead is on. The synth plays it as a practice
  // (src/audio/practice.ts); a recording loops it plainly, by seeking.

  /** The loop's bars, or null. */
  get loop(): LoopBars | null { return this.loopBars; }
  /** How the loop is practised. */
  get practiceOptions(): PracticeOptions { return this.practice; }
  /** Turn the loop on (on the bars the button takes) or off. */
  toggleLoop() { this.setLoopBars(this.loopBars ? null : this.loopTarget()); }
  /** Loop these performed bars; null clears the loop. */
  setLoopBars(bars: LoopBars | null) {
    const count = this.performance?.measures.length ?? 0;
    const valid = bars && bars.first >= 0 && bars.first <= bars.last && bars.last < count ? { first: bars.first, last: bars.last } : null;
    this.loopBars = this.shownBars = valid;
    if (!valid && this.openPop === 'loop') this.openPop = null;
    this.applyLoop();
    this.announceLoop();
  }
  /** Change how the loop is practised; a loop playing starts its count of repeats again. */
  setPracticeOptions(options: PracticeOptions) {
    this.practice = options;
    this.adoptShownBars();
    this.savePractice();
    this.reapplyLoop();
  }
  private loopTarget(): LoopBars | null {
    const count = this.performance?.measures.length ?? 0;
    const bar = (o: number | null | undefined) => o !== null && o !== undefined && o >= 0 && o < count ? { first: o, last: o } : null;
    if (!count) return null;
    if (this.playback?.wantsPlayback) return bar(this.scorePosition?.ordinal);
    const c = this.loopCandidate;
    if (c && c.first >= 0 && c.first <= c.last && c.last < count) return c;
    return bar(this.cursorPlace?.ordinal) ?? bar(this.scorePosition?.ordinal) ?? bar(0);
  }
  /** Once Advance has moved the practice, the loop is where it got to: an edit starts from there. */
  private adoptShownBars() {
    if (this.shownBars && this.loopBars && (this.shownBars.first !== this.loopBars.first || this.shownBars.last !== this.loopBars.last))
      this.loopBars = this.shownBars;
  }
  /** The loop again, after the backend or the performance changed under it. */
  private reapplyLoop() {
    const count = this.performance?.measures.length ?? 0;
    if (this.loopBars && this.loopBars.last >= count) { this.setLoopBars(null); return; }
    if (this.loopBars) this.shownBars = this.loopBars;
    this.applyLoop();
    this.announceLoop();
  }
  private applyLoop() {
    const session = this.session, performance = this.performance, bars = this.loopBars;
    if (!session || !performance) return;
    const backend = session.backend;
    try {
      if (backend instanceof HostBackend) backend.transport.setLoop(bars ? practiceRegion(performance, bars, this.practice, this.rate, this.meterOf()) : undefined);
      else session.setLoop(bars ? this.scoreLoop(bars) : undefined);
    } catch (error) {
      this.loopBars = this.shownBars = null;
      this.localError = `the loop could not be set (${error instanceof Error ? error.message : String(error)})`;
    }
  }
  /** Bars as a recording's loop: from the first bar's start to the next bar's. */
  private scoreLoop(bars: LoopBars): ScoreLoop {
    const measures = this.performance!.measures, first = measures[bars.first]!, next = measures[bars.last + 1];
    return {
      start: { ordinal: bars.first, metricOffset: first.from },
      end: next ? { ordinal: bars.last + 1, metricOffset: next.from } : { ordinal: measures.length, metricOffset: ZERO },
    };
  }
  /** Each bar's count: the beats of its time signature (compound time counted in dotted beats). */
  private meterOf(): MeterOf { return documentMeter(this.performance!, this.document); }
  /** The practice moved on (Advance) or ended: the loop follows it. */
  private followPractice() {
    const loop = this.status?.transport?.loop, take = loop?.visit.take?.bars;
    if (!this.loopBars || !take || this.dragBars) { this.announceLoop(); return; }
    const same = (a: LoopBars | null, b: LoopBars) => a?.first === b.first && a.last === b.last;
    if (!same(this.shownBars, take)) this.shownBars = take;
    // Advanced to the end: the loop stays where it got to, and plays from there next time.
    if (loop?.ended && !same(this.loopBars, take)) { this.loopBars = take; queueMicrotask(() => this.applyLoop()); }
    this.announceLoop();
  }
  /** The written bar a performed one is, as the score numbers it. */
  private barLabel(ordinal: number): string {
    const m = this.performance?.measures[ordinal];
    if (!m) return '';
    return String(this.document?.global.measures[m.measureIndex]?.number ?? m.measureIndex + 1);
  }
  private barsLabel(bars: LoopBars) {
    const a = this.barLabel(bars.first), b = this.barLabel(bars.last);
    return a === b && bars.first === bars.last ? a : `${a}–${b}`;
  }
  /** Tell the host where the loop is, for the score's marker (`loop-changed`). */
  private announceLoop() {
    const bars = this.dragBars?.bars ?? this.shownBars, performance = this.performance;
    const loop = this.status?.transport?.loop, playing = this.playback?.wantsPlayback ?? false;
    const take = loop?.visit.take;
    const counting = playing ? loop?.counting ?? null : null;
    const detail = bars && performance ? {
      first: bars.first,
      last: bars.last,
      measures: [...new Set(performance.measures.slice(bars.first, bars.last + 1).map(m => m.measureIndex))],
      start: performance.measures[bars.first]!.measureIndex,
      end: performance.measures[bars.last]!.measureIndex,
      label: `Loop ${this.barsLabel(bars)}${playing && take && this.practice.repeats !== null ? ` · repeat ${take.repeat} of ${this.practice.repeats}` : ''}`,
      counting,
    } : null;
    const signature = JSON.stringify([this.documentId, detail]);
    if (signature === this.lastLoopSignature) return;
    this.lastLoopSignature = signature;
    this.dispatchEvent(new CustomEvent('loop-changed', { detail: { documentId: this.documentId, loop: detail }, bubbles: true, composed: true }));
  }
  private static readPractice(json: string | null): PracticeOptions {
    try {
      const o = JSON.parse(json ?? 'null') as Partial<PracticeOptions> | null;
      if (!o || typeof o !== 'object') return PLAIN_LOOP;
      const int = (v: unknown, lo: number, hi: number, d: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : d;
      const t = o.trainer;
      return {
        countIn: int(o.countIn, 0, 2, 0),
        repeats: o.repeats === null ? null : int(o.repeats, 1, 99, 4),
        then: o.then === 'continue' || o.then === 'advance' ? o.then : 'stop',
        gap: int(o.gap, 0, 1, 0),
        trainer: t && typeof t === 'object' && [t.start, t.step, t.every, t.ceiling].every(v => typeof v === 'number' && Number.isFinite(v))
          ? { start: Player.snapRate(t.start), step: Math.min(0.25, Math.max(0.05, t.step)), every: int(t.every, 1, 8, 2), ceiling: Player.snapRate(Math.max(t.start, t.ceiling)) } : null,
      };
    } catch { return PLAIN_LOOP; }
  }
  private savePractice() {
    try { localStorage.setItem('mnx-player-practice', JSON.stringify(this.practice)); } catch {}
  }

  /** The Loop field: its body turns the loop on and off, its chevron opens the options. */
  private loopControl() {
    if (!this.performance) return nothing;
    const bars = this.dragBars?.bars ?? this.shownBars, on = this.loopBars !== null, open = this.openPop === 'loop' && on;
    const icon = Player.stroke('M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4', 15);
    const pass = (() => {
      const m = bars && this.performance?.measures[bars.first];
      return m && m.occurrence > 1 ? ` · pass ${m.occurrence}` : '';
    })();
    return html`<span class="anchor">
      ${open ? this.loopOptions() : nothing}
      <span class=${on ? 'field loop on' : 'field loop'}>
        <span class="lab" aria-hidden="true">Loop${on ? pass : ''}</span>
        <span class="box">
          <button type="button" class="toggle" aria-pressed=${on}
            aria-label=${on && bars ? `Loop bars ${this.barsLabel(bars)}: on. Press to clear it` : 'Loop: off. Press to loop the bars here'}
            title=${on ? 'Clear the loop' : 'Loop the bars here'}
            @click=${() => this.toggleLoop()}>${icon}<span>${on && bars ? this.barsLabel(bars) : 'Off'}</span></button>
          <button type="button" class="more" aria-haspopup="dialog" aria-expanded=${open} aria-label="Loop options" title="Loop options"
            ?disabled=${!on}
            @click=${() => (this.openPop = open ? null : 'loop')}>${Player.stroke(open ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6', 10)}</button>
        </span>
      </span>
    </span>`;
  }
  private loopOptions() {
    const o = this.practice, bars = this.shownBars, synth = this.session?.backend instanceof HostBackend;
    const set = (patch: Partial<PracticeOptions>) => this.setPracticeOptions({ ...o, ...patch });
    const seg = <T,>(label: string, value: T, choices: readonly [T, string][], pick: (v: T) => void) => html`<div class="row">
      <span>${label}</span>
      <span class="seg" role="radiogroup" aria-label=${label}>${choices.map(([v, text]) => html`<button type="button" role="radio"
        aria-checked=${v === value} @click=${() => pick(v)}>${text}</button>`)}</span>
    </div>`;
    const take = this.status?.transport?.loop?.visit.take;
    const playing = this.playback?.wantsPlayback ?? false;
    const t = o.trainer;
    const pct = (r: number) => `${Math.round(r * 100)}%`;
    const stepper = (label: string, value: string, down: () => void, up: () => void) => html`<div class="stepper"><span>${label}</span><div>
      <button type="button" aria-label=${`${label}: less`} @click=${down}>−</button><output aria-label=${label}>${value}</output>
      <button type="button" aria-label=${`${label}: more`} @click=${up}>+</button></div></div>`;
    const trainer = (patch: Partial<NonNullable<PracticeOptions['trainer']>>) => {
      const next = { ...(t ?? DEFAULT_TRAINER), ...patch };
      next.start = Player.snapRate(Math.min(1, Math.max(Player.RATE_MIN, next.start)));
      next.ceiling = Player.snapRate(Math.min(Player.RATE_MAX, Math.max(next.start, next.ceiling)));
      next.step = Math.round(Math.min(0.25, Math.max(0.05, next.step)) * 100) / 100;
      next.every = Math.min(8, Math.max(1, Math.round(next.every)));
      set({ trainer: next });
    };
    const count = bars ? bars.last - bars.first + 1 : 0;
    return html`<div class="pop loop" role="dialog" aria-label="Loop options">
      <div class="head"><b>Loop</b><span>${bars ? `bars ${this.barsLabel(bars)} · ${count} bar${count === 1 ? '' : 's'}` : ''}</span>
        <button type="button" @click=${() => this.setLoopBars(null)}>Clear loop</button></div>
      ${synth ? html`
        ${playing && take && o.repeats !== null ? html`<div class="progress"><span>Repeat ${take.repeat} of ${o.repeats}</span>
          <span class="bars" aria-hidden="true">${Array.from({ length: Math.min(o.repeats, 24) }, (_, i) => html`<span class=${i + 1 < take.repeat ? 'done' : i + 1 === take.repeat ? 'now' : ''}></span>`)}</span></div>` : nothing}
        ${seg('Count-in', o.countIn, [[0, 'Off'], [1, '1 bar'], [2, '2 bars']], v => set({ countIn: v }))}
        ${seg('Repeats', o.repeats, [[null, '∞'], [2, '2'], [4, '4'], [8, '8']], v => set({ repeats: v }))}
        ${o.repeats !== null ? seg<PracticeThen>('Then', o.then, [['stop', 'Stop'], ['continue', 'Carry on'], ['advance', 'Advance']], v => set({ then: v })) : nothing}
        ${o.repeats !== null && o.then === 'advance' ? html`<p class="note">After ${o.repeats} repeats the loop moves on a bar and counts in again${t ? ', back at the trainer’s starting speed' : ''}. It stops at the end of the piece.</p>` : nothing}
        ${seg('Gap between', o.gap, [[0, 'None'], [1, '1 bar']], v => set({ gap: v }))}
        <div class="rule"></div>
        <label class="check"><input type="checkbox" .checked=${t !== null} @change=${(e: Event) => set({ trainer: (e.target as HTMLInputElement).checked ? (t ?? DEFAULT_TRAINER) : null })}>Speed trainer</label>
        ${t ? html`<div class="steppers">
            ${stepper('Start', pct(t.start), () => trainer({ start: t.start - 0.05 }), () => trainer({ start: t.start + 0.05 }))}
            ${stepper('Step', `+${pct(t.step)}`, () => trainer({ step: t.step - 0.05 }), () => trainer({ step: t.step + 0.05 }))}
            ${stepper('Every', `${t.every} rep.`, () => trainer({ every: t.every - 1 }), () => trainer({ every: t.every + 1 }))}
            ${stepper('Up to', pct(t.ceiling), () => trainer({ ceiling: t.ceiling - 0.05 }), () => trainer({ ceiling: t.ceiling + 0.05 }))}
          </div>
          ${playing && take ? html`<p class="note">Now ${pct(take.rate)}</p>` : nothing}` : nothing}`
      : html`<p class="note">A recording loops these bars as they are. Count-in, repeats and the speed trainer play with the synth.</p>`}
    </div>`;
  }

  // ── the loop's handles on the rail ──
  /** The performed bar under the pointer while a handle is dragged: the column under it, and the
   *  lane by height while the pointer is over the cells (above them, the pass the handle is on). */
  private ordinalUnder(event: PointerEvent, edge: 'first' | 'last'): number | null {
    const model = this.railModel, rail = this.renderRoot.querySelector<HTMLElement>('.rail');
    const base = this.loopBars;
    if (!model || !rail || !base) return null;
    const box = rail.getBoundingClientRect();
    const column = Math.min(model.columns - 1, Math.max(0, Math.floor((event.clientX - box.left) / box.width * model.columns)));
    const lanes = model.cells[column]?.lanes ?? [];
    if (!lanes.length) return null;
    const cellTop = box.bottom - (rail.querySelector<HTMLElement>('.cell')?.offsetHeight ?? 30);
    const current = edge === 'first' ? base.first : base.last;
    const currentLane = Math.max(0, model.cells.flatMap(c => [c.lanes.findIndex(l => l.ordinal === current)]).find(i => i >= 0) ?? 0);
    const lane = event.clientY >= cellTop
      ? Math.min(lanes.length - 1, Math.max(0, Math.floor((event.clientY - cellTop) / (box.bottom - cellTop) * lanes.length)))
      : Math.min(lanes.length - 1, currentLane);
    return lanes[lane]!.ordinal;
  }
  private dragTo(edge: 'first' | 'last', ordinal: number) {
    const base = this.loopBars;
    if (!base) return;
    const bars = edge === 'first' ? { first: Math.min(ordinal, base.last), last: base.last } : { first: base.first, last: Math.max(ordinal, base.first) };
    this.dragBars = { bars, edge };
    this.announceLoop();
  }
  private onHandleDown(edge: 'first' | 'last', event: PointerEvent) {
    if (!this.loopBars || event.button > 0) return;
    event.preventDefault(); event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.adoptShownBars();
    this.dragBars = { bars: this.loopBars, edge };
  }
  private onHandleMove(edge: 'first' | 'last', event: PointerEvent) {
    if (!this.dragBars || this.dragBars.edge !== edge) return;
    const ordinal = this.ordinalUnder(event, edge);
    if (ordinal !== null) this.dragTo(edge, ordinal);
  }
  private onHandleUp(event: PointerEvent) {
    const drag = this.dragBars;
    if (!drag) return;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.dragBars = null;
    const base = this.loopBars;
    if (base && (drag.bars.first !== base.first || drag.bars.last !== base.last)) this.setLoopBars(drag.bars);
    else this.announceLoop();
  }
  /** ←/→ on a focused handle move it a performed bar. */
  private onHandleKey(edge: 'first' | 'last', event: KeyboardEvent) {
    const base = this.shownBars ?? this.loopBars, count = this.performance?.measures.length ?? 0;
    if (!base || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    this.adoptShownBars();
    event.preventDefault(); event.stopPropagation();
    const step = event.key === 'ArrowLeft' ? -1 : 1;
    const bars = edge === 'first'
      ? { first: Math.min(base.last, Math.max(0, base.first + step)), last: base.last }
      : { first: base.first, last: Math.max(base.first, Math.min(count - 1, base.last + step)) };
    this.setLoopBars(bars);
  }
  /** The bracket over the loop's written bars and a handle at each end. */
  private loopOnRail() {
    const bars = this.dragBars?.bars ?? this.shownBars, performance = this.performance;
    if (!bars || !performance || this.syncMode) return nothing;
    const columns = performance.measures.slice(bars.first, bars.last + 1).map(m => m.measureIndex);
    const lo = Math.min(...columns), hi = Math.max(...columns);
    const startColumn = performance.measures[bars.first]!.measureIndex, endColumn = performance.measures[bars.last]!.measureIndex;
    const count = bars.last - bars.first + 1;
    // Lanes are equal shares of the cell, so the lanes under the one held are that share of it.
    const lift = (column: number, ordinal: number) => {
      const lanes = this.railModel?.cells[column]?.lanes ?? [];
      if (lanes.length < 2 || lanes.length > GAUGE_PASSES) return 0;
      return (lanes.length - 1 - Math.max(0, lanes.findIndex(lane => lane.ordinal === ordinal))) / lanes.length;
    };
    const handle = (edge: 'first' | 'last', column: number) => {
      const dragging = this.dragBars?.edge === edge;
      const ordinal = edge === 'first' ? bars.first : bars.last;
      return html`<button type="button" class=${`loop-handle ${edge}${dragging ? ' dragging' : ''}`}
        style=${`grid-column: ${column + 1}; --lift: ${lift(column, ordinal)};`}
        aria-label=${`Loop ${edge === 'first' ? 'start' : 'end'}, bar ${this.barLabel(ordinal)}. Drag, or use the arrow keys, to move it`}
        @pointerdown=${(e: PointerEvent) => this.onHandleDown(edge, e)}
        @pointermove=${(e: PointerEvent) => this.onHandleMove(edge, e)}
        @pointerup=${(e: PointerEvent) => this.onHandleUp(e)}
        @pointercancel=${(e: PointerEvent) => this.onHandleUp(e)}
        @keydown=${(e: KeyboardEvent) => this.onHandleKey(edge, e)}
      ><span class="grip"></span><span class="stem"></span>${dragging ? html`<span class="loop-card">${edge === 'first' ? 'Start' : 'End'} · bar ${this.barLabel(ordinal)} · ${count} bar${count === 1 ? '' : 's'}</span>` : nothing}</button>`;
    };
    return html`<div class="loop-bracket" style=${`grid-column: ${lo + 1} / ${hi + 2};`}></div>${handle('first', startColumn)}${handle('last', endColumn)}`;
  }

  // ── rate and volume: a value on the tray, the control in an overlay ─────
  static readonly RATE_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  private setRate(value: number) {
    // A rate chosen by hand ends the speed trainer's say over it.
    if (this.practice.trainer && this.loopBars) { this.practice = { ...this.practice, trainer: null }; this.savePractice(); this.adoptShownBars(); this.reapplyLoop(); }
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
        class=${open ? 'field rate on' : 'field rate'}
        aria-haspopup="dialog"
        aria-expanded=${open}
        aria-label=${`Change playback rate, ${this.rate.toFixed(2)}×`}
        title="Playback rate"
        @click=${() => (this.openPop = open ? null : 'rate')}
      ><span class="lab" aria-hidden="true">Rate</span><span class="box"><span>${this.rate.toFixed(2)}×</span>${Player.stroke(open ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6', 10)}</span></button>
    </span>`;
  }

  /** The volume field's cells: one lights per sixth of the level. */
  private static readonly METER = [1, 2, 3, 4, 5, 6].map((i) => (i - 0.5) / 6);

  /** The level before a mute, so unmuting lands back where it was. */
  private volumeBeforeMute = 0.7;

  private setVolume(value: number) {
    this.volume = Math.min(1, Math.max(0, value));
    this.volume = this.session?.setVolume(this.volume) ?? this.volume;
    try {
      localStorage.setItem('mnx-player-volume', String(this.volume));
    } catch {}
    this.dispatchEvent(new CustomEvent<{ volume: number }>('volume-changed', { detail: { volume: this.volume }, bubbles: true, composed: true }));
  }

  /** The master volume, 0–1 — what a host's mixer shows as its Master. */
  get masterVolume() { return this.volume; }
  /** A host's mixer setting the master; the tray follows, and `volume-changed` reports it. */
  setMasterVolume(value: number) { this.setVolume(value); }
  /** Mute everything, or bring it back to where it was. */
  toggleMasterMute() { this.toggleMute(); }

  private toggleMute() {
    if (this.volume > 0) { this.volumeBeforeMute = this.volume; this.setVolume(0); }
    else this.setVolume(this.volumeBeforeMute || 0.7);
  }

  /** The volume field as a host mixer's handle: what plays, and the master level. */
  private mixerControl(mixer: { label: string; open: boolean }) {
    const level = Math.round(this.volume * 100);
    return html`<button
      type="button"
      class=${mixer.open ? 'field mix on' : 'field mix'}
      aria-expanded=${mixer.open}
      aria-label=${`Mix: ${mixer.label}, master ${level}`}
      title="Mix"
      @click=${() => this.dispatchEvent(new CustomEvent('mixer-toggle', { bubbles: true, composed: true }))}
    ><span class="lab" aria-hidden="true">Mix · ${mixer.label}</span><span class="box"><span class="meter" aria-hidden="true">${Player.METER.map((step) => html`<span class=${this.volume >= step ? 'lit' : ''}></span>`)}</span><span>${level}</span>${Player.stroke(mixer.open ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6', 10)}</span></button>`;
  }

  /** The recording the tray's toggle plays: the one playing, else the host's choice, else the first. */
  private get chosenRecording() {
    return this.recordings.find(r => r.id === this.sourceId) ?? this.recordings.find(r => r.id === this.recordingChoice) ?? this.recordings[0];
  }
  /** What the layers sound, as the tray's label says it: "Video + Synth", or "silent" — with
   *  `named`, the recording by its name (the field's accessible name). */
  layersLabel(named = false) {
    const layers = this.layers, chosen = this.chosenRecording;
    if (!layers) return '';
    const heard = [this.sourceId !== 'synth' && chosen ? (named ? chosen.name : chosen.kind === 'youtube' ? 'Video' : 'Audio') : '',
      layers.synth ? 'Synth' : '', layers.click ? 'Click' : ''].filter(Boolean);
    return heard.length ? heard.join(' + ') : 'silent';
  }
  private setLayer(layer: 'synth' | 'click', on: boolean) {
    if (!this.layers) return;
    this.layers = { ...this.layers, [layer]: on };
    this.dispatchEvent(new CustomEvent<MixLayers>('layers-change', { detail: this.layers, bubbles: true, composed: true }));
  }
  /** The recording on (selected, so it leads) or off (the synth leads). */
  private toggleRecording() {
    const chosen = this.chosenRecording;
    if (this.sourceId !== 'synth') void this.selectSource('synth');
    else if (chosen) void this.selectSource(chosen.id);
  }
  private static readonly LAYER_ICONS = {
    video: 'M5 5h14a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5H5a2.5 2.5 0 0 1-2.5-2.5v-9A2.5 2.5 0 0 1 5 5zM10 9l5 3-5 3z',
    audio: 'M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2',
    synth: 'M3 5h18v14H3zM9 5v9M15 5v9',
    click: 'M7 21h10L14 4h-4L7 21zM12 15l6-9',
  };
  /** The tray's Mix field with layers: a toggle each for the recording, the synth and the click. */
  private layersControl(mixer: { label: string; open: boolean }, layers: MixLayers) {
    const chosen = this.chosenRecording, recordingOn = this.sourceId !== 'synth', level = Math.round(this.volume * 100);
    const toggle = (layer: string, on: boolean, icon: string, name: string, act: () => void) => html`<button type="button" aria-pressed=${on}
      data-layer=${layer} aria-label=${`${name}: ${on ? 'on' : 'off'}`} title=${`${on ? 'Turn off' : 'Play'} ${name}`} @click=${act}>${Player.stroke(icon, 20)}</button>`;
    return html`<span class="field layers"><span class="lab" aria-hidden="true">Mix · ${this.layersLabel()}</span><span class="box" role="group" aria-label="Mix">
        ${chosen ? toggle('recording', recordingOn, chosen.kind === 'youtube' ? Player.LAYER_ICONS.video : Player.LAYER_ICONS.audio, chosen.name, () => this.toggleRecording()) : nothing}
        ${toggle('synth', layers.synth, Player.LAYER_ICONS.synth, 'the synth', () => this.setLayer('synth', !layers.synth))}
        ${toggle('click', layers.click, Player.LAYER_ICONS.click, 'the click', () => this.setLayer('click', !layers.click))}
        <button type="button" class="mix-open" data-mix-open aria-expanded=${mixer.open}
          aria-label=${`Mix: ${this.layersLabel(true)}, master ${level}`} title="The mix, and the master volume"
          @click=${() => this.dispatchEvent(new CustomEvent('mixer-toggle', { bubbles: true, composed: true }))}
        ><span>${level}</span>${Player.stroke(mixer.open ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6', 10)}</button>
      </span></span>`;
  }

  private volumeControl() {
    if (this.mixer && this.layers) return this.layersControl(this.mixer, this.layers);
    if (this.mixer) return this.mixerControl(this.mixer);
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
        class=${open ? 'field volume on' : 'field volume'}
        aria-haspopup="dialog"
        aria-expanded=${open}
        aria-label=${`Change volume, ${Math.round(this.volume * 100)}`}
        title="Volume"
        @click=${() => (this.openPop = open ? null : 'volume')}
      ><span class="lab" aria-hidden="true">${muted ? 'Muted' : 'Volume'}</span><span class="box"><span class="meter" aria-hidden="true">${Player.METER.map((step) => html`<span class=${this.volume >= step ? 'lit' : ''}></span>`)}</span><span>${Math.round(this.volume * 100)}</span></span></button>
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

  /** The video's failure and its retry, for the inline panel or a host video pane. */
  renderYouTubeError() {
    const error = this.youtubeError;
    return error ? html`<section class="youtube-error" role="alert">
        <p>Playback unavailable: ${error}</p>
        ${this.status?.error ? html`<button @click=${() => void this.selectSource(this.sourceId, true)}>Retry video</button>` : nothing}
      </section>` : nothing;
  }

  render() {
    const playing = this.status?.wantsPlayback ?? false;
    const busy = this.syncEditable && this.sourceId !== 'synth'
      || this.sourceControl && (this.recordings.length > 0 || this.canAddRecording);
    // The line's height is the rail's cells, never under 30px: a piece without
    // repeats still gets values a finger can catch, and one with deep repeats
    // thickens the whole line with its rail.
    const line = Math.max(30, this.railModel?.cell ?? 0);
    return html` <div class=${busy ? 'controls busy' : 'controls'} style=${`--tray-line: ${line}px;`}>
        <button
          class=${playing && this.status?.strained ? 'primary strained' : 'primary'}
          ?disabled=${!this.performance || (this.status?.needsStart && !this.status.alignmentIssue)}
          aria-label=${playing ? 'Pause' : 'Play'}
          title=${playing && this.status?.strained ? 'Pause — the synth is struggling to keep up on this device' : playing ? 'Pause' : 'Play'}
          @click=${() => (playing ? this.pause() : void this.play())}
        >
          ${playing ? Player.glyph('M7 5h3.5v14H7zM13.5 5H17v14h-3.5z') : Player.glyph('M8 5l11 7-11 7z')}
        </button>
        <button class="icon stop" ?disabled=${!this.performance} aria-label="Stop" title="Stop" @click=${() => this.stop()}>
          ${Player.glyph('M6 6h12v12H6z', 14)}
        </button>
        ${this.performance
          ? html`<div class="field pos" data-tip=${this.syncMode ? nothing : this.placeTip() ?? nothing}><span class="lab" aria-hidden="true">${this.syncMode ? 'Time' : 'Bar'}</span
              ><output class="box" aria-live="off" aria-label=${this.positionLabel}
              >${this.syncMode
                ? html`<span>${Player.mediaClock(this.status?.mediaTime ?? 0)}</span><span class="widest" aria-hidden="true">88:88.8</span>`
                : this.readout()}</output
            ></div>${this.syncMode || !this.positionParts ? nothing : html`<div class="field beat"><span class="lab" aria-hidden="true">Beat</span
              ><output class="box" aria-hidden="true">${this.beatReadout()}</output></div>`}`
          : html`<output aria-live="off" class="none">Nothing to play</output>`}
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
        ${this.rateControl()}
        ${this.loopControl()}
        ${this.volumeControl()}
        </span>
      </div>
      ${this.status?.kind === 'youtube' && !this.videoPaneHosted ? html`<section class="youtube-panel" aria-label="YouTube recording">
        <div class="youtube-surface"></div>
        ${this.renderYouTubeError()}
        <p>YouTube · <button @click=${() => this.youtubeNotice = !this.youtubeNotice}>Terms and privacy</button> · <button @click=${() => { this.pause(); void this.selectSource('synth'); }}>Close video</button></p>
      </section>` : nothing}
      ${this.videoPaneHosted ? nothing : this.renderYouTubeNotice()}
      ${this.loading && this.preparingShown
        ? html`<p role="status" class="preparing">
            Preparing audio…
          </p>`
        : nothing}
      ${this.error && !this.youtubeError ? html`<p role="alert">Playback unavailable: ${this.error}</p>` : nothing}
      ${!(this.status?.kind === 'youtube' && this.status.error) && this.status?.needsStart && !this.status.alignmentIssue ? html`<button @click=${() => void this.startSource()}>Start this source</button>` : nothing}
      ${this.replacesImportedSync ? html`<p role="status">This recording's imported sync has no segments to reopen. Placing the start handle replaces it.</p>` : nothing}
      ${!this.loading && this.status?.state === 'buffering' ? html`<p role="status">Buffering audio…</p>` : nothing}
      ${!this.syncWarningsInPanel && (this.status?.alignmentIssue || this.status?.syncIssue) && !this.error ? html`<p role="status">Score follow: ${this.status?.alignmentIssue || this.status?.syncIssue}</p>` : nothing}`;
  }
}
