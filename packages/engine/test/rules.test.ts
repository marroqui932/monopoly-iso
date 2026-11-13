import { describe, expect, it } from "vitest";
import { applyAction, createGame, GameError, parisTheme, rentFor, netWorth } from "../src";
import { NOW, act, cardIndex, give, newGame, p, players, rigDice, rollWith } from "./helpers";

describe("création de partie", () => {
  it("donne 1500 € à chacun et place tout le monde au départ", () => {
    const s = createGame(parisTheme, players(6), {}, 1, NOW);
    expect(s.players).toHaveLength(6);
    for (const pl of s.players) {
      expect(pl.cash).toBe(1500);
      expect(pl.position).toBe(0);
    }
    expect(s.decks.chance).toHaveLength(16);
    expect(s.decks.community).toHaveLength(16);
    expect(s.bank).toEqual({ houses: 32, hotels: 12 });
    expect(Object.keys(s.properties)).toHaveLength(28);
  });

  it("refuse moins de 2 ou plus de 6 joueurs", () => {
    expect(() => createGame(parisTheme, players(1))).toThrow(GameError);
    expect(() => createGame(parisTheme, [...players(6), { id: "x", name: "X", color: "", token: "" }])).toThrow(GameError);
  });
});

describe("tour de jeu", () => {
  it("avance, propose l'achat, puis passe au joueur suivant", () => {
    let s = newGame();
    s = rollWith(s, "p0", 2, 4); // case 6 : Rue de Vaugirard
    expect(p(s, "p0").position).toBe(6);
    expect(s.phase).toBe("buy");
    s = act(s, "p0", { type: "buy" });
    expect(s.properties[6]!.owner).toBe("p0");
    expect(p(s, "p0").cash).toBe(1400);
    expect(s.phase).toBe("end");
    s = act(s, "p0", { type: "endTurn" });
    expect(s.currentPlayer).toBe(1);
    expect(s.phase).toBe("roll");
  });

  it("interdit de jouer hors de son tour", () => {
    const s = newGame();
    expect(() => act(s, "p1", { type: "roll" })).toThrow("Ce n'est pas votre tour.");
  });

  it("un double fait rejouer, trois doubles envoient en prison", () => {
    let s = newGame();
    s = rollWith(s, "p0", 1, 1); // 2 : Caisse de communauté
    // On neutralise la carte tirée en choisissant une carte « gain ».
    expect(s.phase === "roll" || s.phase === "cardChoice").toBe(true);
    s = newGame();
    s.properties[6]!.owner = "p1";
    s.properties[8]!.owner = "p1";
    s.properties[9]!.owner = "p1";
    p(s, "p0").position = 0;
    s = rollWith(s, "p0", 3, 3); // 6 : appartient à p1
    expect(s.phase).toBe("roll");
    expect(s.doublesCount).toBe(1);
    s = rollWith(s, "p0", 1, 1); // 8 : appartient à p1
    expect(s.phase).toBe("roll");
    s = rollWith(s, "p0", 2, 2); // 3e double
    expect(p(s, "p0").inJail).toBe(true);
    expect(p(s, "p0").position).toBe(10);
    expect(s.phase).toBe("end");
  });

  it("touche 200 € en passant par la case Départ", () => {
    let s = newGame();
    p(s, "p0").position = 38;
    s.properties[1]!.owner = "p1";
    s = rollWith(s, "p0", 1, 2); // 38 + 3 = 1
    expect(p(s, "p0").position).toBe(1);
    // 1500 + 200 − loyer de 2 €
    expect(p(s, "p0").cash).toBe(1698);
  });

  it("taxe : payer l'impôt sur le revenu", () => {
    let s = newGame();
    s = rollWith(s, "p0", 1, 3); // 4
    expect(p(s, "p0").cash).toBe(1300);
  });

  it("la case « Allez en prison » envoie en prison sans salaire", () => {
    let s = newGame();
    p(s, "p0").position = 25;
    s = rollWith(s, "p0", 2, 3); // 30
    expect(p(s, "p0").position).toBe(10);
    expect(p(s, "p0").inJail).toBe(true);
    expect(p(s, "p0").cash).toBe(1500);
  });
});

