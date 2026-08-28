// Placement for the overlays that hang off the selection — the tray and the
// rung inspector (roadmap/inprogress/workbench-rung-inspector.md). Factored
// out of SelectionTray.place() when the inspector arrived, so "where the
// tray sits" is one function rather than two copies that drift: the design
// pass placed the inspector by pointing at the tray, and this is the code
// form of that pointer.
//
// The host is positioned absolutely inside its offsetParent (`.main`); it
// hangs one shaft below the anchor, flips above when the room below is
// worse, mirrors to the anchor's right edge when the page says so, and docks
// bottom-centre when there is no anchor at all. The two custom properties it
// writes (`--tray-w`, `--tray-max-h`) are placement, not palette — the
// design-tokens test whitelists them by name.

/** The selection's box in the coordinate space of the host's offsetParent. */
export interface OverlayAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The connector: the spec plants the overlay one small gap below the
 *  selection's lower bound and lets the shaft fill exactly that gap. */
export const OVERLAY_SHAFT_H = 8;
/** The gap the chip and the overlays all sit at, below the selection. */
export const OVERLAY_EDGE_GAP = 8;
/** The spec's mirror trigger: flip when the overlay's right edge would pass
 *  the score's right edge minus this. */
export const OVERLAY_MIRROR_MARGIN = 16;

export interface PlaceOverlayOptions {
  anchor: OverlayAnchor | null;
  mirrored: boolean;
  /** The overlay's fixed width. */
  width: number;
  /** The shortest it may be squeezed to before it simply scrolls. */
  minHeight: number;
  /** The connector element inside the host's shadow root, if it draws one. */
  shaft: HTMLElement | null;
}

/**
 * Position `host` from the anchor. Normally its LEFT edge sits on the
 * selection's left edge; mirrored (decided by the page, held for the open),
 * its RIGHT edge sits on the selection's right edge. Vertically it hangs one
 * shaft below the selection, flipping above when there is no room.
 * Anchor-less (nothing selected / geometry unknown): docked bottom-centre —
 * the fallback the visuals doc names.
 */
export function placeOverlay(host: HTMLElement, options: PlaceOverlayOptions): void {
  const parent = host.offsetParent as HTMLElement | null;
  if (!parent) return;
  const { anchor, mirrored, width, minHeight, shaft } = options;
  host.style.setProperty('--tray-w', `${width}px`);
  const pw = parent.clientWidth;
  const ph = parent.clientHeight;
  if (!anchor) {
    host.removeAttribute('data-flipped');
    host.removeAttribute('data-mirrored');
    if (shaft) shaft.style.display = 'none';
    const dockH = Math.max(minHeight, ph - OVERLAY_EDGE_GAP - 18);
    host.style.setProperty('--tray-max-h', `${dockH}px`);
    const docked = Math.min(host.getBoundingClientRect().height || 200, dockH);
    host.style.left = `${Math.max(OVERLAY_EDGE_GAP, (pw - width) / 2)}px`;
    host.style.top = `${Math.max(OVERLAY_EDGE_GAP, ph - docked - 18)}px`;
    return;
  }

  host.toggleAttribute('data-mirrored', mirrored);
  const wanted = mirrored ? anchor.x + anchor.width - width : anchor.x;
  const left = Math.min(
    Math.max(wanted, OVERLAY_EDGE_GAP),
    Math.max(OVERLAY_EDGE_GAP, pw - width - OVERLAY_EDGE_GAP)
  );
  const below = anchor.y + anchor.height + OVERLAY_SHAFT_H;
  // How much room each side actually has, decided BEFORE the height is
  // capped — otherwise the overlay measures last frame's clamp and every
  // re-place shrinks it a little further.
  const roomBelow = Math.max(0, ph - below - OVERLAY_EDGE_GAP);
  const roomAbove = Math.max(0, anchor.y - OVERLAY_SHAFT_H - OVERLAY_EDGE_GAP);
  host.style.setProperty('--tray-max-h', 'none');
  const wantH = host.getBoundingClientRect().height || 200;

  // Hang below when it fits there; otherwise take whichever side has more
  // room. Asking whether the OTHER side could hold it WHOLE left an overlay
  // too tall for both below and running off the screen.
  const flip = wantH > roomBelow && roomAbove > roomBelow;
  const room = Math.max(minHeight, flip ? roomAbove : roomBelow);
  host.style.setProperty('--tray-max-h', `${room}px`);
  // `data-flipped` alone carries this: nothing in render() reads the side.
  host.toggleAttribute('data-flipped', flip);
  host.style.left = `${left}px`;
  // The height it will REALLY have, so a flipped one's top is not computed
  // from a box it was never allowed to be.
  const realH = Math.min(wantH, room);
  host.style.top = `${
    flip ? Math.max(OVERLAY_EDGE_GAP, anchor.y - OVERLAY_SHAFT_H - realH) : below
  }px`;

  // The shaft: selection width clamped 24–240, centred on the selection's
  // horizontal centre, clamped to the overlay's span.
  if (shaft) {
    const w = Math.min(240, Math.max(24, anchor.width));
    const centre = anchor.x + anchor.width / 2 - left;
    const x = Math.min(Math.max(centre - w / 2, 0), Math.max(0, width - w));
    shaft.style.left = `${x}px`;
    shaft.style.width = `${w}px`;
    shaft.style.display = 'block';
  }
}
