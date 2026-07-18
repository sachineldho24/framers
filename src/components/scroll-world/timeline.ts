export type TimelineScene = {
  id: string;
  scroll?: number;
};

export type TimelineSegment = {
  id: string;
  index: number;
  start: number;
  end: number;
};

export type ScrollTimeline = {
  segments: TimelineSegment[];
  totalHeight: number;
};

export type StoryboardWindow = {
  videoStart: number;
  videoEnd: number;
};

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (value: number) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};

export function buildTimeline(
  scenes: TimelineScene[],
  viewportHeight: number,
  mobileFactor = 1,
): ScrollTimeline {
  let offset = 0;
  const safeViewportHeight = Math.max(1, viewportHeight);
  const safeMobileFactor = Math.max(1, mobileFactor);

  const segments = scenes.map((scene, index) => {
    const start = offset * safeViewportHeight;
    offset += (scene.scroll ?? 1.4) * safeMobileFactor;

    return {
      id: scene.id,
      index,
      start,
      end: offset * safeViewportHeight,
    };
  });

  return {
    segments,
    totalHeight: offset * safeViewportHeight + safeViewportHeight,
  };
}

export function getActiveSceneIndex(
  segments: TimelineSegment[],
  scrollY: number,
): number {
  if (segments.length === 0) return -1;

  let active = 0;
  for (const segment of segments) {
    if (scrollY >= segment.start) active = segment.index;
  }

  return clamp(active, 0, segments.length - 1);
}

export function getSegmentProgress(
  segment: TimelineSegment,
  scrollY: number,
): number {
  return clamp((scrollY - segment.start) / (segment.end - segment.start));
}

export function getStoryboardTime(
  scene: StoryboardWindow,
  progress: number,
): number {
  const x = clamp(progress);
  return scene.videoStart + (scene.videoEnd - scene.videoStart) * x;
}

export function getCopyCrossfade(
  progress: number,
  hasNext: boolean,
): { current: number; next: number } {
  if (!hasNext) return { current: 1, next: 0 };

  const next = smoothstep((clamp(progress) - 0.78) / 0.22);
  return { current: 1 - next, next };
}

export function remapWithLinger(progress: number, linger = 0): number {
  const x = clamp(progress);
  const amount = clamp(linger);
  const centered = x - 0.5;

  return (1 - amount) * x + amount * (4 * centered ** 3 + 0.5);
}
