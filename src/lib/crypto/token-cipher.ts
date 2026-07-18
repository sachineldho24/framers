import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Application-level encryption for Canva OAuth tokens at rest.
 *
 * Canva's security guidelines require user access/refresh tokens to be encrypted
 * before storage (disk-level encryption from the DB provider is not sufficient on
 * its own). We use AES-256-GCM, which is authenticated: decryption fails if the
 * ciphertext (or IV/tag) has been tampered with.
 *
 * Wire format (all base64url, joined by "."):  iv . authTag . ciphertext
 *   - iv:      12 random bytes (GCM standard nonce size)
 *   - authTag: 16 bytes (GCM tag)
 *   - ciphertext: the encrypted UTF-8 token
 *
 * Key: CANVA_TOKEN_ENCRYPTION_KEY — 32 bytes, base64-encoded. Generate with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function getKey(): Buffer {
  const raw = serverEnv.canvaTokenEncryptionKey;
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `CANVA_TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }
  return key;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/** Encrypt a plaintext token for storage. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [b64url(iv), b64url(authTag), b64url(ciphertext)].join(".");
}

/**
 * Decrypt a stored token. Throws if the payload is malformed or fails the
 * authentication check (wrong key or tampered data). Callers that read
 * possibly-legacy rows should catch and treat failure as "no valid token".
 */
export function decryptToken(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted token payload");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = fromB64url(ivB64);
  const authTag = fromB64url(tagB64);
  const ciphertext = fromB64url(dataB64);

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
