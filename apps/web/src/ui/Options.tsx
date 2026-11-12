import { useState } from "react";
import { THEMES, type GameOptions } from "@monopoly/engine";
import { PLAYER_COLORS, TOKENS } from "../tokens";
import type { Profile } from "../net";

/** Réglages de fin de partie et règle maison. */
export function OptionsEditor({
  options,
  onChange,
  readOnly = false,
}: {
  options: Partial<GameOptions>;
  onChange: (o: Partial<GameOptions>) => void;
  readOnly?: boolean;
}) {
  const mode = options.maxRounds ? "rounds" : options.timeLimitMs ? "time" : "bankruptcy";
  const [rounds, setRounds] = useState(options.maxRounds ?? 30);
  const [minutes, setMinutes] = useState(options.timeLimitMs ? Math.round(options.timeLimitMs / 60000) : 60);

  const set = (m: string, r = rounds, min = minutes) =>
    onChange({
      ...options,
      maxRounds: m === "rounds" ? Math.max(1, r) : null,
      timeLimitMs: m === "time" ? Math.max(1, min) * 60_000 : null,
    });

  return (
    <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
      <h2>Fin de partie</h2>
      <div className="options">
        <label>
          <input type="radio" checked={mode === "bankruptcy"} onChange={() => set("bankruptcy")} />
          Classique : jusqu'à ce qu'il ne reste qu'un joueur
        </label>
        <label>
          <input type="radio" checked={mode === "rounds"} onChange={() => set("rounds")} />
          Après
          <input
            type="number"
            min={1}
            value={rounds}
            onChange={(e) => {
              setRounds(Number(e.target.value));
              set("rounds", Number(e.target.value));
            }}
          />
          tours de table (le plus riche gagne)
        </label>
        <label>
          <input type="radio" checked={mode === "time"} onChange={() => set("time")} />
          Après
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => {
              setMinutes(Number(e.target.value));
              set("time", rounds, Number(e.target.value));
            }}
          />
          minutes (le plus riche gagne)
        </label>
      </div>
      <h2>Règle maison</h2>
      <div className="options">
        <label>
          <input
            type="checkbox"
            checked={!!options.freeParkingJackpot}
            onChange={(e) => onChange({ ...options, freeParkingJackpot: e.target.checked })}
          />
          Cagnotte du Parc gratuit (taxes et amendes vont au Parc gratuit)
        </label>
      </div>
    </fieldset>
  );
}

/** Nom, couleur et pion d'un joueur. */
export function ProfileEditor({
  profile,
  onChange,
  takenColors = [],
  label = "Votre pseudo",
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  takenColors?: string[];
  label?: string;
}) {
  return (
    <div className="player-row">
      <input
        type="text"
        value={profile.name}
        placeholder="Pseudo"
        maxLength={16}
        onChange={(e) => onChange({ ...profile, name: e.target.value })}
        aria-label={label}
      />
      <div className="swatches">
        {PLAYER_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`swatch ${profile.color === c.value ? "on" : ""}`}
            style={{ background: c.value }}
            title={c.label}
            disabled={profile.color !== c.value && takenColors.includes(c.value)}
            onClick={() => onChange({ ...profile, color: c.value })}
          />
        ))}
      </div>
      <select value={profile.token} onChange={(e) => onChange({ ...profile, token: e.target.value })} aria-label="Pion">
        {TOKENS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Choix du plateau. */
export function ThemePicker({ value, onChange, readOnly = false }: { value: string | undefined; onChange: (id: string) => void; readOnly?: boolean }) {
  const current = value ?? THEMES[0]!.id;
  return (
    <>
      <h2>Plateau</h2>
      <div className="options">
        {THEMES.map((t) => (
          <label key={t.id}>
            <input type="radio" disabled={readOnly} checked={current === t.id} onChange={() => onChange(t.id)} />
            {t.name}
          </label>
        ))}
      </div>
    </>
  );
}
