import {
  applySurfaceLookDelta,
  computePinchFov,
  computeTouchDistance,
  isDoubleTap
} from './TouchGestureMath.js';

const TAP_MAX_MOVE_PX = 14;
const TAP_MAX_DURATION_MS = 280;

/**
 * Enhances canvas finger navigation alongside Three.js OrbitControls:
 * - Immediately cancels active focus tweens on finger touch so dragging never fights GSAP.
 * - Supports double-tap on canvas (zoom/focus in orbital view, reset/exit in surface view, WAC/NAC toggle in instrument view).
 * - Supports 1-finger horizon look-around while locked on a body's surface.
 * - Supports 2-finger pinch-to-zoom optical FOV while locked in Instrument View.
 * - Renders a brief visual ripple ring on recognized double-taps.
 */
export class TouchNavigationController {
  constructor(
    canvas,
    cameraController,
    {
      onFirstTouch,
      onDoubleTapOrbital,
      onDoubleTapSurface,
      onDoubleTapInstrument,
      onInstrumentZoom,
      onSurfaceLook
    } = {}
  ) {
    this.canvas = canvas;
    this.cameraController = cameraController;
    this.onFirstTouch = onFirstTouch;
    this.onDoubleTapOrbital = onDoubleTapOrbital;
    this.onDoubleTapSurface = onDoubleTapSurface;
    this.onDoubleTapInstrument = onDoubleTapInstrument;
    this.onInstrumentZoom = onInstrumentZoom;
    this.onSurfaceLook = onSurfaceLook;

    this.activePointers = new Map();
    this.pinchState = null;
    this.lastTap = null;
    this.hasInteracted = false;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerCancel = this.handlePointerCancel.bind(this);

    if (this.canvas) {
      this.canvas.addEventListener('pointerdown', this.handlePointerDown);
      this.canvas.addEventListener('pointermove', this.handlePointerMove);
      this.canvas.addEventListener('pointerup', this.handlePointerUp);
      this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    }
  }

  dispose() {
    if (!this.canvas) return;
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.activePointers.clear();
    this.pinchState = null;
  }

  handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    if (!this.hasInteracted && event.pointerType === 'touch') {
      this.hasInteracted = true;
      this.onFirstTouch?.();
    }

    // Interrupt orbital focus transitions immediately when the user grabs the canvas.
    if (
      !this.cameraController?.isSurfaceLocked &&
      !this.cameraController?.isInstrumentLocked
    ) {
      this.cameraController?.cancelTransition?.();
    }

    if (event.pointerType !== 'touch') return;

    this.activePointers.set(event.pointerId, {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      startTime: event.timeStamp || performance.now(),
      moved: false
    });

    if (this.activePointers.size === 2) {
      const pair = Array.from(this.activePointers.values());
      const dist = computeTouchDistance(pair[0], pair[1]);
      this.pinchState = {
        initialDistance: dist,
        baseFov: this.cameraController?.camera?.fov ?? 32
      };
      this.lastTap = null;
    } else if (this.activePointers.size > 2) {
      this.pinchState = null;
      this.lastTap = null;
    }
  }

  handlePointerMove(event) {
    if (event.pointerType !== 'touch') return;
    const pointer = this.activePointers.get(event.pointerId);
    if (!pointer) return;

    const dx = event.clientX - pointer.lastX;
    const dy = event.clientY - pointer.lastY;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (
      !pointer.moved &&
      Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) >
        TAP_MAX_MOVE_PX
    ) {
      pointer.moved = true;
    }

    if (this.cameraController?.isInstrumentLocked && this.activePointers.size === 2) {
      if (!this.pinchState) return;
      const pair = Array.from(this.activePointers.values());
      const currentDistance = computeTouchDistance(pair[0], pair[1]);
      const nextFov = computePinchFov(
        this.pinchState.baseFov,
        this.pinchState.initialDistance,
        currentDistance
      );
      this.cameraController.setInstrumentFov(nextFov);
      this.onInstrumentZoom?.(nextFov);
      return;
    }

    if (this.cameraController?.isSurfaceLocked && this.activePointers.size === 1) {
      const next = applySurfaceLookDelta(
        this.cameraController.surfaceLookYaw ?? 0,
        this.cameraController.surfaceLookPitch ?? 0,
        dx,
        dy,
        window.innerWidth,
        window.innerHeight
      );
      this.cameraController.setSurfaceLook?.(next.yaw, next.pitch);
      this.onSurfaceLook?.(next);
    }
  }

  handlePointerUp(event) {
    if (event.pointerType !== 'touch') return;
    const pointer = this.activePointers.get(event.pointerId);
    const hadSingleTouch = this.activePointers.size === 1 && !this.pinchState;
    this.activePointers.delete(event.pointerId);

    if (this.activePointers.size < 2) {
      this.pinchState = null;
    }

    if (!pointer || !hadSingleTouch) return;

    const now = event.timeStamp || performance.now();
    const duration = now - pointer.startTime;
    const totalMove = Math.hypot(
      event.clientX - pointer.startX,
      event.clientY - pointer.startY
    );

    if (pointer.moved || duration > TAP_MAX_DURATION_MS || totalMove > TAP_MAX_MOVE_PX) {
      this.lastTap = null;
      return;
    }

    if (
      this.lastTap &&
      isDoubleTap({
        firstTime: this.lastTap.time,
        secondTime: now,
        firstX: this.lastTap.x,
        firstY: this.lastTap.y,
        secondX: event.clientX,
        secondY: event.clientY
      })
    ) {
      this.lastTap = null;
      this.spawnRipple(event.clientX, event.clientY);
      this.triggerDoubleTap();
      return;
    }

    this.lastTap = {
      time: now,
      x: event.clientX,
      y: event.clientY
    };
  }

  handlePointerCancel(event) {
    if (event.pointerType !== 'touch') return;
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) {
      this.pinchState = null;
    }
    this.lastTap = null;
  }

  triggerDoubleTap() {
    if (this.cameraController?.isInstrumentLocked) {
      this.onDoubleTapInstrument?.();
      return;
    }
    if (this.cameraController?.isSurfaceLocked) {
      this.onDoubleTapSurface?.();
      return;
    }
    this.onDoubleTapOrbital?.();
  }

  spawnRipple(clientX, clientY) {
    if (typeof document === 'undefined' || !document.body) return;
    const ripple = document.createElement('span');
    ripple.className = 'touch-ripple';
    ripple.style.left = `${clientX}px`;
    ripple.style.top = `${clientY}px`;
    ripple.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ripple);
    window.setTimeout(() => {
      ripple.remove();
    }, 460);
  }
}
