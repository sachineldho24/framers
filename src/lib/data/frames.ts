import { createClient } from "@/lib/supabase/server";
import type { Frame } from "@/lib/supabase/types";

/** All active frames for the storefront, in display order. */
export async function getActiveFrames(): Promise<Frame[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("frames")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load frames: ${error.message}`);
  }
  return data ?? [];
}

/** A single active frame by slug, or null if not found. */
export async function getFrameBySlug(slug: string): Promise<Frame | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("frames")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load frame "${slug}": ${error.message}`);
  }
  return data;
}

/** A single frame by id (any active state) — used server-side for pricing. */
export async function getFrameById(id: string): Promise<Frame | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("frames")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load frame ${id}: ${error.message}`);
  }
  return data;
}
