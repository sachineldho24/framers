import { createClient } from "@/lib/supabase/server";
import type { FrameStyle } from "@/lib/supabase/types";

/** All active frame styles, in display order. */
export async function getActiveFrameStyles(): Promise<FrameStyle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("frame_styles")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Failed to load frame styles: ${error.message}`);
  return data ?? [];
}

/** A single frame style by id — used server-side for pricing. */
export async function getFrameStyleById(
  id: string
): Promise<FrameStyle | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("frame_styles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load frame style ${id}: ${error.message}`);
  return data;
}
