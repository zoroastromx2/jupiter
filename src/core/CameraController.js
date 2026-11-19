import * as THREE from 'three';
import { gsap } from 'gsap';

const TRANSITION_SECONDS = 1.7;

/**
 * Camera focus / follow / surface-mount controller.
 * All per-frame vectors are preallocated; update() is allocation-free.
 */
export class CameraController {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.defaultUp = camera.up.clone();

    this.currentTarget = null;
    this.tween = null;
    this.progress = { value: 0 };

    this.startPosition = new THREE.Vector3();
    this.startTarget = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.endPosition = new THREE.Vector3();
    this.offsetDirection = new THREE.Vector3();
    this.lastTargetPosition = new THREE.Vector3();
    this.followDelta = new THREE.Vector3();
    this.surfaceMountPosition = new THREE.Vector3();
    this.surfaceLookPosition = new THREE.Vector3();
    this.surfaceCenter = new THREE.Vector3();
    this.surfaceUp = new THREE.Vector3();
    this.startUp = new THREE.Vector3();
    this.surfaceCenterObject = null;

    this.focusDistance = 1;
    this.isSurfaceLocked = false;
    this.surfaceMount = null;
    this.surfaceTarget = null;
    this.surfaceOrigin = new THREE.Vector3();
    this.lastSurfaceTarget = new THREE.Vector3();
  }

  static radiusOf(targetObject) {
    const radius =
      targetObject?.userData?.radius ??
      targetObject?.geometry?.parameters?.radius ??
      targetObject?.geometry?.boundingSphere?.radius ??
      1;
    return Math.max(0.0001, radius);
  }

  focusOnMesh(targetMesh, distanceMultiplier = 4, elevationBias = 0.28) {
    if (!targetMesh) return;
    this.focusOnObject(
      targetMesh,
      CameraController.radiusOf(targetMesh) * distanceMultiplier,
      elevationBias
    );
  }

  focusOnObject(targetObject, distance, elevationBias = 0.28) {
    if (!targetObject) return;
    this.exitSurfaceView();

    if (this.tween) {
      this.tween.kill();
      this.tween = null;
    }

    this.currentTarget = targetObject;
    this.focusDistance = Math.max(0.05, distance);
    this.controls.enabled = true;

    this.startPosition.copy(this.camera.position);
    this.startTarget.copy(this.controls.target);
    targetObject.getWorldPosition(this.targetPosition);
    this.lastTargetPosition.copy(this.targetPosition);

    this.offsetDirection.copy(this.startPosition).sub(this.targetPosition);
    if (this.offsetDirection.lengthSq() < 1e-8) {
      this.offsetDirection.set(0.35, 0.25, 1);
    }
    this.offsetDirection.normalize();
    this.offsetDirection.y += elevationBias;
    this.offsetDirection.normalize();

    this.progress.value = 0;
    this.tween = gsap.to(this.progress, {
      value: 1,
      duration: TRANSITION_SECONDS,
      ease: 'power3.inOut',
      onUpdate: () => this.applyFocusTransition(),
      onComplete: () => {
        this.applyFocusTransition();
        this.lastTargetPosition.copy(this.targetPosition);
        this.tween = null;
      }
    });
  }

  applyFocusTransition() {
    if (!this.currentTarget) return;

    this.currentTarget.getWorldPosition(this.targetPosition);
    this.endPosition
      .copy(this.targetPosition)
      .addScaledVector(this.offsetDirection, this.focusDistance);

    this.camera.position.lerpVectors(
      this.startPosition,
      this.endPosition,
      this.progress.value
    );
    this.controls.target.lerpVectors(
      this.startTarget,
      this.targetPosition,
      this.progress.value
    );
    this.camera.lookAt(this.controls.target);
  }

  landOnSurface(simulator) {
    const mount = simulator?.surfaceCameraMount;
    const target = simulator?.surfaceCameraTarget;
    if (!mount || !target) return;

    if (this.tween) {
      this.tween.kill();
      this.tween = null;
    }

    this.currentTarget = simulator.mesh ?? simulator.focusTarget ?? null;
    this.surfaceCenterObject = simulator.mesh ?? simulator.focusTarget ?? null;
    this.isSurfaceLocked = false;
    this.surfaceMount = mount;
    this.surfaceTarget = target;
    this.controls.enabled = false;

    this.startPosition.copy(this.camera.position);
    this.startTarget.copy(this.controls.target);
    this.startUp.copy(this.camera.up);
    mount.getWorldPosition(this.surfaceMountPosition);
    target.getWorldPosition(this.surfaceLookPosition);

    this.progress.value = 0;
    this.tween = gsap.to(this.progress, {
      value: 1,
      duration: TRANSITION_SECONDS,
      ease: 'power3.inOut',
      onUpdate: () => {
        mount.getWorldPosition(this.surfaceMountPosition);
        target.getWorldPosition(this.surfaceLookPosition);
        this.camera.position.lerpVectors(
          this.startPosition,
          this.surfaceMountPosition,
          this.progress.value
        );
        this.controls.target.lerpVectors(
          this.startTarget,
          this.surfaceLookPosition,
          this.progress.value
        );
        this.surfaceCenterObject.getWorldPosition(this.surfaceCenter);
        this.surfaceUp
          .subVectors(this.surfaceMountPosition, this.surfaceCenter)
          .normalize();
        this.camera.up
          .lerpVectors(this.startUp, this.surfaceUp, this.progress.value)
          .normalize();
        this.camera.lookAt(this.controls.target);
      },
      onComplete: () => {
        mount.getWorldPosition(this.surfaceMountPosition);
        target.getWorldPosition(this.surfaceLookPosition);
        this.surfaceCenterObject.getWorldPosition(this.surfaceCenter);
        this.surfaceUp
          .subVectors(this.surfaceMountPosition, this.surfaceCenter)
          .normalize();
        this.camera.position.copy(this.surfaceMountPosition);
        this.controls.target.copy(this.surfaceLookPosition);
        this.camera.up.copy(this.surfaceUp);
        this.camera.lookAt(this.controls.target);
        this.isSurfaceLocked = true;
        this.controls.enabled = false;
        this.lastSurfaceTarget.copy(this.surfaceLookPosition);
        this.tween = null;
      }
    });
  }

  exitSurfaceView() {
    this.isSurfaceLocked = false;
    this.surfaceMount = null;
    this.surfaceTarget = null;
    this.surfaceCenterObject = null;
    this.camera.up.copy(this.defaultUp);
    this.controls.enabled = true;
  }

  update() {
    if (this.isSurfaceLocked && this.surfaceMount && this.surfaceTarget) {
      this.surfaceMount.getWorldPosition(this.camera.position);
      this.surfaceTarget.getWorldPosition(this.surfaceLookPosition);
      this.surfaceCenterObject.getWorldPosition(this.surfaceCenter);
      this.surfaceUp
        .subVectors(this.camera.position, this.surfaceCenter)
        .normalize();
      this.camera.up.copy(this.surfaceUp);
      this.controls.target.copy(this.surfaceLookPosition);
      this.camera.lookAt(this.controls.target);
      return;
    }

    if (this.currentTarget && !this.tween) {
      this.currentTarget.getWorldPosition(this.targetPosition);
      this.followDelta.subVectors(this.targetPosition, this.lastTargetPosition);
      this.camera.position.add(this.followDelta);
      this.controls.target.copy(this.targetPosition);
      this.lastTargetPosition.copy(this.targetPosition);
    }

    this.controls.update();
  }
}
