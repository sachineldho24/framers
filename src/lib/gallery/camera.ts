import { AnimationMixer, LoopOnce, type AnimationClip, type Object3D, type PerspectiveCamera } from "three";

/** Scrub the authored GLB; keep the camera's parent hierarchy intact. */
export function createTourCamera(root: Object3D, clip: AnimationClip) {
  const camera = root.getObjectByName("CAM_TOUR") as PerspectiveCamera | undefined;
  if (!camera?.isPerspectiveCamera) throw new Error("Gallery tour camera is missing.");
  const mixer = new AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const start = Math.min(...clip.tracks.map(track => track.times[0]));
  const end = Math.max(...clip.tracks.map(track => track.times[track.times.length - 1]));
  return {
    camera,
    sample(progress: number) {
      action.enabled = true;
      action.paused = false;
      mixer.setTime(start + Math.max(0, Math.min(1, progress)) * (end - start));
      root.updateMatrixWorld(true);
    },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(root); },
  };
}
