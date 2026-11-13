import { useState, type ReactNode } from "react";
import {
  currentPlayer,
  mortgageInterest,
  unmortgageCost,
  type GameState,
  type Player,
} from "@monopoly/engine";
import { money, useCanAct, useGame, useOffline } from "../store";
import { useBusy } from "./GameView";

export function ActionArea({ game }: { game: GameState }) {
  const busy = useBusy();
  if (game.phase === "gameOver") return null;
  return (
    <div className="overlay actions">
      {!busy && <MortgageDecisions game={game} />}
      {!busy && <Debts game={game} />}
      {game.phase === "auction" && !busy ? <AuctionPanel game={game} /> : <TurnBar game={game} busy={busy} />}
    </div>
  );
}

function Who({ p }: { p: Player }) {
  return (
    <span className="who">
      <span className="dot" style={{ background: p.color }} />
      {p.name}
    </span>
  );
}

function TurnBar({ game, busy }: { game: GameState; busy: boolean }) {
  const dispatch = useGame((s) => s.dispatch);
  const select = useGame((s) => s.select);
  const canAct = useCanAct();
  const p = currentPlayer(game);
  const blocked = game.debts.length > 0 || game.mortgageDecisions.length > 0;
  const act = (a: Parameters<typeof dispatch>[1]) => dispatch(p.id, a);

  let content: ReactNode = null;
  if (busy) {
    content = <span style={{ color: "var(--muted)" }}>…</span>;
  } else if (p.bankrupt) {
    content = <span>En attente…</span>;
  } else if (!canAct(p.id)) {
    const what: Record<string, string> = {
      order: "lance les dés pour l'ordre de jeu…",
      roll: "lance les dés…",
      buy: `réfléchit à l'achat de ${game.theme.squares[p.position]!.name}…`,
      cardChoice: "choisit : payer ou tirer une carte…",
      end: "termine son tour…",
    };
    content = <span style={{ color: "var(--muted)" }}>{what[game.phase] ?? "joue…"}</span>;
  } else {
    switch (game.phase) {
      case "order":
        content = (
          <>
            <span>Qui commence ? Le plus gros score joue en premier.</span>
            <button className="btn primary big" onClick={() => act({ type: "rollOrder" })} autoFocus>
              🎲 Lancer pour l'ordre
            </button>
          </>
        );
        break;
      case "roll":
        content = p.inJail ? (
          <>
            <span>🔒 En prison (tentative {p.jailAttempts + 1}/3)</span>
            <button className="btn" disabled={blocked || p.cash < game.options.jailFine} onClick={() => act({ type: "payJailFine" })}>
              Payer {money(game, game.options.jailFine)}
            </button>
            {p.jailCards.length > 0 && (
              <button className="btn" disabled={blocked} onClick={() => act({ type: "useJailCard" })}>
                Utiliser la carte 🗝️
              </button>
            )}
            <button className="btn primary" disabled={blocked} onClick={() => act({ type: "roll" })}>
              🎲 Tenter un double
            </button>
          </>
        ) : (
          <button className="btn primary big" disabled={blocked} onClick={() => act({ type: "roll" })} autoFocus>
            🎲 Lancer les dés
          </button>
        );
        break;
      case "buy": {
        const sq = game.theme.squares[p.position]!;
        const price = "price" in sq ? sq.price : 0;
        content = (
          <>
            <span>
              <b>{sq.name}</b> — {money(game, price)}
            </span>
            <button className="btn small ghost" onClick={() => select(p.position)}>
              Voir la fiche
            </button>
            <button className="btn ok" disabled={blocked || p.cash < price} onClick={() => act({ type: "buy" })}>
              Acheter
            </button>
            <button className="btn" disabled={blocked} onClick={() => act({ type: "declineBuy" })}>
              Mettre aux enchères
            </button>
          </>
        );
        break;
      }
      case "cardChoice": {
        const deck = game.pendingCard?.deck === "chance" ? game.theme.chance : game.theme.community;
        const card = game.pendingCard ? deck[game.pendingCard.index] : undefined;
        const amount = card?.effect.type === "payOrDraw" ? card.effect.amount : 0;
        content = (
          <>
            <button className="btn" onClick={() => act({ type: "chooseCard", option: "pay" })}>
              Payer {money(game, amount)}
            </button>
            <button className="btn primary" onClick={() => act({ type: "chooseCard", option: "draw" })}>
              Tirer une carte Chance
            </button>
          </>
        );
        break;
      }
      case "end":
        content = (
          <button className="btn primary big" disabled={blocked} onClick={() => act({ type: "endTurn" })}>
            Terminer le tour ➜
          </button>
        );
        break;
      default:
        content = null;
    }
  }

  return (
    <div className="panel action-bar">
      <Who p={p} />
      {content}
    </div>
  );
}

