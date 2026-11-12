import { useGame } from "./store";
import { Setup } from "./ui/Setup";
import { GameView } from "./ui/GameView";
import { LobbyView } from "./ui/Lobby";

export function App() {
  const game = useGame((s) => s.game);
  const mode = useGame((s) => s.mode);
  if (game) return <GameView game={game} />;
  if (mode !== "local") return <LobbyView />;
  return <Setup />;
}
