import { useState, useEffect, useCallback } from "react";
import api from "@/services/api";
import type { SentinelReport } from "@/services/api";

function useApiCall<T>(fn: () => Promise<{ data?: T; error?: string; status: number }>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(() => {
    setLoading(true);
    setError(null);
    fn()
      .then((res) => {
        if (res.error) setError(res.error);
        else if (res.data !== undefined) setData(res.data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Erro");
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { call(); }, [call]);
  return { data, loading, error, refetch: call };
}

export function useHealth() {
  return useApiCall(api.health);
}

export function useSentinelScan() {
  const [data, setData] = useState<SentinelReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.sentinelScan();
    if (res.error) setError(res.error);
    else setData((res.data as SentinelReport) ?? null);
    setLoading(false);
  }, []);

  return { data, loading, error, refetch };
}

export function useAuthHealth() {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.authHealth()
      .then((res) => { if (res.data) setData(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