function Debts({ game }: { game: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const canAct = useCanAct();
  if (game.debts.length === 0) return null;
  return (
    <>
      {game.debts.map((d) => {
        const debtor = game.players.find((p) => p.id === d.debtor)!;
        const creditor = d.creditor ? game.players.find((p) => p.id === d.creditor)?.name : "la banque";
        return (
          <div key={d.id} className="panel notice">
            <Who p={debtor} />
            <span>
              doit <b>{money(game, d.amount)}</b> à {creditor} ({d.reason}) · a {money(game, debtor.cash)}
            </span>
            {canAct(debtor.id) ? (
              <>
                <button className="btn ok" disabled={debtor.cash < d.amount} onClick={() => dispatch(debtor.id, { type: "payDebt", debtId: d.id })}>
                  Payer
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    if (confirm(`${debtor.name} déclare faillite ? C'est définitif.`)) dispatch(debtor.id, { type: "declareBankruptcy" });
                  }}
                >
                  Faire faillite
                </button>
                <span className="hint">
                  Pour trouver de l'argent : cliquez sur vos propriétés pour vendre des maisons ou hypothéquer, ou proposez un échange.
                </span>
              </>
            ) : (
              <span style={{ color: "var(--muted)" }}>cherche de l'argent…</span>
            )}
          </div>
        );
      })}
    </>
  );
}

function MortgageDecisions({ game }: { game: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const canAct = useCanAct();
  if (game.mortgageDecisions.length === 0) return null;
  return (
    <>
      {game.mortgageDecisions.map((d) => {
        const p = game.players.find((pl) => pl.id === d.player)!;
        const sq = game.theme.squares[d.position]!;
        const lift = unmortgageCost(game, d.position);
        const fee = mortgageInterest(game, d.position);
        return (
          <div key={`${d.player}-${d.position}`} className="panel notice">
            <Who p={p} />
            <span>
              reçoit <b>{sq.name}</b> hypothéquée
            </span>
            {canAct(p.id) ? (
              <>
                <button className="btn ok" disabled={p.cash < lift} onClick={() => dispatch(p.id, { type: "resolveMortgage", position: d.position, unmortgage: true })}>
                  Lever l'hypothèque ({money(game, lift)})
                </button>
                <button className="btn" onClick={() => dispatch(p.id, { type: "resolveMortgage", position: d.position, unmortgage: false })}>
                  Garder hypothéquée (10 % : {money(game, fee)})
                </button>
              </>
            ) : (
              <span style={{ color: "var(--muted)" }}>décide…</span>
            )}
          </div>
        );
      })}
    </>
  );
}

function AuctionPanel({ game }: { game: GameState }) {
  const a = game.auction!;
  const sq = game.theme.squares[a.position]!;
  const leader = game.players.find((p) => p.id === a.highestBidder);
  return (
    <div className="panel auction">
      <h3>🔨 Enchères : {sq.name}</h3>
      <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
        Prix affiché : {"price" in sq ? money(game, sq.price) : "—"}. L'enchère se termine quand tous les autres ont passé.
      </div>
      <div className="best">
        {leader ? (
          <>
            Meilleure offre : {money(game, a.highestBid)} par {leader.name}
          </>
        ) : (
          "Aucune offre pour l'instant"
        )}
      </div>
      {a.active.map((id) => (
        <Bidder key={id} game={game} playerId={id} />
      ))}
    </div>
  );
}

function Bidder({ game, playerId }: { game: GameState; playerId: string }) {
  const dispatch = useGame((s) => s.dispatch);
  const canAct = useCanAct();
  const offline = useOffline();
  const mode = useGame((s) => s.mode);
  const a = game.auction!;
  const p = game.players.find((pl) => pl.id === playerId)!;
  const [custom, setCustom] = useState("");
  const leading = a.highestBidder === p.id;
  const bid = (amount: number) => dispatch(p.id, { type: "bid", amount });
  return (
    <div className="bidder">
      <span className="nm">
        <span className="dot" style={{ background: p.color }} />
        {p.name}
      </span>
      <span style={{ color: "var(--muted)", fontSize: "0.8rem", minWidth: 60 }}>{money(game, p.cash)}</span>
      {leading ? (
        <b style={{ color: "var(--ok)" }}>En tête</b>
      ) : !canAct(p.id) ? (
        <>
          <span style={{ color: "var(--muted)" }}>{offline(p.id) ? "hors ligne" : "réfléchit…"}</span>
          {mode === "host" && offline(p.id) && (
            <button className="btn small" onClick={() => dispatch(p.id, { type: "passAuction" })}>
              Passer pour lui
            </button>
          )}
        </>
      ) : (
        <>
          {[1, 10, 50, 100].map((inc) => (
            <button key={inc} className="btn small" disabled={a.highestBid + inc > p.cash} onClick={() => bid(a.highestBid + inc)}>
              +{inc}
            </button>
          ))}
          <input
            type="number"
            placeholder="Montant"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && custom) {
                if (bid(Number(custom))) setCustom("");
              }
            }}
          />
          <button className="btn small ok" disabled={!custom} onClick={() => bid(Number(custom)) && setCustom("")}>
            Offrir
          </button>
          <button className="btn small" onClick={() => dispatch(p.id, { type: "passAuction" })}>
            Passer
          </button>
        </>
      )}
    </div>
  );
}
