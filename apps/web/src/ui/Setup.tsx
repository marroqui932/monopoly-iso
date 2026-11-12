import { useMemo, useState } from "react";
import { MAX_PLAYERS, MIN_PLAYERS, type GameOptions } from "@monopoly/engine";
import { loadSaved, useGame } from "../store";
import { PLAYER_COLORS, TOKENS } from "../tokens";

interface Row {
  name: string;
  color: string;
  token: string;
}

const DEFAULT_NAMES = ["Joueur 1", "Joueur 2", "Joueur 3", "Joueur 4", "Joueur 5", "Joueur 6"];

type EndMode = "bankruptcy" | "rounds" | "time";

export function Setup() {
  const startGame = useGame((s) => s.startGame);
  const resumeSaved = useGame((s) => s.resumeSaved);
  const saved = useMemo(() => loadSaved(), []);

  const [rows, setRows] = useState<Row[]>(() =>
    [0, 1, 2].map((i) => ({ name: DEFAULT_NAMES[i]!, color: PLAYER_COLORS[i]!.value, token: TOKENS[i]!.id })),
  );
  const [endMode, setEndMode] = useState<EndMode>("bankruptcy");
  const [rounds, setRounds] = useState(30);
  const [minutes, setMinutes] = useState(60);
  const [jackpot, setJackpot] = useState(false);

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const addPlayer = () => {
    if (rows.length >= MAX_PLAYERS) return;
    const color = PLAYER_COLORS.find((c) => !rows.some((r) => r.color === c.value))!.value;
    const token = TOKENS.find((t) => !rows.some((r) => r.token === t.id))?.id ?? "pawn";
    setRows([...rows, { name: DEFAULT_NAMES[rows.length]!, color, token }]);
  };

  const start = () => {
    const options: Partial<GameOptions> = {
      freeParkingJackpot: jackpot,
      maxRounds: endMode === "rounds" ? Math.max(1, rounds) : null,
      timeLimitMs: endMode === "time" ? Math.max(1, minutes) * 60_000 : null,
    };
    startGame(
      rows.map((r, i) => ({ id: `j${i + 1}`, name: r.name.trim() || DEFAULT_NAMES[i]!, color: r.color, token: r.token })),
      options,
    );
  };

  return (
    <div className="setup">
      <div className="setup-card panel">
        <h1>MONOPOLY</h1>
        <p className="subtitle">entre potes · partie locale sur cet écran (le jeu en ligne arrive bientôt)</p>

        <h2>Joueurs ({rows.length}/{MAX_PLAYERS})</h2>
        {rows.map((row, i) => (
          <div className="player-row" key={i}>
            <input type="text" value={row.name} maxLength={16} onChange={(e) => update(i, { name: e.target.value })} aria-label={`Nom du joueur ${i + 1}`} />
            <div className="swatches">
              {PLAYER_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={`swatch ${row.color === c.value ? "on" : ""}`}
                  style={{ background: c.value }}
                  title={c.label}
                  disabled={row.color !== c.value && rows.some((r) => r.color === c.value)}
                  onClick={() => update(i, { color: c.value })}
                />
              ))}
            </div>
            <select value={row.token} onChange={(e) => update(i, { token: e.target.value })} aria-label="Pion">
              {TOKENS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button className="btn small ghost" disabled={rows.length <= MIN_PLAYERS} onClick={() => setRows(rows.filter((_, j) => j !== i))} title="Retirer">
              ✕
            </button>
          </div>
        ))}
        <button className="btn small" style={{ marginTop: 10 }} onClick={addPlayer} disabled={rows.length >= MAX_PLAYERS}>
          + Ajouter un joueur
        </button>

        <h2>Fin de partie</h2>
        <div className="options">
          <label>
            <input type="radio" checked={endMode === "bankruptcy"} onChange={() => setEndMode("bankruptcy")} />
            Classique : jusqu'à ce qu'il ne reste qu'un joueur
          </label>
          <label>
            <input type="radio" checked={endMode === "rounds"} onChange={() => setEndMode("rounds")} />
            Après
            <input type="number" min={1} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} onFocus={() => setEndMode("rounds")} />
            tours de table (le plus riche gagne)
          </label>
          <label>
            <input type="radio" checked={endMode === "time"} onChange={() => setEndMode("time")} />
            Après
            <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} onFocus={() => setEndMode("time")} />
            minutes (le plus riche gagne)
          </label>
        </div>

        <h2>Règle maison</h2>
        <div className="options">
          <label>
            <input type="checkbox" checked={jackpot} onChange={(e) => setJackpot(e.target.checked)} />
            Cagnotte du Parc gratuit (taxes et amendes vont au Parc gratuit)
          </label>
        </div>

        <div className="setup-actions">
          {saved && (
            <button className="btn big" onClick={() => resumeSaved()}>
              Reprendre la partie en cours
            </button>
          )}
          <button className="btn primary big" onClick={start}>
            Lancer la partie
          </button>
        </div>
      </div>
    </div>
  );
}