describe("loyers", () => {
  it("loyer nu, doublé avec le groupe complet, puis avec maisons", () => {
    let s = newGame();
    give(s, "p1", 37);
    expect(rentFor(s, 37, 7)).toBe(35);
    give(s, "p1", 39);
    expect(rentFor(s, 37, 7)).toBe(70);
    s.properties[37]!.houses = 3;
    expect(rentFor(s, 37, 7)).toBe(1100);
    s.properties[37]!.houses = 5;
    expect(rentFor(s, 37, 7)).toBe(1500);
  });

  it("gares : 25, 50, 100, 200", () => {
    const s = newGame();
    const stations = [5, 15, 25, 35];
    const expected = [25, 50, 100, 200];
    stations.forEach((pos, i) => {
      s.properties[pos]!.owner = "p1";
      expect(rentFor(s, 5, 7)).toBe(expected[i]);
    });
  });

  it("compagnies : 4× ou 10× les dés", () => {
    let s = newGame();
    give(s, "p1", 12);
    p(s, "p0").position = 7; // on évite la carte en se plaçant sur Chance déjà résolue
    s = rollWith(s, "p0", 2, 3); // 12
    expect(p(s, "p0").cash).toBe(1500 - 20);
    expect(p(s, "p1").cash).toBe(1500 + 20);
    s.properties[28]!.owner = "p1";
    expect(rentFor(s, 12, 5)).toBe(50);
  });

  it("pas de loyer sur une propriété hypothéquée", () => {
    let s = newGame();
    give(s, "p1", 6);
    s.properties[6]!.mortgaged = true;
    s = rollWith(s, "p0", 2, 4);
    expect(p(s, "p0").cash).toBe(1500);
  });
});

describe("prison", () => {
  function jailed() {
    const s = newGame();
    const pl = p(s, "p0");
    pl.position = 10;
    pl.inJail = true;
    return s;
  }

  it("payer l'amende avant de lancer", () => {
    let s = jailed();
    s = act(s, "p0", { type: "payJailFine" });
    expect(p(s, "p0").inJail).toBe(false);
    expect(p(s, "p0").cash).toBe(1450);
    expect(s.phase).toBe("roll");
  });

  it("utiliser une carte « Libéré de prison » la remet dans le paquet", () => {
    let s = jailed();
    const idx = cardIndex("chance", "libéré de prison");
    s.decks.chance = s.decks.chance.filter((i) => i !== idx);
    p(s, "p0").jailCards = ["chance"];
    s = act(s, "p0", { type: "useJailCard" });
    expect(p(s, "p0").inJail).toBe(false);
    expect(p(s, "p0").jailCards).toHaveLength(0);
    expect(s.decks.chance.at(-1)).toBe(idx);
  });

  it("un double libère mais ne fait pas rejouer", () => {
    let s = jailed();
    s = rollWith(s, "p0", 4, 4); // 18
    expect(p(s, "p0").inJail).toBe(false);
    expect(p(s, "p0").position).toBe(18);
    expect(s.phase).toBe("buy");
    s = act(s, "p0", { type: "buy" });
    expect(s.phase).toBe("end");
  });

  it("après 3 échecs, on paie et on avance", () => {
    let s = jailed();
    s = rollWith(s, "p0", 1, 2);
    expect(p(s, "p0").inJail).toBe(true);
    expect(s.phase).toBe("end");
    s.currentPlayer = 0;
    s.phase = "roll";
    s = rollWith(s, "p0", 1, 2);
    s.phase = "roll";
    s = rollWith(s, "p0", 1, 3); // 3e échec → 14
    expect(p(s, "p0").inJail).toBe(false);
    expect(p(s, "p0").position).toBe(14);
    expect(p(s, "p0").cash).toBe(1450);
  });
});

