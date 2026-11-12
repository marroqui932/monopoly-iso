import type { BoardTheme } from "../types";
import { ajibTheme } from "./3ajib";
import { parisTheme } from "./paris";

/** Plateaux disponibles. Le premier est celui proposé par défaut. */
export const THEMES: BoardTheme[] = [ajibTheme, parisTheme];

export function themeById(id: string | undefined): BoardTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

export { ajibTheme, parisTheme };
