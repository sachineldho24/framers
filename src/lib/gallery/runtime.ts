import {
  AgXToneMapping, Box3, Color, Group, HemisphereLight, Material, Mesh, MeshBasicMaterial,
  PMREMGenerator, Raycaster, Scene, SpotLight, SRGBColorSpace, Texture, Vector3, WebGLRenderer,
} from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GALLERY_BASE, GALLERY_ROOMS, type SceneData } from "./manifest";
import { createTourCamera } from "./camera";
import { nearestStop, TourProgress, wheelDistance } from "./navigation";

type Callbacks = {
  ready(): void;
  room(index: number): void;
  error(error: unknown): void;
  frame(progress: number, pin: { x: number; y: number; visible: boolean }): void;
};

function release(root: Group) {
  const textures = new Set<Texture>();
  const materials = new Set<Material>();
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
  });
  for (const material of materials) material.dispose();
  for (const texture of textures) {
    texture.dispose();
    if (typeof ImageBitmap !== "undefined" && texture.source.data instanceof ImageBitmap) texture.source.data.close();
  }
  root.removeFromParent();
}

export function createGalleryRuntime(canvas: HTMLCanvasElement, callbacks: Callbacks, initialProgress = 0, reducedMotion = false) {
  const mobileViewport = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
  const renderer = new WebGLRenderer({ canvas, antialias: !mobileViewport, powerPreference: "low-power", stencil: false });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.25 : 1.5));
  const scene = new Scene();
  scene.background = new Color("#777467");
  const pmrem = new PMREMGenerator(renderer);
  const environmentScene = new RoomEnvironment();
  const environment = pmrem.fromScene(environmentScene, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.5;
  environmentScene.dispose();
  pmrem.dispose();
  scene.add(new HemisphereLight(0xf4ecdc, 0x534736, 0.38));
  const spots = [0, 1].map(() => {
    const light = new SpotLight(0xffe8c4, 60, 20, Math.PI * 0.37, 0.85, 2);
    scene.add(light, light.target);
    return light;
  });
  const abort = new AbortController();
  const draco = new DRACOLoader().setDecoderPath(`${GALLERY_BASE}/draco/`).setWorkerLimit(1);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const controller = new TourProgress();
  controller.seek(initialProgress, true);
  const stops = GALLERY_ROOMS.map(room => room.stop);
  const rooms = new Map<number, Group>();
  const artworkBounds = new Map<number, Vector3[]>();
  const pending = new Map<number, Promise<void>>();
  const groups = new Set<Group>();
  let tour: ReturnType<typeof createTourCamera> | undefined;
  let data: SceneData;
  let disposed = false;
  let failed = false;
  let frameId = 0;
  let lastTime = 0;
  let roomIndex = -1;
  let initialized = false;
  let width = 1;
  let height = 1;
  let gesture: { id: number; y: number } | null = null;
  let lastOcclusion = -Infinity;
  let lastOcclusionRoom = -1;
  let lastTelemetry = -Infinity;
  let occluded = false;
  const eye = new Vector3();
  const anchor = new Vector3();
  const projected = new Vector3();
  const cornerProjection = new Vector3();
  const direction = new Vector3();
  const cameraDirection = new Vector3();
  const normal = new Vector3();
  const raycaster = new Raycaster();

  function fail(error: unknown) {
    if (disposed || failed) return;
    failed = true;
    controller.pause();
    callbacks.error(error);
  }

  async function load(url: string): Promise<GLTF> {
    const response = await fetch(url, { signal: abort.signal });
    if (!response.ok) throw new Error(`Gallery asset could not load (${response.status}).`);
    const gltf = await loader.parseAsync(await response.arrayBuffer(), `${GALLERY_BASE}/`);
    if (disposed) { release(gltf.scene); throw new DOMException("Gallery closed", "AbortError"); }
    return gltf;
  }

  function invalidate() {
    if (!disposed && !failed && !document.hidden && !frameId) frameId = requestAnimationFrame(draw);
  }

  function prepare(root: Group) {
    root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if ("map" in material && material.map instanceof Texture) material.map.anisotropy = Math.min(mobileViewport ? 2 : 4, renderer.capabilities.getMaxAnisotropy());
        // glTF unlit bakes are scene-linear diffuse appearance encoded as sRGB.
        if (material instanceof MeshBasicMaterial) {
          material.toneMapped = true;
          // Baked patches sit in front of the shared shell. Fill their depth
          // first so the GPU can reject hidden, expensive PBR wall fragments.
          object.renderOrder = -1;
        }
      }
    });
    groups.add(root);
    scene.add(root);
  }

  function needed(index: number) {
    const window = mobileViewport ? [index, index + 1] : [index - 1, index, index + 1];
    return window.filter(i => i >= 0 && i < GALLERY_ROOMS.length);
  }

  function ensureRoom(index: number): Promise<void> {
    if (rooms.has(index)) return Promise.resolve();
    const existing = pending.get(index);
    if (existing) return existing;
    const request = (async () => {
      const gltf = await load(GALLERY_ROOMS[index].model);
      const group = new Group();
      group.name = `room-${index}`;
      group.add(gltf.scene);
      if (index === 0) {
        try { group.add((await load(`${GALLERY_BASE}/living-baked.glb`)).scene); }
        catch (error) { release(group); throw error; }
      }
      if (disposed) { release(group); return; }
      prepare(group);
      const artwork = group.getObjectByName(data.anchors[index].node);
      if (artwork) {
        // Include a little space around the artwork plane for the molding.
        const box = new Box3().setFromObject(artwork).expandByScalar(0.06);
        const corners: Vector3[] = [];
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x, y, z));
          }
        }
        artworkBounds.set(index, corners);
      }
      if (tour) await renderer.compileAsync(scene, tour.camera);
      if (disposed) return;
      rooms.set(index, group);
      invalidate();
    })().finally(() => pending.delete(index));
    pending.set(index, request);
    return request;
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    width = Math.max(1, box.width); height = Math.max(1, box.height);
    const pixelRatio = Math.min(window.devicePixelRatio, mobileViewport ? 1.25 : 1.5);
    if (renderer.getPixelRatio() !== pixelRatio) renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    if (tour) {
      tour.camera.aspect = width / height;
      // Portrait gets a wider composition, reviewed independently from desktop.
      const aspect = width / height;
      tour.camera.fov = aspect < 0.8
        ? Math.max(55, Math.min(75, 2 * Math.atan(Math.tan(55 * Math.PI / 360) * (390 / 844) / aspect) * 180 / Math.PI))
        : 38;
      if (width / height < 0.8) tour.camera.setViewOffset(width, height, 0, height * 0.07, width, height);
      else tour.camera.clearViewOffset();
      tour.camera.updateProjectionMatrix();
    }
    invalidate();
  }

  function updateRoom(index: number) {
    if (roomIndex === index) return;
    roomIndex = index;
    callbacks.room(index);
    const keys = data.lights.filter(light => light.name.startsWith("LIGHT_Key_"));
    tour!.camera.getWorldPosition(eye);
    const nearest = keys.map(key => ({ key, distance: new Vector3(key.position[0], key.position[2], -key.position[1]).distanceToSquared(eye) })).sort((a,b) => a.distance - b.distance);
    spots.forEach((spot,i) => {
      const light = nearest[i]?.key;
      if (!light) return;
      spot.color.setRGB(...light.color);
      spot.intensity = light.energy * 0.15;
      spot.position.set(light.position[0], light.position[2], -light.position[1]);
      spot.target.position.set(light.target[0], light.target[2], -light.target[1]);
    });
  }

  function draw(now: number) {
    frameId = 0;
    if (disposed || failed || !tour || !initialized || document.hidden) return;
    const dt = lastTime ? (now - lastTime) / 1000 : 1 / 60;
    lastTime = now;
    // Preload the current and adjoining room before advancing into its view.
    const index = nearestStop(controller.current, stops);
    const required = needed(index);
    const missing = required.filter(i => !rooms.has(i));
    if (missing.length) {
      Promise.all(missing.map(ensureRoom)).then(invalidate).catch(fail);
    } else {
      controller.tick(dt);
    }
    tour.sample(controller.current);
    updateRoom(nearestStop(controller.current, stops));
    renderer.render(scene, tour.camera);
    const position = data.anchors[roomIndex].position;
    anchor.fromArray(position);
    tour.camera.getWorldPosition(eye);
    projected.copy(anchor).project(tour.camera);
    direction.copy(anchor).sub(eye);
    const distance = direction.length();
    tour.camera.getWorldDirection(cameraDirection);
    const inFront = direction.dot(cameraDirection) > 0;
    const facingCamera = normal.fromArray(data.anchors[roomIndex].normal).dot(direction) < 0;
    let visible = inFront && facingCamera && projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 0.88 && Math.abs(projected.y) < 0.75;
    if (visible) {
      if (now - lastOcclusion >= 120 || roomIndex !== lastOcclusionRoom || !controller.moving) {
        raycaster.set(eye, direction.normalize());
        raycaster.far = distance - 0.12;
        occluded = raycaster.intersectObjects([...groups], true).length > 0;
        lastOcclusion = now;
        lastOcclusionRoom = roomIndex;
      }
      visible = !occluded;
    }
    let pinX = 0;
    let pinY = 0;
    if (visible) {
      const corners = artworkBounds.get(roomIndex);
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const corner of corners ?? []) {
        cornerProjection.copy(corner).project(tour.camera);
        const x = (cornerProjection.x + 1) * width / 2;
        const y = (1 - cornerProjection.y) * height / 2;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      // The 48px eye stays outside the complete projected frame, including its
      // hover growth. Prefer the right side, then use available mobile space.
      const gap = 40;
      const candidates = [
        [right + gap, (top + bottom) / 2],
        [left - gap, (top + bottom) / 2],
        [(left + right) / 2, bottom + gap],
        [(left + right) / 2, top - gap],
      ];
      const placement = candidates.find(([x, y]) =>
        Number.isFinite(x) && Number.isFinite(y) && x >= 34 && x <= width - 34 &&
        y >= 100 && y <= height - (width < 600 ? 140 : 110));
      visible = Boolean(placement);
      if (placement) [pinX, pinY] = placement;
    }
    callbacks.frame(controller.current, { x: pinX, y: pinY, visible });
    canvas.dataset.progress = String(controller.current);
    if (now - lastTelemetry >= 250 || !initialized) {
      canvas.dataset.triangles = String(renderer.info.render.triangles);
      canvas.dataset.drawCalls = String(renderer.info.render.calls);
      canvas.dataset.frameCount = String(renderer.info.render.frame);
      canvas.dataset.textures = String(renderer.info.memory.textures);
      canvas.dataset.residentRooms = [...rooms.keys()].sort().join(",");
      lastTelemetry = now;
    }
    // A small resident window bounds GPU memory as the visitor explores.
    for (const [i, group] of rooms) {
      if (Math.abs(i - roomIndex) > 1) { rooms.delete(i); artworkBounds.delete(i); groups.delete(group); release(group); }
    }
    if (controller.moving && !missing.length) invalidate();
    else lastTime = 0;
  }

  function wheel(event: WheelEvent) {
    if (event.ctrlKey || reducedMotion || controller.paused) return;
    event.preventDefault();
    controller.nudge(wheelDistance(event.deltaY, event.deltaMode, height) / 9000);
    invalidate();
  }
  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || controller.paused || reducedMotion) return;
    gesture = { id: event.pointerId, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (!gesture || gesture.id !== event.pointerId || controller.paused) return;
    controller.nudge((gesture.y - event.clientY) / (height * 6));
    gesture.y = event.clientY;
    invalidate();
  }
  function pointerUp() { gesture = null; }
  function visibility() {
    lastTime = 0;
    if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; }
    else invalidate();
  }
  function contextLost(event: Event) { event.preventDefault(); fail(new Error("The 3D view was interrupted.")); }

  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("webglcontextlost", contextLost);
  document.addEventListener("visibilitychange", visibility);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const ready = (async () => {
    const response = await fetch(`${GALLERY_BASE}/scene.json`, { signal: abort.signal });
    if (!response.ok) throw new Error("Gallery information could not load.");
    data = await response.json() as SceneData;
    // Register each loaded root immediately so a later failure/unmount also
    // releases an already decoded camera or shell.
    const camera = await load(`${GALLERY_BASE}/camera-paths.glb`);
    prepare(camera.scene);
    const shell = await load(`${GALLERY_BASE}/shell.glb`);
    prepare(shell.scene);
    tour = createTourCamera(camera.scene, camera.animations[0]);
    tour.sample(controller.current);
    resize();
    updateRoom(nearestStop(controller.current, stops));
    // Present the first useful frame before fetching adjoining room detail.
    await ensureRoom(roomIndex);
    if (disposed) return;
    await renderer.compileAsync(scene, tour.camera);
    if (disposed) return;
    initialized = true;
    cancelAnimationFrame(frameId);
    frameId = 0;
    draw(performance.now());
    callbacks.ready();
  })().catch(fail);

  return {
    ready,
    get progress() { return controller.current; },
    goTo(index: number) { controller.goTo(GALLERY_ROOMS[index].stop, reducedMotion); invalidate(); },
    seek(progress: number) { controller.seek(progress, reducedMotion); invalidate(); },
    pause() { controller.pause(); gesture = null; },
    resume() { controller.resume(); invalidate(); },
    dispose() {
      if (disposed) return;
      disposed = true; abort.abort(); cancelAnimationFrame(frameId); observer.disconnect();
      canvas.removeEventListener("wheel", wheel); canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove); canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp); canvas.removeEventListener("webglcontextlost", contextLost);
      document.removeEventListener("visibilitychange", visibility);
      tour?.dispose();
      for (const root of groups) release(root);
      groups.clear(); rooms.clear(); artworkBounds.clear();
      environment.dispose(); draco.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

export type GalleryRuntime = ReturnType<typeof createGalleryRuntime>;
