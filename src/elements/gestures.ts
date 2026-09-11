/**
 * Touch gestures on the score (roadmap/inprogress/core-touch-gestures.md).
 *
 * Three, and deliberately only three:
 *  - **double tap** → zoom reset (back to FITTED, not to 1.0)
 *  - **double tap, hold, drag** → staff × space zoom; a diagonal drives both
 *  - **two-finger tap** → play/pause, as an event the host wires to its player
 *
 * A double-tap-drag is ONE finger: tap, lift, tap again and don't lift. The
 * double-tap is only the unlock; the drag that follows is the control. That
 * matters more than it sounds — a one-finger drag is a clean 2D vector on
 * touch, trackpad and mouse alike, where a trackpad pinch is a single scalar
 * with no x/y to decompose. It is also the single-pointer path WCAG 2.5.1
 * requires, which a pinch cannot be.
 *
 * The rate curve is `src/workbench/ZoomPad.ts`'s, constant for constant: this
 * is that control's drag without the pad, and the two must agree on what a
 * step is. The one deliberate divergence is the axis lock — the pad LOCKS to
 * one axis (core-zoom-density-pad.md ruling 2), and here the near-axis cone is
 * a SNAP instead, so pure-staff and pure-space stay easy targets while a
 * genuinely diagonal drag drives both. The pad is untouched.
 *
 * No tests: `harness/` may not import the shells or `elements/`, and this is
 * timing-and-threshold code against real PointerEvents. It ships the way
 * `ZoomPad.ts` ships.
 */
import { clampStaffScale } from '../engine/render/scale.ts';
import { walkDensity } from '../engine/layout/spacing.ts';

/** Staff steps are geometric — the pad's reasoning, unchanged: an additive
 *  step is invisible at 640% and coarse at 60%. */
const STAFF_STEP_RATIO = 1.1;
/** ±1 step per 6px of travel. */
const DRAG_PX_PER_STEP = 6;
/** The axis snap decides once, after this much travel, and is then held —
 *  deciding per move lets a curving drag flip axes mid-gesture. */
const AXIS_SNAP_PX = 8;
const AXIS_SNAP_TAN = Math.tan((20 * Math.PI) / 180);

/** Tap one's release to tap two's press. 300ms is the platform convention. */
const DOUBLE_TAP_MS = 300;
/** How far apart two taps may land and still be one gesture. */
const TAP_SLOP_PX = 14;
/** The second tap releases within this, without moving → reset rather than
 *  drag. Longer than a tap and shorter than a deliberate hold. */
const SECOND_TAP_MS = 220;
/** Both fingers down within this of each other, and up within it again, with
 *  neither moving → a two-finger tap rather than the start of a scroll. */
const TWO_FINGER_MS = 260;
const TWO_FINGER_SLOP_PX = 16;

export interface ZoomValues {
  /** The axis's new value, or null for "this gesture did not touch it" — an
   *  axis-snapped drag drives one axis and must leave the other exactly as it
   *  found it, including leaving it unset. Returning to fitted is `reset()`,
   *  never a null here. */
  staffScale: number | null;
  densityH: number | null;
}

export interface GestureTargets {
  /**
   * The values to drag FROM — resolved, never null. A gesture must continue
   * from what is on screen: starting a drag from 1.0 on a fitted score that
   * drew at 2.3 would jump before it moved.
   */
  effective(): { staffScale: number; densityH: number };
  /** The density ladder for this paint, or null to step a flat percentage. */
  ladder(): number[] | null;
  /** Apply and announce. */
  commit(next: ZoomValues): void;
  /** Double tap: back to both defaults, and the staff default is fitted. */
  reset(): void;
  /** Two-finger tap. */
  toggleTransport(): void;
  /** Transient readout during a drag; null clears it. */
  hud(text: string | null): void;
}

interface Contact {
  x: number;
  y: number;
  t: number;
  moved: boolean;
}

interface Drag {
  pointerId: number;
  x0: number;
  y0: number;
  t0: number;
  snap: 'staff' | 'space' | 'both' | null;
  moved: boolean;
  staff0: number;
  space0: number;
}

/** `steps` geometric staff steps from `from`, snapped to the 1% grid the pad's
 *  readout prints, so repeated ×1.1 ÷1.1 cannot drift. */
