import { useState } from "react";
import {
  useScotlandYard,
  getPlayerDisplayName,
  REVEAL_ROUNDS,
} from "@/hooks/useScotlandYard";
import { GameSetupModal } from "@/components/GameSetupModal";
import { GameOverModal } from "@/components/GameOverModal";
import { LocationInput } from "@/components/LocationInput";
import { RoundCard } from "@/components/RoundCard";
import { MrXPasswordGate } from "@/components/MrXPasswordGate";
import { TransportSelector } from "@/components/TransportSelector";
import { TicketDisplay } from "@/components/TicketDisplay";

const Index = () => {
  const {
    game,
    startGame,
    submitLocation,
    selectTransport,
    cancelPendingLocation,
    lockRound,
    toggleMrxReveal,
    isMrxVisible,
    resetGame,
    allPlayersEntered,
    currentPlayerName,
    needsTransportSelection,
    isLocationTakenByDetective,
    verifyMrxPassword,
  } = useScotlandYard();

  const [mrxUnlocked, setMrxUnlocked] = useState(false);

  if (game.status === "setup") {
    return <GameSetupModal onStart={startGame} />;
  }

  const gameOver = game.status === "detectives_win" || game.status === "mrx_wins";
  const isMrXTurn = currentPlayerName === "mrx";
  const needsPassword = isMrXTurn && !mrxUnlocked && !gameOver && !needsTransportSelection;
  const isDoubleMoveSecondLeg = game.isDoubleMoveActive && game.doubleMovePhase === "second_location";

  // When the round advances or player changes, reset the password gate
  const handlePasswordVerified = () => {
    setMrxUnlocked(true);
  };

  // Reset password lock when Mr. X finishes their turn
  const handleTransportSelect = (transport: any, useDoubleMove: boolean) => {
    selectTransport(transport, useDoubleMove);
    // If not double-moving or finishing second leg, lock password again
    if (!useDoubleMove && !(game.isDoubleMoveActive && game.doubleMovePhase === "second_transport")) {
      // Mr. X turn done, lock the gate for next round
      if (isMrXTurn) {
        setMrxUnlocked(false);
      }
    }
  };

  // Also reset password when location is submitted for detective (no transport modal yet)
  const handleLocationSubmit = (location: number) => {
    submitLocation(location);
  };

  // Reset password gate when player changes away from Mr. X
  // Using useEffect-like pattern via checking in render
  const shouldLockMrx = !isMrXTurn && mrxUnlocked;
  if (shouldLockMrx) {
    // Safe: setMrxUnlocked(false) will trigger a re-render but won't loop
    // because on next render, mrxUnlocked will be false
    setMrxUnlocked(false);
  }

  const currentTickets = currentPlayerName ? game.tickets[currentPlayerName] : null;

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
          <div>
            <h1 className="game-title text-xl sm:text-2xl md:text-3xl font-bold">Scotland Yard</h1>
            <p className="text-muted-foreground font-mono text-[10px] sm:text-xs mt-0.5">
              Round {game.currentRound}/24 · {game.detectiveCount} Detectives
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {!gameOver && currentPlayerName && (
              <div
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-mono font-semibold ${
                  isMrXTurn ? "mr-x-badge" : "detective-badge"
                }`}
              >
                {getPlayerDisplayName(currentPlayerName)}'s turn
              </div>
            )}
            {gameOver && (
              <button
                onClick={resetGame}
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-secondary text-foreground font-mono text-xs hover:bg-muted transition-colors"
              >
                New Game
              </button>
            )}
          </div>
        </div>

        {/* Reveal rounds indicator */}
        <div className="flex gap-0.5 sm:gap-1 mt-2 sm:mt-3 flex-wrap">
          {REVEAL_ROUNDS.map((r) => (
            <span
              key={r}
              className={`text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded ${
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
          <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground ml-1 self-center">
            ← reveal
          </span>
        </div>

        {/* Current player tickets */}
        {!gameOver && currentPlayerName && currentTickets && (
          <div className="mt-3">
            <TicketDisplay
              tickets={currentTickets}
              isMrX={isMrXTurn}
              compact
            />
          </div>
        )}
      </header>

      {/* Input area */}
      {!gameOver && !allPlayersEntered && currentPlayerName && !needsTransportSelection && (
        <div className="max-w-6xl mx-auto mb-4 sm:mb-6 px-2">
          {needsPassword ? (
            <MrXPasswordGate
              onVerified={handlePasswordVerified}
              verifyPassword={verifyMrxPassword}
            />
          ) : (
            <LocationInput
              key={`${game.currentRound}-${currentPlayerName}-${isDoubleMoveSecondLeg ? "2nd" : "1st"}`}
              playerName={currentPlayerName}
              onSubmit={handleLocationSubmit}
              isLocationTaken={(loc) => isLocationTakenByDetective(loc, currentPlayerName)}
              isDoubleMoveSecond={isDoubleMoveSecondLeg}
            />
          )}
        </div>
      )}

      {/* Transport selector modal */}
      {needsTransportSelection && currentPlayerName && currentTickets && (
        <TransportSelector
          playerName={currentPlayerName}
          location={game.pendingLocation!}
          tickets={currentTickets}
          onSelect={handleTransportSelect}
          onCancel={cancelPendingLocation}
          canDoubleMove={isMrXTurn && game.tickets[currentPlayerName]?.double > 0}
          isDoubleMoving={game.isDoubleMoveActive && game.doubleMovePhase === "second_transport"}
        />
      )}

      {/* Lock Round button */}
      {!gameOver && allPlayersEntered && !game.rounds[game.currentRound - 1]?.locked && (
        <div className="max-w-6xl mx-auto mb-4 sm:mb-6 flex justify-center">
          <button
            onClick={lockRound}
            className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl bg-primary text-primary-foreground font-display text-base sm:text-lg font-bold hover:opacity-90 transition-opacity pulse-active"
          >
            🔒 Lock Round {game.currentRound}
          </button>
        </div>
      )}

      {/* Round grid */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-1.5 sm:gap-2">
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
