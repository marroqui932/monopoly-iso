import { useEffect, useRef, useState } from "react";
import { currentPlayer, netWorth, type GameState } from "@monopoly/engine";
import { Scene } from "../scene/Scene";
import { money, useGame, useOffline } from "../store";
import { NetBanner } from "./Lobby";
import { nowSec } from "../anim";
import { isMuted, setMuted } from "../sound";
import { useSettings } from "../settings";
import { TOKENS } from "../tokens";
import { ActionArea } from "./Actions";
import { Deed } from "./Deed";
import { TradeList, TradeModal } from "./Trade";

/** Vrai tant que les animations (dés, pions) ne sont pas finies. */
export function useBusy(): boolean {
  const busyUntil = useGame((s) => s.busyUntil);
  const [, force] = useState(0);
  const busy = nowSec() < busyUntil;
  useEffect(() => {
    if (!busy) return;
    const id = setTimeout(() => force((n) => n + 1), (busyUntil - nowSec()) * 1000 + 30);
    return () => clearTimeout(id);
  }, [busy, busyUntil]);
  return busy;
}

export function GameView({ game }: { game: GameState }) {
  const [quarter, setQuarter] = useState(0);
  const [showLog, setShowLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const selected = useGame((s) => s.selected);
  const tradeOpen = useGame((s) => s.tradeOpen);
  const setTradeOpen = useGame((s) => s.setTradeOpen);
  const quit = useGame((s) => s.quit);
  const mode = useGame((s) => s.mode);
  const lobby = useGame((s) => s.lobby);
  const me = useGame((s) => s.me);
  const tradeAllowed = canTrade(game, mode === "local" ? null : me);

  return (
    <div className="game">
      <NetBanner />
      <Scene game={game} quarter={quarter} />

      <div className="overlay topbar panel">
        <button className="btn small ghost" title="Tourner le plateau" onClick={() => setQuarter((q) => (q + 3) % 4)}>
          ⟲
        </button>
        <button className="btn small ghost" title="Tourner le plateau" onClick={() => setQuarter((q) => (q + 1) % 4)}>
          ⟳
        </button>
        <span className="round">
          Tour {game.round}
          {game.options.maxRounds ? ` / ${game.options.maxRounds}` : ""}
          {game.options.freeParkingJackpot ? ` · Cagnotte : ${money(game, game.freeParkingPot)}` : ""}
          {` · Banque : ${game.bank.houses} 🏠 ${game.bank.hotels} 🏨`}
        </span>
        <TimeLeft game={game} />
        {lobby && mode !== "local" && <span className="round">Salle {lobby.code}</span>}
        <button
          className="btn small"
          onClick={() => setTradeOpen(true)}
          disabled={!tradeAllowed}
          title={tradeAllowed ? "" : "On ne peut proposer un échange que pendant son tour"}
        >
          🤝 Échanger
        </button>
        <button className={`btn small ${showLog ? "" : "ghost"}`} title="Journal de la partie" onClick={() => setShowLog((v) => !v)}>
          📜
        </button>
        <button className={`btn small ${showSettings ? "" : "ghost"}`} title="Affichage" onClick={() => setShowSettings((v) => !v)}>
          ⚙️
        </button>
        <button
          className="btn small ghost"
          title={muted ? "Activer le son" : "Couper le son"}
          onClick={() => {
            setMuted(!muted);
            setMutedState(!muted);
          }}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button
          className="btn small ghost"
          onClick={() => {
            const msg =
              mode === "host"
                ? "Quitter ? La partie sera en pause pour tout le monde. Vous pourrez rouvrir la salle depuis l'accueil."
                : mode === "client"
                  ? "Quitter la salle ? Vous pourrez revenir avec le même code."
                  : "Revenir au menu ? La partie reste sauvegardée sur cet appareil.";
            if (confirm(msg)) quit();
          }}
        >
          Menu
        </button>
      </div>

      <Players game={game} />
      {showSettings && <DisplaySettings onClose={() => setShowSettings(false)} />}

      <div className="overlay side">
        {selected !== null && <Deed game={game} position={selected} />}
        <TradeList game={game} />
        {showLog && <Log game={game} />}
      </div>

      <Notifications />
      <ActionArea game={game} />

      {tradeOpen && <TradeModal game={game} onClose={() => setTradeOpen(false)} />}
      <CardPopupView game={game} />
      {game.phase === "gameOver" && <GameOver game={game} />}
    </div>
  );
}

function DisplaySettings({ onClose }: { onClose: () => void }) {
  const { view, decor, shadows, set } = useSettings();
  return (
    <div className="overlay settings panel">
      <div className="settings-head">
        <b>Affichage</b>
        <button className="btn small ghost" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </div>
      <div className="seg">
        <button className={view === "iso" ? "on" : ""} onClick={() => set({ view: "iso" })}>
          🧊 Vue 3D
        </button>
        <button className={view === "top" ? "on" : ""} onClick={() => set({ view: "top" })}>
          ⬛ Vue de dessus
        </button>
      </div>
      <label>
        <input type="checkbox" checked={decor} onChange={(e) => set({ decor: e.target.checked })} />
        Décors 3D sur les cases
      </label>
      <label>
        <input type="checkbox" checked={shadows} onChange={(e) => set({ shadows: e.target.checked })} />
        Ombres (désactiver si ça rame)
      </label>
    </div>
  );
}

/** Peut-on ouvrir la fenêtre d'échange ? (à son tour, ou endetté) */
export function canTrade(game: GameState, me: string | null): boolean {
  if (game.phase === "gameOver") return false;
  const cur = currentPlayer(game);
  if (me === null) return !cur.bankrupt || game.debts.length > 0;
  const mine = game.players.find((p) => p.id === me);
  if (!mine || mine.bankrupt) return false;
  return cur.id === me || game.debts.some((d) => d.debtor === me);
}

function TimeLeft({ game }: { game: GameState }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!game.options.timeLimitMs) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [game.options.timeLimitMs]);
  if (!game.options.timeLimitMs) return null;
  const left = Math.max(0, game.startedAt + game.options.timeLimitMs - Date.now());
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return <span className="round">⏱ {m}:{String(s).padStart(2, "0")}</span>;
}

