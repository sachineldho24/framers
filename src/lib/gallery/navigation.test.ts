import assert from "node:assert/strict";
import test from "node:test";
import { TourProgress, wheelDistance, nearestStop } from "./navigation.ts";

test("tour reverses after reaching the end without wrapping", () => {
  const tour = new TourProgress();
  tour.seek(1, true);
  tour.nudge(-0.2);
  for (let i = 0; i < 240; i++) tour.tick(1 / 60);
  assert.ok(Math.abs(tour.current - 0.8) < 0.0001);
  tour.nudge(-4);
  for (let i = 0; i < 240; i++) tour.tick(1 / 60);
  assert.equal(tour.current, 0);
});

test("opening details freezes the rendered pose and discards pending inertia", () => {
  const tour = new TourProgress();
  tour.seek(0.7);
  tour.tick(0.1);
  const pose = tour.current;
  tour.pause();
  tour.nudge(0.4);
  tour.tick(1);
  tour.resume();
  tour.tick(1);
  assert.equal(tour.current, pose);
  assert.equal(tour.target, pose);
});

test("new input cancels a chapter transition from the rendered position", () => {
  const tour = new TourProgress();
  tour.goTo(0.9);
  tour.tick(0.2);
  const visible = tour.current;
  tour.nudge(-0.02);
  assert.ok(Math.abs(tour.target - Math.max(0, visible - 0.02)) < 1e-8);
});

test("easing gives equivalent progress at different refresh rates", () => {
  const fast = new TourProgress();
  const slow = new TourProgress();
  fast.seek(0.8); slow.seek(0.8);
  for (let i = 0; i < 60; i++) fast.tick(1 / 60);
  for (let i = 0; i < 30; i++) slow.tick(1 / 30);
  assert.ok(Math.abs(fast.current - slow.current) < 1e-8);
});

test("wheel units and room stops are normalized consistently", () => {
  assert.equal(wheelDistance(3, 1, 800), 48);
  assert.equal(wheelDistance(1, 2, 800), 800);
  assert.equal(wheelDistance(24, 0, 800), 24);
  assert.equal(nearestStop(0.45, [0, 0.11, 0.448, 0.55]), 2);
});
