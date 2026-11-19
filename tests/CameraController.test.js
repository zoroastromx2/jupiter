import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CameraController } from '../src/core/CameraController.js';

function createHarness() {
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 1000);
  const controls = {
    target: new THREE.Vector3(),
    enabled: true,
    update() {}
  };
  const controller = new CameraController(camera, controls);
  return { camera, controls, controller };
}

function createSurfaceBody() {
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(10, 8, 6),
    new THREE.MeshBasicMaterial()
  );
  const mount = new THREE.Object3D();
  mount.position.set(10, 0, 0);
  const aim = new THREE.Object3D();
  aim.position.set(15, 0, 2);
  body.add(mount, aim);
  body.updateMatrixWorld(true);
  return { body, mount, aim };
}

function completeTransition(controller) {
  expect(controller.tween).not.toBeNull();
  controller.tween.progress(1);
  expect(controller.tween).toBeNull();
}

describe('CameraController', () => {
  it('focuses a target and follows its motion', () => {
    const { camera, controls, controller } = createHarness();
    const target = new THREE.Object3D();
    target.position.set(10, 4, -6);
    const focusPoint = target.position.clone();

    controller.focusOnObject(target, 20, 0);
    completeTransition(controller);

    expect(controller.currentTarget).toBe(target);
    expect(camera.position.distanceTo(focusPoint)).toBeCloseTo(20, 5);
    expect(controls.target.distanceTo(focusPoint)).toBeCloseTo(0, 6);

    const before = camera.position.clone();
    target.position.x += 5;
    controller.update();

    expect(camera.position.x).toBeCloseTo(before.x + 5, 5);
    expect(controls.target.x).toBeCloseTo(focusPoint.x + 5, 5);
  });

  it('locks the camera to a surface mount and restores orbital control', () => {
    const { camera, controls, controller } = createHarness();
    const { body, mount, aim } = createSurfaceBody();

    controller.landOnSurface({
      mesh: body,
      surfaceCameraMount: mount,
      surfaceCameraTarget: aim
    });
    completeTransition(controller);

    const mountWorld = mount.getWorldPosition(new THREE.Vector3());
    expect(controller.isSurfaceLocked).toBe(true);
    expect(controls.enabled).toBe(false);
    expect(camera.position.distanceTo(mountWorld)).toBeCloseTo(0, 6);
    expect(camera.up.x).toBeCloseTo(1, 6);

    controller.exitSurfaceView();

    expect(controller.isSurfaceLocked).toBe(false);
    expect(controls.enabled).toBe(true);
    expect(camera.up.toArray()).toEqual([0, 1, 0]);
  });

  it('enters instrument view and rides the optical mount', () => {
    const { camera, controls, controller } = createHarness();
    const mount = new THREE.Object3D();
    mount.position.set(0, 1.1, 2.6);
    mount.updateMatrixWorld(true);

    controller.engageInstrumentView(mount, 32);

    expect(controller.isInstrumentLocked).toBe(true);
    expect(camera.fov).toBe(32);
    expect(controller.activeLensMode).toBe('WAC');
    expect(controls.enabled).toBe(false);

    controller.setInstrumentTarget(new THREE.Vector3(0, 0, 0));
    controller.update();

    const mountWorld = mount.getWorldPosition(new THREE.Vector3());
    expect(camera.position.distanceTo(mountWorld)).toBeCloseTo(0, 6);
  });

  it('toggles between the wide and narrow instrument lenses', () => {
    const { camera, controller } = createHarness();
    const mount = new THREE.Object3D();
    controller.engageInstrumentView(mount, 32);

    controller.toggleInstrumentLens();
    expect(controller.activeLensMode).toBe('NAC');
    expect(camera.fov).toBe(10);

    controller.toggleInstrumentLens();
    expect(controller.activeLensMode).toBe('WAC');
    expect(camera.fov).toBe(32);
  });

  it('exits instrument view and restores the orbital camera', () => {
    const { camera, controls, controller } = createHarness();
    const mount = new THREE.Object3D();
    controller.engageInstrumentView(mount, 10);
    expect(camera.fov).toBe(10);

    controller.exitInstrumentView();

    expect(controller.isInstrumentLocked).toBe(false);
    expect(camera.fov).toBe(45);
    expect(controls.enabled).toBe(true);
    expect(camera.up.toArray()).toEqual([0, 1, 0]);
  });
});
