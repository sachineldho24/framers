"use client";

/**
 * Client boundary for the studio.
 *
 * Two jobs the shell shouldn't own: deciding what document to open with, and
 * knowing how this app stores things. Opening is async — a saved document may
 * be on the server or only in this browser — so the shell is mounted once we
 * have an answer, keyed by nothing and never remounted afterwards.
 *
 * With no saved document we seed one from the session's upload, filling the
 * page. That's the first-run path from `upload → size → frame → edit`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  SessionUploadError,
  uploadSessionFiles,
} from "@/lib/session-upload";
import {
  createDocument,
  createImageLayer,
  type StudioDocument,
} from "@/lib/studio/document";
import { coverBox } from "@/lib/studio/geometry";
import { loadDocument, saveDocument } from "@/lib/studio/persistence";
import { createSessionResolver } from "@/lib/studio/useStudioImages";

import { Icon } from "@/components/Icon";
import { StudioShell, type StudioShellUpload } from "./StudioShell";
import type { FrameSizeOption } from "./StudioTopBar";
import { pickAndUploadImage } from "./uploadImage";
import { listLibrary, removeFromLibrary } from "@/lib/uploadLibrary";

/** Don't hold the editor closed on a slow library: open, list what came. */
const LIBRARY_WAIT_MS = 4000;

/** Same wording wherever a lapsed sign-in surfaces — the fix is not a retry. */
const SIGNED_OUT =
  "You’ve been signed out. Sign in again in another tab, then press Done.";

export interface StudioLoaderProps {
  sessionId: string;
  page: { width: number; height: number };
  title: string;
  uploadPath: string | null;
  uploadUrl: string | null;
  userInitial: string;
  isAdmin?: boolean;
  sizes: FrameSizeOption[];
  /** `null` when the studio was opened before a frame was chosen. */
  currentSizeId: string | null;
}

/** Decode just enough of an image to know its natural size. */
function measure(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read the image."));
    img.src = url;
  });
}