describe("enchères", () => {
  it("refuser l'achat lance une enchère, le meilleur enchérisseur l'emporte", () => {
    let s = newGame(3);
    s = rollWith(s, "p0", 2, 4);
    s = act(s, "p0", { type: "declineBuy" });
    expect(s.phase).toBe("auction");
    s = act(s, "p1", { type: "bid", amount: 50 });
    s = act(s, "p2", { type: "bid", amount: 70 });
    expect(() => act(s, "p0", { type: "bid", amount: 60 })).toThrow(GameError);
    s = act(s, "p0", { type: "passAuction" });
    s = act(s, "p1", { type: "passAuction" });
    expect(s.auction).toBeNull();
    expect(s.properties[6]!.owner).toBe("p2");
    expect(p(s, "p2").cash).toBe(1430);
    expect(s.phase).toBe("end");
  });

  it("personne n'enchérit : la propriété reste à la banque", () => {
    let s = newGame(2);
    s = rollWith(s, "p0", 2, 4);
    s = act(s, "p0", { type: "declineBuy" });
    s = act(s, "p0", { type: "passAuction" });
    s = act(s, "p1", { type: "passAuction" });
    expect(s.properties[6]!.owner).toBeNull();
    expect(s.phase).toBe("end");
  });

  it("le meilleur enchérisseur ne peut pas se retirer", () => {
    let s = newGame(2);
    s = rollWith(s, "p0", 2, 4);
    s = act(s, "p0", { type: "declineBuy" });
    s = act(s, "p0", { type: "bid", amount: 10 });
    expect(() => act(s, "p0", { type: "passAuction" })).toThrow("meilleur enchérisseur");
  });

  it("après une enchère suite à un double, on rejoue", () => {
    let s = newGame(2);
    s = rollWith(s, "p0", 3, 3);
    s = act(s, "p0", { type: "declineBuy" });
    s = act(s, "p1", { type: "bid", amount: 10 });
    s = act(s, "p0", { type: "passAuction" });
    expect(s.phase).toBe("roll");
    expect(s.currentPlayer).toBe(0);
  });
});

describe("constructions", () => {
  function withBlues() {
    const s = newGame();
    give(s, "p0", 37, 39);
    return s;
  }

  it("exige le groupe complet", () => {
    const s = newGame();
    give(s, "p0", 37);
    expect(() => act(s, "p0", { type: "build", position: 37 })).toThrow("tout le groupe");
  });

  it("construit uniformément, puis un hôtel", () => {
    let s = withBlues();
    p(s, "p0").cash = 3000;
    s = act(s, "p0", { type: "build", position: 37 });
    expect(() => act(s, "p0", { type: "build", position: 37 })).toThrow("uniformément");
    s = act(s, "p0", { type: "build", position: 39 });
    for (let i = 0; i < 3; i++) {
      s = act(s, "p0", { type: "build", position: 37 });
      s = act(s, "p0", { type: "build", position: 39 });
    }
    expect(s.bank.houses).toBe(24);
    s = act(s, "p0", { type: "build", position: 37 });
    expect(s.properties[37]!.houses).toBe(5);
    expect(s.bank.houses).toBe(28);
    expect(s.bank.hotels).toBe(11);
    expect(p(s, "p0").cash).toBe(3000 - 9 * 200);
  });

  it("ne construit que pendant son tour, mais vend à tout moment", () => {
    let s = newGame();
    give(s, "p1", 37, 39);
    s.properties[37]!.houses = 1;
    s.properties[39]!.houses = 1;
    s.bank.houses = 30;
    expect(() => act(s, "p1", { type: "build", position: 37 })).toThrow("pendant son tour");
    s = act(s, "p1", { type: "sellBuilding", position: 37 });
    expect(s.properties[37]!.houses).toBe(0);
  });

  it("respecte la pénurie de maisons", () => {
    let s = withBlues();
    s.bank.houses = 0;
    expect(() => act(s, "p0", { type: "build", position: 37 })).toThrow("plus de maison");
  });

  it("revend uniformément à moitié prix, et casse un hôtel en 4 maisons", () => {
    let s = withBlues();
    s.properties[37]!.houses = 5;
    s.properties[39]!.houses = 4;
    s.bank = { houses: 28, hotels: 11 };
    expect(() => act(s, "p0", { type: "sellBuilding", position: 39 })).toThrow("uniformément");
    s = act(s, "p0", { type: "sellBuilding", position: 37 });
    expect(s.properties[37]!.houses).toBe(4);
    expect(s.bank).toEqual({ houses: 24, hotels: 12 });
    expect(p(s, "p0").cash).toBe(1600);
  });

  it("interdit d'hypothéquer si le groupe a des constructions", () => {
    let s = withBlues();
    s.properties[39]!.houses = 1;
    s.bank.houses = 31;
    expect(() => act(s, "p0", { type: "mortgage", position: 37 })).toThrow("constructions");
  });

  it("hypothèque à moitié prix, lève à +10 %", () => {
    let s = withBlues();
    s = act(s, "p0", { type: "mortgage", position: 37 });
    expect(p(s, "p0").cash).toBe(1675);
    expect(() => act(s, "p0", { type: "build", position: 39 })).toThrow("hypothéqué");
    s = act(s, "p0", { type: "unmortgage", position: 37 });
    expect(p(s, "p0").cash).toBe(1675 - 193);
  });
});

