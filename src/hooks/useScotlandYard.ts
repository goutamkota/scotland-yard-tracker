import { useState, useCallback } from "react";

export const TOTAL_ROUNDS = 24;
export const REVEAL_ROUNDS = [3, 8, 13, 18, 24];

export type GameStatus = "setup" | "playing" | "detectives_win" | "mrx_wins";

export interface PlayerEntry {
  location: number | null;
}

export interface RoundData {
  roundNumber: number;
  entries: Record<string, PlayerEntry>; // "mrx", "d1", "d2", etc.
  locked: boolean;
  mrxManualReveal: boolean;
}

export interface GameState {
  status: GameStatus;
  detectiveCount: number;
  playerNames: string[];
  rounds: RoundData[];
  currentRound: number;
  currentPlayerIndex: number; // index into playerNames
  caughtByDetective: string | null;
  caughtInRound: number | null;
}

function createInitialRounds(playerNames: string[]): RoundData[] {
  return Array.from({ length: TOTAL_ROUNDS }, (_, i) => ({
    roundNumber: i + 1,
    entries: Object.fromEntries(playerNames.map((name) => [name, { location: null }])),
    locked: false,
    mrxManualReveal: false,
  }));
}

export function useScotlandYard() {
  const [game, setGame] = useState<GameState>({
    status: "setup",
    detectiveCount: 3,
    playerNames: [],
    rounds: [],
    currentRound: 1,
    currentPlayerIndex: 0,
    caughtByDetective: null,
    caughtInRound: null,
  });

  const startGame = useCallback((detectiveCount: number) => {
    const playerNames = ["mrx", ...Array.from({ length: detectiveCount }, (_, i) => `d${i + 1}`)];
    setGame({
      status: "playing",
      detectiveCount,
      playerNames,
      rounds: createInitialRounds(playerNames),
      currentRound: 1,
      currentPlayerIndex: 0,
      caughtByDetective: null,
      caughtInRound: null,
    });
  }, []);

  const submitLocation = useCallback((location: number) => {
    setGame((prev) => {
      if (prev.status !== "playing") return prev;
      const roundIdx = prev.currentRound - 1;
      const currentPlayer = prev.playerNames[prev.currentPlayerIndex];
      const newRounds = [...prev.rounds];
      newRounds[roundIdx] = {
        ...newRounds[roundIdx],
        entries: {
          ...newRounds[roundIdx].entries,
          [currentPlayer]: { location },
        },
      };
      const nextPlayerIndex = prev.currentPlayerIndex + 1;
      return {
        ...prev,
        rounds: newRounds,
        currentPlayerIndex: nextPlayerIndex < prev.playerNames.length ? nextPlayerIndex : prev.currentPlayerIndex,
      };
    });
  }, []);

  const allPlayersEntered = game.status === "playing" &&
    game.playerNames.every((name) => game.rounds[game.currentRound - 1]?.entries[name]?.location !== null);

  const lockRound = useCallback(() => {
    setGame((prev) => {
      if (prev.status !== "playing") return prev;
      const roundIdx = prev.currentRound - 1;
      const round = prev.rounds[roundIdx];
      const mrxLocation = round.entries["mrx"]?.location;

      // Check if any detective caught Mr. X
      let caughtBy: string | null = null;
      for (const name of prev.playerNames) {
        if (name === "mrx") continue;
        if (round.entries[name]?.location === mrxLocation) {
          caughtBy = name;
          break;
        }
      }

      const newRounds = [...prev.rounds];
      newRounds[roundIdx] = { ...round, locked: true };

      if (caughtBy) {
        return {
          ...prev,
          rounds: newRounds,
          status: "detectives_win",
          caughtByDetective: caughtBy,
          caughtInRound: prev.currentRound,
        };
      }

      if (prev.currentRound === TOTAL_ROUNDS) {
        return {
          ...prev,
          rounds: newRounds,
          status: "mrx_wins",
        };
      }

      return {
        ...prev,
        rounds: newRounds,
        currentRound: prev.currentRound + 1,
        currentPlayerIndex: 0,
      };
    });
  }, []);

  const toggleMrxReveal = useCallback((roundNumber: number) => {
    setGame((prev) => {
      const roundIdx = roundNumber - 1;
      if (!prev.rounds[roundIdx]?.locked) return prev;
      const newRounds = [...prev.rounds];
      newRounds[roundIdx] = {
        ...newRounds[roundIdx],
        mrxManualReveal: !newRounds[roundIdx].mrxManualReveal,
      };
      return { ...prev, rounds: newRounds };
    });
  }, []);

  const isMrxVisible = useCallback((roundNumber: number, round: RoundData) => {
    return REVEAL_ROUNDS.includes(roundNumber) || round.mrxManualReveal;
  }, []);

  const resetGame = useCallback(() => {
    setGame({
      status: "setup",
      detectiveCount: 3,
      playerNames: [],
      rounds: [],
      currentRound: 1,
      currentPlayerIndex: 0,
      caughtByDetective: null,
      caughtInRound: null,
    });
  }, []);

  const currentPlayerName = game.status === "playing" ? game.playerNames[game.currentPlayerIndex] : null;

  return {
    game,
    startGame,
    submitLocation,
    lockRound,
    toggleMrxReveal,
    isMrxVisible,
    resetGame,
    allPlayersEntered,
    currentPlayerName,
  };
}

export function getPlayerDisplayName(id: string): string {
  if (id === "mrx") return "Mr. X";
  const num = id.replace("d", "");
  return `Detective ${num}`;
}
