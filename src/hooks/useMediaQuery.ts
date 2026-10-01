import { useEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export type LayoutMode = "mobile" | "tablet" | "desktop";

export function useLayoutMode(): LayoutMode {
  const isDesktop = useMediaQuery("(min-width: 1100px)");
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1099px)");
  if (isDesktop) return "desktop";
  if (isTablet) return "tablet";
  return "mobile";
}