describe("dettes et faillite", () => {
  it("une dette bloque la fin du tour jusqu'au paiement", () => {
    let s = newGame();
    give(s, "p0", 39);
    p(s, "p0").cash = 100;
    s = rollWith(s, "p0", 1, 3); // impôt de 200
    expect(s.debts).toHaveLength(1);
    expect(() => act(s, "p0", { type: "endTurn" })).toThrow("dettes");
    s = act(s, "p0", { type: "mortgage", position: 39 });
    s = act(s, "p0", { type: "payDebt", debtId: s.debts[0]!.id });
    expect(p(s, "p0").cash).toBe(100);
    s = act(s, "p0", { type: "endTurn" });
    expect(s.currentPlayer).toBe(1);
  });

  it("faillite envers un joueur : il récupère tout, et décide pour les hypothèques", () => {
    let s = newGame(3);
    give(s, "p1", 37, 39);
    s.properties[39]!.houses = 0;
    s.properties[37]!.houses = 0;
    give(s, "p0", 1, 3);
    s.properties[1]!.mortgaged = true;
    s.properties[3]!.houses = 0;
    p(s, "p0").cash = 10;
    p(s, "p0").jailCards = ["community"];
    p(s, "p0").position = 34;
    s = rollWith(s, "p0", 1, 2); // 37 : loyer doublé = 70
    expect(s.debts).toHaveLength(1);
    s = act(s, "p0", { type: "declareBankruptcy" });
    expect(p(s, "p0").bankrupt).toBe(true);
    expect(s.properties[1]!.owner).toBe("p1");
    expect(s.properties[3]!.owner).toBe("p1");
    expect(p(s, "p1").cash).toBe(1510);
    expect(p(s, "p1").jailCards).toEqual(["community"]);
    expect(s.mortgageDecisions).toEqual([{ player: "p1", position: 1 }]);
    // Le tour ne passe qu'une fois la décision prise.
    expect(s.currentPlayer).toBe(0);
    s = act(s, "p1", { type: "resolveMortgage", position: 1, unmortgage: false });
    expect(p(s, "p1").cash).toBe(1507);
    expect(s.currentPlayer).toBe(1);
    expect(s.phase).toBe("roll");
  });

  it("faillite envers la banque : les propriétés partent aux enchères", () => {
    let s = newGame(3);
    give(s, "p0", 6, 8);
    p(s, "p0").cash = 50;
    s = rollWith(s, "p0", 1, 3); // impôt 200
    s = act(s, "p0", { type: "declareBankruptcy" });
    expect(s.phase).toBe("auction");
    expect(s.auction!.position).toBe(6);
    expect(s.auction!.active).toEqual(["p1", "p2"]);
    s = act(s, "p1", { type: "bid", amount: 20 });
    s = act(s, "p2", { type: "passAuction" });
    expect(s.properties[6]!.owner).toBe("p1");
    expect(s.auction!.position).toBe(8);
    s = act(s, "p1", { type: "passAuction" });
    s = act(s, "p2", { type: "passAuction" });
    expect(s.properties[8]!.owner).toBeNull();
    expect(s.auction).toBeNull();
    expect(s.currentPlayer).toBe(1);
    expect(s.phase).toBe("roll");
  });

  it("la partie se termine quand il ne reste qu'un joueur", () => {
    let s = newGame(2);
    s = act(s, "p1", { type: "forfeit" });
    expect(s.phase).toBe("gameOver");
    expect(s.winner).toBe("p0");
  });
});

