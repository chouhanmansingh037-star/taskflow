import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Runs a fetcher whenever its dependencies change, cancelling the previous request,
 * and exposes loading / error state plus a manual reload.
 */
export function useApiData<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetcher(controller.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
        setState((prev) => ({ ...prev, loading: false, error: message }));
      });
    return () => controller.abort();
    // The fetcher closes over `deps`, which are listed explicitly by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { ...state, reload };
}
