import { useEffect, useMemo, useState } from "react";
import { MAX_PLAYERS, MIN_PLAYERS, type GameOptions } from "@monopoly/engine";
import { loadHostSave, loadProfile, loadSaved, saveProfile, useGame } from "../store";
import { normalizeCode, type Profile } from "../net";
import { PLAYER_COLORS, TOKENS } from "../tokens";
import { OptionsEditor, ProfileEditor, ThemePicker } from "./Options";
import { MenuScene } from "../scene/Scene";

const DEFAULT_NAMES = ["Joueur 1", "Joueur 2", "Joueur 3", "Joueur 4", "Joueur 5", "Joueur 6"];

export function Setup() {
  const roomFromUrl = useMemo(() => normalizeCode(new URLSearchParams(window.location.search).get("salle") ?? ""), []);
  const [tab, setTab] = useState<"online" | "local">("online");

  return (
    <div className="setup">
      <div className="menu-backdrop">
        <MenuScene />
      </div>
      <div className="setup-card panel">
        <h1 className="logo">
          <span className="word">Monopoly</span>
          <span className="edition">3ajib Edition</span>
        </h1>
        <div className="tabs">
          <button className={`tab ${tab === "online" ? "on" : ""}`} onClick={() => setTab("online")}>
            🌐 En ligne
          </button>
          <button className={`tab ${tab === "local" ? "on" : ""}`} onClick={() => setTab("local")}>
            🖥️ Sur cet écran
          </button>
        </div>
        {tab === "online" ? <OnlineSetup initialCode={roomFromUrl} /> : <LocalSetup />}
      </div>
    </div>
  );
}

function OnlineSetup({ initialCode }: { initialCode: string }) {
  const hostRoom = useGame((s) => s.hostRoom);
  const resumeHost = useGame((s) => s.resumeHost);
  const joinRoom = useGame((s) => s.joinRoom);
  const hostSave = useMemo(() => loadHostSave(), []);
  const [profile, setProfile] = useState<Profile>(() => {
    const { name, color, token } = loadProfile();
    return { name, color, token };
  });
  const [code, setCode] = useState(initialCode || loadProfile().lastRoom || "");
  const nameOk = profile.name.trim().length > 0;

  // Page rechargée en pleine partie : on revient directement dans la salle.
  useEffect(() => {
    const p = loadProfile();
    if (initialCode && p.name && p.lastRoom === initialCode) joinRoom(initialCode, { name: p.name, color: p.color, token: p.token });
  }, [initialCode, joinRoom]);

  const update = (p: Profile) => {
    setProfile(p);
    saveProfile(p);
  };

  return (
    <>
      <h2>Votre joueur</h2>
      <ProfileEditor profile={profile} onChange={update} />
      {!nameOk && <p className="hint-text">Choisissez un pseudo pour continuer.</p>}

      <div className="online-grid">
        <div className="online-box">
          <h3>Rejoindre une salle</h3>
          <p className="hint-text">Entrez le code envoyé par votre pote.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="code-input"
              value={code}
              placeholder="CODE"
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && nameOk && code.length === 5 && joinRoom(code, { ...profile, name: profile.name.trim() })}
              aria-label="Code de la salle"
              autoFocus={!!initialCode}
            />
            <button
              className="btn primary"
              disabled={!nameOk || code.length !== 5}
              onClick={() => joinRoom(code, { ...profile, name: profile.name.trim() })}
            >
              Rejoindre
            </button>
          </div>
        </div>
        <div className="online-box">
          <h3>Créer une salle</h3>
          <p className="hint-text">Votre navigateur héberge la partie : gardez cet onglet ouvert pendant le jeu.</p>
          <button className="btn primary" disabled={!nameOk} onClick={() => hostRoom({ ...profile, name: profile.name.trim() })}>
            Créer une salle
          </button>
          {hostSave && (
            <button className="btn" style={{ marginTop: 8 }} onClick={() => resumeHost()}>
              Rouvrir la salle {hostSave.code}
              {hostSave.game ? " (partie en cours)" : ""}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

interface Row {
  name: string;
  color: string;
  token: string;
}

function LocalSetup() {
  const startGame = useGame((s) => s.startGame);
  const resumeSaved = useGame((s) => s.resumeSaved);
  const saved = useMemo(() => loadSaved(), []);
  const [rows, setRows] = useState<Row[]>(() =>
    [0, 1, 2].map((i) => ({ name: DEFAULT_NAMES[i]!, color: PLAYER_COLORS[i]!.value, token: TOKENS[i]!.id })),
  );
  const [options, setOptions] = useState<Partial<GameOptions>>({});
  const [themeId, setThemeId] = useState<string | undefined>(undefined);

  const addPlayer = () => {
    if (rows.length >= MAX_PLAYERS) return;
    const color = PLAYER_COLORS.find((c) => !rows.some((r) => r.color === c.value))!.value;
    const token = TOKENS.find((t) => !rows.some((r) => r.token === t.id))?.id ?? "pawn";
    setRows([...rows, { name: DEFAULT_NAMES[rows.length]!, color, token }]);
  };

  const start = () =>
    startGame(
      rows.map((r, i) => ({ id: `j${i + 1}`, name: r.name.trim() || DEFAULT_NAMES[i]!, color: r.color, token: r.token })),
      options,
      themeId,
    );

  return (
    <>
      <h2>Joueurs ({rows.length}/{MAX_PLAYERS})</h2>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ flex: 1 }}>
            <ProfileEditor
              profile={row}
              label={`Nom du joueur ${i + 1}`}
              takenColors={rows.filter((_, j) => j !== i).map((r) => r.color)}
              onChange={(p) => setRows((r) => r.map((x, j) => (j === i ? p : x)))}
            />
          </div>
          <button className="btn small ghost" disabled={rows.length <= MIN_PLAYERS} onClick={() => setRows(rows.filter((_, j) => j !== i))} title="Retirer">
            ✕
          </button>
        </div>
      ))}
      <button className="btn small" style={{ marginTop: 10 }} onClick={addPlayer} disabled={rows.length >= MAX_PLAYERS}>
        + Ajouter un joueur
      </button>
      <ThemePicker value={themeId} onChange={setThemeId} />
      <OptionsEditor options={options} onChange={setOptions} />
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
    </>
  );
}
