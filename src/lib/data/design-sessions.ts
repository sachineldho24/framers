import { createClient } from "@/lib/supabase/server";
import type { DesignSession, DesignSource } from "@/lib/supabase/types";

/** Create a working design session for the current user. */
export async function createDesignSession(input: {
  userId: string;
  designSource: DesignSource;
  frameId?: string | null;
}): Promise<DesignSession> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("design_sessions")
    .insert({
      user_id: input.userId,
      design_source: input.designSource,
      frame_id: input.frameId ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create design session: ${error.message}`);
  return data;
}

/** Load a session owned by the current user (RLS-enforced). */
export async function getDesignSession(
  id: string
): Promise<DesignSession | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("design_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load design session: ${error.message}`);
  return data;
}

export interface DesignSessionPatch {
  frame_id?: string | null;
  frame_style_id?: string | null;
  finish_id?: string | null;
  upload_path?: string | null;
  canva_design_id?: string | null;
  mockup_path?: string | null;
  crop_x?: number;
  crop_y?: number;
  crop_scale?: number;
}

/** Update fields on a session (RLS restricts to the owner). */
export async function updateDesignSession(
  id: string,
  patch: DesignSessionPatch
): Promise<DesignSession | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("design_sessions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Failed to update design session: ${error.message}`);
  return data;
}
