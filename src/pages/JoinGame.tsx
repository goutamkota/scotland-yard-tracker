import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { getMultiplayerManager, resetMultiplayerManager } from "@/lib/multiplayer";
import type { PeerMessage, ConnectedPlayer } from "@/lib/multiplayer";
import { getPlayerDisplayName, REVEAL_ROUNDS } from "@/hooks/useScotlandYard";
import type { GameState, TransportMode, RoundData } from "@/hooks/useScotlandYard";
import { LocationInput } from "@/components/LocationInput";
import { TransportSelector } from "@/components/TransportSelector";
import { TicketDisplay } from "@/components/TicketDisplay";
import { RoundCard } from "@/components/RoundCard";
import { GameOverModal } from "@/components/GameOverModal";
import { GameLobby, type LobbyPhase, type LobbyPlayer } from "@/components/GameLobby";
import { MrXPasswordGate } from "@/components/MrXPasswordGate";
import { MoveTimeline } from "@/components/MoveTimeline";
import { TicketDashboard } from "@/components/TicketDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getAvatarById } from "@/lib/avatars";
import { sounds } from "@/lib/audio";
import { haptics } from "@/lib/haptics";
import { Wifi, WifiOff, Users, Loader2, Home, History, BarChart3 } from "lucide-react";

