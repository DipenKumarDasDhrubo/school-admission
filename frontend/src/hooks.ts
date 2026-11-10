import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText, serverNow } from './api';

const STORAGE_KEY = 'studentId';

/** The student id survives page refresh and browser restarts (localStorage). */
export function useStudentId(): [string, (id: string) => void] {
  const [id, setId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const save = useCallback((next: string) => {
    setId(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable: keep it in memory only */
    }
  }, []);
  return [id, save];
}

/** Current server-adjusted time in ms, re-rendering every `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => serverNow());
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export interface Polled<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/** Calls `fn` immediately and then every `ms`. Keeps the last good data if a refresh fails. */
export function usePolling<T>(fn: () => Promise<T>, ms: number, deps: unknown[], enabled = true): Polled<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const result = await fnRef.current();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    const t = setInterval(run, ms);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, enabled, tick, ...deps]);

  return { data, error, loading, refresh };
}
