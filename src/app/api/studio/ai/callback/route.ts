/**
 * POST /api/studio/ai/callback — Kie.ai requires a callback URL on every task.
 * We poll for results instead, so this only acknowledges the call. It reads
 * nothing and changes nothing.
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true });
}
