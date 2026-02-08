import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  useScotlandYard,
  getPlayerDisplayName,
  REVEAL_ROUNDS,
} from "@/hooks/useScotlandYard";
import type { TransportMode, GameState, RoundData } from "@/hooks/useScotlandYard";
import { generateSessionCode, generateSessionId } from "@/lib/db";
import { getMultiplayerManager, resetMultiplayerManager } from "@/lib/multiplayer";
import type { PeerMessage, ConnectedPlayer } from "@/lib/multiplayer";
import { sounds } from "@/lib/audio";
import { haptics } from "@/lib/haptics";
import { GameSetupModal } from "@/components/GameSetupModal";
import { GameOverModal } from "@/components/GameOverModal";
import { LocationInput } from "@/components/LocationInput";
import { RoundCard } from "@/components/RoundCard";
import { MrXPasswordGate } from "@/components/MrXPasswordGate";
import { TransportSelector } from "@/components/TransportSelector";
import { TicketDisplay } from "@/components/TicketDisplay";
import { MoveTimeline } from "@/components/MoveTimeline";
import { TicketDashboard } from "@/components/TicketDashboard";
import { RoundSummary } from "@/components/RoundSummary";
import { GameLobby, type LobbyPhase, type LobbyPlayer } from "@/components/GameLobby";
import { getAvatarById } from "@/lib/avatars";
import {
  History, BarChart3, Undo2, Wifi, Users, Copy, Check, Home, Share2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const { sessionId: paramSessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = searchParams.get("mode") || "local"; // "local" | "host"
  const code = searchParams.get("code") || "";
  const hostNameParam = searchParams.get("name") || "";
  const hostAvatarParam = searchParams.get("avatar") || "";

  const sessionId = paramSessionId || "";
  const sessionCode = code || "";

  const {
    game,
    loaded,
    startGame,
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
  } = useScotlandYard(sessionId);

  const [mrxUnlocked, setMrxUnlocked] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showRoundSummary, setShowRoundSummary] = useState(false);
  const [lastLockedRound, setLastLockedRound] = useState(0);
  const [codeCopied, setCodeCopied] = useState(false);

  // Multiplayer state
  const [connectedPlayers, setConnectedPlayers] = useState<ConnectedPlayer[]>([]);
  const [showPlayerList, setShowPlayerList] = useState(false);
  const isHost = mode === "host";
  const isMultiplayer = mode === "host";

  // ── Lobby state (host manages) ──
  const [lobbyPhase, setLobbyPhase] = useState<LobbyPhase>("waiting");
  const [hostReady, setHostReady] = useState(false);
  const [hostVotedFor, setHostVotedFor] = useState("");
  const [mrxPeerId, setMrxPeerId] = useState("");
  const [mrxPin, setMrxPin] = useState("");
  const [mrxPinSet, setMrxPinSet] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // The host's own peer ID (always `sy-<code>`)
  const hostPeerId = `sy-${sessionCode}`;

  // Refs to track latest lobby state for broadcastLobbyState (avoids stale closures)
  const lobbyPhaseRef = useRef(lobbyPhase);
  lobbyPhaseRef.current = lobbyPhase;
  const hostReadyRef = useRef(hostReady);
  hostReadyRef.current = hostReady;
  const hostVotedForRef = useRef(hostVotedFor);
  hostVotedForRef.current = hostVotedFor;
  const mrxPeerIdRef = useRef(mrxPeerId);
  mrxPeerIdRef.current = mrxPeerId;

  // ── Setup multiplayer for host ──
  useEffect(() => {
    if (!isHost) return;

    const mp = getMultiplayerManager();

    mp.setOnMessage((msg: PeerMessage, senderId: string) => {
      switch (msg.type) {
        case "player-ready":
          mp.setPlayerReady(senderId, true);
          setConnectedPlayers([...mp.getPlayers()]);
          broadcastLobbyState();
          break;

        case "player-unready":
          mp.setPlayerReady(senderId, false);
          setConnectedPlayers([...mp.getPlayers()]);
          broadcastLobbyState();
          break;

        case "vote-cast": {
          // Allow re-voting: overwrite previous vote
          const newVote = String(msg.payload?.votedFor || "");
          mp.setPlayerVote(senderId, newVote);
          setConnectedPlayers([...mp.getPlayers()]);
          // Use setTimeout to ensure state is flushed before broadcast & tally
          setTimeout(() => {
            broadcastLobbyState();
            checkAllVoted();
          }, 0);
          break;
        }

        case "mrx-pin-set":
          setMrxPin(String(msg.payload?.pin || ""));
          setMrxPinSet(true);
          setLobbyPhase("ready-to-start");
          broadcastLobbyState();
          break;

        case "move-submit": {
          // Decentralized: apply move from remote player
          const p = msg.payload || {};
          const role = String(p.role || "");
          const location = Number(p.location);
          const transport = String(p.transport || "") as TransportMode;
          const useDoubleMove = Boolean(p.useDoubleMove);
          if (role && !isNaN(location) && transport) {
            applyRemoteMove(role, location, transport, useDoubleMove);
          }
          break;
        }

        case "reveal-toggle": {
          // Mr. X player requesting a round reveal toggle
          const roundNum = Number(msg.payload?.roundNumber);
          if (!isNaN(roundNum) && roundNum > 0) {
            toggleMrxReveal(roundNum);
          }
          break;
        }

        default:
          break;
      }
    });

    mp.setOnPlayerJoined((player) => {
      setConnectedPlayers([...mp.getPlayers()]);
      sounds.playerJoined();
      broadcastLobbyState();
    });

    mp.setOnPlayerLeft(() => {
      setConnectedPlayers([...mp.getPlayers()]);
      broadcastLobbyState();
    });

    mp.setOnError((err) => {
      console.error("Multiplayer error:", err);
    });

    return () => {};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  // ── Apply remote player move (host processes it) ──
  const applyRemoteMove = (role: string, location: number, transport: TransportMode, useDoubleMove: boolean) => {
    // Submit location then transport in sequence
    submitLocation(location);
    // Use a microtask to ensure state update from submitLocation is processed
    setTimeout(() => {
      selectTransport(transport, useDoubleMove);
    }, 50);
  };

  // ── Broadcast lobby state to all peers ──
  const broadcastLobbyState = () => {
    if (!isHost) return;
    const mp = getMultiplayerManager();
    const allPlayers = mp.getPlayers();

    // Use refs to always read the latest state (avoids stale closures in callbacks)
    mp.broadcastLobbyUpdate({
      players: allPlayers,
      hostName: hostNameParam,
      hostAvatar: hostAvatarParam,
      hostPeerId,
      hostReady: hostReadyRef.current,
      hostVotedFor: hostVotedForRef.current,
      phase: lobbyPhaseRef.current,
      votingActive: lobbyPhaseRef.current === "voting",
      mrxPeerId: mrxPeerIdRef.current,
    });
  };

  // Broadcast lobby whenever lobby state changes
  useEffect(() => {
    if (isHost && !gameStarted) {
      broadcastLobbyState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyPhase, hostReady, hostVotedFor, mrxPeerId, mrxPinSet, connectedPlayers.length]);

  // ── Check if all voted ──
  const checkAllVoted = () => {
    if (lobbyPhaseRef.current !== "voting") return;
    const mp = getMultiplayerManager();
    const allPeersVoted = mp.allPlayersVoted();
    const currentHostVote = hostVotedForRef.current;
    if (allPeersVoted && currentHostVote) {
      // Tally
      const { winner } = mp.tallyVotes(currentHostVote);
      if (winner) {
        setMrxPeerId(winner);
        setLobbyPhase("pin-setup");

        // If the host is Mr. X, pin-setup is handled locally
        // If a peer is Mr. X, we wait for them to send mrx-pin-set

        mp.broadcast({
          type: "vote-result",
          payload: { mrxPeerId: winner },
        });
      }
    }
  };

  // Re-check when host votes
  useEffect(() => {
    if (lobbyPhase === "voting" && hostVotedFor) {
      checkAllVoted();
    }
  }, [hostVotedFor, lobbyPhase]);

  // ── Broadcast game state to peers when game changes ──
  useEffect(() => {
    if (!isHost || !gameStarted || game.status === "setup") return;

    const mp = getMultiplayerManager();

    // Send sanitized state to detectives, full state to Mr. X
    const sanitized = sanitizeStateForDetectives(game);
    const mrxFullState = sanitizeForMrX(game);

    for (const p of mp.getPlayers()) {
      if (p.role === "mrx") {
        // Mr. X sees full state (their own locations)
        mp.sendToPeer(p.peerId, {
          type: "state-sync",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: mrxFullState as unknown as Record<string, any>,
        });
      } else {
        // Detectives see sanitized state
        mp.sendToPeer(p.peerId, {
          type: "state-sync",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: sanitized as unknown as Record<string, any>,
        });
      }
    }

    // Send turn notifications — tell the current player it's their turn
    if (game.status === "playing" && currentPlayerName) {
      const players = mp.getPlayers();
      const currentTurnPlayer = players.find((p) => p.role === currentPlayerName);
      if (currentTurnPlayer) {
        mp.requestMove(currentTurnPlayer.peerId, currentPlayerName, game.currentRound);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.currentRound, game.currentPlayerIndex, game.status, isHost, currentPlayerName, gameStarted]);

  // Show round summary after lock
  useEffect(() => {
    if (game.status === "playing" && game.currentRound > lastLockedRound + 1) {
      const justLockedRound = game.currentRound - 1;
      if (justLockedRound > 0 && game.rounds[justLockedRound - 1]?.locked) {
        setShowRoundSummary(true);
        setLastLockedRound(justLockedRound);
        sounds.lock();
        haptics.lock();
      }
    }
  }, [game.currentRound, game.rounds, lastLockedRound, game.status]);

  // Broadcast game state on transition to "playing"
  useEffect(() => {
    if (isHost && game.status === "playing" && gameStarted) {
      const mp = getMultiplayerManager();
      const sanitized = sanitizeStateForDetectives(game);
      const mrxFullState = sanitizeForMrX(game);
      for (const p of mp.getPlayers()) {
        if (p.role === "mrx") {
          mp.sendToPeer(p.peerId, {
            type: "game-started",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: mrxFullState as unknown as Record<string, any>,
          });
        } else {
          mp.sendToPeer(p.peerId, {
            type: "game-started",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: sanitized as unknown as Record<string, any>,
          });
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, game.status, gameStarted]);

  // Reset password gate when player changes
  const isMrXTurn = currentPlayerName === "mrx";
  useEffect(() => {
    if (!isMrXTurn && mrxUnlocked) {
      setMrxUnlocked(false);
    }
  }, [isMrXTurn, mrxUnlocked]);

  // ── Loading ──
  if (!loaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground font-mono text-xs">Loading game...</p>
        </div>
      </div>
    );
  }

  // ── Lobby (multiplayer only, before game starts) ──
  if (isMultiplayer && !gameStarted && game.status === "setup") {
    const mp = getMultiplayerManager();
    const peerPlayers = connectedPlayers;

    // Build lobby player list: host + peers
    const lobbyPlayers: LobbyPlayer[] = [
      {
        peerId: hostPeerId,
        name: hostNameParam,
        avatar: hostAvatarParam,
        ready: hostReady,
        connected: true,
        votedFor: hostVotedFor,
        isHost: true,
      },
      ...peerPlayers.map((p) => ({
        peerId: p.peerId,
        name: p.name,
        avatar: p.avatar,
        ready: p.ready,
        connected: p.connected,
        votedFor: p.votedFor,
        isHost: false,
      })),
    ];

    const handleHostReady = () => setHostReady(true);
    const handleHostUnready = () => setHostReady(false);

    const handleHostVote = (targetPeerId: string) => {
      // Toggle: if already voted for this player, unvote; otherwise change vote
      if (hostVotedFor === targetPeerId) {
        setHostVotedFor("");
      } else {
        setHostVotedFor(targetPeerId);
      }
    };

    const handleKickPlayer = (peerId: string) => {
      mp.kickPlayer(peerId);
      setConnectedPlayers([...mp.getPlayers()]);
      broadcastLobbyState();
    };

    const handleLeaveLobby = () => {
      resetMultiplayerManager();
      navigate("/");
    };

    const handleSetPin = (pin: string) => {
      setMrxPin(pin);
      setMrxPinSet(true);
      setLobbyPhase("ready-to-start");
    };

    const handleStartHunt = () => {
      if (lobbyPhase === "waiting") {
        // All ready → start voting
        setLobbyPhase("voting");
        mp.broadcast({ type: "vote-start", payload: {} });
        return;
      }

      if (lobbyPhase === "ready-to-start") {
        // Actually start the game
        const detectiveCount = lobbyPlayers.length - 1; // everyone except Mr. X
        const playerNames = ["mrx", ...Array.from({ length: detectiveCount }, (_, i) => `d${i + 1}`)];

        // Assign roles: Mr. X gets "mrx", others get "d1", "d2", etc.
        let dIdx = 1;
        for (const lp of lobbyPlayers) {
          if (lp.peerId === mrxPeerId) {
            if (lp.peerId !== hostPeerId) {
              mp.assignRole(lp.peerId, "mrx");
            }
          } else {
            if (lp.peerId !== hostPeerId) {
              mp.assignRole(lp.peerId, `d${dIdx}`);
            }
            dIdx++;
          }
        }

        // Determine host's own role
        const hostRole = mrxPeerId === hostPeerId ? "mrx" : `d${lobbyPlayers.filter(p => p.peerId !== mrxPeerId && lobbyPlayers.indexOf(p) < lobbyPlayers.findIndex(x => x.peerId === hostPeerId)).length}`;
        // Simpler: just figure it out
        let hostRoleStr = "";
        let di = 1;
        for (const lp of lobbyPlayers) {
          if (lp.peerId === mrxPeerId) {
            if (lp.peerId === hostPeerId) hostRoleStr = "mrx";
          } else {
            if (lp.peerId === hostPeerId) hostRoleStr = `d${di}`;
            di++;
          }
        }

        startGame(detectiveCount, mrxPin, sessionId, sessionCode);
        setGameStarted(true);

        mp.broadcast({
          type: "start-hunt",
          payload: { detectiveCount },
        });
      }
    };

    return (
      <GameLobby
        sessionCode={sessionCode}
        isHost={true}
        myPeerId={hostPeerId}
        myName={hostNameParam}
        myAvatar={hostAvatarParam}
        players={lobbyPlayers}
        phase={lobbyPhase}
        mrxPeerId={mrxPeerId}
        mrxPinSet={mrxPinSet}
        onReady={handleHostReady}
        onUnready={handleHostUnready}
        onVote={handleHostVote}
        onSetPin={handleSetPin}
        onStartHunt={handleStartHunt}
        onKick={handleKickPlayer}
        onLeave={handleLeaveLobby}
        isMyReady={hostReady}
        myVotedFor={hostVotedFor}
      />
    );
  }

  // ── Local game setup ──
  if (!isMultiplayer && game.status === "setup") {
    return (
      <GameSetupModal
        onStart={(detectiveCount, mrxPassword) => {
          startGame(detectiveCount, mrxPassword, sessionId, sessionCode);
        }}
        sessionCode={sessionCode}
        isMultiplayer={false}
        connectedPlayers={[]}
      />
    );
  }

  // ── Game UI ──
  const gameOver = game.status === "detectives_win" || game.status === "mrx_wins";
  const needsPassword = isMrXTurn && !mrxUnlocked && !gameOver && !needsTransportSelection;
  const isDoubleMoveSecondLeg = game.isDoubleMoveActive && game.doubleMovePhase === "second_location";

  // In multiplayer, determine if it's the HOST's turn to enter input
  // (decentralized: each player enters on their device, host only enters for host's role)
  let hostRole = "";
  if (isMultiplayer && gameStarted) {
    const mp = getMultiplayerManager();
    // Figure out host's role
    if (mrxPeerId === hostPeerId) {
      hostRole = "mrx";
    } else {
      let di = 1;
      const peerPlayers = mp.getPlayers();
      const allLobby = [
        { peerId: hostPeerId },
        ...peerPlayers,
      ];
      for (const lp of allLobby) {
        if (lp.peerId === mrxPeerId) continue;
        if (lp.peerId === hostPeerId) {
          hostRole = `d${di}`;
          break;
        }
        di++;
      }
    }
  }
  const isHostTurn = isMultiplayer ? (currentPlayerName === hostRole) : true;
  const showInputForHost = !isMultiplayer || isHostTurn;
  const isHostMrX = hostRole === "mrx";

  // In multiplayer, non-Mr.X host sees sanitized state (can't see Mr. X locations)
  // In local mode or if host IS Mr. X, show full game
  const viewGame = (isMultiplayer && !isHostMrX) ? sanitizeStateForDetectives(game) : game;

  const handlePasswordVerified = () => {
    setMrxUnlocked(true);
  };

  const handleTransportSelect = (transport: TransportMode, useDoubleMove: boolean) => {
    selectTransport(transport, useDoubleMove);
    sounds.confirm();
    haptics.confirm();
    if (!useDoubleMove && !(game.isDoubleMoveActive && game.doubleMovePhase === "second_transport")) {
      if (isMrXTurn) {
        setMrxUnlocked(false);
      }
    }
  };

  const handleLocationSubmit = (location: number) => {
    submitLocation(location);
    sounds.tap();
    haptics.tap();
  };

  const handleLockRound = () => {
    lockRound();
  };

  const handleUndo = (playerName: string) => {
    undoMove(playerName);
    sounds.undo();
    haptics.tap();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const currentTickets = currentPlayerName ? viewGame.tickets[currentPlayerName] : null;
  const currentRound = viewGame.rounds[viewGame.currentRound - 1];

  // For multiplayer, find the avatar of the current player
  const getCurrentPlayerAvatar = () => {
    if (!isMultiplayer || !currentPlayerName) return null;
    if (currentPlayerName === hostRole) {
      return getAvatarById(hostAvatarParam);
    }
    const mp = getMultiplayerManager();
    const peer = mp.getPlayers().find((p) => p.role === currentPlayerName);
    return peer ? getAvatarById(peer.avatar) : null;
  };

  const currentPlayerAvatar = getCurrentPlayerAvatar();

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/")}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Home"
            >
              <Home className="w-4 h-4 text-muted-foreground" />
            </button>
            <div>
              <h1 className="game-title text-xl sm:text-2xl md:text-3xl font-bold">Scotland Yard</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-muted-foreground font-mono text-[10px] sm:text-xs">
                  Round {game.currentRound}/24 · {game.detectiveCount} Detectives
                </p>
                {sessionCode && (
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted hover:bg-secondary transition-colors"
                    title="Copy session code"
                  >
                    <span className="font-mono text-[10px] text-primary font-semibold">{sessionCode}</span>
                    {codeCopied ? (
                      <Check className="w-3 h-3 text-bus" />
                    ) : (
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <ThemeToggle />
            <button
              onClick={() => setShowTimeline(true)}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-muted transition-colors"
              title="Move History"
            >
              <History className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
            <button
              onClick={() => setShowDashboard(true)}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-muted transition-colors"
              title="Ticket Dashboard"
            >
              <BarChart3 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>

            {isMultiplayer && (
              <button
                onClick={() => setShowPlayerList(!showPlayerList)}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-muted transition-colors relative"
                title="Connected Players"
              >
                <Users className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                {connectedPlayers.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-bus text-white text-[8px] font-mono flex items-center justify-center">
                    {connectedPlayers.length}
                  </span>
                )}
              </button>
            )}

            {!gameOver && currentPlayerName && (
              <div
                className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-mono font-semibold ${
                  isMrXTurn ? "mr-x-badge" : "detective-badge"
                }`}
              >
                {currentPlayerAvatar && (
                  <span className="text-sm">{currentPlayerAvatar.emoji}</span>
                )}
                {getPlayerDisplayName(currentPlayerName)}'s turn
              </div>
            )}

            {gameOver && (
              <button
                onClick={() => {
                  resetGame();
                  navigate("/");
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-secondary text-foreground font-mono text-xs hover:bg-muted transition-colors"
              >
                New Game
              </button>
            )}
          </div>
        </div>

        {/* Connected players dropdown */}
        {showPlayerList && isMultiplayer && (
          <div className="mt-2 p-3 rounded-lg border border-border bg-card max-w-xs">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-mono text-muted-foreground">
              <Wifi className="w-3 h-3" />
              Connected ({connectedPlayers.filter((p) => p.connected).length + 1})
            </div>
            {/* Host */}
            <div className="flex items-center justify-between py-1 text-xs font-mono">
              <span className="flex items-center gap-1.5">
                <span>{getAvatarById(hostAvatarParam)?.emoji || "👤"}</span>
                <span className="text-foreground">{hostNameParam} (Host)</span>
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                hostRole === "mrx" ? "mr-x-badge" : "detective-badge"
              }`}>
                {hostRole ? getPlayerDisplayName(hostRole) : "—"}
              </span>
            </div>
            {connectedPlayers.map((p) => (
              <div key={p.peerId} className="flex items-center justify-between py-1 text-xs font-mono">
                <span className={`flex items-center gap-1.5 ${p.connected ? "text-foreground" : "text-muted-foreground line-through"}`}>
                  <span>{getAvatarById(p.avatar)?.emoji || "👤"}</span>
                  <span>{p.name}</span>
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                  p.role === "mrx" ? "mr-x-badge" : p.role ? "detective-badge" : "bg-muted text-muted-foreground"
                }`}>
                  {p.role ? getPlayerDisplayName(p.role) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}

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

      {/* Input area — only shown if it's this device's turn */}
      {!gameOver && !allPlayersEntered && currentPlayerName && !needsTransportSelection && showInputForHost && (
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

      {/* Waiting for remote player */}
      {!gameOver && !allPlayersEntered && currentPlayerName && !needsTransportSelection && !showInputForHost && (
        <div className="max-w-6xl mx-auto mb-4 sm:mb-6 px-2">
          <div className="text-center p-6 rounded-xl border border-border bg-card card-glow">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground font-mono text-sm">
              Waiting for{" "}
              <span className="text-foreground font-semibold">
                {currentPlayerAvatar && <span className="mr-1">{currentPlayerAvatar.emoji}</span>}
                {getPlayerDisplayName(currentPlayerName)}
              </span>{" "}
              to make their move...
            </p>
          </div>
        </div>
      )}

      {/* Transport selector modal — only for host's own turn */}
      {needsTransportSelection && currentPlayerName && currentTickets && showInputForHost && (
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

      {/* Current round entries with Undo buttons */}
      {!gameOver && currentRound && !currentRound.locked && (
        <div className="max-w-6xl mx-auto mb-4 sm:mb-6 px-2">
          <div className="flex flex-wrap gap-2 justify-center">
            {viewGame.playerNames.map((name) => {
              const entry = currentRound.entries[name];
              if (!entry || entry.location === null) return null;
              const isMrX = name === "mrx";

              return (
                <div
                  key={name}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs font-mono"
                >
                  <span className={isMrX ? "text-accent" : "text-detective"}>
                    {isMrX ? "X" : name.toUpperCase()}
                  </span>
                  <span className="text-muted-foreground">
                    {isMrX ? "✓" : `#${entry.location}`}
                  </span>
                  {/* Only allow undo in local mode or for host's own role */}
                  {(!isMultiplayer || name === hostRole) && (
                    <button
                      onClick={() => handleUndo(name)}
                      className="p-0.5 rounded hover:bg-secondary transition-colors ml-0.5"
                      title={`Undo ${getPlayerDisplayName(name)}'s move`}
                    >
                      <Undo2 className="w-3 h-3 text-muted-foreground hover:text-accent" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lock Round button */}
      {!gameOver && allPlayersEntered && !currentRound?.locked && (
        <div className="max-w-6xl mx-auto mb-4 sm:mb-6 flex justify-center">
          <button
            onClick={handleLockRound}
            className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl bg-primary text-primary-foreground font-display text-base sm:text-lg font-bold hover:opacity-90 transition-opacity pulse-active"
          >
            🔒 Lock Round {game.currentRound}
          </button>
        </div>
      )}

      {/* Round grid */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-1.5 sm:gap-2">
          {viewGame.rounds.map((round) => (
            <RoundCard
              key={round.roundNumber}
              round={round}
              playerNames={viewGame.playerNames}
              isCurrent={round.roundNumber === viewGame.currentRound && !gameOver}
              isMrxVisible={isMrxVisible(round.roundNumber, round)}
              onToggleReveal={() => {
                // Only Mr. X can toggle reveal (in multiplayer: only if host IS Mr. X)
                if (!isMultiplayer || isHostMrX) {
                  toggleMrxReveal(round.roundNumber);
                }
              }}
              gameOver={gameOver}
            />
          ))}
        </div>
      </div>

      {/* Modals */}
      {showTimeline && (
        <MoveTimeline game={viewGame} onClose={() => setShowTimeline(false)} />
      )}

      {showDashboard && (
        <TicketDashboard game={viewGame} onClose={() => setShowDashboard(false)} />
      )}

      {showRoundSummary && lastLockedRound > 0 && viewGame.rounds[lastLockedRound - 1] && (
        <RoundSummary
          round={viewGame.rounds[lastLockedRound - 1]}
          playerNames={viewGame.playerNames}
          onClose={() => setShowRoundSummary(false)}
        />
      )}

      {game.status === "detectives_win" && (
        <GameOverModal
          type="detectives_win"
          caughtBy={game.caughtByDetective}
          caughtInRound={game.caughtInRound}
          onNewGame={() => {
            resetGame();
            navigate("/");
          }}
        />
      )}
      {game.status === "mrx_wins" && (
        <GameOverModal
          type="mrx_wins"
          onNewGame={() => {
            resetGame();
            navigate("/");
          }}
        />
      )}
    </div>
  );
};

// Sanitize game state for detective peers — strip Mr. X's hidden locations
function sanitizeStateForDetectives(game: GameState): GameState {
  const sanitized: GameState = JSON.parse(JSON.stringify(game));
  sanitized.mrxPassword = "";

  sanitized.rounds.forEach((round: RoundData, idx: number) => {
    const roundNum = idx + 1;
    const isReveal = REVEAL_ROUNDS.includes(roundNum) || round.mrxManualReveal;
    if (!isReveal && round.entries?.mrx) {
      round.entries.mrx.location = null;
      round.entries.mrx.secondLocation = null;
    }
  });

  return sanitized;
}

// Sanitize for Mr. X peer — keep all locations but strip password
function sanitizeForMrX(game: GameState): GameState {
  const sanitized: GameState = JSON.parse(JSON.stringify(game));
  sanitized.mrxPassword = "";
  return sanitized;
}

export default Index;
