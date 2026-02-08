import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { GameState } from '@/hooks/useScotlandYard';

// ---------- Types ----------
export interface SessionMeta {
  id: string;
  code: string;
  createdAt: number;
  updatedAt: number;
  round: number;
  status: string;
  detectiveCount: number;
  hostName: string;
}

interface ScotlandYardDB extends DBSchema {
  sessions: {
    key: string;
    value: {
      id: string;
      meta: SessionMeta;
      state: GameState;
    };
    indexes: { 'by-code': string; 'by-updated': number };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

// ---------- Singleton ----------
let dbPromise: Promise<IDBPDatabase<ScotlandYardDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ScotlandYardDB>('scotland-yard', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('by-code', 'meta.code', { unique: true });
          sessionStore.createIndex('by-updated', 'meta.updatedAt');
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings');
          }
        }
      },
    });
  }
  return dbPromise;
}

// ---------- Session CRUD ----------

export async function saveSession(id: string, meta: SessionMeta, state: GameState): Promise<void> {
  const db = await getDB();
  await db.put('sessions', { id, meta, state });
}

export async function loadSession(id: string): Promise<{ meta: SessionMeta; state: GameState } | undefined> {
  const db = await getDB();
  const record = await db.get('sessions', id);
  if (!record) return undefined;
  return { meta: record.meta, state: record.state };
}

export async function loadSessionByCode(code: string): Promise<{ meta: SessionMeta; state: GameState } | undefined> {
  const db = await getDB();
  const record = await db.getFromIndex('sessions', 'by-code', code);
  if (!record) return undefined;
  return { meta: record.meta, state: record.state };
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sessions', id);
}

export async function listSessions(): Promise<SessionMeta[]> {
  const db = await getDB();
  const all = await db.getAll('sessions');
  return all
    .map((r) => r.meta)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// ---------- Settings ----------

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('settings', value, key);
}

export async function loadSetting<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get('settings', key) as Promise<T | undefined>;
}

// ---------- Utilities ----------

export function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateSessionId(): string {
  return `sy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