export function StudioLoader({
  sessionId,
  page,
  title,
  uploadPath,
  uploadUrl,
  userInitial,
  isAdmin = false,
  sizes,
  currentSizeId,
}: StudioLoaderProps) {
  const router = useRouter();
  const [initial, setInitial] = useState<StudioDocument | null>(null);
  const [failed, setFailed] = useState(false);

  // Stable for the life of the session. `useStudioImages` keys its effect on
  // the document's sources rather than on this, and a new resolver identity
  // would mean re-signing every image.
  const resolveSrc = useMemo(() => createSessionResolver(sessionId), [sessionId]);

  // The session's own upload is the entry the Uploads panel starts with.
  // Derived rather than stored: `StudioShell` copies it into its own state and
  // owns everything added afterwards, so a second source of truth here would
  // only be able to disagree.
  //
  // After it, the user's photo library — every photo they've uploaded for any
  // design — so a picture used once is there to reuse without uploading again.
  const [library, setLibrary] = useState<StudioShellUpload[] | null>(null);
  const uploads = useMemo<StudioShellUpload[]>(() => {
    const own = uploadPath && uploadUrl ? [{ src: uploadPath, name: "Your photo", url: uploadUrl }] : [];
    return [...own, ...(library ?? []).filter((entry) => entry.src !== uploadPath)];
  }, [uploadPath, uploadUrl, library]);

  useEffect(() => {
    let cancelled = false;
    const give = (entries: StudioShellUpload[]) => {
      if (!cancelled) setLibrary(entries);
    };
    // Open without it after a while; a late answer still lands (the shell
    // merges uploads that arrive after it mounted).
    const timer = setTimeout(() => {
      if (!cancelled) setLibrary((current) => current ?? []);
    }, LIBRARY_WAIT_MS);
    void (async () => {
      try {
        const rows = await listLibrary();
        const urls = rows.length ? await resolveSrc(rows.map((r) => r.path)) : {};
        give(
          rows
            .filter((r) => urls[r.path])
            .map((r) => ({
              src: r.path,
              name: r.name,
              url: urls[r.path],
              naturalWidth: r.width,
              naturalHeight: r.height,
            }))
        );
      } catch {
        give([]);
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [resolveSrc]);

  useEffect(() => {
    let cancelled = false;

    async function open() {
      try {
        const restored = await loadDocument(sessionId);
        if (cancelled) return;
        if (restored) {
          setInitial(restored.document);
        } else {
          setInitial(await seed());
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    /** First run: place the session's upload on a blank page, filling it. */
    async function seed(): Promise<StudioDocument> {
      const doc = createDocument({
        width: page.width,
        height: page.height,
        title,
      });
      if (!uploadPath) return doc;

      const url = uploadUrl ?? (await resolveSrc([uploadPath]))[uploadPath];
      if (!url) return doc;

      const natural = await measure(url);
      // Cover, not contain. Every preview before this point — size, frame,
      // review — shows the photo filling the frame's opening, so opening the
      // editor letterboxed would both contradict what was promised and print a
      // white margin inside the moulding. The overflow is clipped to the page,
      // and anyone who wants a band has the Border tool for a deliberate one.
      const box = coverBox(
        page.width,
        page.height,
        natural.width,
        natural.height
      );
      doc.layers.push(
        createImageLayer({
          src: uploadPath,
          naturalWidth: natural.width,
          naturalHeight: natural.height,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          name: "Your photo",
        })
      );
      return doc;
    }

    void open();
    return () => {
      cancelled = true;
    };
  }, [sessionId, page.width, page.height, title, uploadPath, uploadUrl, resolveSrc]);

  /* --------------------------------------------------------------- callbacks */

  const persist = useCallback(
    async (doc: StudioDocument) => {
      const where = await saveDocument(sessionId, doc);
      return where === "server";
    },
    [sessionId]
  );

  const onPickImage = useCallback(async () => {
    return pickAndUploadImage();
  }, []);

  const onResize = useCallback(
    (size: FrameSizeOption) => {
      // Changing size changes the frame, which is session state, not document
      // state — so it goes back through the session route and reloads.
      void fetch(`/api/design/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameId: size.id }),
      }).then(() => router.refresh());
    },
    [sessionId, router]
  );

  const onDone = useCallback(
    async ({
      doc,
      print,
      thumbnail,
    }: {
      doc: StudioDocument;
      print: Blob;
      thumbnail: Blob;
    }) => {
      // The artwork goes browser → Storage under a signed token; only the
      // document JSON is small enough to send through a route handler.
      // `uploadSessionFiles` throws with copy worth showing.
      try {
        await uploadSessionFiles(sessionId, { print, thumb: thumbnail });
      } catch (e) {
        if (e instanceof SessionUploadError && e.signedOut) {
          throw new Error(SIGNED_OUT);
        }
        throw e;
      }

      const response = await fetch(`/api/design/session/${sessionId}/flatten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: doc }),
      });
      if (!response.ok) {
        // 401 here means the auth session lapsed mid-edit, not that anything is
        // wrong with the artwork — worth saying, because the fix is different.
        throw new Error(
          response.status === 401
            ? SIGNED_OUT
            : "Your artwork couldn’t be saved. Check your connection and press Done again."
        );
      }
      router.push(`/design/${sessionId}/review`);
    },
    [sessionId, router]
  );

  if (failed) {
    return (
      <div className="studio-root flex h-screen flex-col items-center justify-center gap-3 bg-[var(--studio-canvas-bg)] px-6 text-center">
        <Icon name="error" className="text-[32px] text-[var(--studio-ink-muted)]" />
        <p className="text-[14px] font-semibold text-[var(--studio-ink)]">
          The editor couldn&apos;t open this design
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          data-r="full"
          className="bg-[#16161a] px-4 py-2 text-[13px] font-medium text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!initial || library === null) {
    return (
      <div
        role="status"
        className="studio-root flex h-screen flex-col items-center justify-center gap-3 bg-[var(--studio-canvas-bg)]"
      >
        <Icon
          name="progress_activity"
          className="animate-spin text-[28px] text-[var(--studio-ink-muted)] motion-reduce:animate-none"
        />
        <p className="text-[13px] text-[var(--studio-ink-muted)]">
          Opening the editor…
        </p>
      </div>
    );
  }

  return (
    <StudioShell
      initialDocument={initial}
      userInitial={userInitial}
      isAdmin={isAdmin}
      sizes={sizes}
      currentSizeId={currentSizeId}
      uploads={uploads}
      resolveSrc={resolveSrc}
      onPickImage={onPickImage}
      onRemoveUpload={removeFromLibrary}
      persist={persist}
      onDone={onDone}
      onResize={onResize}
    />
  );
}