const JoinGame = () => {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const playerName = searchParams.get("name") || "Player";
  const playerAvatar = searchParams.get("avatar") || "";

  // Game state (received from host)
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myRole, setMyRole] = useState<string>("");
  const [players, setPlayers] = useState<ConnectedPlayer[]>([]);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [waitingForHost, setWaitingForHost] = useState(true);

  // Lobby state (received from host)
  const [lobbyPhase, setLobbyPhase] = useState<LobbyPhase>("waiting");
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [inLobby, setInLobby] = useState(true);
  const [myReady, setMyReady] = useState(false);
  const [myVotedFor, setMyVotedFor] = useState("");
  const [mrxPeerId, setMrxPeerId] = useState("");
  const [iAmMrX, setIAmMrX] = useState(false);
  const [mrxPinSet, setMrxPinSet] = useState(false);

  // Mr. X password verification (for Mr. X player)
  const [mrxUnlocked, setMrxUnlocked] = useState(false);

  // UI modals
  const [showTimeline, setShowTimeline] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showPlayerList, setShowPlayerList] = useState(false);

  useEffect(() => {
    const mp = getMultiplayerManager();

    mp.setOnMessage((msg: PeerMessage) => {
      switch (msg.type) {
        case "join-accepted":
          setConnected(true);
          setWaitingForHost(false);
          sounds.playerJoined();
          break;

        case "lobby-update": {
          const data = msg.payload || {};
          // Always update phase from host (use 'in' check to avoid overwriting with undefined)
          if ('phase' in data && data.phase !== undefined) {
            setLobbyPhase(data.phase as LobbyPhase);
          }
          if ('mrxPeerId' in data) setMrxPeerId(String(data.mrxPeerId || ""));

          // Build lobby player list from host's broadcast
          const allPlayers: LobbyPlayer[] = [];
          // Host entry
          allPlayers.push({
            peerId: String(data.hostPeerId || ""),
            name: String(data.hostName || "Host"),
            avatar: String(data.hostAvatar || ""),
            ready: Boolean(data.hostReady),
            connected: true,
            votedFor: String(data.hostVotedFor || ""),
            isHost: true,
          });
          // Peer players
          const peerList = data.players as ConnectedPlayer[] | undefined;
          if (peerList) {
            for (const p of peerList) {
              allPlayers.push({
                peerId: p.peerId,
                name: p.name,
                avatar: p.avatar,
                ready: p.ready,
                connected: p.connected,
                votedFor: p.votedFor,
                isHost: false,
              });
            }
          }
          setLobbyPlayers(allPlayers);
          break;
        }

        case "state-sync":
          setGameState(msg.payload as unknown as GameState);
          break;

        case "player-list": {
          const playerList = (msg.payload?.players || []) as ConnectedPlayer[];
          setPlayers(playerList);
          const me = playerList.find(
            (p) => p.peerId === mp.getPeerId()
          );
          if (me?.role) {
            setMyRole(me.role);
            setIAmMrX(me.role === "mrx");
          }
          break;
        }

        case "request-move":
          if (msg.payload?.role === myRole) {
            setIsMyTurn(true);
            sounds.turnNotify();
            haptics.turnNotify();
          } else {
            setIsMyTurn(false);
          }
          break;

        case "turn-notify":
          if (msg.payload?.role === myRole) {
            setIsMyTurn(true);
            sounds.turnNotify();
            haptics.turnNotify();
          } else {
            setIsMyTurn(false);
          }
          break;

        case "vote-start":
          setLobbyPhase("voting");
          sounds.tap();
          break;

        case "vote-result":
          setMrxPeerId(String(msg.payload?.mrxPeerId || ""));
          setIAmMrX(msg.payload?.mrxPeerId === mp.getPeerId());
          setLobbyPhase("pin-setup");
          sounds.confirm();
          break;

        case "game-started":
          setGameState(msg.payload as unknown as GameState);
          setInLobby(false);
          sounds.confirm();
          haptics.confirm();
          break;

        case "start-hunt":
          setInLobby(false);
          sounds.confirm();
          haptics.confirm();
          break;

        case "kick": {
          // Disconnect and navigate to Home
          const kickReason = String(msg.payload?.reason || "You have been kicked by the host.");
          mp.destroy();
          // Use alert so the player sees why, then navigate
          alert(kickReason);
          navigate("/");
          break;
        }

        case "join-rejected":
          setError(String(msg.payload?.reason || "Join rejected"));
          break;
      }
    });

    mp.setOnPlayerLeft(() => {
      setConnected(false);
      setError("Disconnected from host");
    });

    mp.setOnError((err) => {
      setError(err);
    });

    return () => {};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRole]);

  const handleLocationSubmit = (location: number) => {
    setPendingLocation(location);
  };

  const handleTransportSelect = (transport: TransportMode, useDoubleMove: boolean) => {
    if (pendingLocation === null) return;
    const mp = getMultiplayerManager();
    mp.sendToHost({
      type: "move-submit",
      payload: {
        role: myRole,
        location: pendingLocation,
        transport,
        useDoubleMove,
      },
    });
    setPendingLocation(null);
    setIsMyTurn(false);
    sounds.confirm();
    haptics.confirm();
  };

  const handleCancelLocation = () => {
    setPendingLocation(null);
  };

  // ── Lobby handlers ──
  const handleReady = () => {
    setMyReady(true);
    const mp = getMultiplayerManager();
    mp.sendToHost({ type: "player-ready", payload: {} });
  };

  const handleUnready = () => {
    setMyReady(false);
    const mp = getMultiplayerManager();
    mp.sendToHost({ type: "player-unready", payload: {} });
  };

  const handleVote = (targetPeerId: string) => {
    // Toggle: if already voted for this player, unvote; otherwise change vote
    const newVote = myVotedFor === targetPeerId ? "" : targetPeerId;
    setMyVotedFor(newVote);
    const mp = getMultiplayerManager();
    mp.sendToHost({ type: "vote-cast", payload: { votedFor: newVote } });
  };

  const handleSetPin = (pin: string) => {
    setMrxPinSet(true);
    const mp = getMultiplayerManager();
    mp.sendToHost({ type: "mrx-pin-set", payload: { pin } });
  };

  const handleLeaveGame = () => {
    resetMultiplayerManager();
    navigate("/");
  };

  // ── Waiting to connect ──
  if (waitingForHost && !connected) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold mb-2">Connecting...</h2>
          <p className="text-muted-foreground font-mono text-sm mb-4">
            Connecting to session {code}...
          </p>
          {error && (
            <p className="text-accent font-mono text-xs mt-3">{error}</p>
          )}
          <button
            onClick={handleLeaveGame}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md font-display text-sm hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Lobby phase ──
  if (inLobby && !gameState) {
    const mp = getMultiplayerManager();
    const myPeerId = mp.getPeerId() || "";

    return (
      <GameLobby
        sessionCode={code || ""}
        isHost={false}
        myPeerId={myPeerId}
        myName={playerName}
        myAvatar={playerAvatar}
        players={lobbyPlayers}
        phase={lobbyPhase}
        mrxPeerId={mrxPeerId}
        mrxPinSet={mrxPinSet}
        onReady={handleReady}
        onUnready={handleUnready}
        onVote={handleVote}
        onSetPin={handleSetPin}
        onStartHunt={() => {}} // non-host can't start
        onLeave={handleLeaveGame}
        isMyReady={myReady}
        myVotedFor={myVotedFor}
      />
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <WifiOff className="w-8 h-8 text-accent mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold mb-2">No Game Data</h2>
          <p className="text-muted-foreground font-mono text-sm mb-4">{error || "Waiting for game state..."}</p>
          <button
            onClick={handleLeaveGame}
            className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-display text-sm hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Game UI ──
  const gameOver = gameState.status === "detectives_win" || gameState.status === "mrx_wins";
  const isMrX = myRole === "mrx";
  const currentTickets = myRole ? gameState.tickets[myRole] : null;
  const showTransportModal = pendingLocation !== null;

  // Get avatar for current turn player
  const currentTurnPlayer = gameState.playerNames[gameState.currentPlayerIndex];
  const currentTurnAvatar = (() => {
    if (!currentTurnPlayer) return null;
    if (currentTurnPlayer === myRole) return getAvatarById(playerAvatar);
    const matchedPeer = players.find(pl => pl.role === currentTurnPlayer);
    if (matchedPeer) {
      const lobby = lobbyPlayers.find(p => p.peerId === matchedPeer.peerId);
      return lobby ? getAvatarById(lobby.avatar) : null;
    }
    return null;
  })();

  const handleToggleReveal = (roundNumber: number) => {
    // Only Mr. X can toggle reveal — send to host
    if (!isMrX) return;
    const mp = getMultiplayerManager();
    mp.sendToHost({ type: "reveal-toggle", payload: { roundNumber } });
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleLeaveGame}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Home"
            >
              <Home className="w-4 h-4 text-muted-foreground" />
            </button>
            <div>
              <h1 className="game-title text-xl sm:text-2xl md:text-3xl font-bold">Scotland Yard</h1>
              <p className="text-muted-foreground font-mono text-[10px] sm:text-xs mt-0.5">
                Round {gameState.currentRound}/24 · {gameState.detectiveCount} Detectives · Code: {code}
              </p>
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
            <button
              onClick={() => setShowPlayerList(!showPlayerList)}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-muted transition-colors relative"
              title="Connected Players"
            >
              <Users className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              {lobbyPlayers.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-bus text-white text-[8px] font-mono flex items-center justify-center">
                  {lobbyPlayers.length}
                </span>
              )}
            </button>
            <div className="flex items-center gap-1 text-bus font-mono text-[10px]">
              <Wifi className="w-3 h-3" />
              {connected ? "Connected" : "Disconnected"}
            </div>
            {myRole && (
              <div className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-mono font-semibold ${
                isMrX ? "mr-x-badge" : "detective-badge"
              }`}>
                {getAvatarById(playerAvatar) && (
                  <span className="text-sm">{getAvatarById(playerAvatar)?.emoji}</span>
                )}
                {playerName} · {getPlayerDisplayName(myRole)}
              </div>
            )}
            {!gameOver && currentTurnPlayer && (
              <div
                className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-mono font-semibold ${
                  currentTurnPlayer === "mrx" ? "mr-x-badge" : "detective-badge"
                }`}
              >
                {currentTurnAvatar && (
                  <span className="text-sm">{currentTurnAvatar.emoji}</span>
                )}
                {getPlayerDisplayName(currentTurnPlayer)}'s turn
              </div>
            )}
            {gameOver && (
              <button
                onClick={() => {
                  resetMultiplayerManager();
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
        {showPlayerList && (
          <div className="mt-2 p-3 rounded-lg border border-border bg-card max-w-xs">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-mono text-muted-foreground">
              <Wifi className="w-3 h-3" />
              Players ({lobbyPlayers.length})
            </div>
            {lobbyPlayers.map((p) => {
              const peerRole = p.isHost
                ? (players.length > 0 ? undefined : undefined) // host role unknown to player
                : players.find(pl => pl.peerId === p.peerId)?.role;
              return (
                <div key={p.peerId} className="flex items-center justify-between py-1 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <span>{getAvatarById(p.avatar)?.emoji || "👤"}</span>
                    <span>{p.name}{p.isHost ? " (Host)" : ""}</span>
                  </span>
                  {peerRole && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      peerRole === "mrx" ? "mr-x-badge" : "detective-badge"
                    }`}>
                      {getPlayerDisplayName(peerRole)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Reveal rounds */}
        <div className="flex gap-0.5 sm:gap-1 mt-2 sm:mt-3 flex-wrap">
          {REVEAL_ROUNDS.map((r) => (
            <span key={r} className={`text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded ${
              gameState.currentRound === r ? "bg-primary text-primary-foreground"
                : r < gameState.currentRound ? "bg-muted text-muted-foreground"
                : "bg-secondary text-muted-foreground"
            }`}>R{r}</span>
          ))}
          <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground ml-1 self-center">← reveal</span>
        </div>

        {/* Tickets */}
        {!gameOver && currentTickets && (
          <div className="mt-3">
            <TicketDisplay tickets={currentTickets} isMrX={isMrX} compact />
          </div>
        )}
      </header>

      {/* Turn input — only when it's MY turn */}
      {isMyTurn && !gameOver && !showTransportModal && (
        <div className="max-w-6xl mx-auto mb-4 px-2">
          <LocationInput
            playerName={myRole}
            onSubmit={handleLocationSubmit}
            isLocationTaken={() => false}
            isDoubleMoveSecond={false}
          />
        </div>
      )}

      {/* Waiting for other player's turn */}
      {!isMyTurn && !gameOver && (
        <div className="max-w-6xl mx-auto mb-4 px-2">
          <div className="text-center p-6 rounded-xl border border-border bg-card card-glow">
            <p className="text-muted-foreground font-mono text-sm">
              Waiting for{" "}
              <span className="text-foreground font-semibold">
                {currentTurnAvatar && <span className="mr-1">{currentTurnAvatar.emoji}</span>}
                {currentTurnPlayer
                  ? getPlayerDisplayName(currentTurnPlayer)
                  : "..."}
              </span>'s turn
            </p>
          </div>
        </div>
      )}

      {/* Transport selector */}
      {showTransportModal && currentTickets && (
        <TransportSelector
          playerName={myRole}
          location={pendingLocation!}
          tickets={currentTickets}
          onSelect={handleTransportSelect}
          onCancel={handleCancelLocation}
          canDoubleMove={isMrX && currentTickets.double > 0}
          isDoubleMoving={false}
        />
      )}

      {/* Round grid */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-1.5 sm:gap-2">
          {gameState.rounds.map((round: RoundData) => (
            <RoundCard
              key={round.roundNumber}
              round={round}
              playerNames={gameState.playerNames}
              isCurrent={round.roundNumber === gameState.currentRound && !gameOver}
              isMrxVisible={REVEAL_ROUNDS.includes(round.roundNumber) || round.mrxManualReveal}
              onToggleReveal={() => handleToggleReveal(round.roundNumber)}
              gameOver={gameOver}
            />
          ))}
        </div>
      </div>

      {/* Modals */}
      {showTimeline && (
        <MoveTimeline game={gameState} onClose={() => setShowTimeline(false)} />
      )}

      {showDashboard && (
        <TicketDashboard game={gameState} onClose={() => setShowDashboard(false)} />
      )}

      {/* Game over */}
      {gameState.status === "detectives_win" && (
        <GameOverModal
          type="detectives_win"
          caughtBy={gameState.caughtByDetective}
          caughtInRound={gameState.caughtInRound}
          onNewGame={() => {
            resetMultiplayerManager();
            navigate("/");
          }}
        />
      )}
      {gameState.status === "mrx_wins" && (
        <GameOverModal
          type="mrx_wins"
          onNewGame={() => {
            resetMultiplayerManager();
            navigate("/");
          }}
        />
      )}
    </div>
  );
};

export default JoinGame;
