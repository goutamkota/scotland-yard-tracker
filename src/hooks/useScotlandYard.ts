import { useState, useCallback } from "react";

export const TOTAL_ROUNDS = 24;
export const REVEAL_ROUNDS = [3, 8, 13, 18, 24];

export type GameStatus = "setup" | "playing" | "detectives_win" | "mrx_wins";
export type TransportMode = "taxi" | "bus" | "underground" | "black" | "double";

export interface PlayerTickets {
  taxi: number;
  bus: number;
  underground: number;
  black: number;
  double: number;
}

export interface PlayerEntry {
  location: number | null;
  transport: TransportMode | null;
  // For double move: Mr. X's second move
  secondLocation?: number | null;
  secondTransport?: TransportMode | null;
}

export interface RoundData {
  roundNumber: number;
  entries: Record<string, PlayerEntry>;
  locked: boolean;
  mrxManualReveal: boolean;
}

export interface GameState {
  status: GameStatus;
  detectiveCount: number;
  playerNames: string[];
  rounds: RoundData[];
  currentRound: number;
  currentPlayerIndex: number;
  caughtByDetective: string | null;
  caughtInRound: number | null;
  tickets: Record<string, PlayerTickets>;
  mrxPassword: string;
  // Pending location before transport is selected
  pendingLocation: number | null;
  // Double move state
  isDoubleMoveActive: boolean;
  doubleMovePhase: "first_location" | "first_transport" | "second_location" | "second_transport" | null;
}

export const MRX_INITIAL_TICKETS: PlayerTickets = {
  taxi: 4,
  bus: 3,
  underground: 3,
  black: 5,
  double: 2,
};

export const DETECTIVE_INITIAL_TICKETS: PlayerTickets = {
  taxi: 10,
  bus: 8,
  underground: 4,
  black: 0,
  double: 0,
};

function createInitialRounds(playerNames: string[]): RoundData[] {
  return Array.from({ length: TOTAL_ROUNDS }, (_, i) => ({
    roundNumber: i + 1,
    entries: Object.fromEntries(
      playerNames.map((name) => [name, { location: null, transport: null }])
    ),
    locked: false,
    mrxManualReveal: false,
  }));
}

function createInitialTickets(playerNames: string[]): Record<string, PlayerTickets> {
  return Object.fromEntries(
    playerNames.map((name) => [
      name,
      name === "mrx" ? { ...MRX_INITIAL_TICKETS } : { ...DETECTIVE_INITIAL_TICKETS },
    ])
  );
}

export function getAvailableTransports(tickets: PlayerTickets, isMrX: boolean): TransportMode[] {
  const modes: TransportMode[] = [];
  if (tickets.taxi > 0) modes.push("taxi");
  if (tickets.bus > 0) modes.push("bus");
  if (tickets.underground > 0) modes.push("underground");
  if (isMrX && tickets.black > 0) modes.push("black");
  return modes;
}

export function getTransportLabel(mode: TransportMode): string {
  switch (mode) {
    case "taxi": return "Taxi";
    case "bus": return "Bus";
    case "underground": return "Underground";
    case "black": return "Black Ticket";
    case "double": return "2X Move";
  }
}

