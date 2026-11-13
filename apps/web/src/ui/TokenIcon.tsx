// Silhouette du pion de chaque joueur (mêmes formes que les pions 3D).

export function TokenIcon({ token, size = 22 }: { token: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "#fff", "aria-hidden": true } as const;
  switch (token) {
    case "hat":
      return (
        <svg {...common}>
          <rect x="7.5" y="4" width="9" height="12" rx="1.2" />
          <rect x="3" y="16" width="18" height="3.2" rx="1.6" />
          <rect x="7.5" y="12.5" width="9" height="1.6" fill="rgba(0,0,0,0.25)" />
        </svg>
      );
    case "cube":
      return (
        <svg {...common}>
          <path d="M12 2.5 21 7.5v9L12 21.5 3 16.5v-9z" />
          <path d="M12 12 21 7.5 12 2.5 3 7.5z" fill="rgba(255,255,255,0.75)" />
          <path d="M12 12v9.5L3 16.5v-9z" fill="rgba(0,0,0,0.18)" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <path d="M12 1.5 19.5 12 12 22.5 4.5 12z" />
          <path d="M12 1.5 19.5 12H4.5z" fill="rgba(255,255,255,0.75)" />
        </svg>
      );
    case "ring":
      return (
        <svg {...common} fill="none" stroke="#fff" strokeWidth="3.6">
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
    case "ball":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="9" cy="9" r="2.6" fill="rgba(255,255,255,0.55)" />
        </svg>
      );
    default:
      // Pion classique
      return (
        <svg {...common}>
          <circle cx="12" cy="6.5" r="4" />
          <path d="M8.5 21h7l-1.6-9.5h-3.8z" />
          <rect x="6" y="19.2" width="12" height="2.8" rx="1.4" />
        </svg>
      );
  }
}
