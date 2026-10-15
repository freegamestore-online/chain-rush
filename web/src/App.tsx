import { GameAuth, GameButton, GameOverScreen, GameTopbar } from "@freegamestore/games";
import { useEffect, useState } from "react";
import { Celebration } from "./feel/Celebration";
import GameShell from "./GameShell";
import { Board, type BoardMode } from "./game/Board";
import { formatValue } from "./game/format";
import { useChainGame } from "./game/useChainGame";
import { useHighScore } from "./hooks/useHighScore";
import type { Pos } from "./engine";

const RULES = (
  <p>
    Drag across touching tiles of the same value, or an equal pair followed by double (2-2-4-8). Let go
    to merge. The tip shows the value you will get. Every 500 points earns a helper: Hammer removes a
    tile, Swap trades two tiles, Shuffle reorders the board. Undo takes back your last chain.
  </p>
);

export default function App() {
  const game = useChainGame();
  const [best, updateBest] = useHighScore("chain-rush:best");
  const [mode, setMode] = useState<BoardMode>("chain");
  const [pending, setPending] = useState<Pos | null>(null);
  const { over, score, highest, helpers, undo: canUndo, grid } = game.game;
  const celebration = game.celebrations[0];
  const earned = game.merge?.earned ?? [];

  useEffect(() => {
    if (over) updateBest(score);
    // Record the best score once, when the game ends.
  }, [over]);

  const endHelper = () => {
    setMode("chain");
    setPending(null);
  };

  const toggleHelper = (next: "hammer" | "swap") => {
    setPending(null);
    setMode((current) => (current === next ? "chain" : next));
  };

  const onTap = (pos: Pos) => {
    if (grid[pos.row]?.[pos.col] == null) return;
    if (mode === "hammer") {
      game.hammerAt(pos);
      endHelper();
    } else if (mode === "swap") {
      if (pending === null) {
        setPending(pos);
      } else {
        game.swapTiles(pending, pos);
        endHelper();
      }
    }
  };

  const hint =
    mode === "hammer"
      ? "Tap a tile to remove it."
      : mode === "swap"
        ? pending
          ? "Tap a second tile to swap."
          : "Tap a tile to swap."
        : null;

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Chain Rush"
          stats={[
            { label: "Score", value: score, accent: true },
            { label: "Best tile", value: formatValue(highest) },
          ]}
          rules={RULES}
          onRestart={() => {
            endHelper();
            game.restart();
          }}
        />
      }
    >
      <GameAuth />
      <main className="play-area">
        <div className="play-column">
          <Board
            grid={grid}
            ids={game.ids}
            merge={game.merge}
            over={over}
            onCommit={game.commit}
            mode={mode}
            pending={pending}
            onTap={onTap}
          />
          <div className="helper-bar" role="group" aria-label="Helpers">
            <GameButton
              size="sm"
              variant={mode === "hammer" ? "primary" : "secondary"}
              disabled={over || helpers.hammer === 0}
              onClick={() => toggleHelper("hammer")}
            >
              {`Hammer ×${helpers.hammer}`}
            </GameButton>
            <GameButton
              size="sm"
              variant={mode === "swap" ? "primary" : "secondary"}
              disabled={over || helpers.swap === 0}
              onClick={() => toggleHelper("swap")}
            >
              {`Swap ×${helpers.swap}`}
            </GameButton>
            <GameButton
              size="sm"
              variant="secondary"
              disabled={over || helpers.shuffle === 0}
              onClick={() => {
                endHelper();
                game.shuffleBoard();
              }}
            >
              {`Shuffle ×${helpers.shuffle}`}
            </GameButton>
            <GameButton
              size="sm"
              variant="ghost"
              disabled={!canUndo}
              onClick={() => {
                endHelper();
                game.undo();
              }}
            >
              Undo
            </GameButton>
          </div>
          <p className="play-status" aria-live="polite">
            {hint ?? (earned.length > 0 ? `Earned: ${earned.map(labelOf).join(", ")}` : " ")}
          </p>
        </div>
        {celebration !== undefined && (
          <Celebration
            id={`milestone-${celebration}`}
            label={`${formatValue(celebration)} reached!`}
            onDone={game.celebrated}
          />
        )}
        {over && <GameOverScreen score={score} highScore={Math.max(best, score)} onPlayAgain={game.restart} />}
      </main>
    </GameShell>
  );
}

function labelOf(kind: "hammer" | "swap" | "shuffle"): string {
  return `+1 ${kind[0]?.toUpperCase()}${kind.slice(1)}`;
}
