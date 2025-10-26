type NumericEnv = string | number | undefined;

const coerceNumber = (value: NumericEnv, fallback: number): number => {
  if (value === undefined || value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const appLayoutConfig = {
  defaultWidth: coerceNumber(import.meta.env.VITE_APP_DEFAULT_WIDTH, 1200),
  defaultHeight: coerceNumber(import.meta.env.VITE_APP_DEFAULT_HEIGHT, 800),
  fullscreenBreakpoint: coerceNumber(import.meta.env.VITE_APP_FULLSCREEN_BREAKPOINT, 1400),
  containerPaddingTopVH: coerceNumber(import.meta.env.VITE_APP_CONTAINER_PADDING_TOP, 4),
};

export const historyConfig = {
  limit: coerceNumber(import.meta.env.VITE_APP_HISTORY_LIMIT, 10),
};

export function isFullscreenViewport(width?: number): boolean {
  const currentWidth =
    typeof width === "number"
      ? width
      : typeof window !== "undefined"
      ? window.innerWidth
      : appLayoutConfig.defaultWidth;
  return currentWidth >= appLayoutConfig.fullscreenBreakpoint;
}