function staffAfterSteps(from: number, steps: number): number {
  return Math.round(from * Math.pow(STAFF_STEP_RATIO, steps) * 100) / 100;
}

export class ScoreGestures {
  private contacts = new Map<number, Contact>();
  private lastTapUp: { x: number; y: number; t: number } | null = null;
  private drag: Drag | null = null;
  /** Set the moment a second tap is recognised, cleared when the gesture
   *  ends. The non-passive touchstart handler reads it — see `onTouchStart`. */
  private armed = false;
  /** Both contacts of a candidate two-finger tap, while it is still a
   *  candidate. */
  private twoFinger: { ids: number[]; t: number } | null = null;
  private hudTimer: number | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly targets: GestureTargets
  ) {}

  attach() {
    this.host.addEventListener('pointerdown', this.onPointerDown);
    this.host.addEventListener('pointermove', this.onPointerMove);
    this.host.addEventListener('pointerup', this.onPointerUp);
    this.host.addEventListener('pointercancel', this.onPointerCancel);
    // NON-PASSIVE, and the whole experiment this item exists to run: with
    // `touch-action: pan-y` the browser owns one-finger vertical scrolling,
    // which is exactly what a double-tap-drag is. preventDefault() on the
    // SECOND tap should suppress the scroll for that sequence alone and leave
    // native scrolling everywhere else. If a platform disagrees, the fallback
    // recorded in the roadmap doc is to take `touch-action: none` and hand-write
    // the scroller — or to move the 2D zoom onto a pinch, which does not
    // compete with one finger at all.
    this.host.addEventListener('touchstart', this.onTouchStart, { passive: false });
  }

  detach() {
    this.host.removeEventListener('pointerdown', this.onPointerDown);
    this.host.removeEventListener('pointermove', this.onPointerMove);
    this.host.removeEventListener('pointerup', this.onPointerUp);
    this.host.removeEventListener('pointercancel', this.onPointerCancel);
    this.host.removeEventListener('touchstart', this.onTouchStart);
    if (this.hudTimer !== null) clearTimeout(this.hudTimer);
    this.hudTimer = null;
    this.contacts.clear();
    this.drag = null;
    this.armed = false;
    this.twoFinger = null;
  }

  private onTouchStart = (event: TouchEvent) => {
    // Only the armed second tap, and only while it is the sole contact:
    // suppressing more than that would take scrolling away wholesale, which is
    // the outcome the pan-y choice exists to avoid.
    if (this.armed && event.touches.length === 1 && event.cancelable) event.preventDefault();
  };

  private onPointerDown = (event: PointerEvent) => {
    // Left button only for mouse; touch and pen report 0 here too.
    if (event.button !== 0) return;
    const now = event.timeStamp;
    this.contacts.set(event.pointerId, { x: event.clientX, y: event.clientY, t: now, moved: false });

    if (this.contacts.size === 2) {
      // A second finger cancels any zoom drag — two contacts are never a
      // double-tap-drag, and letting the drag survive would zoom under a
      // scroll.
      this.endDrag();
      this.twoFinger = { ids: [...this.contacts.keys()], t: now };
      return;
    }
    if (this.contacts.size > 2) {
      this.twoFinger = null;
      return;
    }

    const previous = this.lastTapUp;
    const isSecondTap =
      previous !== null &&
      now - previous.t <= DOUBLE_TAP_MS &&
      Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= TAP_SLOP_PX;
    if (!isSecondTap) return;

    // The unlock. Selection already happened on tap one's pointerdown, down in
    // `engine/render/svg.ts` — deliberately not deferred, because a 300ms lag
    // on note selection is a worse defect than a double-tap also leaving a note
    // selected, and selection is non-destructive.
    this.lastTapUp = null;
    this.armed = true;
    const from = this.targets.effective();
    this.drag = {
      pointerId: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      t0: now,
      snap: null,
      moved: false,
      staff0: from.staffScale,
      space0: from.densityH
    };
    this.host.setPointerCapture?.(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    const contact = this.contacts.get(event.pointerId);
    if (contact && !contact.moved) {
      if (Math.hypot(event.clientX - contact.x, event.clientY - contact.y) > TWO_FINGER_SLOP_PX) {
        contact.moved = true;
        // A moved contact is a scroll or a pan, never a tap.
        this.twoFinger = null;
      }
    }

    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const dx = event.clientX - drag.x0;
    const dy = event.clientY - drag.y0;
    const travel = Math.hypot(dx, dy);
    if (!drag.moved && travel > 2) drag.moved = true;

    // Snapped once, then held. Unlike the pad this admits 'both': a clearly
    // diagonal drag is the gesture's whole point, and the near-axis cone is
    // what keeps single-axis adjustment from becoming fiddly.
    if (drag.snap === null && travel >= AXIS_SNAP_PX) {
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ay <= ax * AXIS_SNAP_TAN) drag.snap = 'space';
      else if (ax <= ay * AXIS_SNAP_TAN) drag.snap = 'staff';
      else drag.snap = 'both';
    }
    if (drag.snap === null) return;

    // Absolute from the gesture's origin, so a drag out and back returns to
    // where it started instead of ratcheting.
    const staffSteps = drag.snap === 'space' ? 0 : Math.round(-dy / DRAG_PX_PER_STEP);
    const spaceSteps = drag.snap === 'staff' ? 0 : Math.round(dx / DRAG_PX_PER_STEP);

    const staff = clampStaffScale(staffAfterSteps(drag.staff0, staffSteps))!;
    const space = walkDensity(
      drag.space0,
      Math.abs(spaceSteps),
      spaceSteps >= 0 ? 1 : -1,
      this.targets.ladder()
    ).value;

    this.targets.commit({
      staffScale: drag.snap === 'space' ? null : staff,
      densityH: drag.snap === 'staff' ? null : space
    });
    this.showHud(
      `Staff ${Math.round(staff * 100)}% · Space ${Math.round(space * 100)}%`
    );
    if (event.cancelable) event.preventDefault();
  };

  private onPointerUp = (event: PointerEvent) => {
    const contact = this.contacts.get(event.pointerId);
    this.contacts.delete(event.pointerId);
    const now = event.timeStamp;

    // ── two-finger tap ──
    const pair = this.twoFinger;
    if (pair && pair.ids.includes(event.pointerId)) {
      const other = pair.ids.find(id => id !== event.pointerId);
      const otherContact = other === undefined ? undefined : this.contacts.get(other);
      const bothStill = !contact?.moved && !otherContact?.moved;
      const quick = now - pair.t <= TWO_FINGER_MS;
      // Resolve on the FIRST release: the second finger may lift well after.
      this.twoFinger = null;
      if (bothStill && quick) {
        this.targets.toggleTransport();
        this.lastTapUp = null;
        return;
      }
    }

    const drag = this.drag;
    if (drag && event.pointerId === drag.pointerId) {
      const quick = now - drag.t0 <= SECOND_TAP_MS;
      const held = drag.snap !== null || drag.moved;
      this.endDrag();
      // Released fast and never moved → the second tap was a tap, and the
      // gesture was a double tap. Held or dragged → it was the zoom.
      if (quick && !held) this.targets.reset();
      this.lastTapUp = null;
      return;
    }

    if (contact && !contact.moved && this.contacts.size === 0) {
      this.lastTapUp = { x: event.clientX, y: event.clientY, t: now };
    }
  };

  private onPointerCancel = (event: PointerEvent) => {
    this.contacts.delete(event.pointerId);
    this.twoFinger = null;
    if (this.drag && this.drag.pointerId === event.pointerId) this.endDrag();
  };

  private endDrag() {
    if (this.drag) this.host.releasePointerCapture?.(this.drag.pointerId);
    this.drag = null;
    this.armed = false;
    this.showHud(null);
  }

  /** The readout exists because the control does not: on touch there is no pad
   *  on screen printing these numbers, and an invisible continuous control with
   *  no feedback is unlearnable. */
  private showHud(text: string | null) {
    if (this.hudTimer !== null) clearTimeout(this.hudTimer);
    this.hudTimer = null;
    this.targets.hud(text);
    if (text === null) return;
    this.hudTimer = setTimeout(() => {
      this.hudTimer = null;
      this.targets.hud(null);
    }, 900) as unknown as number;
  }
}
