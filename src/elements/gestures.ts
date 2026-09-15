/**
 * Touch gestures on the score (roadmap/inprogress/core-touch-gestures.md).
 *
 * Four, and deliberately only four:
 *  - **double tap** → zoom reset (back to FITTED, not to 1.0)
 *  - **double tap, hold, drag** → staff × space zoom; a diagonal drives both
 *  - **pinch** → the same two axes, touch only: spreading the fingers apart
 *    vertically grows the staff, apart horizontally opens the spacing
 *  - **two-finger tap** → play/pause, as an event the host wires to its player
 *
 * A double-tap-drag is ONE finger: tap, lift, tap again and don't lift. The
 * double-tap is only the unlock; the drag that follows is the control. That
 * matters more than it sounds — a one-finger drag is a clean 2D vector on
 * touch, trackpad and mouse alike, where a trackpad pinch is a single scalar
 * with no x/y to decompose. It is also the single-pointer path WCAG 2.5.1
 * requires, which a pinch cannot be. The pinch is therefore an ADDITION for
 * touchscreens, never the only route: on a touchscreen two fingers are two
 * points, so their span IS a 2D vector, and the two axes fall out of it the
 * same way they fall out of the drag.
 *
 * The rate curve is `src/workbench/ZoomPad.ts`'s, constant for constant: this
 * is that control's drag without the pad, and the two must agree on what a
 * step is. The one deliberate divergence is the axis lock — the pad LOCKS to
 * one axis (core-zoom-density-pad.md ruling 2), and here the near-axis cone is
 * a SNAP instead, so pure-staff and pure-space stay easy targets while a
 * genuinely diagonal drag drives both. The pad is untouched.
 *
 * A pinch steps the SAME ladder, by the change in the fingers' span rather
 * than by one finger's travel, at half the drag's rate: two fingers moving
 * apart cover twice the pixels of one finger moving, so the halved rate is
 * what makes a pinch and a drag of the same hand movement zoom the same
 * amount. Stepping by span change rather than span ratio is deliberate too —
 * a ratio explodes when the fingers start close together, and it would need
 * a rate curve of its own.
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
/** ±1 step per 12px of span change — half the drag's rate, see above. */
const PINCH_PX_PER_STEP = 12;
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

/**
 * A trackpad pinch reaches the page as `wheel` with `ctrlKey` set — the
 * browser's own encoding, which is why Ctrl cannot be the modifier that
 * picks the axis: a real Ctrl and a pinch are the same event. Shift is.
 * Chrome's pinch deltas run a few units per event and sum to roughly the
 * natural log of the zoom ×100, so 10 units per ×1.1 step keeps a pinch
 * feeling like the browser's own; a mouse wheel's 100-unit notches are
 * clamped so one notch is a few steps rather than a leap.
 */
const WHEEL_UNITS_PER_STEP = 10;
const WHEEL_UNIT_CLAMP = 30;
/** No wheel event for this long ends the pinch: the release the fingers
 *  cannot report. */
const WHEEL_IDLE_MS = 250;

/** What the readout says the moment a zoom gesture is armed, before any
 *  travel. The earlier cut showed nothing until the first step had landed,
 *  which on a slow device meant a second of holding a finger on a score that
 *  gave no sign it had noticed (reported 2026-09-15 from a tablet). */
const ARMED_HINT = 'Zoom — drag ↕ staff · ↔ space';
const PINCH_HINT = 'Zoom — pinch ↕ staff · ↔ space';
const WHEEL_HINT = 'Zoom — pinch staff · Shift+pinch space';
const RESET_HINT = 'Reset — fitted';

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
  /**
   * A zoom gesture is in flight (armed drag or pinch). The host uses it to
   * show the mode and to take the per-frame fast path — the selection chrome
   * that costs a third of a paint waits for the release.
   */
  active(on: boolean): void;
}

interface Contact {
  x: number;
  y: number;
  /** Where the contact is NOW — a pinch reads both fingers' current spots. */
  cx: number;
  cy: number;
  t: number;
  moved: boolean;
}

type Snap = 'staff' | 'space' | 'both' | null;

interface Drag {
  pointerId: number;
  x0: number;
  y0: number;
  t0: number;
  snap: Snap;
  moved: boolean;
  staff0: number;
  space0: number;
}

interface Pinch {
  ids: [number, number];
  /** The fingers' horizontal and vertical span when the second landed. */
  dx0: number;
  dy0: number;
  snap: Snap;
  /** Past the snap threshold at least once — the gesture is a pinch, not a
   *  two-finger tap, and the host has been told it is active. */
  engaged: boolean;
  staff0: number;
  space0: number;
}

