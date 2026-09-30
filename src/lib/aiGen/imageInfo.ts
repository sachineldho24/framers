/**
 * What an image file is and how big, from its first bytes — enough to store a
 * provider's result with the right type and size without decoding it (the
 * server has no image library, and doesn't need one for this).
 */

export interface ImageInfo {
  mime: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  width: number;
  height: number;
}

export const EXTENSION_FOR: Record<ImageInfo["mime"], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function u16be(b: Uint8Array, i: number) {
  return (b[i] << 8) | b[i + 1];
}
function u16le(b: Uint8Array, i: number) {
  return b[i] | (b[i + 1] << 8);
}
function u24le(b: Uint8Array, i: number) {
  return b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
}
function u32be(b: Uint8Array, i: number) {
  return ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
}

/** Null when the bytes aren't a PNG, JPEG, WebP or GIF we can measure. */
export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  const b = bytes;
  if (b.length < 24) return null;

  // PNG: signature, then the IHDR chunk.
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { mime: "image/png", width: u32be(b, 16), height: u32be(b, 20) };
  }

  // GIF: logical screen size.
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { mime: "image/gif", width: u16le(b, 6), height: u16le(b, 8) };
  }

  // WebP: RIFF....WEBP, then VP8 / VP8L / VP8X.
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === "VP8X" && b.length >= 30) {
      return { mime: "image/webp", width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
    }
    if (chunk === "VP8 " && b.length >= 30) {
      return { mime: "image/webp", width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
    }
    if (chunk === "VP8L" && b.length >= 25) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { mime: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }

  // JPEG: walk the markers to the first start-of-frame.
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xff) {
        i++;
        continue;
      }
      // Standalone markers carry no length.
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const length = u16be(b, i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { mime: "image/jpeg", height: u16be(b, i + 5), width: u16be(b, i + 7) };
      i += 2 + length;
    }
    return null;
  }

  return null;
}
