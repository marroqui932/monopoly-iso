import { useEffect, useState } from "react";
import { currentPlayer, groupHasBuildings, mortgageValue, type GameState, type Player, type TradeSide } from "@monopoly/engine";
import { money, useCanAct, useGame } from "../store";

const empty = (): TradeSide => ({ cash: 0, properties: [], jailCards: 0 });

export function TradeModal({ game, onClose }: { game: GameState; onClose: () => void }) {
  const dispatch = useGame((s) => s.dispatch);
  const me = useGame((s) => s.me);
  const alive = game.players.filter((p) => !p.bankrupt);
  // Peut proposer : le joueur dont c'est le tour, ou un joueur endetté.
  const proposers = alive.filter((p) => p.id === currentPlayer(game).id || game.debts.some((d) => d.debtor === p.id));
  const [fromId, setFromId] = useState(me ?? proposers[0]?.id ?? alive[0]!.id);
  const [toId, setToId] = useState(alive.find((p) => p.id !== fromId)!.id);
  const [give, setGive] = useState<TradeSide>(empty);
  const [take, setTake] = useState<TradeSide>(empty);

  const from = game.players.find((p) => p.id === fromId)!;
  const to = game.players.find((p) => p.id === toId)!;

  // En ligne : les autres voient l'échange se construire en direct.
  const setMyDraft = useGame((s) => s.setMyDraft);
  useEffect(() => {
    const id = setTimeout(() => setMyDraft({ to: toId, give, take }), 120);
    return () => clearTimeout(id);
  }, [toId, give, take, setMyDraft]);
  useEffect(() => () => setMyDraft(null), [setMyDraft]);

  const changeFrom = (id: string) => {
    setFromId(id);
    setGive(empty());
    if (id === toId) {
      setToId(alive.find((p) => p.id !== id)!.id);
      setTake(empty());
    }
  };

  const propose = () => {
    if (dispatch(fromId, { type: "proposeTrade", to: toId, give, take })) onClose();
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="panel modal" onClick={(e) => e.stopPropagation()}>
        <h2>🤝 Proposer un échange</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          {me ? (
            <b>Vous</b>
          ) : (
            <select value={fromId} onChange={(e) => changeFrom(e.target.value)} aria-label="Qui propose">
              {proposers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <span>{me ? "proposez à" : "propose à"}</span>
          <select
            value={toId}
            onChange={(e) => {
              setToId(e.target.value);
              setTake(empty());
            }}
            aria-label="À qui"
          >
            {alive
              .filter((p) => p.id !== fromId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        <div className="trade-cols">
          <SideEditor game={game} owner={from} title={`${from.name} donne`} side={give} onChange={setGive} />
          <SideEditor game={game} owner={to} title={`${from.name} demande à ${to.name}`} side={take} onChange={setTake} />
        </div>
        <div className="setup-actions">
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn primary" onClick={propose}>
            Envoyer la proposition
          </button>
        </div>
      </div>
    </div>
  );
}

function SideEditor({
  game,
  owner,
  title,
  side,
  onChange,
}: {
  game: GameState;
  owner: Player;
  title: string;
  side: TradeSide;
  onChange: (s: TradeSide) => void;
}) {
  const owned = Object.entries(game.properties)
    .filter(([, prop]) => prop.owner === owner.id)
    .map(([pos]) => Number(pos));
  const toggle = (pos: number) =>
    onChange({
      ...side,
      properties: side.properties.includes(pos) ? side.properties.filter((p) => p !== pos) : [...side.properties, pos],
    });
  return (
    <div className="trade-col">
      <h4>
        <span className="dot" style={{ background: owner.color }} />
        {title}
      </h4>
      <label>
        Argent
        <input
          type="number"
          min={0}
          max={owner.cash}
          value={side.cash || ""}
          placeholder="0"
          onChange={(e) => onChange({ ...side, cash: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
        />
        <span style={{ color: "var(--muted)" }}>/ {money(game, owner.cash)}</span>
      </label>
      {owner.jailCards.length > 0 && (
        <label>
          Cartes « Libéré de prison »
          <input
            type="number"
            min={0}
            max={owner.jailCards.length}
            value={side.jailCards || ""}
            placeholder="0"
            onChange={(e) => onChange({ ...side, jailCards: Math.max(0, Math.min(owner.jailCards.length, Math.floor(Number(e.target.value) || 0))) })}
          />
        </label>
      )}
      {owned.length === 0 && <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Aucune propriété.</div>}
      {owned.map((pos) => {
        const sq = game.theme.squares[pos]!;
        const built = groupHasBuildings(game, pos);
        const color = sq.kind === "street" ? game.theme.groupColors[sq.group] : "#6c757d";
        return (
          <label key={pos} title={built ? "Vendez d'abord les constructions du groupe" : ""} style={{ opacity: built ? 0.45 : 1 }}>
            <input type="checkbox" disabled={built} checked={side.properties.includes(pos)} onChange={() => toggle(pos)} />
            <span className="dot" style={{ background: color, borderRadius: 3 }} />
            <span style={{ flex: 1 }}>
              {sq.name}
              {game.properties[pos]!.mortgaged && <b style={{ color: "#c92a2a" }}> · hypothéquée</b>}
            </span>
            <span className="trade-val" title="Prix d'achat · valeur hypothécaire">
              {"price" in sq ? money(game, sq.price) : ""} · hyp. {money(game, mortgageValue(game, pos))}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function describe(game: GameState, side: TradeSide): string {
  const parts: string[] = [];
  if (side.cash > 0) parts.push(money(game, side.cash));
  for (const pos of side.properties) {
    const hyp = game.properties[pos]?.mortgaged ? "hypothéquée, " : "";
    parts.push(`${game.theme.squares[pos]!.name} (${hyp}hyp. ${money(game, mortgageValue(game, pos))})`);
  }
  if (side.jailCards > 0) parts.push(`${side.jailCards} carte(s) prison`);
  return parts.length ? parts.join(", ") : "rien";
}

export function TradeList({ game }: { game: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const me = useGame((s) => s.me);
  const canAct = useCanAct();
  if (game.trades.length === 0) return null;
  return (
    <div className="panel trade-list">
      <h3>Échanges proposés</h3>
      {game.trades.map((t) => {
        const from = game.players.find((p) => p.id === t.from)!;
        const to = game.players.find((p) => p.id === t.to)!;
        return (
          <div key={t.id} className="trade-item">
            <b>{from.name}</b> → <b>{to.name}</b>
            <div>Donne : {describe(game, t.give)}</div>
            <div>Demande : {describe(game, t.take)}</div>
            <div className="btns">
              {canAct(to.id) && (
                <>
                  <button className="btn small ok" onClick={() => dispatch(to.id, { type: "acceptTrade", tradeId: t.id })}>
                    {me ? "Accepter" : `${to.name} accepte`}
                  </button>
                  <button className="btn small" onClick={() => dispatch(to.id, { type: "rejectTrade", tradeId: t.id })}>
                    Refuser
                  </button>
                </>
              )}
              {canAct(from.id) && (
                <button className="btn small ghost" onClick={() => dispatch(from.id, { type: "cancelTrade", tradeId: t.id })}>
                  Retirer
                </button>
              )}
              {!canAct(to.id) && !canAct(from.id) && <span style={{ color: "var(--muted)" }}>En attente de {to.name}…</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Les échanges que les autres sont en train de préparer, visibles en direct. */
export function TradeDrafts({ game }: { game: GameState }) {
  const drafts = useGame((s) => s.drafts);
  const me = useGame((s) => s.me);
  const entries = Object.entries(drafts).filter(([from]) => from !== me);
  if (entries.length === 0) return null;
  return (
    <div className="panel trade-list drafting">
      {entries.map(([fromId, d]) => {
        const from = game.players.find((p) => p.id === fromId);
        const to = game.players.find((p) => p.id === d.to);
        if (!from || !to) return null;
        return (
          <div key={fromId} className="trade-item">
            <div className="drafting-head">
              <span className="pen">✍️</span>
              <b>{from.name}</b>&nbsp;prépare un échange avec&nbsp;<b>{to.id === me ? "toi" : to.name}</b>
            </div>
            <div>Donne : {describe(game, d.give)}</div>
            <div>Demande : {describe(game, d.take)}</div>
          </div>
        );
      })}
    </div>
  );
}
