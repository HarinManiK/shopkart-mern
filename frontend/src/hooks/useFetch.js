import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs `fetcher(signal)` whenever `key` changes and exposes loading / error / data.
 *
 * - `key` is a string describing the request (e.g. the query params). Change it to refetch.
 * - Loading is *derived* (the stored result belongs to an older key), so there is no
 *   synchronous setState inside the effect.
 * - The in-flight request is aborted when the key changes or the component unmounts,
 *   so a slow stale response can never overwrite a newer one.
 */
export default function useFetch(key, fetcher) {
  const [result, setResult] = useState({ key: null });
  const [reloadCount, setReloadCount] = useState(0);
  const fullKey = `${key}#${reloadCount}`;

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    const controller = new AbortController();
    fetcherRef
      .current(controller.signal)
      .then((data) => setResult({ key: fullKey, data }))
      .catch((error) => {
        if (error.code !== 'ERR_CANCELED') setResult({ key: fullKey, error });
      });
    return () => controller.abort();
  }, [fullKey]);

  const reload = useCallback(() => setReloadCount((c) => c + 1), []);
  // Lets pages update the loaded data locally after a successful mutation.
  const setData = useCallback(
    (updater) => setResult((r) => (r.key === null || r.error ? r : { ...r, data: updater(r.data) })),
    []
  );

  const settled = result.key === fullKey;
  return {
    loading: !settled,
    data: settled ? result.data : undefined,
    error: settled ? result.error : undefined,
    reload,
    setData
  };
}