function Players({ game }: { game: GameState }) {
  const select = useGame((s) => s.select);
  const offline = useOffline();
  const mode = useGame((s) => s.mode);
  const me = useGame((s) => s.me);
  const dispatch = useGame((s) => s.dispatch);
  return (
    <div className="overlay players">
      {game.players.map((p, i) => {
        const owned = Object.entries(game.properties)
          .filter(([, prop]) => prop.owner === p.id)
          .map(([pos]) => Number(pos));
        return (
          <div
            key={p.id}
            className={`panel player-card ${i === game.currentPlayer && game.phase !== "gameOver" ? "current" : ""} ${p.bankrupt ? "bankrupt" : ""}`}
            style={{ borderLeftColor: p.color }}
          >
            <div className="name">
              <span>
                {p.name}
                {p.id === me && <span style={{ color: "var(--muted)", fontWeight: 500 }}> (vous)</span>}
              </span>
              <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: "0.8rem" }}>
                {TOKENS.find((t) => t.id === p.token)?.label}
              </span>
            </div>
            <div className="cash">{p.bankrupt ? "Faillite" : money(game, p.cash)}</div>
            {!p.bankrupt && offline(p.id) && (
              <div className="offline">
                ● hors ligne
                {mode === "host" && game.phase !== "gameOver" && (
                  <button
                    className="btn small ghost"
                    onClick={() => {
                      if (confirm(`Faire abandonner ${p.name} ? Ses propriétés seront remises aux enchères.`)) dispatch(p.id, { type: "forfeit" });
                    }}
                  >
                    Faire abandonner
                  </button>
                )}
              </div>
            )}
            {!p.bankrupt && (p.inJail || p.jailCards.length > 0) && (
              <div className="meta">
                {p.inJail && <span>🔒 En prison</span>}
                {p.jailCards.length > 0 && <span>🗝️ Libéré de prison ×{p.jailCards.length}</span>}
              </div>
            )}
            {owned.length > 0 && <OwnedColumns game={game} playerId={p.id} onSelect={select} />}
          </div>
        );
      })}
    </div>
  );
}

const GROUP_ORDER = ["brown", "lightblue", "pink", "orange", "red", "yellow", "green", "darkblue", "railroad", "utility"] as const;

