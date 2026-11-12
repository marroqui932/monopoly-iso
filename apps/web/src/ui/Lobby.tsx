import { useState } from "react";
import { MIN_PLAYERS } from "@monopoly/engine";
import { useGame } from "../store";
import { inviteLink } from "../net";
import { TOKENS } from "../tokens";
import { OptionsEditor, ThemePicker } from "./Options";

export function NetBanner() {
  const net = useGame((s) => s.net);
  if (!net || net.kind === "ready") return null;
  const text = net.kind === "connecting" ? "Connexion…" : net.detail;
  return <div className={`net-banner ${net.kind === "failed" ? "bad" : ""}`}>{text}</div>;
}

export function LobbyView() {
  const mode = useGame((s) => s.mode);
  const me = useGame((s) => s.me);
  const lobby = useGame((s) => s.lobby);
  const net = useGame((s) => s.net);
  const rejected = useGame((s) => s.rejected);
  const quit = useGame((s) => s.quit);
  const kick = useGame((s) => s.kick);
  const hostStart = useGame((s) => s.hostStart);
  const setLobbyOptions = useGame((s) => s.setLobbyOptions);
  const setLobbyTheme = useGame((s) => s.setLobbyTheme);
  const [copied, setCopied] = useState(false);

  if (rejected) {
    return (
      <div className="setup">
        <div className="setup-card panel">
          <h1>Oups</h1>
          <p>{rejected}</p>
          <button className="btn primary" onClick={quit}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const isHost = mode === "host";
  const link = lobby ? inviteLink(lobby.code) : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible : le lien reste sélectionnable */
    }
  };

  return (
    <div className="setup">
      <div className="setup-card panel">
        <h1>Salle d'attente</h1>
        {lobby ? (
          <>
            <p className="subtitle">
              Code de la salle : <span className="room-code">{lobby.code}</span>
            </p>
            <div className="invite">
              <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Lien d'invitation" />
              <button className="btn" onClick={copy}>
                {copied ? "Copié ✓" : "Copier le lien"}
              </button>
            </div>
            <h2>
              Joueurs ({lobby.players.length}/6)
            </h2>
            {lobby.players.map((p) => (
              <div key={p.id} className="lobby-player">
                <span className="dot" style={{ background: p.color, width: 16, height: 16 }} />
                <b>{p.name}</b>
                <span style={{ color: "var(--muted)" }}>{TOKENS.find((t) => t.id === p.token)?.label}</span>
                {p.host && <span className="tag">hôte</span>}
                {p.id === me && <span className="tag">vous</span>}
                {!p.online && <span className="tag off">hors ligne</span>}
                {isHost && !p.host && (
                  <button className="btn small ghost" style={{ marginLeft: "auto" }} onClick={() => kick(p.id)}>
                    Retirer
                  </button>
                )}
              </div>
            ))}
            <ThemePicker value={lobby.themeId} onChange={setLobbyTheme} readOnly={!isHost} />
            <OptionsEditor options={lobby.options} onChange={setLobbyOptions} readOnly={!isHost} />
            <div className="setup-actions">
              <button className="btn" onClick={quit}>
                Quitter
              </button>
              {isHost ? (
                <button className="btn primary big" disabled={lobby.players.length < MIN_PLAYERS} onClick={hostStart}>
                  {lobby.players.length < MIN_PLAYERS ? "En attente d'autres joueurs…" : "Lancer la partie"}
                </button>
              ) : (
                <span style={{ alignSelf: "center", color: "var(--muted)" }}>L'hôte va lancer la partie…</span>
              )}
            </div>
          </>
        ) : (
          <>
            <p>{net?.kind === "reconnecting" || net?.kind === "failed" ? net.detail : "Connexion à la salle…"}</p>
            <button className="btn" onClick={quit}>
              Annuler
            </button>
          </>
        )}
      </div>
      <NetBanner />
    </div>
  );
}
