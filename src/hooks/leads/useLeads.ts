import { useCallback, useEffect, useState } from "react";
import type { Lead } from "@/types/lead";
import { getLeads } from "@/services/leads/lead-service";

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLeads();
      setLeads(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel carregar os leads.";
      setError(message);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  return { leads, loading, error, reload: loadLeads };
}

