"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Eye, X } from "lucide-react";
import { GALLERY_ROOMS } from "@/lib/gallery/manifest";
import { wheelDistance } from "@/lib/gallery/navigation";
import type { GalleryRuntime } from "@/lib/gallery/runtime";
import styles from "./GalleryClient.module.css";

export function GalleryClient() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<GalleryRuntime | null>(null);
  const pin = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const position = useRef(0);
  const reduced = useRef(false);
  const imageGesture = useRef<{ id: number; y: number } | null>(null);
  const imageWheel = useRef(0);
  const lastImageStep = useRef(0);
  const [mode, setMode] = useState<"pending" | "3d" | "images">("pending");
  const [ready, setReady] = useState(false);
  const [roomIndex, setRoomIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const room = GALLERY_ROOMS[roomIndex];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = media.matches;
    try {
      const saved = Number(sessionStorage.getItem("framers_gallery_progress"));
      if (Number.isFinite(saved) && saved >= 0 && saved <= 1) position.current = saved;
    } catch { /* Storage is optional. */ }
    const initial = GALLERY_ROOMS.reduce((best, r, i) => Math.abs(r.stop - position.current) < Math.abs(GALLERY_ROOMS[best].stop - position.current) ? i : best, 0);
    setRoomIndex(initial);
    setMode(media.matches ? "images" : "3d");
    function preferenceChanged() {
      reduced.current = media.matches;
      if (media.matches) setMode("images");
    }
    media.addEventListener("change", preferenceChanged);
    return () => media.removeEventListener("change", preferenceChanged);
  }, []);

  useEffect(() => {
    if (mode !== "3d" || !canvas.current) return;
    let cancelled = false;
    const element = canvas.current;
    setReady(false);
    // The renderer and Three.js are fetched only after entering this route.
    void import("@/lib/gallery/runtime").then(({ createGalleryRuntime }) => {
      if (cancelled) return;
      runtime.current = createGalleryRuntime(element, {
        ready() { if (!cancelled) setReady(true); },
        room(index) { if (!cancelled) setRoomIndex(index); },
        error(error) {
          if (cancelled) return;
          console.error("Gallery could not start", error);
          setMode("images");
        },
        frame(value, anchor) {
          position.current = value;
          if (pin.current) {
            pin.current.style.transform = `translate(${anchor.x}px, ${anchor.y}px) translate(-50%, -50%)`;
            pin.current.hidden = !anchor.visible;
          }
        },
      }, position.current, reduced.current);
    }).catch(error => {
      if (!cancelled) { console.error(error); setMode("images"); }
    });
    return () => {
      cancelled = true;
      try { sessionStorage.setItem("framers_gallery_progress", String(position.current)); } catch { /* Storage is optional. */ }
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, [mode]);

  function goTo(index: number) {
    const next = Math.max(0, Math.min(GALLERY_ROOMS.length - 1, index));
    if (mode === "3d" && runtime.current && ready) runtime.current.goTo(next);
    else {
      position.current = GALLERY_ROOMS[next].stop;
      setRoomIndex(next);
    }
  }

  function openArtwork() {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    runtime.current?.pause();
    setSelected(roomIndex);
  }

  const closeArtwork = useCallback(() => {
    setSelected(null);
    runtime.current?.resume();
    opener.current?.focus();
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (selected !== null && !element.open) element.showModal();
    if (selected === null && element.open) element.close();
  }, [selected]);

  const detail = selected === null ? room : GALLERY_ROOMS[selected];
  const showImage = mode !== "3d" || !ready;

  return (
    <main className={styles.gallery} aria-label="Framers room gallery">
      <div className={styles.stage}>
        {/* Plain images keep the server-rendered fallback independent of WebGL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.backdrop} src={room.image} alt={`Framed artwork in the ${room.title.toLowerCase()} room`} fetchPriority="high" style={{ opacity: showImage ? 1 : 0 }} />
        <canvas key={mode} ref={canvas} className={styles.canvas} style={{ opacity: mode === "images" || !showImage ? 1 : 0 }} aria-label="Room tour. Scroll or swipe to travel, use arrow keys to change rooms, or press Enter for artwork details." tabIndex={mode === "pending" || (mode === "3d" && !ready) ? -1 : 0}
          onKeyDown={event => {
            if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown") { event.preventDefault(); goTo(roomIndex + 1); }
            if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") { event.preventDefault(); goTo(roomIndex - 1); }
            if (event.key === "Home") { event.preventDefault(); goTo(0); }
            if (event.key === "End") { event.preventDefault(); goTo(5); }
            if (event.key === "Enter") { event.preventDefault(); openArtwork(); }
          }}
          onWheel={event => {
            if (mode !== "images" || selected !== null) return;
            if (event.ctrlKey || performance.now() - lastImageStep.current < 350) return;
            imageWheel.current += wheelDistance(event.deltaY, event.deltaMode, event.currentTarget.clientHeight);
            if (Math.abs(imageWheel.current) < 100) return;
            goTo(roomIndex + Math.sign(imageWheel.current));
            imageWheel.current = 0;
            lastImageStep.current = performance.now();
          }}
          onPointerDown={event => {
            if (mode !== "images" || selected !== null || event.button !== 0) return;
            imageGesture.current = { id: event.pointerId, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={event => {
            const gesture = imageGesture.current;
            imageGesture.current = null;
            if (mode !== "images" || selected !== null || gesture?.id !== event.pointerId) return;
            const distance = gesture.y - event.clientY;
            if (Math.abs(distance) >= 40) goTo(roomIndex + Math.sign(distance));
          }}
          onPointerCancel={() => { imageGesture.current = null; }} />
        <button ref={pin} hidden={mode !== "images"} className={`${styles.pin} ${mode === "images" ? styles.imagePin : ""}`} type="button" onClick={openArtwork} aria-label={`Open artwork details for the ${room.title.toLowerCase()} room`} style={{ visibility: showImage && mode !== "images" ? "hidden" : "visible", transform: mode === "images" ? "none" : undefined }}>
          <Eye size={25} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      <dialog ref={dialog} className={styles.dialog} aria-labelledby="gallery-artwork-title" onCancel={closeArtwork} onClose={closeArtwork}>
        <div className={styles.dialogHeader}><span>THE GALLERY / {detail.title.toUpperCase()}</span><button type="button" onClick={closeArtwork} aria-label="Close artwork details" autoFocus><X size={22} /></button></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {selected !== null && <img className={styles.artImage} src={detail.artwork} alt={`Artwork displayed in the ${detail.title.toLowerCase()} room`} />}
        <div className={styles.dialogBody}>
          <p className={styles.eyebrow}>FRAMING INSPIRATION</p>
          <h2 id="gallery-artwork-title">{detail.headline}</h2>
          <p>{detail.description}</p>
          <div className={styles.detailNote}>Make it personal. Upload your own photo or artwork, then choose your size, frame, and finish.</div>
          <Link href="/design/start" className={styles.designerLink}>Create your own frame <ArrowUpRight size={20} aria-hidden="true" /></Link>
          <button type="button" className={styles.continueButton} onClick={closeArtwork}>Continue exploring</button>
        </div>
      </dialog>
      <noscript><p className={styles.noScript}>Explore the room photograph above, or <a href="/design/start">create your own frame</a>. Enable JavaScript for the interactive tour.</p></noscript>
    </main>
  );
}
