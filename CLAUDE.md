# Notes pour Claude

- Projet : Monopoly isométrique 3D low-poly entre amis, dans le navigateur. Le propriétaire parle français : interface, messages d'erreur, logs et commentaires en français.
- Hébergement GitHub Pages uniquement (statique). Multijoueur : hôte dans le navigateur, autres joueurs en WebRTC pair-à-pair. Pas de serveur de jeu. 2 à 6 joueurs, pseudo uniquement.
- Règles : Monopoly classique complet, édition française. Toute logique de règle vit dans `packages/engine` (pur, sans dépendance, sans DOM) ; l'interface ne fait qu'appeler `applyAction` et afficher l'état et les événements.
- Front prévu : Vite + React + React Three Fiber (+ drei), Zustand, Howler.js ; caméra orthographique pour l'isométrique.
- Thème : les amis fourniront leurs propres noms et références ; garder tout le contenu du thème dans des fichiers de données.
- Toujours lancer `pnpm test` et `pnpm typecheck` avant de commit.
