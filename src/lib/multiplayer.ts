// ---------------------------------------------------------------------------
//  Scotland Yard – P2P Multiplayer Manager (PeerJS, no backend)
// ---------------------------------------------------------------------------
import Peer, { DataConnection, PeerError } from 'peerjs';
import type { GameState } from '@/hooks/useScotlandYard';

export type MultiplayerRole = 'host' | 'player';

export interface PeerMessage {
  type:
    | 'join-request'
    | 'join-accepted'
    | 'join-rejected'
    | 'state-sync'
    | 'move-submit'
    | 'turn-notify'
    | 'player-list'
    | 'game-started'
    | 'ping'
    | 'pong'
    | 'chat'
    // Lobby & voting messages
    | 'lobby-update'
    | 'player-ready'
    | 'player-unready'
    | 'vote-start'
    | 'vote-cast'
    | 'vote-result'
    | 'mrx-pin-set'
    | 'avatar-select'
    | 'start-hunt'
    | 'request-move'
    | 'reveal-toggle'
    | 'kick';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Record<string, any>;
  from?: string;
  timestamp?: number;
}

export interface ConnectedPlayer {
  peerId: string;
  name: string;
  role: string;       // "mrx" | "d1" | "d2" ... assigned after voting
  connected: boolean;
  avatar: string;      // avatar id
  ready: boolean;
  votedFor: string;    // peerId of player voted for as Mr. X
}

type MessageHandler = (msg: PeerMessage, senderId: string) => void;
type ConnectionHandler = (player: ConnectedPlayer) => void;
type DisconnectionHandler = (peerId: string) => void;
type ErrorHandler = (error: string) => void;