describe("échanges", () => {
  it("échange accepté avec argent, propriétés et cartes", () => {
    let s = newGame();
    give(s, "p0", 6);
    give(s, "p1", 8);
    p(s, "p1").jailCards = ["chance"];
    s = act(s, "p0", {
      type: "proposeTrade",
      to: "p1",
      give: { cash: 100, properties: [6], jailCards: 0 },
      take: { cash: 0, properties: [8], jailCards: 1 },
    });
    expect(() => act(s, "p0", { type: "acceptTrade", tradeId: s.trades[0]!.id })).toThrow();
    s = act(s, "p1", { type: "acceptTrade", tradeId: s.trades[0]!.id });
    expect(s.properties[6]!.owner).toBe("p1");
    expect(s.properties[8]!.owner).toBe("p0");
    expect(p(s, "p0").cash).toBe(1400);
    expect(p(s, "p1").cash).toBe(1600);
    expect(p(s, "p0").jailCards).toEqual(["chance"]);
  });

  it("interdit d'échanger un terrain dont le groupe est construit", () => {
    const s = newGame();
    give(s, "p0", 37, 39);
    s.properties[39]!.houses = 1;
    expect(() =>
      act(s, "p0", {
        type: "proposeTrade",
        to: "p1",
        give: { cash: 0, properties: [37], jailCards: 0 },
        take: { cash: 10, properties: [], jailCards: 0 },
      }),
    ).toThrow("constructions");
  });

  it("propriété hypothéquée reçue : lever tout de suite", () => {
    let s = newGame();
    give(s, "p0", 39);
    s.properties[39]!.mortgaged = true;
    s = act(s, "p0", {
      type: "proposeTrade",
      to: "p1",
      give: { cash: 0, properties: [39], jailCards: 0 },
      take: { cash: 50, properties: [], jailCards: 0 },
    });
    s = act(s, "p1", { type: "acceptTrade", tradeId: s.trades[0]!.id });
    expect(s.mortgageDecisions).toEqual([{ player: "p1", position: 39 }]);
    expect(() => act(s, "p0", { type: "roll" })).toThrow("décision");
    s = act(s, "p1", { type: "resolveMortgage", position: 39, unmortgage: true });
    expect(s.properties[39]!.mortgaged).toBe(false);
    expect(p(s, "p1").cash).toBe(1500 - 50 - 220);
  });

  it("on ne propose un échange qu'à son tour (sauf dette), et il expire en fin de tour", () => {
    let s = newGame();
    const offer = { cash: 10, properties: [], jailCards: 0 };
    const nothing = { cash: 0, properties: [], jailCards: 0 };
    expect(() => act(s, "p1", { type: "proposeTrade", to: "p0", give: offer, take: nothing })).toThrow("pendant votre tour");
    s = act(s, "p0", { type: "proposeTrade", to: "p1", give: offer, take: nothing });
    s = rollWith(s, "p0", 1, 2);
    if (s.phase === "buy") s = act(s, "p0", { type: "buy" });
    s = act(s, "p0", { type: "endTurn" });
    expect(s.trades).toHaveLength(0);
    // Un joueur endetté peut proposer hors de son tour.
    s.debts = [{ id: 500, debtor: "p0", creditor: null, amount: 5000, reason: "test", toPot: false }];
    s = act(s, "p0", { type: "proposeTrade", to: "p1", give: offer, take: nothing });
    expect(s.trades).toHaveLength(1);
  });

  it("une proposition peut être refusée ou retirée", () => {
    let s = newGame();
    const trade = { type: "proposeTrade" as const, to: "p1", give: { cash: 10, properties: [], jailCards: 0 }, take: { cash: 0, properties: [], jailCards: 0 } };
    s = act(s, "p0", trade);
    s = act(s, "p1", { type: "rejectTrade", tradeId: s.trades[0]!.id });
    expect(s.trades).toHaveLength(0);
    s = act(s, "p0", trade);
    s = act(s, "p0", { type: "cancelTrade", tradeId: s.trades[0]!.id });
    expect(s.trades).toHaveLength(0);
  });
});

