import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";

// The cipher reads CANVA_TOKEN_ENCRYPTION_KEY (via env.ts) at call time, so set a
// valid 32-byte base64 key before importing the module under test.
// (Resolution of "@/" imports and the "server-only" marker is handled by
// scripts/test-hooks.mjs, registered via the test:unit script.)
process.env.CANVA_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const { encryptToken, decryptToken } = await import("./token-cipher.ts");

test("round-trips a token value", () => {
  const secret = "canva_access_token_abc123.def456";
  const encrypted = encryptToken(secret);
  assert.notEqual(encrypted, secret, "ciphertext must differ from plaintext");
  assert.equal(decryptToken(encrypted), secret);
});

test("produces a different ciphertext each time (random IV)", () => {
  const secret = "same-token";
  assert.notEqual(encryptToken(secret), encryptToken(secret));
});

test("rejects tampered ciphertext", () => {
  const encrypted = encryptToken("sensitive");
  const parts = encrypted.split(".");
  // Flip a character in the ciphertext segment.
  const data = parts[2];
  parts[2] = (data[0] === "A" ? "B" : "A") + data.slice(1);
  assert.throws(() => decryptToken(parts.join(".")));
});

test("rejects a malformed payload", () => {
  assert.throws(() => decryptToken("not-a-valid-payload"));
});
