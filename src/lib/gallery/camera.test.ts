import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Vector3, Quaternion } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createTourCamera } from "./camera.ts";

test("the actual exported tour seeks backward after its final frame", async () => {
  const bytes = new Uint8Array(readFileSync(new URL("../../../public/gallery-assets/v07/camera-paths.glb", import.meta.url)));
  const asset = await new GLTFLoader().parseAsync(bytes.buffer, "");
  assert.equal(asset.animations[0].name, "Framers_Continuous_Tour");
  const tour = createTourCamera(asset.scene, asset.animations[0]);
  tour.sample(0.4);
  const expectedPosition = tour.camera.getWorldPosition(new Vector3());
  const expectedRotation = tour.camera.getWorldQuaternion(new Quaternion());
  tour.sample(1);
  assert.ok(tour.camera.getWorldPosition(new Vector3()).distanceTo(expectedPosition) > 2);
  tour.sample(0.4);
  assert.ok(tour.camera.getWorldPosition(new Vector3()).distanceTo(expectedPosition) < 1e-6);
  assert.ok(tour.camera.getWorldQuaternion(new Quaternion()).angleTo(expectedRotation) < 1e-6);
  tour.sample(0);
  assert.ok(Math.abs(tour.camera.getWorldPosition(new Vector3()).y - 1.7) < 0.001);
  tour.dispose();
});
