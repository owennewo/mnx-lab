// The selection command tray (roadmap/complete/workbench-selection-chip-ladder.md,
// after core-selection-tray-visuals.md): a command surface planted under the
// selection — a VERTICAL ladder column whose current rung is the collapsed
// chip grown in place, a Bravura glyph grid with shortcut and state per tile,
// the accent shaft, and scoped search.
//
// The component is deliberately dumb — rungs, tiles and the anchor arrive
// as neutral view-model data, and every interaction leaves as a composed
// CustomEvent. That is the promotion posture (the ScoreHud precedent):
// `elements/` never imports `edit/`, so a tray that one day moves there must
// already speak a neutral contract. Incubating in `workbench/`, where churn is
// free. The one non-model import is the engine's SMuFL name→codepoint lookup,
// which `elements/` is also allowed.
//
// Styling is FAITHFUL to the design spec — "SPEC · v1 — SELECTION MODE CHIP →
// TRAY" replaces the older tray spec's horizontal tab strip. Its thesis is
// that the closed chip and the open tray are ONE object: the chip *is* the
// current rung, so opening must not re-case the word, move its x, or change
// its box. That is why the scope selector is now a 74px column of lowercase
// mono rungs at the tray's leading edge rather than an uppercase tab row
// across its top. Since 2026-08-15 the palette is spoken in TOKENS rather
// than literals; a conformance test holds that line.
//
// It still does NOT include `designTokens`, and that is now load-bearing for a
// different reason than before: the tokens reach here by INHERITANCE from
// `<mnx-workbench>`'s host (custom properties cross shadow boundaries), and
// the dark half is selected by a `resolved-theme` attribute on that host.
// Re-declaring designTokens here would plant a light-only `:host` block
// between the app and this component and pin the tray light forever — the
// theme switch would visibly skip it. A workbench leaf should inherit its
// palette, not restate it.
// See roadmap/proposed/core-campaign-modernist.md.
import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { glyphBBox, glyphCodepoint, isSmuflLoaded } from '../engine/smufl/smufl.ts';

/** One rung of the ladder. `active` = the rung on display; `holdsSelection`
 *  marks the rung still owning the real selection while another is only
 *  previewed. */
export interface TrayRung {
  key: string;
  label: string;
  active: boolean;
  holdsSelection: boolean;
  /** Can the selection be moved here? False for a row that is not a rung —
   *  the `global` scope sits outside the ladder, so there is nothing for
   *  Enter to commit and the widen hint would be a lie. Absent = true. */
  committable?: boolean;
}

/** A Bravura glyph by canonical SMuFL name, or one of the two marks that have
 *  no single glyph and are drawn as two-point SVG arcs (slur/tie). */
export type TrayMark = { smufl: string } | { arc: 'slur' | 'tie' };

/**
 * An operator composed onto a mark: `+` for an insertion, `−` for a removal.
 * `at` is the direction the new thing lands in, so it follows whichever axis
 * the rung is ordered in — before/after along time, above/below down the page.
 * The registry decides both (`CommandOperator`); the tray only draws them.
 */
export interface TrayOperator {
  sign: 'plus' | 'minus';
  at: 'before' | 'after' | 'above' | 'below';
}

/** What a tile draws: a bare mark, or a mark with an operator composed onto
 *  it, in which case the picture — not the shortcut — carries the verb. */
export type TrayGlyph = TrayMark | { mark: TrayMark; op: TrayOperator };

export type TrayTileState = 'available' | 'active' | 'mixed' | 'unavailable';

export interface TrayTile {
  id: string;
  glyph: TrayGlyph;
  shortcut: string;
  label: string;
  state: TrayTileState;
  /**
   * Has nobody vouched for this tile yet — untested, ungrouped, unordered
   * (roadmap/proposed/core-selection-tray-residue.md)? It draws purple.
   *
   * Deliberately ORTHOGONAL to `state` rather than a fifth member of it: a
   * tile can be untriaged and already `active`, and collapsing the two would
   * make "this marking is on" and "nobody has checked this tile" compete for
   * one slot — losing whichever the enum ordered second. `unavailable` is the
   * one state that suppresses it, upstream, by never setting the flag.
   */
  untriaged?: boolean;
}

/**
 * One captioned band of tiles — the tray's unit of grouping.
 *
 * The caption is the claim ("these six answer the same question"), and it is
 * what survives a filter: type three letters and the bands that keep nothing
 * disappear caption and all, while a lone survivor still says which family it
 * came from. A band with no caption draws as a bare run of tiles, which is
 * every rung the group table has nothing to say about yet.
 */
export interface TrayBand {
  id: string;
  caption?: string;
  tiles: TrayTile[];
}

/**
 * How large a tile glyph is drawn, in px along its longest side.
 *
 * A palette normalizes optical size; a score does not. Drawn at one true scale,
 * a staccato dot is a 3px speck beside a 34px repeat barline — musically
 * honest and useless to pick from. So each glyph is scaled to read at the same
 * size, with a ceiling so the smallest marks are enlarged rather than blown up
 * (Dorico's and Sibelius's palettes do the same).
 */
const GLYPH_TARGET_PX = 34;
const GLYPH_MAX_PX_PER_SP = 30;

/**
 * How large a composed operator is drawn, and how far it stands off its mark.
 *
 * The mark is the noun and the operator is a modifier on it, so the operator
 * must never out-weigh what it modifies: 14px against the glyph's 34. The gap
 * is the band's own tile gap, which is what makes the pair read as ONE
 * composed picture rather than two things sharing a tile — wider and it
 * becomes a row, tighter and the plus fuses onto the notehead.
 */
const OPERATOR_PX = 14;
const OPERATOR_GAP_PX = 5;
/** Stacked (above/below) the two marks are already separated by the mark's own
 *  side bearings, so the gap comes down or the pair reads as two rows. */
const OPERATOR_STACK_GAP_PX = 3;

/**
 * Stacked, the operator and its mark share the envelope a BARE mark gets —
 * they do not add up to a taller glyph.
 *
 * The shortcut lives below the picture, so the two axes are not alike:
 * composing sideways costs nothing, and composing downward walks straight into
 * the corner label (a 14px operator over a 34px brace is 51px in a tile with
 * 48 to give). So a stacked pair is sized to the same 34, and the operator
 * comes down with the mark to keep the weight ratio it has in a row — the mark
 * must still read as the noun.
 */
