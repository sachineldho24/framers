"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";
import type { FinishOverlay } from "@/lib/supabase/types";

/**
 * FramePreview — virtual "try-on" of an image inside a physical frame.
 * Native HTML5 Canvas 2D (no Konva dependency — see plan/10 §2).
 *
 * Layers, back to front:
 *   1. molding (frame border, `moldingColor`)
 *   2. white inner liner (thin)
 *   3. user image (object-fit: cover into the window, draggable + zoomable)
 *   4. finish overlay (matte=none, glossy=specular highlight, premium=glass tint)
 *
 * Editable mode: drag to pan, wheel / pinch to zoom. Emits the composited PNG
 * + crop transform via onComposite / the imperative `capture()` handle.
 */

export interface CropTransform {
  x: number; // pan offset in canvas px
  y: number;
  scale: number; // >= cover scale
}

export interface FramePreviewHandle {
  capture: () => { dataUrl: string; crop: CropTransform } | null;
  getCrop: () => CropTransform;
}

export interface FramePreviewProps {
  widthMm: number;
  heightMm: number;
  moldingColor?: string;
  moldingWidthMm?: number;
  finish?: FinishOverlay;
  imageSrc?: string | null;
  editable?: boolean;
  initialCrop?: Partial<CropTransform>;
  /** Longest canvas edge in device px (internal resolution). */
  maxEdge?: number;
  className?: string;
  onCropChange?: (crop: CropTransform) => void;
}

const PLACEHOLDER_BG = "#ebebeb"; // surface-muted
const LINER = "#ffffff";