export function getTransportEmoji(mode: TransportMode): string {
  switch (mode) {
    case "taxi": return "🚕";
    case "bus": return "🚌";
    case "underground": return "🚇";
    case "black": return "🎩";
    case "double": return "⚡";
  }
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
    tickets: {},
    mrxPassword: "",
    pendingLocation: null,
    isDoubleMoveActive: false,
    doubleMovePhase: null,
  });

  const startGame = useCallback((detectiveCount: number, mrxPassword: string) => {
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
      tickets: createInitialTickets(playerNames),
      mrxPassword,
      pendingLocation: null,
      isDoubleMoveActive: false,
      doubleMovePhase: null,
    });
  }, []);

  // Check if a detective location overlaps with another detective
  const isLocationTakenByDetective = useCallback(
    (location: number, excludePlayer: string): boolean => {
      if (game.status !== "playing") return false;
      const round = game.rounds[game.currentRound - 1];
      for (const name of game.playerNames) {
        if (name === "mrx" || name === excludePlayer) continue;
        if (round.entries[name]?.location === location) return true;
      }
      return false;
    },
    [game]
  );

  // Step 1: Submit location (sets pending, waits for transport)
  const submitLocation = useCallback((location: number) => {
    setGame((prev) => {
      if (prev.status !== "playing") return prev;

      // If in double move second phase, store as pending for second transport
      if (prev.isDoubleMoveActive && prev.doubleMovePhase === "second_location") {
        return {
          ...prev,
          pendingLocation: location,
          doubleMovePhase: "second_transport",
        };
      }

      return {
        ...prev,
        pendingLocation: location,
        doubleMovePhase: prev.playerNames[prev.currentPlayerIndex] === "mrx" ? "first_transport" : null,
      };
    });
  }, []);

  // Step 2: Select transport (completes the entry)
  const selectTransport = useCallback((transport: TransportMode, useDoubleMove: boolean = false) => {
    setGame((prev) => {
      if (prev.status !== "playing" || prev.pendingLocation === null) return prev;

      const roundIdx = prev.currentRound - 1;
      const currentPlayer = prev.playerNames[prev.currentPlayerIndex];
      const newRounds = [...prev.rounds];
      const newTickets = { ...prev.tickets };
      newTickets[currentPlayer] = { ...newTickets[currentPlayer] };

      // Decrement ticket
      newTickets[currentPlayer][transport]--;

      // Handle double move second transport
      if (prev.isDoubleMoveActive && prev.doubleMovePhase === "second_transport") {
        const existingEntry = newRounds[roundIdx].entries[currentPlayer];
        newRounds[roundIdx] = {
          ...newRounds[roundIdx],
          entries: {
            ...newRounds[roundIdx].entries,
            [currentPlayer]: {
              ...existingEntry,
              secondLocation: prev.pendingLocation,
              secondTransport: transport,
            },
          },
        };

        const nextPlayerIndex = prev.currentPlayerIndex + 1;
        return {
          ...prev,
          rounds: newRounds,
          tickets: newTickets,
          pendingLocation: null,
          isDoubleMoveActive: false,
          doubleMovePhase: null,
          currentPlayerIndex: nextPlayerIndex < prev.playerNames.length ? nextPlayerIndex : prev.currentPlayerIndex,
        };
      }

      // Normal entry
      newRounds[roundIdx] = {
        ...newRounds[roundIdx],
        entries: {
          ...newRounds[roundIdx].entries,
          [currentPlayer]: {
            ...newRounds[roundIdx].entries[currentPlayer],
            location: prev.pendingLocation,
            transport,
          },
        },
      };

      // If Mr. X and wants to use double move
      if (currentPlayer === "mrx" && useDoubleMove && newTickets[currentPlayer].double > 0) {
        newTickets[currentPlayer].double--;
        return {
          ...prev,
          rounds: newRounds,
          tickets: newTickets,
          pendingLocation: null,
          isDoubleMoveActive: true,
          doubleMovePhase: "second_location",
        };
      }

      // Advance to next player
      const nextPlayerIndex = prev.currentPlayerIndex + 1;
      return {
        ...prev,
        rounds: newRounds,
        tickets: newTickets,
        pendingLocation: null,
        isDoubleMoveActive: false,
        doubleMovePhase: null,
        currentPlayerIndex: nextPlayerIndex < prev.playerNames.length ? nextPlayerIndex : prev.currentPlayerIndex,
      };
    });
  }, []);

  const cancelPendingLocation = useCallback(() => {
    setGame((prev) => ({
      ...prev,
      pendingLocation: null,
      doubleMovePhase: prev.isDoubleMoveActive ? "second_location" : null,
    }));
  }, []);

  const allPlayersEntered =
    game.status === "playing" &&
    game.playerNames.every(
      (name) => game.rounds[game.currentRound - 1]?.entries[name]?.location !== null
    );

  const lockRound = useCallback(() => {
    setGame((prev) => {
      if (prev.status !== "playing") return prev;
      const roundIdx = prev.currentRound - 1;
      const round = prev.rounds[roundIdx];

      // Mr. X's effective location (second location if double move used)
      const mrxEntry = round.entries["mrx"];
      const mrxLocation = mrxEntry?.secondLocation ?? mrxEntry?.location;

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
      tickets: {},
      mrxPassword: "",
      pendingLocation: null,
      isDoubleMoveActive: false,
      doubleMovePhase: null,
    });
  }, []);

  const currentPlayerName =
    game.status === "playing" ? game.playerNames[game.currentPlayerIndex] : null;

  const needsTransportSelection = game.pendingLocation !== null;

  const verifyMrxPassword = useCallback(
    (password: string): boolean => {
      return password === game.mrxPassword;
    },
    [game.mrxPassword]
  );

  return {
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
  };
}

export function getPlayerDisplayName(id: string): string {
  if (id === "mrx") return "Mr. X";
  const num = id.replace("d", "");
  return `Detective ${num}`;
}
