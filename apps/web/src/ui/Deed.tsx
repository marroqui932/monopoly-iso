import {
  buildError,
  mortgageError,
  mortgageValue,
  ownsGroup,
  rentFor,
  sellError,
  unmortgageCost,
  unmortgageError,
  type GameState,
} from "@monopoly/engine";
import { money, useCanAct, useGame } from "../store";

const DESCRIPTIONS: Record<string, string> = {
  go: "Recevez votre salaire à chaque passage.",
  jail: "Simple visite… ou prison. Pour sortir : payer l'amende, utiliser une carte, ou faire un double (3 essais).",
  freeParking: "Rien ne se passe ici (sauf avec la règle de la cagnotte).",
  goToJail: "Allez directement en prison, sans passer par la case Départ.",
  chance: "Tirez une carte Chance.",
  community: "Tirez une carte Caisse de communauté.",
};

export function Deed({ game, position }: { game: GameState; position: number }) {
  const dispatch = useGame((s) => s.dispatch);
  const select = useGame((s) => s.select);
  const canAct = useCanAct();
  const sq = game.theme.squares[position]!;
  const prop = game.properties[position];
  const cur = game.theme.currency;

  const headColor =
    sq.kind === "street" ? game.theme.groupColors[sq.group] : sq.kind === "railroad" ? "#343a40" : sq.kind === "utility" ? "#6c757d" : "#1d3557";

  const close = (
    <button className="btn small ghost close" onClick={() => select(null)} aria-label="Fermer">
      ✕
    </button>
  );

  if (!prop || !("price" in sq)) {
    return (
      <div className="panel deed">
        <div className="deed-head" style={{ background: headColor }}>
          {sq.name}
          {close}
        </div>
        <div className="deed-body">{sq.kind === "tax" ? `Payez ${sq.amount} ${cur}.` : DESCRIPTIONS[sq.kind]}</div>
      </div>
    );
  }

  const owner = prop.owner ? game.players.find((p) => p.id === prop.owner) : undefined;
  const lastDice = game.dice ? game.dice.a + game.dice.b : 7;

  let rows: [string, string, boolean][] = [];
  if (sq.kind === "street") {
    const full = owner ? ownsGroup(game, owner.id, sq.group) : false;
    rows = [
      [`Loyer nu`, `${sq.rents[0]} ${cur}`, prop.houses === 0 && !full],
      [`Groupe complet (nu)`, `${sq.rents[0] * 2} ${cur}`, prop.houses === 0 && full],
      ...[1, 2, 3, 4].map((h): [string, string, boolean] => [`${h} maison${h > 1 ? "s" : ""}`, `${sq.rents[h]} ${cur}`, prop.houses === h]),
      [`Hôtel`, `${sq.rents[5]} ${cur}`, prop.houses === 5],
    ];
  } else if (sq.kind === "railroad") {
    rows = [1, 2, 3, 4].map((n): [string, string, boolean] => [`${n} gare${n > 1 ? "s" : ""}`, `${25 * 2 ** (n - 1)} ${cur}`, false]);
  } else {
    rows = [
      ["1 compagnie", "4 × les dés", false],
      ["2 compagnies", "10 × les dés", false],
    ];
  }

  const ownerId = owner?.id;
  const btn = (label: string, err: string | null, onClick: () => void) => (
    <button className="btn small" disabled={!!err} title={err ?? ""} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <div className="panel deed">
      <div className="deed-head" style={{ background: headColor }}>
        <small>Titre de propriété</small>
        {sq.name}
        {close}
      </div>
      <div className="deed-body">
        <table>
          <tbody>
            {rows.map(([label, value, active]) => (
              <tr key={label} className={active ? "active" : ""}>
                <td>{label}</td>
                <td>{value}</td>
              </tr>
            ))}
            {sq.kind === "street" && (
              <tr>
                <td>Prix d'une maison</td>
                <td>{money(game, sq.houseCost)}</td>
              </tr>
            )}
            <tr>
              <td>Valeur hypothécaire</td>
              <td>{money(game, mortgageValue(game, position))}</td>
            </tr>
          </tbody>
        </table>
        <div className="owner">
          {owner ? (
            <>
              <span className="dot" style={{ background: owner.color }} />
              <span>
                À <b>{owner.name}</b>
                {prop.mortgaged ? " · hypothéquée" : ` · loyer actuel ${money(game, rentFor(game, position, lastDice))}`}
              </span>
            </>
          ) : (
            <span>À vendre : {money(game, sq.price)}</span>
          )}
        </div>
        {ownerId && canAct(ownerId) && game.phase !== "gameOver" && (
          <div className="btns">
            {sq.kind === "street" &&
              btn(prop.houses === 4 ? "Construire un hôtel" : "Construire une maison", buildError(game, ownerId, position), () =>
                dispatch(ownerId, { type: "build", position }),
              )}
            {sq.kind === "street" &&
              prop.houses > 0 &&
              btn(`Vendre (${money(game, Math.floor(sq.houseCost / 2))})`, sellError(game, ownerId, position), () =>
                dispatch(ownerId, { type: "sellBuilding", position }),
              )}
            {prop.mortgaged
              ? btn(`Lever l'hypothèque (${money(game, unmortgageCost(game, position))})`, unmortgageError(game, ownerId, position), () =>
                  dispatch(ownerId, { type: "unmortgage", position }),
                )
              : btn(`Hypothéquer (+${money(game, mortgageValue(game, position))})`, mortgageError(game, ownerId, position), () =>
                  dispatch(ownerId, { type: "mortgage", position }),
                )}
          </div>
        )}
      </div>
    </div>
  );
}