/** `steps` geometric staff steps from `from`, snapped to the 1% grid the pad's
 *  readout prints, so repeated ×1.1 ÷1.1 cannot drift. */
function staffAfterSteps(from: number, steps: number): number {
  return Math.round(from * Math.pow(STAFF_STEP_RATIO, steps) * 100) / 100;
}

/** The near-axis cone: pure-staff and pure-space stay easy targets, a clearly
 *  diagonal movement drives both. Decided once per gesture and then held. */
function snapFor(dx: number, dy: number): Snap {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ay <= ax * AXIS_SNAP_TAN) return 'space';
  if (ax <= ay * AXIS_SNAP_TAN) return 'staff';
  return 'both';
}

/** A short tick on arming, where the platform offers one (Android). iOS
 *  Safari exposes no vibration API and simply skips it. */
function haptic() {
  try {
    (navigator as Navigator & { vibrate?: (ms: number) => boolean }).vibrate?.(10);
  } catch {
    // Not worth an error: the hint and the outline carry the same message.
  }
}

export class ScoreGestures {
  private contacts = new Map<number, Contact>();
  private lastTapUp: { x: number; y: number; t: number } | null = null;
  private drag: Drag | null = null;
  private pinch: Pinch | null = null;
  /** Set the moment a second tap is recognised, cleared when the gesture
   *  ends. The non-passive touchstart handler reads it — see `onTouchStart`. */
  private armed = false;
  /** Both contacts of a candidate two-finger tap, while it is still a
   *  candidate. */
  private twoFinger: { ids: number[]; t: number } | null = null;
  private hudTimer: number | null = null;
  /** What the last commit carried, for the dedupe in `commitSteps`. */
  private lastCommit: { staff: number; space: number } | null = null;
  /** The readout's last text, so a fading readout can repeat it. */
  private lastHud: string | null = null;
  /** A trackpad pinch in flight: one burst of ctrl+wheel events. */
  private wheel: { axis: 'staff' | 'space'; acc: number; staff0: number; space0: number } | null = null;
  private wheelTimer: number | null = null;

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
    //
    // Confirmed on a real tablet 2026-09-15: one-finger scrolling stays native
    // and the second tap is claimed. The same handler now also claims the
    // moment a SECOND finger lands, so a pinch is ours rather than a
    // two-finger scroll — one-finger scrolling is untouched by that.
    this.host.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.host.addEventListener('touchmove', this.onTouchMove, { passive: false });
    // Non-passive too: a pinch the page does not claim zooms the page.
    this.host.addEventListener('wheel', this.onWheel, { passive: false });
  }

  detach() {
    this.host.removeEventListener('pointerdown', this.onPointerDown);
    this.host.removeEventListener('pointermove', this.onPointerMove);
    this.host.removeEventListener('pointerup', this.onPointerUp);
    this.host.removeEventListener('pointercancel', this.onPointerCancel);
    this.host.removeEventListener('touchstart', this.onTouchStart);
    this.host.removeEventListener('touchmove', this.onTouchMove);
    this.host.removeEventListener('wheel', this.onWheel);
    if (this.hudTimer !== null) clearTimeout(this.hudTimer);
    this.hudTimer = null;
    if (this.wheelTimer !== null) clearTimeout(this.wheelTimer);
    this.wheelTimer = null;
    this.wheel = null;
    this.contacts.clear();
    if (this.drag || this.pinch || this.wheel) this.targets.active(false);
    this.drag = null;
    this.pinch = null;
    this.armed = false;
    this.twoFinger = null;
  }

  private onTouchStart = (event: TouchEvent) => {
    if (!event.cancelable) return;
    // The armed second tap while it is the sole contact, or a second finger
    // landing: suppressing more than that would take scrolling away
    // wholesale, which is the outcome the pan-y choice exists to avoid.
    if ((this.armed && event.touches.length === 1) || event.touches.length === 2) event.preventDefault();
  };

  /** The trackpad's pinch (and a mouse's ctrl+wheel, which the browser
   *  spells the same way): staff by default, space with Shift held. A burst
   *  of events is one gesture, from the scale on screen when it began. */
  private onWheel = (event: WheelEvent) => {
    // A plain two-finger scroll is the browser's, untouched.
    if (!event.ctrlKey) return;
    event.preventDefault();
    const axis: 'staff' | 'space' = event.shiftKey ? 'space' : 'staff';
    // Some platforms move a shifted wheel onto the x axis.
    let delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
    if (event.deltaMode === 1) delta *= 16;
    else if (event.deltaMode === 2) delta *= 400;
    delta = Math.max(-WHEEL_UNIT_CLAMP, Math.min(WHEEL_UNIT_CLAMP, delta));

    if (!this.wheel || this.wheel.axis !== axis) {
      const from = this.targets.effective();
      this.wheel = { axis, acc: 0, staff0: from.staffScale, space0: from.densityH };
      this.lastCommit = null;
      this.targets.active(true);
      this.showHud(WHEEL_HINT, true);
    }
    // Fingers apart (a negative delta, like wheel-up) means bigger.
    this.wheel.acc -= delta;
    const steps = Math.round(this.wheel.acc / WHEEL_UNITS_PER_STEP);
    this.commitSteps(axis, this.wheel.staff0, this.wheel.space0, axis === 'staff' ? steps : 0, axis === 'space' ? steps : 0);

    if (this.wheelTimer !== null) clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => {
      this.wheelTimer = null;
      this.wheel = null;
      this.targets.active(false);
      // Let the numbers linger, then fade, as a touch release does.
      this.showHud(this.lastHud);
    }, WHEEL_IDLE_MS) as unknown as number;
  };

  private onTouchMove = (event: TouchEvent) => {
    if ((this.drag || this.pinch) && event.cancelable) event.preventDefault();
  };

  private onPointerDown = (event: PointerEvent) => {
    // Left button only for mouse; touch and pen report 0 here too.
    if (event.button !== 0) return;
    const now = event.timeStamp;
    this.contacts.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      cx: event.clientX,
      cy: event.clientY,
      t: now,
      moved: false
    });

    if (this.contacts.size === 2) {
      // A second finger cancels any zoom drag — two contacts are never a
      // double-tap-drag, and letting the drag survive would zoom under a
      // scroll.
      this.endDrag();
      const ids = [...this.contacts.keys()] as [number, number];
      this.twoFinger = { ids, t: now };
      // …and is the start of a pinch, until it resolves as a tap. Nothing is
      // committed and the host is not told until the span actually changes.
      const [a, b] = ids.map(id => this.contacts.get(id)!);
      const from = this.targets.effective();
      this.lastCommit = null;
      this.pinch = {
        ids,
        dx0: Math.abs(a.cx - b.cx),
        dy0: Math.abs(a.cy - b.cy),
        snap: null,
        engaged: false,
        staff0: from.staffScale,
        space0: from.densityH
      };
      return;
    }
    if (this.contacts.size > 2) {
      this.twoFinger = null;
      this.endPinch();
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
    this.lastCommit = null;
    // Say so at once — the mode is entered on the press, not on the first
    // step. A quick release turns this into the reset and its own readout.
    this.targets.active(true);
    this.showHud(ARMED_HINT, true);
    haptic();
  };

  private onPointerMove = (event: PointerEvent) => {
    const contact = this.contacts.get(event.pointerId);
    if (contact) {
      contact.cx = event.clientX;
      contact.cy = event.clientY;
      if (!contact.moved && Math.hypot(event.clientX - contact.x, event.clientY - contact.y) > TWO_FINGER_SLOP_PX) {
        contact.moved = true;
        // A moved contact is a scroll or a pan, never a tap.
        this.twoFinger = null;
      }
    }

    const pinch = this.pinch;
    if (pinch && pinch.ids.includes(event.pointerId)) {
      this.movePinch(pinch);
      if (pinch.engaged && event.cancelable) event.preventDefault();
      return;
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
    if (drag.snap === null && travel >= AXIS_SNAP_PX) drag.snap = snapFor(dx, dy);
    if (drag.snap === null) return;

    // Absolute from the gesture's origin, so a drag out and back returns to
    // where it started instead of ratcheting.
    this.commitSteps(
      drag.snap,
      drag.staff0,
      drag.space0,
      Math.round(-dy / DRAG_PX_PER_STEP),
      Math.round(dx / DRAG_PX_PER_STEP)
    );
    if (event.cancelable) event.preventDefault();
  };

  /** Both fingers are read on every move of either: the span is a property of
   *  the pair, and whichever finger moved, the other's current spot is where
   *  it was last seen. */
  private movePinch(pinch: Pinch) {
    const a = this.contacts.get(pinch.ids[0]);
    const b = this.contacts.get(pinch.ids[1]);
    if (!a || !b) return;
    // Spreading apart is positive on both axes: a wider vertical span grows
    // the staff, a wider horizontal span opens the spacing.
    const ddx = Math.abs(a.cx - b.cx) - pinch.dx0;
    const ddy = Math.abs(a.cy - b.cy) - pinch.dy0;
    const travel = Math.hypot(ddx, ddy);
    if (pinch.snap === null) {
      if (travel < AXIS_SNAP_PX) return;
      pinch.snap = snapFor(ddx, ddy);
    }
    if (!pinch.engaged) {
      pinch.engaged = true;
      // A span that changed is a pinch, whatever the individual fingers did.
      this.twoFinger = null;
      this.targets.active(true);
      this.showHud(PINCH_HINT, true);
      haptic();
    }
    this.commitSteps(
      pinch.snap,
      pinch.staff0,
      pinch.space0,
      Math.round(ddy / PINCH_PX_PER_STEP),
      Math.round(ddx / PINCH_PX_PER_STEP)
    );
  }

  /** The shared tail of both zoom gestures: steps → values → commit → readout. */
  private commitSteps(snap: Snap, staff0: number, space0: number, staffSteps: number, spaceSteps: number) {
    if (snap === 'space') staffSteps = 0;
    if (snap === 'staff') spaceSteps = 0;
    const staff = clampStaffScale(staffAfterSteps(staff0, staffSteps))!;
    const space = walkDensity(
      space0,
      Math.abs(spaceSteps),
      spaceSteps >= 0 ? 1 : -1,
      this.targets.ladder()
    ).value;
    // A pinch reports a move per finger and a drag one per frame, and most
    // of those land on the step the last one did: only a changed value is a
    // commit, because every commit is also an announcement the host acts on.
    if (staff === this.lastCommit?.staff && space === this.lastCommit.space) return;
    this.lastCommit = { staff, space };

    this.targets.commit({
      staffScale: snap === 'space' ? null : staff,
      densityH: snap === 'staff' ? null : space
    });
    this.showHud(`Staff ${Math.round(staff * 100)}% · Space ${(Math.round(space * 10) / 10).toFixed(1)}sp`, true);
  }

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
        this.endPinch();
        this.targets.toggleTransport();
        this.lastTapUp = null;
        return;
      }
    }

    // ── pinch ──
    const pinch = this.pinch;
    if (pinch && pinch.ids.includes(event.pointerId)) {
      // Either finger lifting ends it; the one still down is the tail of a
      // pinch, not a tap and not a drag.
      const other = pinch.ids.find(id => id !== event.pointerId);
      const remaining = other === undefined ? undefined : this.contacts.get(other);
      if (remaining) remaining.moved = true;
      this.endPinch();
      this.lastTapUp = null;
      return;
    }

    const drag = this.drag;
    if (drag && event.pointerId === drag.pointerId) {
      const quick = now - drag.t0 <= SECOND_TAP_MS;
      const held = drag.snap !== null || drag.moved;
      this.endDrag();
      // Released fast and never moved → the second tap was a tap, and the
      // gesture was a double tap. Held or dragged → it was the zoom.
      if (quick && !held) {
        this.targets.reset();
        this.showHud(RESET_HINT);
      }
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
    if (this.pinch && this.pinch.ids.includes(event.pointerId)) this.endPinch();
  };

  private endDrag() {
    if (!this.drag) return;
    this.host.releasePointerCapture?.(this.drag.pointerId);
    this.drag = null;
    this.armed = false;
    this.targets.active(false);
    this.showHud(null);
  }

  private endPinch() {
    const pinch = this.pinch;
    if (!pinch) return;
    this.pinch = null;
    if (pinch.engaged) {
      this.targets.active(false);
      this.showHud(null);
    }
  }

  /** The readout exists because the control does not: on touch there is no pad
   *  on screen printing these numbers, and an invisible continuous control with
   *  no feedback is unlearnable. `hold` keeps it up for as long as the gesture
   *  lasts; otherwise it fades on its own. */
  private showHud(text: string | null, hold = false) {
    if (this.hudTimer !== null) clearTimeout(this.hudTimer);
    this.hudTimer = null;
    this.lastHud = text;
    this.targets.hud(text);
    if (text === null || hold) return;
    this.hudTimer = setTimeout(() => {
      this.hudTimer = null;
      this.targets.hud(null);
    }, 900) as unknown as number;
  }
}
