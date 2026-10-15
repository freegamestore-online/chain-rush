import { GameAuth, GameButton, GameOverScreen, GameTopbar } from "@freegamestore/games";
import { useEffect, useState } from "react";
import { Celebration } from "./feel/Celebration";
import GameShell from "./GameShell";
import { Board, type BoardMode } from "./game/Board";
import { DAILY_MOVES } from "./game/daily";
import { formatValue } from "./game/format";
import { useLeaderboard, recentDaily } from "./game/leaderboard";
import { useChainGame } from "./game/useChainGame";
import type { Pos } from "./engine";

const RULES = (
  <p>
    Drag across touching tiles of the same value, or an equal pair followed by double (2-2-4-8). Let go
    to merge. The tip shows the value you will get. Every 500 points earns a helper: Hammer removes a
    tile, Swap trades two tiles, Shuffle reorders the board. Undo takes back your last chain. The daily
    board is the same for everyone on a date and lasts {DAILY_MOVES} chains.
  </p>
);

export default function App() {
  const game = useChainGame();
  const scores = useLeaderboard();
  const [mode, setMode] = useState<BoardMode>("chain");
  const [pending, setPending] = useState<Pos | null>(null);
  const [scoresOpen, setScoresOpen] = useState(false);
  const { finished, limitReached, mode: gameMode, date, game: state } = game;
  const { score, highest, helpers, undo: canUndo, grid, moves } = state;
  const celebration = game.celebrations[0];
  const earned = game.merge?.earned ?? [];

  // Record the score once the game ends. Recording is idempotent (keeps the best), so a reload
  // of a finished game does no harm.
  useEffect(() => {
    if (!finished) return;
    if (gameMode === "daily" && date) scores.recordDailyScore(date, score);
    else scores.recordEndlessScore(score);
    // Only the end of a game matters here: `scores` changes identity on every update.
  }, [finished, gameMode, date, score]);

  const endHelper = () => {
    setMode("chain");
    setPending(null);
  };

  const toggleHelper = (next: "hammer" | "swap") => {
    setPending(null);
    setMode((current) => (current === next ? "chain" : next));
  };

  const switchMode = (next: "endless" | "daily") => {
    endHelper();
    game.switchMode(next);
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
  const status =
    hint ??
    (earned.length > 0
      ? `Earned: ${earned.map(labelOf).join(", ")}`
      : gameMode === "daily"
        ? `Daily ${date} · ${Math.max(0, DAILY_MOVES - moves)} moves left`
        : " ");

  const todays = date ? scores.board.daily[date] : undefined;

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
          <div className="mode-bar" role="group" aria-label="Game mode">
            <GameButton
              size="sm"
              variant={gameMode === "endless" ? "primary" : "secondary"}
              onClick={() => switchMode("endless")}
            >
              Endless
            </GameButton>
            <GameButton
              size="sm"
              variant={gameMode === "daily" ? "primary" : "secondary"}
              onClick={() => switchMode("daily")}
            >
              Daily
            </GameButton>
            <GameButton size="sm" variant="ghost" onClick={() => setScoresOpen((open) => !open)}>
              Scores
            </GameButton>
          </div>
          <Board
            grid={grid}
            ids={game.ids}
            merge={game.merge}
            over={finished}
            onCommit={game.commit}
            mode={mode}
            pending={pending}
            onTap={onTap}
          />
          <div className="helper-bar" role="group" aria-label="Helpers">
            <GameButton
              size="sm"
              variant={mode === "hammer" ? "primary" : "secondary"}
              disabled={finished || helpers.hammer === 0}
              onClick={() => toggleHelper("hammer")}
            >
              {`Hammer ×${helpers.hammer}`}
            </GameButton>
            <GameButton
              size="sm"
              variant={mode === "swap" ? "primary" : "secondary"}
              disabled={finished || helpers.swap === 0}
              onClick={() => toggleHelper("swap")}
            >
              {`Swap ×${helpers.swap}`}
            </GameButton>
            <GameButton
              size="sm"
              variant="secondary"
              disabled={finished || helpers.shuffle === 0}
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
              disabled={limitReached || !canUndo}
              onClick={() => {
                endHelper();
                game.undo();
              }}
            >
              Undo
            </GameButton>
          </div>
          <p className="play-status" aria-live="polite">
            {status}
          </p>
          {scoresOpen && (
            <section className="scores" aria-label="Scores">
              <p>
                Best endless: <strong>{scores.board.endless}</strong>
              </p>
              <p>
                Today's daily: <strong>{todays ?? "not played"}</strong>
              </p>
              {recentDaily(scores.board).length > 0 && (
                <ol>
                  {recentDaily(scores.board).map((entry) => (
                    <li key={entry.date}>
                      {entry.date}: {entry.score}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
        {celebration !== undefined && (
          <Celebration
            id={`milestone-${celebration}`}
            label={`${formatValue(celebration)} reached!`}
            onDone={game.celebrated}
          />
        )}
        {finished && (
          <GameOverScreen
            score={score}
            highScore={gameMode === "endless" ? Math.max(scores.board.endless, score) : undefined}
            onPlayAgain={game.restart}
          >
            {gameMode === "daily" && (
              <p>Daily complete. Come back tomorrow for a new board, or play endless now.</p>
            )}
          </GameOverScreen>
        )}
      </main>
    </GameShell>
  );
}

function labelOf(kind: "hammer" | "swap" | "shuffle"): string {
  return `+1 ${kind[0]?.toUpperCase()}${kind.slice(1)}`;
}
