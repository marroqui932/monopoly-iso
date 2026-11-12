import { create } from "zustand";

const KEY = "monopoly-iso:reglages";

export interface Settings {
  /** Vue isométrique (3D) ou vue de dessus (plateau à plat, comme en vrai). */
  view: "iso" | "top";
  /** Décors 3D sur les cases. */
  decor: boolean;
  /** Ombres (plus joli, plus gourmand). */
  shadows: boolean;
  /** Effets de lumière (halo des néons, vignettage). */
  effects: boolean;
}

function load(): Settings {
  const lite = new URLSearchParams(window.location.search).has("lite");
  const defaults: Settings = { view: "iso", decor: true, shadows: !lite, effects: !lite };
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Settings>) };
  } catch {
    return defaults;
  }
}

export const useSettings = create<Settings & { set(patch: Partial<Settings>): void }>((set, get) => ({
  ...load(),
  set(patch) {
    set(patch);
    const { view, decor, shadows, effects } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ view, decor, shadows, effects }));
    } catch {
      /* rien */
    }
  },
}));