export const FramePreview = forwardRef<FramePreviewHandle, FramePreviewProps>(
  function FramePreview(
    {
      widthMm,
      heightMm,
      moldingColor = "#141414",
      moldingWidthMm = 22,
      finish = "none",
      imageSrc = null,
      editable = false,
      initialCrop,
      maxEdge = 900,
      className,
      onCropChange,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [imgLoaded, setImgLoaded] = useState(false);

    // Canvas internal pixel size, preserving the frame's aspect ratio.
    const ratio = widthMm / heightMm;
    const cw = ratio >= 1 ? maxEdge : Math.round(maxEdge * ratio);
    const ch = ratio >= 1 ? Math.round(maxEdge / ratio) : maxEdge;

    // Molding thickness in canvas px (scaled from mm relative to the frame width).
    const molding = Math.max(
      6,
      Math.round((moldingWidthMm / widthMm) * cw)
    );
    const linerPx = Math.max(2, Math.round(molding * 0.12));

    // The visible image window (inside molding + liner).
    const win = {
      x: molding + linerPx,
      y: molding + linerPx,
      w: cw - 2 * (molding + linerPx),
      h: ch - 2 * (molding + linerPx),
    };

    // "cover" scale so the image always fills the window.
    const coverScale = useCallback(() => {
      const img = imgRef.current;
      if (!img || !img.naturalWidth) return 1;
      return Math.max(win.w / img.naturalWidth, win.h / img.naturalHeight);
    }, [win.w, win.h]);

    const cropRef = useRef<CropTransform>({
      x: initialCrop?.x ?? 0,
      y: initialCrop?.y ?? 0,
      scale: initialCrop?.scale ?? 1,
    });

    // --- drawing -----------------------------------------------------------
    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, cw, ch);

      // 1. molding
      ctx.fillStyle = moldingColor;
      ctx.fillRect(0, 0, cw, ch);

      // 2. liner
      ctx.fillStyle = LINER;
      ctx.fillRect(
        molding,
        molding,
        cw - 2 * molding,
        ch - 2 * molding
      );

      // window background
      ctx.fillStyle = PLACEHOLDER_BG;
      ctx.fillRect(win.x, win.y, win.w, win.h);

      // 3. image, clipped to the window
      const img = imgRef.current;
      if (img && img.naturalWidth && imgLoaded) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(win.x, win.y, win.w, win.h);
        ctx.clip();

        const base = coverScale();
        const s = base * cropRef.current.scale;
        const dw = img.naturalWidth * s;
        const dh = img.naturalHeight * s;
        // centre + pan
        const dx = win.x + (win.w - dw) / 2 + cropRef.current.x;
        const dy = win.y + (win.h - dh) / 2 + cropRef.current.y;
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
      } else {
        // placeholder mountain glyph
        ctx.strokeStyle = "#bdbdbd";
        ctx.lineWidth = Math.max(2, win.w * 0.006);
        ctx.beginPath();
        const cx = win.x + win.w / 2;
        const cy = win.y + win.h / 2;
        const u = win.w * 0.16;
        ctx.moveTo(cx - 2 * u, cy + u);
        ctx.lineTo(cx - 0.6 * u, cy - 0.4 * u);
        ctx.lineTo(cx + 0.2 * u, cy + 0.4 * u);
        ctx.lineTo(cx + u, cy - 0.6 * u);
        ctx.lineTo(cx + 2 * u, cy + u);
        ctx.stroke();
      }

      // 4. finish overlay
      if (finish === "gloss") {
        const g = ctx.createLinearGradient(win.x, win.y, win.x + win.w, win.y + win.h);
        g.addColorStop(0, "rgba(255,255,255,0.32)");
        g.addColorStop(0.18, "rgba(255,255,255,0.05)");
        g.addColorStop(0.5, "rgba(255,255,255,0)");
        g.addColorStop(0.82, "rgba(255,255,255,0.04)");
        g.addColorStop(1, "rgba(255,255,255,0.14)");
        ctx.fillStyle = g;
        ctx.fillRect(win.x, win.y, win.w, win.h);
      } else if (finish === "glass") {
        const g = ctx.createLinearGradient(win.x, win.y, win.x + win.w * 0.6, win.y + win.h);
        g.addColorStop(0, "rgba(255,255,255,0.14)");
        g.addColorStop(0.5, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(win.x, win.y, win.w, win.h);
      }
    }, [cw, ch, molding, moldingColor, win.x, win.y, win.w, win.h, finish, imgLoaded, coverScale]);

    // --- load image --------------------------------------------------------
    useEffect(() => {
      if (!imageSrc) {
        imgRef.current = null;
        setImgLoaded(false);
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imgRef.current = img;
        // reset crop to centred cover on new image
        cropRef.current = {
          x: initialCrop?.x ?? 0,
          y: initialCrop?.y ?? 0,
          scale: initialCrop?.scale ?? 1,
        };
        setImgLoaded(true);
      };
      img.onerror = () => {
        imgRef.current = null;
        setImgLoaded(false);
      };
      img.src = imageSrc;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imageSrc]);

    useEffect(() => {
      draw();
    }, [draw, imgLoaded]);

    // --- interaction (editable) -------------------------------------------
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !editable) return;

      let dragging = false;
      let lastX = 0;
      let lastY = 0;

      // canvas px per CSS px (internal res vs displayed size)
      function pxScale() {
        const rect = canvas!.getBoundingClientRect();
        return cw / rect.width;
      }

      function commit() {
        onCropChange?.({ ...cropRef.current });
      }

      function onDown(e: PointerEvent) {
        if (!imgRef.current) return;
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas!.setPointerCapture(e.pointerId);
      }
      function onMove(e: PointerEvent) {
        if (!dragging) return;
        const k = pxScale();
        cropRef.current.x += (e.clientX - lastX) * k;
        cropRef.current.y += (e.clientY - lastY) * k;
        lastX = e.clientX;
        lastY = e.clientY;
        draw();
      }
      function onUp(e: PointerEvent) {
        if (!dragging) return;
        dragging = false;
        try {
          canvas!.releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
        commit();
      }
      function onWheel(e: WheelEvent) {
        if (!imgRef.current) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.06 : 1 / 1.06;
        cropRef.current.scale = Math.min(
          5,
          Math.max(1, cropRef.current.scale * factor)
        );
        draw();
        commit();
      }

      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      return () => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("wheel", onWheel);
      };
    }, [editable, cw, draw, onCropChange]);

    // --- imperative capture ------------------------------------------------
    useImperativeHandle(
      ref,
      () => ({
        capture: () => {
          const canvas = canvasRef.current;
          if (!canvas) return null;
          draw();
          return {
            dataUrl: canvas.toDataURL("image/png"),
            crop: { ...cropRef.current },
          };
        },
        getCrop: () => ({ ...cropRef.current }),
      }),
      [draw]
    );

    return (
      <canvas
        ref={canvasRef}
        width={cw}
        height={ch}
        className={className}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          touchAction: editable ? "none" : "auto",
          cursor: editable && imgLoaded ? "grab" : "default",
        }}
        aria-label="Frame preview"
      />
    );
  }
);