describe("cartes", () => {
  function onChance(index: number) {
    const s = newGame(3);
    s.decks.chance = [index, ...s.decks.chance.filter((i) => i !== index)];
    p(s, "p0").position = 4;
    return s;
  }

  it("« Reculez de trois cases » depuis Chance (7) ramène à l'impôt (4)", () => {
    let s = onChance(cardIndex("chance", "Reculez"));
    s = rollWith(s, "p0", 1, 2);
    expect(p(s, "p0").position).toBe(4);
    expect(p(s, "p0").cash).toBe(1300);
  });

  it("« Rendez-vous à la Rue de la Paix » propose l'achat", () => {
    let s = onChance(cardIndex("chance", "Rue de la Paix"));
    s = rollWith(s, "p0", 1, 2);
    expect(p(s, "p0").position).toBe(39);
    expect(s.phase).toBe("buy");
  });

  it("« Avancez à la Villette » depuis la case 36 fait passer par Départ", () => {
    let s = newGame(2);
    const idx = cardIndex("chance", "Villette");
    s.decks.chance = [idx, ...s.decks.chance.filter((i) => i !== idx)];
    p(s, "p0").position = 33;
    s = rollWith(s, "p0", 1, 2);
    expect(p(s, "p0").position).toBe(11);
    expect(p(s, "p0").cash).toBe(1700);
  });

  it("la carte anniversaire fait payer chaque autre joueur", () => {
    let s = newGame(3);
    const idx = cardIndex("community", "anniversaire");
    s.decks.community = [idx, ...s.decks.community.filter((i) => i !== idx)];
    p(s, "p2").cash = 5;
    s = rollWith(s, "p0", 1, 3); // 4… on veut 2
    s = newGame(3);
    s.decks.community = [idx, ...s.decks.community.filter((i) => i !== idx)];
    p(s, "p2").cash = 5;
    p(s, "p0").position = 39;
    s = rollWith(s, "p0", 1, 2); // 39 + 3 = 2
    expect(p(s, "p0").cash).toBe(1500 + 200 + 10);
    expect(p(s, "p1").cash).toBe(1490);
    expect(s.debts).toHaveLength(1);
    expect(s.debts[0]!.debtor).toBe("p2");
    expect(() => act(s, "p0", { type: "endTurn" })).toThrow("dettes");
  });

  it("« amende ou carte Chance » : le joueur choisit", () => {
    let s = newGame(2);
    const idx = cardIndex("community", "amende de 10");
    s.decks.community = [idx, ...s.decks.community.filter((i) => i !== idx)];
    p(s, "p0").position = 14;
    s = rollWith(s, "p0", 1, 2); // 17
    expect(s.phase).toBe("cardChoice");
    s = act(s, "p0", { type: "chooseCard", option: "pay" });
    expect(p(s, "p0").cash).toBe(1490);
    expect(s.phase).toBe("end");
  });

  it("la carte « Libéré de prison » est conservée hors du paquet", () => {
    let s = onChance(cardIndex("chance", "libéré de prison"));
    s = rollWith(s, "p0", 1, 2);
    expect(p(s, "p0").jailCards).toEqual(["chance"]);
    expect(s.decks.chance).toHaveLength(15);
  });
});

describe("fins de partie", () => {
  it("limite de tours : le plus riche gagne", () => {
    let s = newGame(2, { maxRounds: 1 });
    give(s, "p1", 39);
    s = rollWith(s, "p0", 1, 2); // 3 : Lecourbe → achat
    s = act(s, "p0", { type: "declineBuy" });
    s = act(s, "p0", { type: "passAuction" });
    s = act(s, "p1", { type: "passAuction" });
    s = act(s, "p0", { type: "endTurn" });
    s = rollWith(s, "p1", 1, 2);
    s = act(s, "p1", { type: "declineBuy" });
    s = act(s, "p0", { type: "passAuction" });
    s = act(s, "p1", { type: "passAuction" });
    s = act(s, "p1", { type: "endTurn" });
    expect(s.phase).toBe("gameOver");
    expect(s.winner).toBe("p1");
    expect(netWorth(s, "p1")).toBe(1900);
  });

  it("limite de temps", () => {
    let s = newGame(2, { timeLimitMs: 60_000 });
    s = rollWith(s, "p0", 1, 2);
    s = act(s, "p0", { type: "buy" });
    const r = applyAction(s, "p0", { type: "endTurn" }, { now: NOW + 61_000 });
    expect(r.state.phase).toBe("gameOver");
    expect(r.state.endReason).toBe("temps écoulé");
  });
});