/** Propriétés d'un joueur rangées en colonnes par groupe : les cases vides montrent ce qui manque. */
function OwnedColumns({ game, playerId, onSelect }: { game: GameState; playerId: string; onSelect: (pos: number) => void }) {
  const columns = GROUP_ORDER.map((group) => {
    const positions: number[] = [];
    game.theme.squares.forEach((sq, i) => {
      if ((sq.kind === "street" && sq.group === group) || sq.kind === group) positions.push(i);
    });
    const color =
      group === "railroad" ? "#343a40" : group === "utility" ? "#8d99ae" : game.theme.groupColors[group];
    return { group, positions, color };
  });

  return (
    <div className="owned">
      {columns.map(({ group, positions, color }) => {
        const full = positions.every((pos) => game.properties[pos]?.owner === playerId);
        return (
          <div key={group} className={`owned-col ${full ? "full" : ""}`} title={full ? "Groupe complet !" : ""}>
            {positions.map((pos) => {
              const prop = game.properties[pos]!;
              const mine = prop.owner === playerId;
              const sq = game.theme.squares[pos]!;
              return (
                <button
                  key={pos}
                  className={`slot ${mine ? "mine" : ""} ${mine && prop.mortgaged ? "mortgaged" : ""}`}
                  style={mine ? { background: color } : { borderColor: color }}
                  title={`${sq.name}${mine ? (prop.mortgaged ? " (hypothéquée)" : "") : " (pas à lui)"}`}
                  onClick={() => onSelect(pos)}
                >
                  {mine && prop.houses > 0 && <span className="houses">{prop.houses === 5 ? "H" : prop.houses}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Log({ game }: { game: GameState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [game.logCounter]);
  return (
    <div className="panel log" ref={ref}>
      <h3>Journal</h3>
      {game.log.slice(-40).map((l) => (
        <p key={l.n}>{l.text}</p>
      ))}
    </div>
  );
}

function CardPopupView({ game }: { game: GameState }) {
  const card = useGame((s) => s.card);
  const closeCard = useGame((s) => s.closeCard);
  const [, force] = useState(0);
  const wait = card ? card.showAt - nowSec() : 0;
  useEffect(() => {
    if (!card || wait <= 0) return;
    const id = setTimeout(() => force((n) => n + 1), wait * 1000 + 20);
    return () => clearTimeout(id);
  }, [card, wait]);
  if (!card || wait > 0) return null;
  const who = game.players.find((p) => p.id === card.player);
  const isChance = card.deck === "chance";
  return (
    <div className="modal-bg" onClick={closeCard}>
      <div className="panel card-popup" style={{ borderTopColor: isChance ? "#f4a259" : "#7fb7e6" }} onClick={(e) => e.stopPropagation()}>
        <div className="deck" style={{ color: isChance ? "#e76f51" : "#3a86ff" }}>
          {isChance ? "CHANCE" : "CAISSE DE COMMUNAUTÉ"}
        </div>
        <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{who?.name} tire une carte</div>
        <CardText text={card.text} />
        <button className="btn primary" onClick={closeCard} autoFocus>
          OK
        </button>
      </div>
    </div>
  );
}

/** « Titre : texte » → titre en gros, si le titre est court. */
function CardText({ text }: { text: string }) {
  const i = text.indexOf(" : ");
  if (i > 0 && i <= 20) {
    return (
      <>
        <div className="card-title">{text.slice(0, i)}</div>
        <p>{text.slice(i + 3)}</p>
      </>
    );
  }
  return <p>{text}</p>;
}

const NOTE_DURATION = 3.2;

/** Notifications au centre de l'écran. */
function Notifications() {
  const notes = useGame((s) => s.notes);
  const [, force] = useState(0);
  const now = nowSec();
  const visible = notes.filter((n) => n.showAt <= now && now < n.showAt + NOTE_DURATION).slice(-4);
  const pending = notes.some((n) => now < n.showAt + NOTE_DURATION);
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => force((x) => x + 1), 200);
    return () => clearTimeout(id);
  });
  if (visible.length === 0) return null;
  return (
    <div className="notes">
      {visible.map((n) => (
        <div key={n.id} className={`note ${n.kind}`} style={{ animationDuration: `${NOTE_DURATION}s` }}>
          {n.color && <span className="dot" style={{ background: n.color }} />}
          {n.text}
        </div>
      ))}
    </div>
  );
}

function GameOver({ game }: { game: GameState }) {
  const quit = useGame((s) => s.quit);
  const winner = game.players.find((p) => p.id === game.winner);
  const ranking = [...game.players].sort((a, b) => netWorth(game, b.id) - netWorth(game, a.id));
  return (
    <div className="modal-bg">
      <div className="panel modal gameover">
        <h2>🏆 {winner ? `${winner.name} gagne !` : "Fin de la partie"}</h2>
        <p style={{ color: "var(--muted)" }}>Raison : {game.endReason}</p>
        <ol>
          {ranking.map((p) => (
            <li key={p.id}>
              <span className="dot" style={{ background: p.color }} /> {p.name} —{" "}
              {p.bankrupt ? "faillite" : money(game, netWorth(game, p.id))}
            </li>
          ))}
        </ol>
        <button className="btn primary big" onClick={quit}>
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
}
