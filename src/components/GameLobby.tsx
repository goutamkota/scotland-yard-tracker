import { useState, useEffect } from "react";
import { Users, Check, Crown, Vote, Lock, Eye, EyeOff, Copy, Wifi, UserX, Home } from "lucide-react";
import { getAvatarById } from "@/lib/avatars";
import type { ConnectedPlayer } from "@/lib/multiplayer";
import { sounds } from "@/lib/audio";
import { haptics } from "@/lib/haptics";

// Lobby phases
export type LobbyPhase = "waiting" | "voting" | "pin-setup" | "ready-to-start";

export interface LobbyPlayer {
  peerId: string;
  name: string;
  avatar: string;
  ready: boolean;
  connected: boolean;
  votedFor: string;
  isHost: boolean;
}

interface GameLobbyProps {
  sessionCode: string;
  isHost: boolean;
  myPeerId: string;
  myName: string;
  myAvatar: string;
  players: LobbyPlayer[];
  phase: LobbyPhase;
  mrxPeerId: string;           // who was voted as Mr. X
  mrxPinSet: boolean;          // whether Mr. X has set their PIN
  onReady: () => void;
  onUnready: () => void;
  onVote: (targetPeerId: string) => void;
  onSetPin: (pin: string) => void;
  onStartHunt: () => void;
  onKick?: (peerId: string) => void;
  onLeave?: () => void;
  isMyReady: boolean;
  myVotedFor: string;
}