describe("immutabilité", () => {
  it("ne modifie jamais l'état d'origine", () => {
    const s = newGame();
    const before = JSON.stringify(s);
    rollWith(s, "p0", 3, 4);
    applyAction(s, "p0", { type: "roll" }, { now: NOW });
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("plateau 3ajib Edition", () => {
  it("a les bons noms, et les cartes renvoient vers les bonnes cases", async () => {
    const { ajibTheme } = await import("../src");
    expect(ajibTheme.squares).toHaveLength(40);
    expect(ajibTheme.squares[39]!.name).toBe("Orly");
    expect(ajibTheme.squares[11]!.name).toBe("Bois de Boulogne");
    const texts = [...ajibTheme.chance, ...ajibTheme.community].map((c) => c.text).join(" ");
    for (const old of ["Rue de la Paix", "Villette.", "Henri-Martin", "Gare de Lyon", "Belleville"]) {
      expect(texts).not.toContain(old);
    }
    // Chaque carte « aller à » pointe vers une case qui porte le nom cité.
    for (const c of [...ajibTheme.chance, ...ajibTheme.community]) {
      if (c.effect.type === "advanceTo" && c.effect.position !== 0) {
        expect(c.text).toContain(ajibTheme.squares[c.effect.position]!.name);
      }
    }
  });
});

describe("ordre de jeu aux dés", () => {
  it("chacun lance, le plus haut commence, les égalités relancent", () => {
    let s = createGame(parisTheme, players(3), {}, 5, NOW);
    expect(s.phase).toBe("order");
    expect(() => act(s, "p0", { type: "roll" })).toThrow("ordre de jeu");
    expect(() => act(s, "p1", { type: "rollOrder" })).toThrow("pas à vous");
    s = rollOrderWith(s, "p0", 2, 3); // 5
    s = rollOrderWith(s, "p1", 6, 6); // 12
    s = rollOrderWith(s, "p2", 1, 4); // 5 → égalité avec p0
    expect(s.phase).toBe("order");
    expect(s.orderQueue).toEqual(["p0", "p2"]);
    s = rollOrderWith(s, "p0", 1, 1); // 2
    s = rollOrderWith(s, "p2", 3, 3); // 6
    expect(s.phase).toBe("roll");
    expect(s.players.map((p) => p.id)).toEqual(["p1", "p2", "p0"]);
    expect(s.currentPlayer).toBe(0);
  });
});

describe("règle maison : faillite vers la banque", () => {
  it("le créancier touche l'argent mais les propriétés partent aux enchères", () => {
    let s = newGame(3, { bankruptToBank: true });
    give(s, "p1", 37, 39);
    give(s, "p0", 1);
    p(s, "p0").cash = 10;
    p(s, "p0").position = 34;
    s = rollWith(s, "p0", 1, 2); // 37 : loyer 70
    s = act(s, "p0", { type: "declareBankruptcy" });
    expect(p(s, "p1").cash).toBe(1510);
    expect(s.phase).toBe("auction");
    expect(s.auction!.position).toBe(1);
  });
});

describe("action selon la case", () => {
  it("le loyer utilise le texte d'action du plateau", () => {
    let s = newGame();
    s.theme = { ...s.theme, actions: { 6: "mange un kebab chez Taiba" } };
    give(s, "p1", 6);
    const r = applyAction(rigDiceCopy(s, 2, 4), "p0", { type: "roll" }, { now: NOW });
    const paid = r.events.find((e) => e.type === "paid");
    expect(paid).toMatchObject({ type: "paid", reason: "mange un kebab chez Taiba", position: 6 });
  });
});

function rigDiceCopy(s: ReturnType<typeof newGame>, a: number, b: number) {
  const copy = structuredClone(s);
  return rigDice(copy, a, b);
}

function rollOrderWith(s: ReturnType<typeof newGame>, id: string, a: number, b: number) {
  return act(rigDice(structuredClone(s), a, b), id, { type: "rollOrder" });
}
