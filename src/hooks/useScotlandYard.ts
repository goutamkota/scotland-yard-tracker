import { useState, useCallback, useEffect, useRef } from "react";
import { saveSession, loadSession, SessionMeta } from "@/lib/db";

// ──────────────────── Constants ────────────────────
export const TOTAL_ROUNDS = 24;
export const REVEAL_ROUNDS = [3, 8, 13, 18, 24];

// ──────────────────── Types ────────────────────
export type GameStatus = "setup" | "playing" | "detectives_win" | "mrx_wins";
export type TransportMode = "taxi" | "bus" | "underground" | "black";

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
  secondLocation?: number | null;
  secondTransport?: TransportMode | null;
  isDoubleMove?: boolean;
}

export interface RoundData {
  roundNumber: number;
  entries: Record<string, PlayerEntry>;
  locked: boolean;
  mrxManualReveal: boolean;
}

export interface GameState {
  sessionId: string;
  sessionCode: string;
  status: GameStatus;
  detectiveCount: number;
  playerNames: string[];
  rounds: RoundData[];
  currentRound: number;
  currentPlayerIndex: number;
  caughtByDetective: string | null;
  caughtInRound: number | null;
  tickets: Record<string, PlayerTickets>;
  bank: PlayerTickets;
  mrxPassword: string;
  pendingLocation: number | null;
  isDoubleMoveActive: boolean;
  doubleMovePhase: "first_location" | "first_transport" | "second_location" | "second_transport" | null;
  createdAt: number;
}

// ──────────────────── Initial Tickets ────────────────────
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

// ──────────────────── Helpers ────────────────────

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

export function getTransportLabel(mode: TransportMode | "double"): string {
  switch (mode) {
    case "taxi": return "Taxi";
    case "bus": return "Bus";
    case "underground": return "Underground";
    case "black": return "Black Ticket";
    case "double": return "2X Move";
  }
}

export function getTransportEmoji(mode: TransportMode | "double"): string {
  switch (mode) {
    case "taxi": return "🚕";
    case "bus": return "🚌";
    case "underground": return "🚇";
    case "black": return "🎩";
    case "double": return "⚡";
  }
}

export function getPlayerDisplayName(id: string): string {
  if (id === "mrx") return "Mr. X";
  const num = id.replace("d", "");
  return `Detective ${num}`;
}

function totalTicketsFor(tickets: PlayerTickets): number {
  return tickets.taxi + tickets.bus + tickets.underground;
}

// ──────────────────── Default state ────────────────────
function defaultGameState(): GameState {
  return {
    sessionId: "",
    sessionCode: "",
    status: "setup",
    detectiveCount: 3,
    playerNames: [],
    rounds: [],
    currentRound: 1,
    currentPlayerIndex: 0,
    caughtByDetective: null,
    caughtInRound: null,
    tickets: {},
    bank: { taxi: 0, bus: 0, underground: 0, black: 0, double: 0 },
    mrxPassword: "",
    pendingLocation: null,
    isDoubleMoveActive: false,
    doubleMovePhase: null,
    createdAt: Date.now(),
  };
}

