import { createClient } from "@/lib/supabase/server";
import type { Finish } from "@/lib/supabase/types";

/** All active finishes, in display order. */
export async function getActiveFinishes(): Promise<Finish[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finishes")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Failed to load finishes: ${error.message}`);
  return data ?? [];
}

/** A single finish by id — used server-side for pricing. */
export async function getFinishById(id: string): Promise<Finish | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finishes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load finish ${id}: ${error.message}`);
  return data;
}
