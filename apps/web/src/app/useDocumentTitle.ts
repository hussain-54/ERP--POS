import { useEffect } from "react";
import { APP_NAME } from "@/branding";

/** Sets the browser tab title; restores APP_NAME on unmount when page-specific. */
export function useDocumentTitle(pageTitle?: string | null) {
  useEffect(() => {
    const previous = document.title;
    document.title = pageTitle?.trim() ? `${pageTitle.trim()} · ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = previous;
    };
  }, [pageTitle]);
}