const STACK_OPERATOR_PX = 10;
const stackedMarkPx = (targetPx: number) =>
  targetPx - STACK_OPERATOR_PX - OPERATOR_STACK_GAP_PX;

export interface TrayMeta {
  primary: string;
  secondary?: string;
  count?: string;
}

/** The selection's box in the coordinate space of the tray's offsetParent. */
export interface TrayAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The connector, now 8px rather than the old 30: the spec plants the tray one
 * small gap below the selection's lower bound and lets the shaft fill exactly
 * that gap, so the ladder reads as growing out of the selection instead of
 * dangling from it on a thread.
 */
export const TRAY_SHAFT_H = 8;
/** The gap the chip and the tray both sit at, below the selection. */
export const TRAY_EDGE_GAP = 8;
/** The ladder column: lowercase mono rungs, the current one lit. */
const LADDER_W = 74;
/**
 * Total tray width. The spec draws a 222px tile panel beside the ladder, which
 * was enough for the six tiles it mocked; our busiest scope (`event`) carries
 * eighteen, and at three columns the tray outgrows the score pane it floats
 * over. So the panel keeps the 470px total the previous tray established —
 * five columns of the spec's own 60px tiles — and every other metric is the
 * spec's.
 */
export const TRAY_WIDTH = 470;

/**
 * The shortest the tray is allowed to be squeezed to before it stops giving
 * ground and simply scrolls. Below roughly this the ladder column — the
 * tray's spine, and the one thing that says WHERE YOU ARE — starts losing
 * rungs, which is a worse trade than a shorter list of tiles.
 */
const TRAY_MIN_H = 168;
/** The spec's mirror trigger: flip when the tray's right edge would pass the
 *  score's right edge minus this. */
export const TRAY_MIRROR_MARGIN = 16;

@customElement('mnx-selection-tray')
export class SelectionTray extends LitElement {
  @property({ attribute: false }) rungs: TrayRung[] = [];
  @property({ attribute: false }) meta: TrayMeta | null = null;
  @property({ attribute: false }) bands: TrayBand[] = [];
  @property({ attribute: false }) anchor: TrayAnchor | null = null;
  @property({ type: String }) searchText = '';
  /**
   * Which edge the tray hangs from. Decided by the PAGE, not here, and held
   * for the life of the open tray — the chip and the tray must agree about the
   * side (they are one object), and the spec forbids flipping mid-interaction.
   * The page snapshots it when `/` opens the tray.
   */
  @property({ type: Boolean }) mirrored = false;

  /** The keyboard tile cursor — an index into the focusable tiles. */
  @state() private cursorIndex = 0;
  /**
   * Does the query line hold the keys?
   *
   * It decides what the top band SAYS, which is the band's whole trick: while
   * you are typing it is the query, and the moment the grid takes the keys it
   * becomes the readout for the tile under the cursor. One row, two jobs,
   * never both at once — and never a second band, which is what the old
   * standing readout cost.
   */
  @state() private searchFocused = true;

