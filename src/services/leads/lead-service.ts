import { supabase } from "@/lib/supabase";
import type { Prospect } from "@/types/database";
import type { Lead } from "@/types/lead";
import { prospectToLead } from "@/services/leads/lead-adapter";

export async function getLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as Prospect[]).map(prospectToLead);
}