export function GameLobby({
  sessionCode,
  isHost,
  myPeerId,
  myName,
  myAvatar,
  players,
  phase,
  mrxPeerId,
  mrxPinSet,
  onReady,
  onUnready,
  onVote,
  onSetPin,
  onStartHunt,
  onKick,
  onLeave,
  isMyReady,
  myVotedFor,
}: GameLobbyProps) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState("");

  const totalPlayers = players.length;
  const allReady = players.length >= 3 && players.every((p) => p.ready);
  const iAmMrX = myPeerId === mrxPeerId;
  const allVoted = players.every((p) => p.votedFor !== "");

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode).then(() => {
      setCodeCopied(true);
      sounds.tap();
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleSetPin = () => {
    if (pin.length < 1) {
      setPinError("PIN is required");
      return;
    }
    onSetPin(pin);
    sounds.confirm();
    haptics.confirm();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-6">
      {/* Top bar with leave button */}
      <div className="w-full max-w-md flex justify-start mt-2">
        {onLeave && (
          <button
            onClick={onLeave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Home className="w-4 h-4" />
            <span className="text-xs font-mono">Leave</span>
          </button>
        )}
      </div>

      {/* Header */}
      <div className="text-center mb-6 mt-4 sm:mt-8">
        <h1 className="game-title text-2xl sm:text-3xl md:text-4xl font-bold mb-1">
          {phase === "voting" ? "Vote for Mr. X" : phase === "pin-setup" ? "Mr. X Setup" : "Game Lobby"}
        </h1>
        <p className="text-muted-foreground font-mono text-xs sm:text-sm">
          {phase === "waiting" && "Waiting for players to join and ready up"}
          {phase === "voting" && "Vote for who should be Mr. X"}
          {phase === "pin-setup" && (iAmMrX ? "Set your secret PIN" : "Waiting for Mr. X to set their PIN...")}
          {phase === "ready-to-start" && (isHost ? "All set! Start the hunt!" : "Waiting for host to start...")}
        </p>
      </div>

      {/* Session code */}
      <div className="mb-6 p-4 rounded-xl border border-border bg-card card-glow text-center max-w-sm w-full">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Wifi className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono text-muted-foreground">Session Code</span>
        </div>
        <button
          onClick={handleCopyCode}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors"
        >
          <span className="font-mono text-xl font-bold text-primary tracking-widest">{sessionCode}</span>
          {codeCopied ? (
            <Check className="w-4 h-4 text-bus" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        <p className="text-[10px] font-mono text-muted-foreground mt-1.5">
          {totalPlayers} player{totalPlayers !== 1 ? "s" : ""} in lobby · Min 3 required
        </p>
      </div>

      {/* Player list */}
      <div className="w-full max-w-md space-y-2 mb-6">
        {players.map((player) => {
          const avatar = getAvatarById(player.avatar);
          const isMe = player.peerId === myPeerId;
          const isMrXWinner = mrxPeerId === player.peerId && (phase === "pin-setup" || phase === "ready-to-start");

          return (
            <div
              key={player.peerId}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                isMe
                  ? "border-primary/50 bg-primary/5"
                  : player.connected
                    ? "border-border bg-card"
                    : "border-border bg-muted/30 opacity-60"
              }`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                avatar ? avatar.color : "bg-muted"
              }`}>
                {avatar ? avatar.emoji : "👤"}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-semibold text-sm text-foreground truncate">
                    {player.name}
                  </span>
                  {isMe && (
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-primary/20 text-primary">you</span>
                  )}
                  {player.isHost && (
                    <Crown className="w-3.5 h-3.5 text-yellow-500" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {!player.connected && (
                    <span className="text-[9px] font-mono text-accent">Disconnected</span>
                  )}
                  {isMrXWinner && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded mr-x-badge">Mr. X</span>
                  )}
                </div>
              </div>

              {/* Status indicators */}
              <div className="flex items-center gap-1.5">
                {/* Voting phase: vote button for every player (including self) */}
                {phase === "voting" && (
                  <button
                    onClick={() => onVote(player.peerId)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all ${
                      myVotedFor === player.peerId
                        ? "bg-accent text-white hover:bg-accent/80"
                        : "bg-accent/20 text-accent hover:bg-accent/40"
                    }`}
                  >
                    {myVotedFor === player.peerId ? "Voted ✓" : isMe ? "Vote Me" : "Vote"}
                  </button>
                )}
                {phase === "voting" && player.votedFor && (
                  <Vote className="w-3.5 h-3.5 text-bus" />
                )}

                {/* Ready state (waiting phase) */}
                {phase === "waiting" && (
                  <div className="flex items-center gap-1.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      player.ready
                        ? "bg-bus/20 text-bus"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {player.ready ? <Check className="w-4 h-4" /> : <span className="text-[10px] font-mono">···</span>}
                    </div>
                    {/* Host kick button */}
                    {isHost && !isMe && onKick && (
                      <button
                        onClick={() => onKick(player.peerId)}
                        className="w-7 h-7 rounded-full flex items-center justify-center bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                        title={`Kick ${player.name}`}
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions per phase */}

      {/* Waiting phase: Ready / Unready button */}
      {phase === "waiting" && (
        <div className="w-full max-w-md space-y-3">
          <button
            onClick={() => {
              if (isMyReady) {
                onUnready();
                sounds.tap();
              } else {
                onReady();
                sounds.confirm();
                haptics.confirm();
              }
            }}
            className={`w-full py-3 rounded-xl font-display text-base font-bold transition-all ${
              isMyReady
                ? "bg-secondary text-muted-foreground hover:bg-muted"
                : "bg-bus text-white hover:opacity-90 pulse-active"
            }`}
          >
            {isMyReady ? "✓ Ready (tap to cancel)" : "I'm Ready!"}
          </button>

          {/* Host-only: Start voting when all ready */}
          {isHost && allReady && (
            <button
              onClick={() => {
                onStartHunt(); // triggers voting phase
                sounds.confirm();
              }}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-display text-base font-bold hover:opacity-90 transition-opacity"
            >
              🗳️ Start Mr. X Vote
            </button>
          )}

          {isHost && !allReady && totalPlayers >= 3 && (
            <p className="text-center text-xs font-mono text-muted-foreground">
              Waiting for all players to ready up...
            </p>
          )}

          {totalPlayers < 3 && (
            <p className="text-center text-xs font-mono text-accent">
              Need at least 3 players to start (currently {totalPlayers})
            </p>
          )}
        </div>
      )}

      {/* Voting phase */}
      {phase === "voting" && (
        <div className="w-full max-w-md text-center space-y-3">
          {myVotedFor ? (
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <Vote className="w-6 h-6 text-bus mx-auto mb-1" />
              <p className="text-sm font-mono text-muted-foreground">
                Vote cast! {allVoted ? "All votes in. Tallying..." : "Waiting for others..."}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground">
                You can tap another player to change your vote
              </p>
            </div>
          ) : (
            <p className="text-xs font-mono text-muted-foreground">
              Tap "Vote" next to a player to nominate them as Mr. X
            </p>
          )}
        </div>
      )}

      {/* PIN setup phase */}
      {phase === "pin-setup" && iAmMrX && (
        <div className="w-full max-w-sm">
          <div className="p-6 rounded-xl border border-border bg-card card-glow">
            <div className="text-center mb-4">
              <span className="text-3xl">🎩</span>
              <h3 className="font-display text-lg font-bold mt-2">You are Mr. X!</h3>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                Set a secret PIN to protect your moves
              </p>
            </div>

            <div className="relative mb-3">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (pinError) setPinError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSetPin()}
                placeholder="Set your secret PIN"
                className="w-full bg-secondary border border-border rounded-lg pl-10 pr-10 py-3 text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pinError && <p className="text-accent text-xs font-mono mb-2">{pinError}</p>}

            <button
              onClick={handleSetPin}
              className="w-full py-3 rounded-xl bg-accent text-white font-display text-base font-bold hover:opacity-90 transition-opacity"
            >
              🔒 Set PIN & Continue
            </button>
          </div>
        </div>
      )}

      {phase === "pin-setup" && !iAmMrX && (
        <div className="w-full max-w-sm text-center">
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-mono text-muted-foreground">
              Waiting for Mr. X to set their PIN...
            </p>
          </div>
        </div>
      )}

      {/* Ready to start */}
      {phase === "ready-to-start" && isHost && (
        <div className="w-full max-w-md">
          <button
            onClick={() => {
              onStartHunt();
              sounds.confirm();
              haptics.confirm();
            }}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-display text-lg font-bold hover:opacity-90 transition-opacity pulse-active"
          >
            🔍 Start the Hunt!
          </button>
        </div>
      )}

      {phase === "ready-to-start" && !isHost && (
        <div className="w-full max-w-sm text-center">
          <div className="p-6 rounded-xl border border-border bg-card">
            <p className="text-sm font-mono text-muted-foreground">
              All set! Waiting for host to start the game...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