  static styles = css`
    :host {
      position: absolute;
      z-index: 30;
      display: block;
      width: var(--tray-w, 470px);
      font-family: var(--sans);
      outline: none;
      /* Re-anchoring animates position, never fades (the spec's rule). */
      transition:
        left 0.16s ease,
        top 0.16s ease;
    }

    /* ── connector ── */
    .shaft {
      position: absolute;
      height: ${TRAY_SHAFT_H}px;
      background: var(--accent);
    }

    :host(:not([data-flipped])) .shaft {
      bottom: 100%;
    }

    /* Flipped above the selection, the shaft is a capital on the tray's top
     * edge rather than a footing under it — the spec's rule; the ladder still
     * reads top-to-bottom either way. */
    :host([data-flipped]) .shaft {
      top: 100%;
    }

    .tray {
      display: flex;
      align-items: stretch;
      box-sizing: border-box;
      width: 100%;
      /* BOUNDED BY THE ROOM THAT EXISTS. place() measures what is available
       * on the side it settled on and sets this; without it the tray simply
       * grew with its content and ran off the viewport, which is what banding
       * the rungs made visible — the note rung went from a flat grid of 19 to
       * six captioned bands of 22, and the top of the first band left the
       * screen. */
      max-height: var(--tray-max-h, none);
      background: var(--surface);
      border: 1px solid var(--ink);
      box-shadow: 0 14px 34px color-mix(in oklab, var(--ink), transparent 78%);
    }

    /* Mirrored: the ladder crosses to the far side so the current rung still
     * lands under the selection's right edge, and the tiles grow leftwards
     * into the room that exists. Everything mirrors TOGETHER. */
    :host([data-mirrored]) .tray {
      flex-direction: row-reverse;
    }

    /* ── B · the ladder column ── */
    .ladder {
      width: ${LADDER_W}px;
      flex: none;
      background: var(--bg-context);
      border-right: 1px solid var(--line);
    }

    :host([data-mirrored]) .ladder {
      border-right: 0;
      border-left: 1px solid var(--line);
    }

    /* A rung is the chip's own box: the same lowercase mono word, never
     * re-cased. The uppercase tab strip this replaced broke the one thing the
     * chip and the tray have to share. */
    .rung {
      display: block;
      box-sizing: border-box;
      width: 100%;
      text-align: left;
      padding: 4px 8px;
      border: 0;
      border-left: 2px solid transparent;
      background: none;
      font: 500 10.5px/1.35 var(--mono);
      color: var(--ink-3);
      cursor: pointer;
      white-space: nowrap;
    }

    :host([data-mirrored]) .rung {
      text-align: right;
      border-left: 0;
      border-right: 2px solid transparent;
    }

    .rung:hover {
      color: var(--ink);
      background: var(--surface);
    }

    .rung[aria-current='true'] {
      color: var(--accent-fg);
      background: var(--row-current);
      border-left-color: var(--accent);
    }

    :host([data-mirrored]) .rung[aria-current='true'] {
      border-left-color: transparent;
      border-right-color: var(--accent);
    }

    .rung .dot {
      display: inline-block;
      width: 5px;
      height: 5px;
      background: var(--accent);
      margin-left: 5px;
      vertical-align: middle;
    }

    /* ── the tile panel ── */
    .panel {
      flex: 1;
      min-width: 0;
      /* min-height:0 is what lets the grid inside actually shrink and
       * scroll: a flex item's default min-height:auto refuses to go below
       * its content, so without this the panel would still push the tray past
       * its own max-height. */
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    /* The ladder never scrolls with the tiles — it is the tray's spine, and
     * losing sight of which rung you are on is worse than a short column. */
    .ladder {
      overflow: hidden;
    }

    /* ── C · meta line ── */
    .meta {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 6px 9px;
      border-bottom: 1px solid var(--line);
      background: var(--bg-context);
      white-space: nowrap;
      overflow: hidden;
    }

    .meta .primary {
      font: 500 10px/1.2 var(--mono);
      color: var(--ink);
    }

    .meta .secondary {
      font: 400 10px/1.2 var(--mono);
      color: var(--ink-3);
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .meta .count {
      margin-left: auto;
      font: 600 8.5px/1.2 var(--sans);
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--ink-3);
      flex: none;
    }

    .meta .count.widen {
      color: var(--accent-fg);
    }

    /* ── D · glyph grid, in captioned bands ── */
    .grid {
      flex: 1;
      min-height: 0;
      /* ONE scrolling body, the frame the score panel already uses: the meta
       * line and the search row stay put, and only the tiles move. Scrolling
       * the whole tray instead would take the search box away exactly when a
       * long rung most needs it. */
      overflow-y: auto;
      overscroll-behavior: contain;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 9px;
    }

    /* A caption stays legible while its band scrolls under it — the caption is
     * the claim about the tiles below, so it has to survive the scroll that
     * separates them. */
    .caption {
      position: sticky;
      top: -9px;
      z-index: 1;
      padding: 4px 0;
      margin-top: -4px;
      background: var(--surface);
    }

    .band {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    /*
     * The caption is set in the meta line's micro-caps rather than the
     * ladder's lowercase mono: the ladder's voice says WHERE YOU ARE, and a
     * band caption says what a run of tiles is about. Borrowing the rung's
     * voice for a second, unrelated meaning is how two vocabularies become
     * none. The rule fills the rest of the row so the caption reads as a
     * section head rather than a stray label.
     */
    .caption {
      display: flex;
      align-items: center;
      gap: 8px;
      font: 600 8.5px/1.2 var(--sans);
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--ink-3);
    }

    .caption .rule {
      flex: 1;
      height: 1px;
      background: var(--line);
    }

    .band-tiles {
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      gap: 6px;
    }

    /*
     * The glyph is centred on its INK, not on its text box. SMuFL glyphs are
     * drawn against a staff — a repeat barline carries side bearings for the
     * staff lines around it, a dot is a speck at the baseline — so centring the
     * text box leaves several of them visibly off, and font ascent/descent is
     * no better a guide.
     *
     * So each tile glyph is drawn into an SVG whose viewBox IS the glyph's
     * bounding box, as the font's own metadata reports it. The box is then the
     * ink and nothing else, and ordinary centring does the rest. Bravura
     * measures in staff spaces and 1em = 4 of them, which is the font-size in
     * the markup; the px size comes from GLYPH_TARGET_PX.
     */
    .tile {
      position: relative;
      width: 60px;
      height: 60px;
      display: grid;
      place-items: center;
      /* Relief for the shortcut, cut from 9px to 6 rather than dropped. The
       * old figure held a wide mark off a solid badge running the width of the
       * tile; the corner label below is far smaller, but it still occupies the
       * bottom 12px and a 34px glyph centred in the bare tile clears that by
       * ONE pixel — which the lit badge, growing 2.2px upward, then spends.
       * Six is what the measured worst case (a stem-up quarter, composed) has
       * to have, and the glyph keeps the other three. */
      padding: 0 0 6px;
      background: var(--surface);
      border: 1px solid var(--line);
      cursor: pointer;
      font: inherit;
    }

    .tile .glyph {
      color: var(--ink);
    }

    /* The two halves of a composed glyph inherit their colour from the
       .glyph wrapper — deliberately NOT restated here, because every state
       rule below (the active inversion, the untriaged purple) sets it on that
       wrapper, and a colour declared on the mark would outrank what it
       inherits and pin the mark to --ink through every state. */
    .tile .glyph,
    .tile .mark,
    .tile .op {
      /* The ink box is the viewBox, and the text inside it carries the font's
         full em box — ascent and descent well beyond the glyph's own ink.
         Visible overflow is what lets that ink paint past the tiny box, but
         overflow is HIT-TESTABLE as well as paintable: without the rule
         below, each glyph captures the pointer over its neighbours and a
         tile two rows down answers for a hover on this one. The button is
         the only thing that should ever be hovered. */
      overflow: visible;
      pointer-events: none;
    }

    /*
     * A composed glyph is one picture, so the operator and its mark are laid
     * out as a unit and centred as a unit. The axis is the rung's own: along
     * time for events and bars, down the page for parts.
     */
    .tile .composed {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: ${OPERATOR_GAP_PX}px;
    }

    .tile .composed[data-stacked] {
      flex-direction: column;
      gap: ${OPERATOR_STACK_GAP_PX}px;
    }

    /*
     * THE QUIET CORNER · the shortcut, demoted.
     *
     * It was a 22px slab filled with --ink, and on a 60px tile Shift+I
     * ran it to 51px wide — the label covering the picture it was labelling,
     * and on the articulation band saying the same word six times over six
     * different marks. It could not be quieter while it was load-bearing:
     * on the structure band the badge was the ONLY thing telling two
     * identical glyphs apart. Composing the verb into the glyph (above) ended
     * that job, and a footnote that is no longer doing real work can be
     * whispered.
     *
     * Mono rather than the sans the slab used: a shortcut is a literal you
     * type, and the tray already speaks mono for the things you type — the
     * ladder rungs and the query line. At 9px the whole of Shift+A fits
     * inside the tile, so nothing has to be abbreviated into a modifier
     * symbol that reads differently on each platform.
     */
    .tile .key {
      position: absolute;
      right: 4px;
      bottom: 3px;
      pointer-events: none;
      /* --ink-3, the tray's own quiet-text colour: the band captions and the
       * meta line's secondary already speak in it, so the resting key joins a
       * voice the component has rather than inventing a fourth. --ink-faint
       * was tried and measured 2.2:1 on the light surface — at 9px that is
       * decoration, not a label, and a shortcut nobody can read is a shortcut
       * that is not doing its job. This clears 3.65 light / 4.54 dark, and the
       * step up to --ink on hover is still a 4.5x jump. */
      color: var(--ink-3);
      font: 500 9px/1 var(--mono);
      letter-spacing: 0.02em;
      /* The corner it already owns. Pinning the origin there holds the 4px
       * inset fixed while the label grows, so it reads as stepping forward in
       * place; growing from the centre would push it out through the tile's
       * own border, which is 4px away. */
      transform-origin: 100% 100%;
      transition:
        color 130ms ease-out,
        transform 130ms cubic-bezier(0.2, 0.75, 0.3, 1);
    }

    /* Scale, not font-size: a font-size transition relayouts the label every
     * frame and the letters crawl, and the glyph shares this grid cell, so a
     * relayout would nudge the picture. A transform composites and touches
     * neither. The keyboard cursor gets the same step forward as the pointer —
     * the tile cursor is virtual, so this is the only thing that answers it. */
    .tile:hover .key,
    .tile.cursor .key {
      color: var(--ink);
      transform: scale(1.24);
    }

    .tile svg path {
      stroke: var(--ink);
    }

    .tile:hover,
    .tile.cursor {
      background: var(--row-current);
      border-color: var(--accent);
    }

    .tile[data-state='active'] {
      background: var(--accent);
      border-color: var(--accent);
    }

    .tile[data-state='active']:hover,
    .tile[data-state='active'].cursor {
      background: var(--accent-pressed);
      border-color: var(--accent-pressed);
    }

    .tile[data-state='active'] .glyph {
      color: var(--surface);
    }

    /* On the accent fill the ink colours disappear, so the corner takes the
     * same inverted voice the glyph takes, one step quieter — and reaches the
     * full inverted colour on hover, so resting and lit stay two steps apart
     * on this ground too.
     *
     * 15% is measured, not chosen: it lands the resting key at 3.37 light /
     * 4.61 dark, which is where --ink-3 lands it on the plain surface. The
     * accent is a mid-tone, so its ceiling is 4.2/5.71 with pure --surface —
     * there is simply nowhere brighter for hover to go, and the scale carries
     * the rest of the emphasis. */
    .tile[data-state='active'] .key {
      color: color-mix(in oklab, var(--surface), transparent 15%);
    }

    .tile[data-state='active']:hover .key,
    .tile[data-state='active'].cursor .key {
      color: var(--surface);
    }

    .tile[data-state='active'] svg path {
      stroke: var(--surface);
    }

    .tile[data-state='mixed'] {
      box-shadow: inset 2px 0 0 var(--accent);
    }

    .tile[data-state='unavailable'] {
      background: var(--bg-context);
      border-color: var(--line);
      cursor: default;
    }

    .tile[data-state='unavailable'] .glyph {
      color: var(--line-strong);
    }

    /* Below the resting key, and it does not answer the pointer at all: a
     * label that lights up over a tile that cannot be pressed is a promise the
     * tile will not keep. --ink-faint rather than a line colour, so the three
     * steps read as one ladder — inert, resting, lit. */
    .tile[data-state='unavailable'] .key {
      color: var(--ink-faint);
    }

    .tile[data-state='unavailable']:hover .key {
      color: var(--ink-faint);
      transform: none;
    }

    /* The colour change is what carries the information — which key this tile
     * answers to — and the growth is only emphasis, so the growth is what
     * goes. The workbench already runs a 640% staff ceiling for low vision;
     * that reader is the likeliest to have this set. */
    @media (prefers-reduced-motion: reduce) {
      .tile .key {
        transition: color 130ms ease-out;
      }

      .tile:hover .key,
      .tile.cursor .key {
        transform: none;
      }
    }

    /*
     * PURPLE · the tile nobody has vouched for.
     *
     * Last in the cascade on purpose — it is a claim ABOUT the tile rather
     * than about the selection, so it outranks the state colours instead of
     * negotiating with them. Two exceptions, both of which would otherwise
     * cost information the reader needs:
     *
     *  - an ACTIVE tile keeps its inverted glyph. Purple ink on the accent
     *    fill is unreadable, and the border already carries the mark.
     *  - hover and the keyboard cursor keep the accent border. That border IS
     *    the cursor's only affordance; with every tile purple today, dropping
     *    it would leave the grid with no visible cursor at all.
     */
    .tile[data-triage='untriaged'] {
      border-color: var(--tile-untriaged);
    }

    .tile[data-triage='untriaged']:not([data-state='active']) .glyph {
      color: var(--tile-untriaged);
    }

    .tile[data-triage='untriaged']:not([data-state='active']) svg path {
      stroke: var(--tile-untriaged);
    }

    .tile[data-triage='untriaged']:hover,
    .tile[data-triage='untriaged'].cursor {
      border-color: var(--accent);
    }

    /*
     * E · the tile's name — a tooltip for the POINTER, the query line for the
     * keyboard.
     *
     * The visuals doc killed a standing readout band under the grid on the
     * grounds that it spent a whole band on a label. That argument still
     * holds, and this does not reopen it: the top band already exists for the
     * query, and a row you are not typing into is a row with nothing to say.
     * So the keyboard's caption moved INTO it (the readout rule below) and costs
     * no height at all, while the pointer keeps its caption at the point of
     * interest, where the eyes already are.
     *
     * That also ends the arbitration this rule used to need. The keyboard no
     * longer captions a tile in the grid, so the pointer can never be
     * captioning a second one — the tooltip appears on hover and at no other
     * time.
     */
    .tile .tip {
      position: absolute;
      left: 50%;
      bottom: calc(100% + 5px);
      transform: translateX(-50%);
      z-index: 4;
      display: none;
      box-sizing: border-box;
      max-width: 190px;
      width: max-content;
      padding: 3px 6px;
      background: var(--ink);
      color: var(--surface);
      font: 500 10px/1.4 var(--sans);
      text-align: center;
      pointer-events: none;
    }

    .tile:hover .tip {
      display: block;
    }

    /*
     * ── F · search, ABOVE the tiles ──
     *
     * The palette order: who you are, what you typed, what is left. With the
     * line at the foot of the panel ↓ pointed away from the only thing it
     * could usefully reach; here the two halves are in reading order and the
     * arrow means what it looks like. It is drawn on the panel's own white
     * rather than the chrome grey the meta line uses, because it is an input
     * you are typing into, not a readout — and it is ruled off below so it
     * does not merge into the first band.
     */
    .search {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 7px 9px;
      border-bottom: 1px solid var(--line);
      background: var(--surface);
    }

    /*
     * The same row, in tile mode. Identical padding and line box to the input
     * it replaces, so the swap moves nothing under the reader's eyes.
     *
     * The live query stays visible as a mono prefix whenever there is one:
     * the readout is only reached by ↓, which is reached from typing, and a
     * grid showing two of eighteen tiles with no visible reason why would be
     * the tray lying about what it is showing.
     */
    .search .readout {
      display: flex;
      align-items: baseline;
      gap: 6px;
      min-width: 0;
      font: 500 11px/1.4 var(--sans);
      color: var(--ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .search .readout .query {
      flex: none;
      font: 400 11px/1.4 var(--mono);
      color: var(--ink-3);
    }

    .search .readout .none {
      color: var(--ink-3);
    }

    /* Names the one gesture this arrangement adds, and swaps to name the way
     * back once the grid has the keys. */
    .search .hint {
      margin-left: auto;
      flex: none;
      font: 600 8.5px/1.2 var(--sans);
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--ink-3);
    }

    .search .prompt {
      font: 600 11px/1.2 var(--mono);
      color: var(--accent-fg);
    }

    .search input {
      flex: 1;
      min-width: 0;
      font: 400 11px/1.4 var(--mono);
      color: var(--ink);
      background: none;
      border: 0;
      outline: none;
      padding: 0;
    }

    .search input::placeholder {
      color: var(--ink-3);
    }
  `;

