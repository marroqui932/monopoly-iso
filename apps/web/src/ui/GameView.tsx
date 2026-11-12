import { useEffect, useRef, useState } from "react";
import { netWorth, type GameState } from "@monopoly/engine";
import { Scene } from "../scene/Scene";
import { money, useGame } from "../store";
import { nowSec } from "../anim";
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
  const selected = useGame((s) => s.selected);
  const tradeOpen = useGame((s) => s.tradeOpen);
  const setTradeOpen = useGame((s) => s.setTradeOpen);
  const quit = useGame((s) => s.quit);

  return (
    <div className="game">
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
        <button className="btn small" onClick={() => setTradeOpen(true)} disabled={game.phase === "gameOver"}>
          🤝 Échanger
        </button>
        <button
          className="btn small ghost"
          onClick={() => {
            if (confirm("Revenir au menu ? La partie reste sauvegardée sur cet appareil.")) quit();
          }}
        >
          Menu
        </button>
      </div>

      <Players game={game} />

      <div className="overlay side">
        {selected !== null && <Deed game={game} position={selected} />}
        <TradeList game={game} />
        <Log game={game} />
      </div>

      <ActionArea game={game} />

      {tradeOpen && <TradeModal game={game} onClose={() => setTradeOpen(false)} />}
      <CardPopupView game={game} />
      <ErrorToast />
      {game.phase === "gameOver" && <GameOver game={game} />}
    </div>
  );
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
              <span>{p.name}</span>
              <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: "0.8rem" }}>
                {TOKENS.find((t) => t.id === p.token)?.label}
              </span>
            </div>
            <div className="cash">{p.bankrupt ? "Faillite" : money(game, p.cash)}</div>
            {!p.bankrupt && (
              <div className="meta">
                {p.inJail && <span>🔒 En prison</span>}
                {p.jailCards.length > 0 && <span>🗝️ ×{p.jailCards.length}</span>}
                <span>Patrimoine {money(game, netWorth(game, p.id))}</span>
              </div>
            )}
            {owned.length > 0 && (
              <div className="chips">
                {owned.map((pos) => {
                  const sq = game.theme.squares[pos]!;
                  const color = sq.kind === "street" ? game.theme.groupColors[sq.group] : sq.kind === "railroad" ? "#343a40" : "#adb5bd";
                  return (
                    <span
                      key={pos}
                      className={`chip ${game.properties[pos]!.mortgaged ? "mortgaged" : ""}`}
                      style={{ background: color }}
                      title={sq.name}
                      onClick={() => select(pos)}
                    />
                  );
                })}
              </div>
            )}
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
        <p>{card.text}</p>
        <button className="btn primary" onClick={closeCard} autoFocus>
          OK
        </button>
      </div>
    </div>
  );
}

function ErrorToast() {
  const error = useGame((s) => s.error);
  const clear = useGame((s) => s.clearError);
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(clear, 3500);
    return () => clearTimeout(id);
  }, [error, clear]);
  if (!error) return null;
  return (
    <div className="toast" onClick={clear}>
      ⚠️ {error.text}
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
          Nouvelle partie
        </button>
      </div>
    </div>
  );
}