// ──────────────────── Hook ────────────────────
export function useScotlandYard(sessionId?: string) {
  const [game, setGame] = useState<GameState>(defaultGameState);
  const [loaded, setLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Persist to IndexedDB (debounced) ──
  const persistState = useCallback((state: GameState) => {
    if (!state.sessionId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const meta: SessionMeta = {
        id: state.sessionId,
        code: state.sessionCode,
        createdAt: state.createdAt,
        updatedAt: Date.now(),
        round: state.currentRound,
        status: state.status,
        detectiveCount: state.detectiveCount,
        hostName: "Host",
      };
      saveSession(state.sessionId, meta, state).catch(console.error);
    }, 100);
  }, []);

  // ── Load from IndexedDB on mount ──
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId).then((data) => {
        if (data?.state) {
          setGame(data.state as GameState);
        }
        setLoaded(true);
      }).catch(() => setLoaded(true));
    } else {
      setLoaded(true);
    }
  }, [sessionId]);

  // ── Auto-persist on every state change ──
  useEffect(() => {
    if (loaded && game.sessionId) {
      persistState(game);
    }
  }, [game, loaded, persistState]);

  // ──── State updater ────
  const updateGame = useCallback((updater: (prev: GameState) => GameState) => {
    setGame((prev) => updater(prev));
  }, []);

  // ──── Start Game ────
  const startGame = useCallback((detectiveCount: number, mrxPassword: string, sId: string, sCode: string) => {
    const playerNames = ["mrx", ...Array.from({ length: detectiveCount }, (_, i) => `d${i + 1}`)];
    const newState: GameState = {
      sessionId: sId,
      sessionCode: sCode,
      status: "playing",
      detectiveCount,
      playerNames,
      rounds: createInitialRounds(playerNames),
      currentRound: 1,
      currentPlayerIndex: 0,
      caughtByDetective: null,
      caughtInRound: null,
      tickets: createInitialTickets(playerNames),
      bank: { taxi: 0, bus: 0, underground: 0, black: 0, double: 0 },
      mrxPassword,
      pendingLocation: null,
      isDoubleMoveActive: false,
      doubleMovePhase: null,
      createdAt: Date.now(),
    };
    setGame(newState);
  }, []);

  // ──── Load an existing game state ────
  const loadGameState = useCallback((state: GameState) => {
    setGame(state);
  }, []);

  // ──── Detective location overlap check (strengthened) ────
  const isLocationTakenByDetective = useCallback(
    (location: number, excludePlayer: string): boolean => {
      if (game.status !== "playing") return false;
      const round = game.rounds[game.currentRound - 1];
      for (const name of game.playerNames) {
        if (name === "mrx" || name === excludePlayer) continue;
        if (round.entries[name]?.location === location) return true;
        if (round.entries[name]?.secondLocation === location) return true;
      }
      // Also check previous round positions for detectives who haven't moved yet
      if (game.currentRound > 1) {
        const prevRound = game.rounds[game.currentRound - 2];
        if (prevRound.locked) {
          for (const name of game.playerNames) {
            if (name === "mrx" || name === excludePlayer) continue;
            if (round.entries[name]?.location === null) {
              const prevLoc = prevRound.entries[name]?.secondLocation ?? prevRound.entries[name]?.location;
              if (prevLoc === location) return true;
            }
          }
        }
      }
      return false;
    },
    [game]
  );

  // ──── Submit Location ────
  const submitLocation = useCallback((location: number) => {
    updateGame((prev) => {
      if (prev.status !== "playing") return prev;

      if (prev.isDoubleMoveActive && prev.doubleMovePhase === "second_location") {
        return {
          ...prev,
          pendingLocation: location,
          doubleMovePhase: "second_transport" as const,
        };
      }

      return {
        ...prev,
        pendingLocation: location,
        doubleMovePhase: null,
      };
    });
  }, [updateGame]);

  // ──── Select Transport (with detective ticket transfer to Mr. X) ────
  const selectTransport = useCallback((transport: TransportMode, useDoubleMove: boolean = false) => {
    updateGame((prev) => {
      if (prev.status !== "playing" || prev.pendingLocation === null) return prev;

      const roundIdx = prev.currentRound - 1;
      const currentPlayer = prev.playerNames[prev.currentPlayerIndex];
      const isMrX = currentPlayer === "mrx";
      const newRounds = [...prev.rounds];
      const newTickets: Record<string, PlayerTickets> = {};
      for (const k of Object.keys(prev.tickets)) {
        newTickets[k] = { ...prev.tickets[k] };
      }

      // Decrement ticket
      newTickets[currentPlayer][transport]--;

      // TICKET TRANSFER: detective's used ticket goes to Mr. X
      // Mr. X's used ticket goes to the Bank
      const newBank = { ...prev.bank };
      if (isMrX) {
        newBank[transport]++;
      } else if (transport !== "black") {
        newTickets["mrx"][transport]++;
      }

      // ── Double move SECOND transport ──
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
              isDoubleMove: true,
            },
          },
        };

        const nextPlayerIndex = prev.currentPlayerIndex + 1;
        return {
          ...prev,
          rounds: newRounds,
          tickets: newTickets,
          bank: newBank,
          pendingLocation: null,
          isDoubleMoveActive: false,
          doubleMovePhase: null,
          currentPlayerIndex: nextPlayerIndex < prev.playerNames.length ? nextPlayerIndex : prev.currentPlayerIndex,
        };
      }

      // ── Normal entry ──
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

      // ── Mr. X double move activation ──
      if (isMrX && useDoubleMove && newTickets[currentPlayer].double > 0) {
        newTickets[currentPlayer].double--;
        newBank.double++;
        return {
          ...prev,
          rounds: newRounds,
          tickets: newTickets,
          bank: newBank,
          pendingLocation: null,
          isDoubleMoveActive: true,
          doubleMovePhase: "second_location" as const,
        };
      }

      // ── Advance to next player ──
      const nextPlayerIndex = prev.currentPlayerIndex + 1;
      return {
        ...prev,
        rounds: newRounds,
        tickets: newTickets,
        bank: newBank,
        pendingLocation: null,
        isDoubleMoveActive: false,
        doubleMovePhase: null,
        currentPlayerIndex: nextPlayerIndex < prev.playerNames.length ? nextPlayerIndex : prev.currentPlayerIndex,
      };
    });
  }, [updateGame]);

  // ──── Cancel pending location ────
  const cancelPendingLocation = useCallback(() => {
    updateGame((prev) => ({
      ...prev,
      pendingLocation: null,
      doubleMovePhase: prev.isDoubleMoveActive ? "second_location" as const : null,
    }));
  }, [updateGame]);

  // ──── Undo Move (before round lock) ────
  const undoMove = useCallback((playerName: string) => {
    updateGame((prev) => {
      if (prev.status !== "playing") return prev;
      const roundIdx = prev.currentRound - 1;
      const round = prev.rounds[roundIdx];
      if (round.locked) return prev;

      const entry = round.entries[playerName];
      if (!entry || entry.location === null) return prev;

      const newRounds = [...prev.rounds];
      const newTickets: Record<string, PlayerTickets> = {};
      for (const k of Object.keys(prev.tickets)) {
        newTickets[k] = { ...prev.tickets[k] };
      }

      // Restore tickets
      const newBank = { ...prev.bank };
      if (entry.transport) {
        newTickets[playerName][entry.transport]++;
        if (playerName === "mrx") {
          newBank[entry.transport]--;
        } else if (entry.transport !== "black") {
          newTickets["mrx"][entry.transport]--;
        }
      }
      if (entry.secondTransport) {
        newTickets[playerName][entry.secondTransport]++;
        if (playerName === "mrx") {
          newBank[entry.secondTransport]--;
        }
      }
      if (entry.isDoubleMove) {
        newTickets[playerName].double++;
        newBank.double--;
      }

      // Clear entry
      newRounds[roundIdx] = {
        ...round,
        entries: {
          ...round.entries,
          [playerName]: { location: null, transport: null },
        },
      };

      const playerIdx = prev.playerNames.indexOf(playerName);
      const newCurrentIdx = Math.min(playerIdx, prev.currentPlayerIndex);

      return {
        ...prev,
        rounds: newRounds,
        tickets: newTickets,
        bank: newBank,
        currentPlayerIndex: newCurrentIdx,
        isDoubleMoveActive: false,
        doubleMovePhase: null,
        pendingLocation: null,
      };
    });
  }, [updateGame]);

  // ──── All Players Entered ────
  const allPlayersEntered =
    game.status === "playing" &&
    game.playerNames.every(
      (name) => game.rounds[game.currentRound - 1]?.entries[name]?.location !== null
    );

  // ──── Lock Round ────
  const lockRound = useCallback(() => {
    updateGame((prev) => {
      if (prev.status !== "playing") return prev;
      const roundIdx = prev.currentRound - 1;
      const round = prev.rounds[roundIdx];

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
          status: "detectives_win" as GameStatus,
          caughtByDetective: caughtBy,
          caughtInRound: prev.currentRound,
        };
      }

      // Check if ALL detectives are out of tickets → Mr. X wins
      const allDetectivesOut = prev.playerNames
        .filter((n) => n !== "mrx")
        .every((n) => totalTicketsFor(prev.tickets[n]) === 0);

      if (allDetectivesOut) {
        return {
          ...prev,
          rounds: newRounds,
          status: "mrx_wins" as GameStatus,
        };
      }

      if (prev.currentRound === TOTAL_ROUNDS) {
        return {
          ...prev,
          rounds: newRounds,
          status: "mrx_wins" as GameStatus,
        };
      }

      return {
        ...prev,
        rounds: newRounds,
        currentRound: prev.currentRound + 1,
        currentPlayerIndex: 0,
      };
    });
  }, [updateGame]);

  // ──── Toggle Mr. X Manual Reveal ────
  const toggleMrxReveal = useCallback((roundNumber: number) => {
    updateGame((prev) => {
      const roundIdx = roundNumber - 1;
      if (!prev.rounds[roundIdx]?.locked) return prev;
      const newRounds = [...prev.rounds];
      newRounds[roundIdx] = {
        ...newRounds[roundIdx],
        mrxManualReveal: !newRounds[roundIdx].mrxManualReveal,
      };
      return { ...prev, rounds: newRounds };
    });
  }, [updateGame]);

  // ──── Is Mr. X Visible ────
  const isMrxVisible = useCallback((roundNumber: number, round: RoundData) => {
    return REVEAL_ROUNDS.includes(roundNumber) || round.mrxManualReveal;
  }, []);

  // ──── Reset Game ────
  const resetGame = useCallback(() => {
    setGame(defaultGameState());
  }, []);

  // ──── Derived values ────
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
    loaded,
    startGame,
    loadGameState,
    submitLocation,
    selectTransport,
    cancelPendingLocation,
    undoMove,
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