  constructor() {
    super();
    this.addEventListener('keydown', this.onKeyDown);
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '-1');
  }

  firstUpdated() {
    // The caret starts in the query line, and the first tile starts ARMED —
    // so the tray opens with something to type and something to press, and
    // the two do not compete: letters filter, Enter fires whatever the filter
    // left under the cursor. The host still owns the keymap (the listener is
    // on it and the input's keydowns bubble there), so ↓ hands the keys over
    // without changing who is listening.
    const input = this.renderRoot.querySelector<HTMLInputElement>('.search input');
    if (input) input.focus();
    else this.focus();
  }

  // ── placement ─────────────────────────────────────────────────────────────

  /** Focusable entries in display order. Unavailable tiles are skipped (the
   *  spec: not focusable). */
  private entries(): { id: string; label: string; shortcut: string; glyph: TrayGlyph }[] {
    return this.bands
      .flatMap(band => band.tiles)
      .filter(t => t.state !== 'unavailable')
      .map(t => ({ id: t.id, label: t.label, shortcut: t.shortcut, glyph: t.glyph }));
  }

  updated(changed: Map<string | number | symbol, unknown>) {
    // A new query re-arms the cursor on the FIRST survivor rather than
    // clamping the old index into the new list. Filtering is a way of
    // choosing: three letters that leave three tiles have already made the
    // choice nearly, and Enter should finish it — landing on whatever tile
    // happens to sit at the old index would be an answer to the previous
    // question.
    if (changed.has('searchText')) {
      this.cursorIndex = 0;
    } else if (changed.has('rungs') || changed.has('bands')) {
      this.cursorIndex = Math.min(this.cursorIndex, Math.max(0, this.entries().length - 1));
    }
    this.place();
    this.revealCursor();
  }

  /**
   * Keep the cursored tile in view now that the grid scrolls.
   *
   * The tile cursor is VIRTUAL — an index and a class, never DOM focus (the
   * search box keeps that, so typing keeps working while the grid is being
   * walked). The browser scrolls what it focuses, so a virtual cursor gets
   * none of that for free, and walking down past the fold left the cursor on
   * a tile nobody could see. Before the height cap there was no fold to fall
   * past, which is why this only became a bug once the tray was bounded.
   *
   * Done by hand rather than with `scrollIntoView({ block: 'nearest' })` for
   * two reasons: that would also scroll ancestors — the tray floats over a
   * score that must not move under it — and it knows nothing about the STICKY
   * captions, which overlay the top of the grid and would swallow a tile
   * parked exactly at scrollTop.
   */
  private revealCursor(): void {
    const grid = this.renderRoot.querySelector<HTMLElement>('.grid');
    const tile = this.renderRoot.querySelectorAll<HTMLElement>('.tile:not([disabled])')[
      this.cursorIndex
    ];
    if (!grid || !tile) return;
    const view = grid.getBoundingClientRect();
    const box = tile.getBoundingClientRect();
    // The caption sitting above this tile is the real ceiling: scrolling to
    // the tile's own top would tuck it under one.
    const band = tile.closest('.band');
    const caption = band?.querySelector<HTMLElement>('.caption');
    const ceiling = view.top + (caption?.getBoundingClientRect().height ?? 0);
    if (box.top < ceiling) grid.scrollTop -= ceiling - box.top;
    else if (box.bottom > view.bottom) grid.scrollTop += box.bottom - view.bottom;
  }

  /**
   * Position the tray from the anchor. Normally its LEFT edge sits on the
   * selection's left edge, so the ladder column — and therefore the word —
   * occupies exactly the x the closed chip occupied. Mirrored (decided by the
   * page, held for the open), its RIGHT edge sits on the selection's right
   * edge and the ladder crosses over to meet it. Vertically it hangs one
   * shaft below the selection, flipping above when there is no room.
   * Anchor-less (nothing selected / geometry unknown): docked bottom-center —
   * the fallback the visuals doc names.
   */
  private place() {
    const host = this;
    const parent = this.offsetParent as HTMLElement | null;
    if (!parent) return;
    const width = TRAY_WIDTH;
    host.style.setProperty('--tray-w', `${width}px`);
    const pw = parent.clientWidth;
    const ph = parent.clientHeight;
    const anchor = this.anchor;
    const shaftEl = this.renderRoot.querySelector<HTMLElement>('.shaft');
    if (!anchor) {
      this.removeAttribute('data-flipped');
      this.removeAttribute('data-mirrored');
      if (shaftEl) shaftEl.style.display = 'none';
      const dockH = Math.max(TRAY_MIN_H, ph - TRAY_EDGE_GAP - 18);
      host.style.setProperty('--tray-max-h', `${dockH}px`);
      const docked = Math.min(this.getBoundingClientRect().height || 200, dockH);
      host.style.left = `${Math.max(TRAY_EDGE_GAP, (pw - width) / 2)}px`;
      host.style.top = `${Math.max(TRAY_EDGE_GAP, ph - docked - 18)}px`;
      return;
    }

    this.toggleAttribute('data-mirrored', this.mirrored);
    const wanted = this.mirrored ? anchor.x + anchor.width - width : anchor.x;
    const left = Math.min(
      Math.max(wanted, TRAY_EDGE_GAP),
      Math.max(TRAY_EDGE_GAP, pw - width - TRAY_EDGE_GAP)
    );
    const below = anchor.y + anchor.height + TRAY_SHAFT_H;
    // How much room each side actually has, decided BEFORE the height is
    // capped — otherwise the tray measures last frame's clamp and every
    // re-place shrinks it a little further.
    const roomBelow = Math.max(0, ph - below - TRAY_EDGE_GAP);
    const roomAbove = Math.max(0, anchor.y - TRAY_SHAFT_H - TRAY_EDGE_GAP);
    host.style.setProperty('--tray-max-h', 'none');
    const wantH = this.getBoundingClientRect().height || 200;

    // Hang below when the tray fits there; otherwise take whichever side has
    // more room. The old test asked whether the OTHER side could hold the tray
    // WHOLE, so a tray too tall for both stayed below and ran off the screen —
    // which is exactly what six captioned bands did to the note rung.
    const flip = wantH > roomBelow && roomAbove > roomBelow;
    const room = Math.max(TRAY_MIN_H, flip ? roomAbove : roomBelow);
    host.style.setProperty('--tray-max-h', `${room}px`);
    // `data-flipped` alone carries this: nothing in render() reads the side
    // any more, so a reactive field would only cost a second update pass.
    this.toggleAttribute('data-flipped', flip);
    host.style.left = `${left}px`;
    // The height the tray will REALLY have, so a flipped one's top is not
    // computed from a box it was never allowed to be.
    const trayH = Math.min(wantH, room);
    host.style.top = `${
      flip ? Math.max(TRAY_EDGE_GAP, anchor.y - TRAY_SHAFT_H - trayH) : below
    }px`;

    // The shaft: selection width clamped 24–240, centred on the selection's
    // horizontal centre, clamped to the tray's span.
    const shaft = shaftEl;
    if (shaft) {
      const w = Math.min(240, Math.max(24, anchor.width));
      const centre = anchor.x + anchor.width / 2 - left;
      const x = Math.min(Math.max(centre - w / 2, 0), Math.max(0, width - w));
      shaft.style.left = `${x}px`;
      shaft.style.width = `${w}px`;
      shaft.style.display = 'block';
    }
  }

  // ── keyboard (a scope-4 region: the tray owns the keys it names) ─────────

  /** Is a scope being previewed — i.e. is the rung on display one the
   *  selection could still move to? A non-committable row (global) is never a
   *  preview: it is a place to run commands, not a scope to select. */
  private get previewing(): boolean {
    const active = this.rungs.find(r => r.active);
    if (active?.committable === false) return false;
    return this.rungs.some(r => r.holdsSelection && !r.active);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const target = event.composedPath()[0] as HTMLElement;
    const inSearch = target instanceof HTMLInputElement;
    if (inSearch) {
      // Three keys mean something other than text while the caret is in the
      // query line; everything else stays typing.
      if (event.code === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        // Hand the keys to the grid WITHOUT moving the cursor: it is already
        // on the first tile, and ↓ meaning "step to the second one" would
        // make the arming a lie.
        this.focus();
        return;
      }
      const fires = event.code === 'Enter' || event.code === 'NumpadEnter';
      if (!fires && event.code !== 'Escape') return; // typing stays typing
    }

    const consume = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    const previewing = this.previewing;

    switch (event.code) {
      case 'Escape': {
        consume();
        if (inSearch) {
          this.focus();
          return;
        }
        if (previewing) {
          // Escape returns to the rung still holding the selection.
          const home = this.rungs.find(r => r.holdsSelection);
          if (home) this.emit('tray-rung-preview', { key: home.key });
          return;
        }
        this.emit('tray-close', {});
        return;
      }
      // Bare ↑/↓ walk the GRID, because the grid is what the open tray is for:
      // once you are in here you are choosing a command, and the tiles wrap
      // over three or four rows, so a linear ←/→ is the wrong instrument for
      // reaching one. Shift+↑/↓ keeps the ladder — the same chord that walks
      // the rungs with the tray shut, so the gesture does not change meaning
      // when the surface opens — and clicking a rung is the pointer's way.
      //
      // ↑ still climbs and ↓ still descends: the column is drawn widest-first,
      // so the walk towards index 0 is also a walk UP the pixels, and key,
      // chip triangle, column and the HUD beside it all point one way.
      case 'ArrowUp':
      case 'ArrowDown': {
        consume();
        if (event.shiftKey) {
          const idx = this.rungs.findIndex(r => r.active);
          const next = this.rungs[idx + (event.code === 'ArrowUp' ? -1 : 1)];
          if (next) this.emit('tray-rung-preview', { key: next.key });
          return;
        }
        this.stepRow(event.code === 'ArrowUp' ? -1 : 1);
        return;
      }
      // ←/→ stay LINEAR and wrap, which is what makes them the complement of
      // the row step rather than a duplicate of it: the row step cannot reach
      // a short last row's tail from a column that has run out, and wrapping
      // ←/→ can walk the whole scope without thinking about the shape.
      case 'ArrowRight':
      case 'ArrowLeft':
      case 'Tab': {
        consume();
        const n = this.entries().length;
        if (n === 0) return;
        const back = event.code === 'ArrowLeft' || (event.code === 'Tab' && event.shiftKey);
        this.cursorIndex = (this.cursorIndex + (back ? n - 1 : 1)) % n;
        return;
      }
      case 'Enter':
      case 'NumpadEnter': {
        consume();
        if (previewing) {
          const active = this.rungs.find(r => r.active);
          if (active) this.emit('tray-rung-commit', { key: active.key });
          return;
        }
        const entry = this.entries()[this.cursorIndex];
        if (entry) this.emit('tray-command', { id: entry.id });
        return;
      }
    }

    // A SECOND slash widens: `/` opened this tray on the selection, so `/`
    // again asks the same question of everything. One key, one escalating
    // meaning — rather than a second chord to remember — and it is why a bare
    // slash never reaches the search box as a character.
    if (!inSearch && event.key === '/') {
      consume();
      this.emit('tray-widen', { text: this.searchText });
      return;
    }

    // Any other printable character jumps focus to the search line (the
    // spec's rule). The triggering character is appended by hand because
    // refocusing mid-keydown does not retarget the insertion.
    if (!inSearch && event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      consume();
      void this.focusSearch(event.key);
    }
  };

  /**
   * Move the tile cursor one ROW, measured rather than counted. The grid is
   * `flex-wrap`, so its column count is whatever the panel width and the
   * scope's tile count happen to produce — there is no constant to step by,
   * and a hardcoded five would quietly lie the first time the panel is
   * resized or a tile grows.
   *
   * So the geometry answers it: find the nearest row of tiles in the
   * requested direction, then take the tile in it whose horizontal centre is
   * closest to the one we are leaving — which is what makes a column feel
   * like a column when the last row is short. Rects rather than
   * `offsetTop`, because `offsetParent` is specified to return null across a
   * shadow boundary.
   *
   * Disabled tiles are absent from the query for the same reason they are
   * absent from `entries()`: the cursor indexes what it can land on, so the
   * two lists are the same list, in the same order.
   */
  private stepRow(dir: 1 | -1) {
    const tiles = [...this.renderRoot.querySelectorAll<HTMLElement>('.tile:not([disabled])')];
    const from = tiles[this.cursorIndex];
    if (!from) return;
    const boxes = tiles.map(el => el.getBoundingClientRect());
    const here = boxes[this.cursorIndex];
    // Half a tile: comfortably more than sub-pixel drift, comfortably less
    // than a row's pitch, so rows group without merging.
    const tolerance = here.height / 2;
    const tops = boxes
      .map(box => box.top)
      .filter(top => (dir > 0 ? top > here.top + tolerance : top < here.top - tolerance));
    if (tops.length === 0) {
      // The foot of the grid is a wall, but its top edge is a door: ↑ from
      // the first row is the mirror of the ↓ that arrived, and it hands the
      // keys back with the query and the caret intact.
      if (dir < 0) void this.focusSearch();
      return;
    }
    const row = dir > 0 ? Math.min(...tops) : Math.max(...tops);

    const centre = here.left + here.width / 2;
    let best = -1;
    let nearest = Infinity;
    boxes.forEach((box, index) => {
      if (Math.abs(box.top - row) > tolerance) return;
      const distance = Math.abs(box.left + box.width / 2 - centre);
      if (distance < nearest) {
        nearest = distance;
        best = index;
      }
    });
    if (best < 0) return;
    this.cursorIndex = best;
  }

  /**
   * The search line's own text. A slash ANYWHERE in it is the widen gesture,
   * carrying whatever was typed before it: the natural motion is to type a
   * few letters, find the scope too narrow, and reach for `/` again — by
   * which point the caret is past the text, so a leading-slash-only rule
   * would miss the very case it exists for.
   *
   * The cost is that a query cannot contain a slash. No command label does,
   * and "type / to go wider" is worth more than searching for one.
   */
  private onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const slash = input.value.indexOf('/');
    if (slash >= 0) {
      const before = input.value.slice(0, slash);
      input.value = before;
      this.emit('tray-widen', { text: before });
      return;
    }
    this.emit('tray-search', { text: input.value });
  }

  private emit(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  // ── rendering ─────────────────────────────────────────────────────────────

  /**
   * The operator half of a composed glyph — drawn as SVG bars, never as the
   * sans font's own `+`.
   *
   * The font's plus is optically far lighter than a Bravura stem and reads as
   * a typo beside one; these bars are cut to the stem's own pen. It is also
   * why the tile's existing arc marks are SVG rather than characters, so this
   * follows a precedent rather than setting one.
   */
  private operator(op: TrayOperator, sizePx: number) {
    // The bars are cut as a fraction of the box, so the pen thins with the
    // operator when a stacked pair shrinks — a 2.2px bar on a 10px plus would
    // be a blob.
    const bar = sizePx * (2.2 / OPERATOR_PX);
    const span = sizePx * (12 / OPERATOR_PX);
    const near = (sizePx - span) / 2;
    const mid = (sizePx - bar) / 2;
    return html`<svg
      class="op"
      width=${sizePx}
      height=${sizePx}
      viewBox="0 0 ${sizePx} ${sizePx}"
      aria-hidden="true"
    >
      ${op.sign === 'plus'
        ? html`<rect x=${mid} y=${near} width=${bar} height=${span} fill="currentColor"></rect>`
        : nothing}
      <rect x=${near} y=${mid} width=${span} height=${bar} fill="currentColor"></rect>
    </svg>`;
  }

  private glyph(glyph: TrayGlyph, cls = 'glyph', targetPx?: number): TemplateResult {
    if ('mark' in glyph) {
      // The wrapper carries `cls`, so every colour rule that already targets
      // `.glyph` — active inversion, unavailable grey, untriaged purple —
      // reaches the operator and the mark together, through `currentColor`.
      const stacked = glyph.op.at === 'above' || glyph.op.at === 'below';
      const first = glyph.op.at === 'before' || glyph.op.at === 'above';
      const mark = this.glyph(
        glyph.mark,
        'mark',
        stacked && targetPx !== undefined ? stackedMarkPx(targetPx) : targetPx
      );
      const op = this.operator(glyph.op, stacked ? STACK_OPERATOR_PX : OPERATOR_PX);
      return html`<span class="${cls} composed" data-stacked=${stacked ? '' : nothing}>
        ${first ? op : mark}${first ? mark : op}
      </span>`;
    }
    if ('arc' in glyph) {
      // Slur and tie have no single SMuFL glyph — two-point arcs, per spec.
      const d = glyph.arc === 'slur' ? 'M2 11C7 2 19 2 24 11' : 'M3 4C8 11 18 11 23 4';
      const scale = targetPx ? targetPx / 26 : 1;
      return html`<svg
        class=${cls}
        width=${26 * scale}
        height=${14 * scale}
        viewBox="0 0 26 14"
      >
        <path d=${d} fill="none" stroke-width="2"></path>
      </svg>`;
    }
    let char = '?';
    if (isSmuflLoaded()) {
      try {
        char = glyphCodepoint(glyph.smufl);
      } catch {
        char = '?';
      }
    }
    // A tile glyph is drawn into its own bounding box (see the .glyph rule), so
    // the element IS the ink and centring is exact. Without metadata loaded
    // there is no box to draw into, so it falls back to plain text.
    const box = targetPx ? glyphBBox(glyph.smufl) : null;
    if (!box) return html`<span class=${cls}>${char}</span>`;
    const scale = Math.min(targetPx! / Math.max(box.w, box.h), GLYPH_MAX_PX_PER_SP);
    return html`<svg
      class=${cls}
      width=${(box.w * scale).toFixed(2)}
      height=${(box.h * scale).toFixed(2)}
      viewBox="${box.x.toFixed(4)} ${(-(box.y + box.h)).toFixed(4)} ${box.w.toFixed(
        4
      )} ${box.h.toFixed(4)}"
    >
      <text x="0" y="0" font-family="Bravura" font-size="4" fill="currentColor">${char}</text>
    </svg>`;
  }

  /**
   * Hand the keys back to the query line.
   *
   * Two-step on purpose: in tile mode the input is not in the DOM at all —
   * the row is rendering the readout instead — so the flag has to flip and
   * the render has to land BEFORE there is anything to focus. Anything that
   * types its way back (a printable character caught by the grid) appends
   * through here for the same reason.
   */
  private async focusSearch(append?: string) {
    this.searchFocused = true;
    await this.updateComplete;
    const input = this.renderRoot.querySelector<HTMLInputElement>('.search input');
    if (!input) return;
    input.focus();
    if (append !== undefined) {
      input.value += append;
      this.emit('tray-search', { text: input.value });
    }
  }

  /**
   * The tile's caption, for the tooltip and for the query line's readout.
   *
   * Typed to the two fields it reads rather than to `TrayTile`, because the
   * readout captions an ENTRY — the cursor indexes the focusable tiles, not
   * the drawn ones — and widening the parameter is cheaper than carrying a
   * tile through the cursor just to name it.
   */
  private tipText(tile: { label: string; shortcut: string }): string {
    return tile.shortcut ? tile.label : `${tile.label} · unbound`;
  }

  render() {
    const previewing = this.previewing;
    const entries = this.entries();
    const cursorEntry = entries[this.cursorIndex];
    const cursorId = cursorEntry?.id;
    return html`
      <div class="shaft" style="display: none"></div>
      <div class="tray">
        <div class="ladder" role="tablist" aria-label="selection scope">
          ${this.rungs.map(
            rung => html`
              <button
                class="rung"
                role="tab"
                aria-current=${rung.active ? 'true' : 'false'}
                @click=${() => this.emit('tray-rung-preview', { key: rung.key })}
              >
                ${rung.label}${rung.holdsSelection && !rung.active
                  ? html`<span class="dot"></span>`
                  : nothing}
              </button>
            `
          )}
        </div>
        <div class="panel">
          ${this.meta
            ? html`<div class="meta">
                <span class="primary">${this.meta.primary}</span>
                ${this.meta.secondary
                  ? html`<span class="secondary">${this.meta.secondary}</span>`
                  : nothing}
                ${previewing
                  ? html`<span class="count widen">↵ to widen selection</span>`
                  : this.meta.count
                    ? html`<span class="count">${this.meta.count}</span>`
                    : nothing}
              </div>`
            : nothing}
          <div class="search">
            <span class="prompt">&gt;</span>
            ${this.searchFocused
              ? html`<input
                  .value=${this.searchText}
                  placeholder="search this scope · / for everything"
                  @input=${(e: Event) => this.onSearchInput(e)}
                  @focus=${() => (this.searchFocused = true)}
                  @blur=${() => (this.searchFocused = false)}
                />`
              : html`<span class="readout">
                  ${this.searchText
                    ? html`<span class="query">${this.searchText} ·</span>`
                    : nothing}
                  ${cursorEntry
                    ? html`<span>${this.tipText(cursorEntry)}</span>`
                    : html`<span class="none">nothing matches</span>`}
                </span>`}
            <span class="hint">${this.searchFocused ? '↓ to the tiles' : '↑ to search'}</span>
          </div>
          <div class="grid">
            ${this.bands.map(
              band => html`
                <div class="band">
                  ${band.caption
                    ? html`<div class="caption">
                        <span>${band.caption}</span><span class="rule"></span>
                      </div>`
                    : nothing}
                  <div class="band-tiles">
                    ${band.tiles.map(
                      tile => html`
                        <button
                          class="tile ${'arc' in tile.glyph ? 'arc-tile' : ''} ${cursorId ===
                          tile.id
                            ? 'cursor'
                            : ''}"
                          data-state=${tile.state}
                          data-triage=${tile.untriaged ? 'untriaged' : nothing}
                          ?disabled=${tile.state === 'unavailable'}
                          tabindex=${tile.state === 'unavailable' ? '-1' : '0'}
                          aria-label=${tile.label}
                          @click=${() => this.emit('tray-command', { id: tile.id })}
                        >
                          ${this.glyph(tile.glyph, 'glyph', GLYPH_TARGET_PX)}
                          <span class="key">${tile.shortcut}</span>
                          <span class="tip">${this.tipText(tile)}</span>
                        </button>
                      `
                    )}
                  </div>
                </div>
              `
            )}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-selection-tray': SelectionTray;
  }
}
