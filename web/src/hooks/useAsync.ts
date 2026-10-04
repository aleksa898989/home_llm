import { useCallback, useEffect, useState } from "react";

type Result<T> = { data?: T; error?: Error };

export function useAsync<T>(load: () => Promise<T>) {
  const [result, setResult] = useState<Result<T>>({});

  const run = useCallback(
    () =>
      load().then(
        (data) => ({ data }),
        (error: Error) => ({ error }),
      ),
    [load],
  );

  useEffect(() => {
    let active = true;
    void run().then((r) => active && setResult(r));
    return () => {
      active = false;
    };
  }, [run]);

  const reload = useCallback(async () => setResult(await run()), [run]);

  return { ...result, reload };
}
