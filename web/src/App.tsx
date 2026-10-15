import { GameAuth, GameOverScreen, GameTopbar } from "@freegamestore/games";
import { useEffect } from "react";
import { Celebration } from "./feel/Celebration";
import GameShell from "./GameShell";
import { Board } from "./game/Board";
import { formatValue } from "./game/format";
import { useChainGame } from "./game/useChainGame";
import { useHighScore } from "./hooks/useHighScore";

const RULES = (
  <p>
    Drag across touching tiles of the same value, or an equal pair followed by double (2-2-4-8). Let go
    to merge. The tip shows the value you will get.
  </p>
);

export default function App() {
  const game = useChainGame();
  const [best, updateBest] = useHighScore("chain-rush:best");
  const { over, score } = game.game;

  useEffect(() => {
    if (over) updateBest(score);
    // Record the best score once, when the game ends.
  }, [over]);

  return (
    <GameShell
      topbar={<GameTopbar title="Chain Rush" score={score} rules={RULES} onRestart={game.restart} />}
    >
      <GameAuth />
      <main className="play-area">
        <Board grid={game.game.grid} ids={game.ids} merge={game.merge} over={over} onCommit={game.commit} />
        {game.celebrate !== null && (
          <Celebration
            id={`milestone-${game.celebrate}`}
            label={`${formatValue(game.celebrate)} reached!`}
            onDone={game.celebrated}
          />
        )}
        {over && <GameOverScreen score={score} highScore={Math.max(best, score)} onPlayAgain={game.restart} />}
      </main>
    </GameShell>
  );
}
