import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listSessions, deleteSession, generateSessionCode, generateSessionId, SessionMeta } from "@/lib/db";
import { getMultiplayerManager, resetMultiplayerManager } from "@/lib/multiplayer";
import { sounds } from "@/lib/audio";
import { haptics } from "@/lib/haptics";
import { Users, Plus, Play, Trash2, Wifi, Hash, Clock, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AvatarPicker } from "@/components/AvatarPicker";
import { AVATARS, type Avatar } from "@/lib/avatars";

const Home = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hostName, setHostName] = useState("");
  const [joinError, setJoinError] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Avatar selection
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATARS[0].id);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const list = await listSessions();
    setSessions(list);
  };

  const handleCreateLocal = () => {
    sounds.tap();
    haptics.tap();
    const id = generateSessionId();
    const code = generateSessionCode();
    navigate(`/game/${id}?code=${code}&mode=local`);
  };

  const handleCreateOnline = async () => {
    if (!hostName.trim()) return;
    sounds.confirm();
    haptics.confirm();
    setConnecting(true);

    const id = generateSessionId();
    const code = generateSessionCode();

    try {
      const mp = getMultiplayerManager();
      await mp.hostSession(code, hostName.trim(), selectedAvatar);
      navigate(`/game/${id}?code=${code}&mode=host&name=${encodeURIComponent(hostName.trim())}&avatar=${encodeURIComponent(selectedAvatar)}`);
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : "Failed to create session");
      setConnecting(false);
      resetMultiplayerManager();
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !playerName.trim()) return;
    sounds.confirm();
    haptics.confirm();
    setConnecting(true);
    setJoinError("");

    try {
      const mp = getMultiplayerManager();
      await mp.joinSession(joinCode.trim().toUpperCase(), playerName.trim(), selectedAvatar);
      navigate(`/join/${joinCode.trim().toUpperCase()}?name=${encodeURIComponent(playerName.trim())}&avatar=${encodeURIComponent(selectedAvatar)}`);
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : "Failed to join session");
      setConnecting(false);
      resetMultiplayerManager();
    }
  };

  const handleContinue = (session: SessionMeta) => {
    sounds.tap();
    haptics.tap();
    navigate(`/game/${session.id}?code=${session.code}&mode=local`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    sounds.undo();
    await deleteSession(id);
    loadSessions();
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "playing":
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary">In Progress</span>;
      case "detectives_win":
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-detective/20 text-detective">Detectives Won</span>;
      case "mrx_wins":
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent">Mr. X Won</span>;
      default:
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Setup</span>;
    }
  };

  const resetModalState = () => {
    setJoinError("");
    setConnecting(false);
    setSelectedAvatar(AVATARS[0].id);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-6">
      {/* Header */}
      <div className="text-center mb-8 mt-8 sm:mt-12 relative">
        <div className="absolute top-0 right-0">
          <ThemeToggle />
        </div>
        <h1 className="game-title text-3xl sm:text-4xl md:text-5xl font-bold mb-2">Scotland Yard</h1>
        <p className="text-muted-foreground font-mono text-xs sm:text-sm">
          Track the chase across London
        </p>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-md space-y-3 mb-8">
        {/* Create New Game - Local */}
        <button
          onClick={handleCreateLocal}
          className="w-full flex items-center gap-3 px-5 py-4 rounded-xl border border-border bg-card hover:bg-secondary transition-all duration-200 card-glow group"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left flex-1">
            <p className="font-display font-semibold text-foreground text-sm">New Local Game</p>
            <p className="text-muted-foreground font-mono text-[10px]">Pass & play on one device</p>
          </div>
          <Shield className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Create Online Game */}
        <button
          onClick={() => { resetModalState(); setShowCreateModal(true); }}
          className="w-full flex items-center gap-3 px-5 py-4 rounded-xl border border-border bg-card hover:bg-secondary transition-all duration-200 card-glow group"
        >
          <div className="w-10 h-10 rounded-lg bg-double-move/20 flex items-center justify-center group-hover:bg-double-move/30 transition-colors">
            <Wifi className="w-5 h-5 text-double-move" />
          </div>
          <div className="text-left flex-1">
            <p className="font-display font-semibold text-foreground text-sm">Host Online Game</p>
            <p className="text-muted-foreground font-mono text-[10px]">Share code with other players</p>
          </div>
          <Users className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Join Game */}
        <button
          onClick={() => { resetModalState(); setShowJoinModal(true); }}
          className="w-full flex items-center gap-3 px-5 py-4 rounded-xl border border-border bg-card hover:bg-secondary transition-all duration-200 card-glow group"
        >
          <div className="w-10 h-10 rounded-lg bg-bus/20 flex items-center justify-center group-hover:bg-bus/30 transition-colors">
            <Hash className="w-5 h-5 text-bus" />
          </div>
          <div className="text-left flex-1">
            <p className="font-display font-semibold text-foreground text-sm">Join Game</p>
            <p className="text-muted-foreground font-mono text-[10px]">Enter a session code to join</p>
          </div>
        </button>
      </div>

      {/* Saved Sessions */}
      {sessions.length > 0 && (
        <div className="w-full max-w-md">
          <h2 className="text-sm font-display font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Previous Games
          </h2>
          <div className="space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleContinue(session)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary transition-all duration-200 group text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-primary font-semibold">{session.code}</span>
                    {getStatusBadge(session.status)}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                    <span>Round {session.round}/24</span>
                    <span>{session.detectiveCount} Detectives</span>
                    <span>{formatDate(session.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Play className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <button
                    onClick={(e) => handleDelete(e, session.id)}
                    className="p-1 rounded hover:bg-destructive/20 transition-colors ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Join Game Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm fade-in p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 card-glow slide-up max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-xl font-bold text-center mb-1">Join Game</h2>
            <p className="text-muted-foreground text-center mb-5 text-xs font-mono">
              Enter the session code shared by the host
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-mono">Your Name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-mono">Session Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
                    if (joinError) setJoinError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="e.g. ABC123"
                  maxLength={6}
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-foreground font-mono text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-ring uppercase"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-mono">Choose Your Avatar</label>
                <AvatarPicker
                  selectedId={selectedAvatar}
                  onSelect={(a) => setSelectedAvatar(a.id)}
                  compact
                />
              </div>
              {joinError && <p className="text-accent text-xs font-mono text-center">{joinError}</p>}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowJoinModal(false); resetModalState(); }}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={!joinCode.trim() || !playerName.trim() || connecting}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {connecting ? "Connecting..." : "Join"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Online Game Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm fade-in p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 card-glow slide-up max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-xl font-bold text-center mb-1">Host Online Game</h2>
            <p className="text-muted-foreground text-center mb-5 text-xs font-mono">
              Other players will connect to your device
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-mono">Your Name</label>
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-mono">Choose Your Avatar</label>
                <AvatarPicker
                  selectedId={selectedAvatar}
                  onSelect={(a) => setSelectedAvatar(a.id)}
                  compact
                />
              </div>
              {joinError && <p className="text-accent text-xs font-mono text-center">{joinError}</p>}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowCreateModal(false); resetModalState(); }}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOnline}
                disabled={!hostName.trim() || connecting}
                className="flex-1 py-2.5 rounded-lg bg-double-move text-white font-display font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {connecting ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
