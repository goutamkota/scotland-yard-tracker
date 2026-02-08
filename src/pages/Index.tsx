import { useScotlandYard, getPlayerDisplayName, REVEAL_ROUNDS } from "@/hooks/useScotlandYard";
import { GameSetupModal } from "@/components/GameSetupModal";
import { GameOverModal } from "@/components/GameOverModal";
import { LocationInput } from "@/components/LocationInput";
import { RoundCard } from "@/components/RoundCard";

const Index = () => {
  const {
    game,
    startGame,
    submitLocation,
    lockRound,
    toggleMrxReveal,
    isMrxVisible,
    resetGame,
    allPlayersEntered,
    currentPlayerName,
  } = useScotlandYard();

  if (game.status === "setup") {
    return <GameSetupModal onStart={startGame} />;
  }

  const gameOver = game.status === "detectives_win" || game.status === "mrx_wins";

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="game-title text-2xl md:text-3xl font-bold">Scotland Yard</h1>
            <p className="text-muted-foreground font-mono text-xs mt-1">
              Round {game.currentRound} of 24 · {game.detectiveCount} Detectives
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!gameOver && currentPlayerName && (
              <div className={`px-3 py-1.5 rounded-full text-xs font-mono font-semibold ${
                currentPlayerName === "mrx" ? "mr-x-badge" : "detective-badge"
              }`}>
                {getPlayerDisplayName(currentPlayerName)}'s turn
              </div>
            )}
            {gameOver && (
              <button
                onClick={resetGame}
                className="px-4 py-2 rounded-lg bg-secondary text-foreground font-mono text-xs hover:bg-muted transition-colors"
              >
                New Game
              </button>
            )}
          </div>
        </div>

        {/* Reveal rounds indicator */}
        <div className="flex gap-1 mt-3 flex-wrap">
          {REVEAL_ROUNDS.map((r) => (
            <span
              key={r}
              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                game.currentRound === r
                  ? "bg-primary text-primary-foreground"
                  : r < game.currentRound
                  ? "bg-muted text-muted-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              R{r}
            </span>
          ))}
          <span className="text-[10px] font-mono text-muted-foreground ml-1 self-center">
            ← reveal rounds
          </span>
        </div>
      </header>

      {/* Input area */}
      {!gameOver && !allPlayersEntered && currentPlayerName && (
        <div className="max-w-6xl mx-auto mb-6 flex justify-center">
          <LocationInput
            key={`${game.currentRound}-${currentPlayerName}`}
            playerName={currentPlayerName}
            onSubmit={submitLocation}
          />
        </div>
      )}

      {/* Lock Round button */}
      {!gameOver && allPlayersEntered && !game.rounds[game.currentRound - 1]?.locked && (
        <div className="max-w-6xl mx-auto mb-6 flex justify-center">
          <button
            onClick={lockRound}
            className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-display text-lg font-bold hover:opacity-90 transition-opacity pulse-gold"
          >
            🔒 Lock Round {game.currentRound}
          </button>
        </div>
      )}

      {/* Round grid */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
          {game.rounds.map((round) => (
            <RoundCard
              key={round.roundNumber}
              round={round}
              playerNames={game.playerNames}
              isCurrent={round.roundNumber === game.currentRound && !gameOver}
              isMrxVisible={isMrxVisible(round.roundNumber, round)}
              onToggleReveal={() => toggleMrxReveal(round.roundNumber)}
              gameOver={gameOver}
            />
          ))}
        </div>
      </div>

      {/* Game over modals */}
      {game.status === "detectives_win" && (
        <GameOverModal
          type="detectives_win"
          caughtBy={game.caughtByDetective}
          caughtInRound={game.caughtInRound}
          onNewGame={resetGame}
        />
      )}
      {game.status === "mrx_wins" && (
        <GameOverModal type="mrx_wins" onNewGame={resetGame} />
      )}
    </div>
  );
};

export default Index;
