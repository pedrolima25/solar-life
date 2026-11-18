"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useApi<T = any>(path: string | null, initial?: T) {
  const [data, setData] = useState<T | undefined>(initial);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, loading, error, reload };
}

export type Ref = { id: string; name: string };
