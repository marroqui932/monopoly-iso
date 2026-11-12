// Médias perso (sons et images) d'un plateau.
//
// Ils se trouvent dans public/media/<id du plateau>/, décrits par un fichier
// medias.json (voir le README de ce dossier). Tout est facultatif : sans fichier,
// le jeu garde ses sons synthétisés et ses décors 3D.

import { create } from "zustand";
import type { BoardTheme, DeckName } from "@monopoly/engine";
import type { SoundName } from "./sound";

/** Un fichier, ou une liste de fichiers (un est tiré au hasard à chaque fois). */
type OneOrMany = string | string[];

export interface MediaManifest {
  sons?: Partial<Record<SoundName, OneOrMany>> & {
    /** Son joué quand un pion arrive sur une case (clé : numéro de case 0-39 ou nom de la case). */
    cases?: Record<string, OneOrMany>;
  };
  images?: {
    /** Image d'une case (clé : numéro 0-39 ou nom de la case). */
    cases?: Record<string, string>;
    /** Image d'une carte Chance (clé : numéro de la carte, à partir de 1). */
    chance?: Record<string, string>;
    /** Image d'une carte Caisse de communauté (clé : numéro de la carte, à partir de 1). */
    communaute?: Record<string, string>;
  };
}

interface Resolved {
  themeId: string | null;
  /** Sons par événement : URLs. */
  sounds: Partial<Record<SoundName, string[]>>;
  /** Sons d'arrivée sur une case, par position. */
  squareSounds: Record<number, string[]>;
  squareImages: Record<number, string>;
  cardImages: Record<DeckName, Record<number, string>>;
}

const EMPTY: Resolved = { themeId: null, sounds: {}, squareSounds: {}, squareImages: {}, cardImages: { chance: {}, community: {} } };

export const useMedia = create<Resolved>(() => EMPTY);

const list = (v: OneOrMany | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** « 24 », « Casino d'Enghien » ou « casino-denghien » → position de la case. */
function findSquare(theme: BoardTheme, key: string): number | null {
  if (/^\d+$/.test(key.trim())) {
    const n = Number(key);
    return n >= 0 && n < theme.squares.length ? n : null;
  }
  const k = norm(key);
  const i = theme.squares.findIndex((sq) => norm(sq.name) === k);
  return i >= 0 ? i : null;
}

const loading = new Map<string, Promise<void>>();

/** Charge les médias du plateau (une seule fois). */
export function loadMedia(theme: BoardTheme): Promise<void> {
  const existing = loading.get(theme.id);
  if (existing) return existing;
  const base = `${import.meta.env.BASE_URL}media/${theme.id}/`;
  const p = fetch(`${base}medias.json`, { cache: "no-cache" })
    .then((r) => (r.ok ? (r.json() as Promise<MediaManifest>) : null))
    .catch(() => null)
    .then((m) => {
      if (!m) {
        useMedia.setState({ ...EMPTY, themeId: theme.id });
        return;
      }
      const url = (file: string) => (/^https?:\/\//.test(file) ? file : base + file);
      const sounds: Resolved["sounds"] = {};
      const squareSounds: Resolved["squareSounds"] = {};
      for (const [key, value] of Object.entries(m.sons ?? {})) {
        if (key === "cases") {
          for (const [sqKey, files] of Object.entries(value as Record<string, OneOrMany>)) {
            const pos = findSquare(theme, sqKey);
            if (pos !== null) squareSounds[pos] = list(files).map(url);
            else console.warn(`[médias] case inconnue pour un son : « ${sqKey} »`);
          }
        } else {
          sounds[key as SoundName] = list(value as OneOrMany).map(url);
        }
      }
      const squareImages: Resolved["squareImages"] = {};
      for (const [sqKey, file] of Object.entries(m.images?.cases ?? {})) {
        const pos = findSquare(theme, sqKey);
        if (pos !== null) squareImages[pos] = url(file);
        else console.warn(`[médias] case inconnue pour une image : « ${sqKey} »`);
      }
      const cards = (rec: Record<string, string> | undefined) => {
        const out: Record<number, string> = {};
        for (const [n, file] of Object.entries(rec ?? {})) out[Number(n) - 1] = url(file);
        return out;
      };
      useMedia.setState({
        themeId: theme.id,
        sounds,
        squareSounds,
        squareImages,
        cardImages: { chance: cards(m.images?.chance), community: cards(m.images?.communaute) },
      });
    });
  loading.set(theme.id, p);
  return p;
}