export class MultiplayerManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private players: Map<string, ConnectedPlayer> = new Map();
  private role: MultiplayerRole = 'host';
  private sessionCode: string = '';
  private playerName: string = '';
  private playerAvatar: string = '';
  private hostConnection: DataConnection | null = null;

  // Event handlers
  private onMessage: MessageHandler | null = null;
  private onPlayerJoined: ConnectionHandler | null = null;
  private onPlayerLeft: DisconnectionHandler | null = null;
  private onError: ErrorHandler | null = null;
  private onOpen: (() => void) | null = null;

  // Buffer messages received before handler is registered (fixes race condition)
  private messageBuffer: { msg: PeerMessage; senderId: string }[] = [];

  // ──── Lifecycle ────

  async hostSession(code: string, hostName: string, avatar: string = ''): Promise<string> {
    this.role = 'host';
    this.sessionCode = code;
    this.playerName = hostName;
    this.playerAvatar = avatar;

    return new Promise((resolve, reject) => {
      const peerId = `sy-${code}`;
      this.peer = new Peer(peerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      this.peer.on('open', (id) => {
        this.onOpen?.();
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err: PeerError<string>) => {
        const msg = err.type === 'unavailable-id'
          ? 'Session code already in use. Try a different one.'
          : `Connection error: ${err.message || err}`;
        this.onError?.(msg);
        reject(new Error(msg));
      });

      this.peer.on('disconnected', () => {
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        }
      });
    });
  }

  async joinSession(code: string, playerName: string, avatar: string = ''): Promise<void> {
    this.role = 'player';
    this.sessionCode = code;
    this.playerName = playerName;
    this.playerAvatar = avatar;

    return new Promise((resolve, reject) => {
      this.peer = new Peer(undefined, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      this.peer.on('open', () => {
        const hostPeerId = `sy-${code}`;
        const conn = this.peer!.connect(hostPeerId, { reliable: true });

        conn.on('open', () => {
          this.hostConnection = conn;
          this.connections.set(hostPeerId, conn);

          this.send(conn, {
            type: 'join-request',
            payload: { name: playerName, avatar },
          });

          conn.on('data', (data) => {
            const msg = data as PeerMessage;
            if (this.onMessage) {
              this.onMessage(msg, hostPeerId);
            } else {
              // Buffer message until handler is registered
              this.messageBuffer.push({ msg, senderId: hostPeerId });
            }
          });

          conn.on('close', () => {
            this.onPlayerLeft?.(hostPeerId);
          });

          resolve();
        });

        conn.on('error', (err) => {
          this.onError?.(`Failed to connect to host: ${err}`);
          reject(err);
        });

        setTimeout(() => {
          if (!conn.open) {
            reject(new Error('Connection timed out. Make sure the host has started the session.'));
          }
        }, 10000);
      });

      this.peer.on('error', (err) => {
        this.onError?.(`Peer error: ${err.message || err}`);
        reject(err);
      });
    });
  }

  // ──── Connection handling (host side) ────

  private handleIncomingConnection(conn: DataConnection) {
    conn.on('open', () => {
      conn.on('data', (data) => {
        const msg = data as PeerMessage;

        if (msg.type === 'join-request') {
          const player: ConnectedPlayer = {
            peerId: conn.peer,
            name: String(msg.payload?.name || 'Unknown'),
            role: '',
            connected: true,
            avatar: String(msg.payload?.avatar || ''),
            ready: false,
            votedFor: '',
          };
          this.players.set(conn.peer, player);
          this.connections.set(conn.peer, conn);

          this.send(conn, {
            type: 'join-accepted',
            payload: { peerId: conn.peer },
          });

          this.onPlayerJoined?.(player);
          this.broadcastPlayerList();
        } else {
          this.onMessage?.(msg, conn.peer);
        }
      });

      conn.on('close', () => {
        const player = this.players.get(conn.peer);
        if (player) {
          player.connected = false;
          this.players.set(conn.peer, player);
        }
        this.connections.delete(conn.peer);
        this.onPlayerLeft?.(conn.peer);
        this.broadcastPlayerList();
      });
    });
  }

  // ──── Messaging ────

  private send(conn: DataConnection, msg: PeerMessage) {
    if (conn.open) {
      conn.send({
        ...msg,
        from: this.peer?.id || '',
        timestamp: Date.now(),
      });
    }
  }

  broadcast(msg: PeerMessage) {
    this.connections.forEach((conn) => {
      this.send(conn, msg);
    });
  }

  sendToPeer(peerId: string, msg: PeerMessage) {
    const conn = this.connections.get(peerId);
    if (conn) {
      this.send(conn, msg);
    }
  }

  sendToHost(msg: PeerMessage) {
    if (this.hostConnection) {
      this.send(this.hostConnection, msg);
    }
  }

  broadcastPlayerList() {
    const list = Array.from(this.players.values());
    this.broadcast({
      type: 'player-list',
      payload: { players: list },
    });
  }

  broadcastLobbyUpdate(lobbyData: {
    players: ConnectedPlayer[];
    hostName: string;
    hostAvatar: string;
    hostPeerId: string;
    hostReady: boolean;
    hostVotedFor: string;
    phase: string;
    votingActive: boolean;
    mrxPeerId: string;
  }) {
    this.broadcast({
      type: 'lobby-update',
      payload: lobbyData,
    });
  }

  broadcastState(fullState: GameState, sanitizeForPlayer: (state: GameState, role: string) => GameState) {
    this.players.forEach((player, peerId) => {
      const conn = this.connections.get(peerId);
      if (conn && conn.open) {
        const sanitized = sanitizeForPlayer(fullState, player.role);
        this.send(conn, {
          type: 'state-sync',
          payload: sanitized,
        });
      }
    });
  }

  notifyTurn(peerId: string, playerRole: string, roundNumber: number) {
    this.sendToPeer(peerId, {
      type: 'turn-notify',
      payload: { role: playerRole, round: roundNumber },
    });
  }

  requestMove(peerId: string, playerRole: string, roundNumber: number) {
    this.sendToPeer(peerId, {
      type: 'request-move',
      payload: { role: playerRole, round: roundNumber },
    });
  }

  assignRole(peerId: string, role: string) {
    const player = this.players.get(peerId);
    if (player) {
      player.role = role;
      this.players.set(peerId, player);
    }
    this.broadcastPlayerList();
  }

  /** Host: kick a player from the session */
  kickPlayer(peerId: string) {
    const conn = this.connections.get(peerId);
    if (conn) {
      this.send(conn, { type: 'kick', payload: { reason: 'Kicked by host' } });
      try { conn.close(); } catch { /* connection already closed */ }
    }
    this.players.delete(peerId);
    this.connections.delete(peerId);
    this.onPlayerLeft?.(peerId);
    this.broadcastPlayerList();
  }

  setPlayerReady(peerId: string, ready: boolean) {
    const player = this.players.get(peerId);
    if (player) {
      player.ready = ready;
      this.players.set(peerId, player);
    }
  }

  setPlayerVote(peerId: string, votedForPeerId: string) {
    const player = this.players.get(peerId);
    if (player) {
      player.votedFor = votedForPeerId;
      this.players.set(peerId, player);
    }
  }

  tallyVotes(hostVote: string): { winner: string | null; counts: Map<string, number> } {
    const voteCounts = new Map<string, number>();
    // Count host vote
    if (hostVote) {
      voteCounts.set(hostVote, 1);
    }
    // Count peer votes
    this.players.forEach((player) => {
      if (player.votedFor) {
        voteCounts.set(player.votedFor, (voteCounts.get(player.votedFor) || 0) + 1);
      }
    });

    let maxVotes = 0;
    let winner: string | null = null;
    voteCounts.forEach((count, peerId) => {
      if (count > maxVotes) {
        maxVotes = count;
        winner = peerId;
      }
    });

    return { winner, counts: voteCounts };
  }

  allPlayersReady(): boolean {
    if (this.players.size === 0) return false;
    let allReady = true;
    this.players.forEach((player) => {
      if (!player.ready) allReady = false;
    });
    return allReady;
  }

  allPlayersVoted(): boolean {
    if (this.players.size === 0) return false;
    let allVoted = true;
    this.players.forEach((player) => {
      if (!player.votedFor) allVoted = false;
    });
    return allVoted;
  }

  clearVotes() {
    this.players.forEach((player) => {
      player.votedFor = '';
      this.players.set(player.peerId, player);
    });
  }

  clearReady() {
    this.players.forEach((player) => {
      player.ready = false;
      this.players.set(player.peerId, player);
    });
  }

  // ──── Event registration ────

  setOnMessage(handler: MessageHandler) {
    this.onMessage = handler;
    // Flush any buffered messages that arrived before handler was set
    if (this.messageBuffer.length > 0) {
      const buffered = [...this.messageBuffer];
      this.messageBuffer = [];
      for (const { msg, senderId } of buffered) {
        handler(msg, senderId);
      }
    }
  }
  setOnPlayerJoined(handler: ConnectionHandler) { this.onPlayerJoined = handler; }
  setOnPlayerLeft(handler: DisconnectionHandler) { this.onPlayerLeft = handler; }
  setOnError(handler: ErrorHandler) { this.onError = handler; }
  setOnOpen(handler: () => void) { this.onOpen = handler; }

  // ──── Getters ────

  getPlayers(): ConnectedPlayer[] {
    return Array.from(this.players.values());
  }

  getRole(): MultiplayerRole { return this.role; }
  getSessionCode(): string { return this.sessionCode; }
  getPlayerName(): string { return this.playerName; }
  getPlayerAvatar(): string { return this.playerAvatar; }
  getPeerId(): string | undefined { return this.peer?.id; }
  isConnected(): boolean { return !!this.peer && !this.peer.destroyed; }

  getConnectionCount(): number {
    let count = 0;
    this.connections.forEach((conn) => {
      if (conn.open) count++;
    });
    return count;
  }

  // ──── Cleanup ────

  destroy() {
    this.connections.forEach((conn) => {
      try { conn.close(); } catch { /* ignore */ }
    });
    this.connections.clear();
    this.players.clear();
    this.messageBuffer = [];
    this.hostConnection = null;
    if (this.peer) {
      try { this.peer.destroy(); } catch { /* ignore */ }
      this.peer = null;
    }
  }
}

// Singleton instance
let instance: MultiplayerManager | null = null;

export function getMultiplayerManager(): MultiplayerManager {
  if (!instance) {
    instance = new MultiplayerManager();
  }
  return instance;
}

export function resetMultiplayerManager() {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
