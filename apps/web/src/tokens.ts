export const PLAYER_COLORS = [
  { value: "#e63946", label: "Rouge" },
  { value: "#3a86ff", label: "Bleu" },
  { value: "#2a9d8f", label: "Vert" },
  { value: "#ffb703", label: "Jaune" },
  { value: "#9b5de5", label: "Violet" },
  { value: "#fb8500", label: "Orange" },
  { value: "#f15bb5", label: "Rose" },
  { value: "#212529", label: "Noir" },
];

export const TOKENS = [
  { id: "pawn", label: "Pion" },
  { id: "hat", label: "Chapeau" },
  { id: "cube", label: "Cube" },
  { id: "diamond", label: "Diamant" },
  { id: "ring", label: "Anneau" },
  { id: "ball", label: "Boule" },
] as const;

export type TokenId = (typeof TOKENS)[number]["id"];
