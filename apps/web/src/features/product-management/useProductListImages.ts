import { useEffect, useState } from "react";
import { signedMediaUrl } from "./product-media";

/** Batch-sign primary image storage paths for the current product list page. */
export function useProductListImages(paths: Array<string | null | undefined>) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const unique = [...new Set(paths.filter(Boolean))] as string[];
    if (!unique.length) {
      setUrls({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        unique.map(async (path) => {
          const url = await signedMediaUrl(path);
          if (url) next[path] = url;
        }),
      );
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [paths.join("|")]);

  return urls;
}
