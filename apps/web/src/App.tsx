import { useGame } from "./store";
import { Setup } from "./ui/Setup";
import { GameView } from "./ui/GameView";

export function App() {
  const game = useGame((s) => s.game);
  return game ? <GameView game={game} /> : <Setup />;
}
