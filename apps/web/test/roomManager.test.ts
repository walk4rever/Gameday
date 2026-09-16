import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRoomAuthToken,
  generateShareText,
  getFavoriteRooms,
  getRoomAuthToken,
  recordVisitedRoom,
  removeFavoriteRoom,
  setRoomAuthToken
} from '../src/game/roomManager.js';

class MockLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

if (!globalThis.localStorage) {
  (globalThis as unknown as { localStorage: MockLocalStorage }).localStorage = new MockLocalStorage();
}

describe('roomManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('generateShareText', () => {
    it('generates friendly text without password', () => {
      const text = generateShareText({
        roomId: 'fam-abc123',
        roomName: '拯救地球',
        hasPassword: false
      });
      expect(text).toContain('拯救地球');
      expect(text).toContain('fam-abc123');
      expect(text).toContain('?room=fam-abc123');
      expect(text).not.toContain('房间密码');
    });

    it('generates friendly text with 6-digit password', () => {
      const text = generateShareText({
        roomId: 'fam-7k8m2a',
        roomName: '相亲相爱一家人',
        hasPassword: true,
        password: '666888'
      });
      expect(text).toContain('相亲相爱一家人');
      expect(text).toContain('fam-7k8m2a');
      expect(text).toContain('🔑 房间密码：666888');
      expect(text).toContain('?room=fam-7k8m2a');
    });

    it('generates text with password reminder if plain password not provided', () => {
      const text = generateShareText({
        roomId: 'fam-xyz999',
        roomName: '快乐老友会',
        hasPassword: true
      });
      expect(text).toContain('快乐老友会');
      expect(text).toContain('🔒 进房设有6位密码');
    });
  });

  describe('token persistence', () => {
    it('sets, gets and clears room auth token', () => {
      expect(getRoomAuthToken('fam-123')).toBeNull();

      setRoomAuthToken('fam-123', 'mock_token_abc');
      expect(getRoomAuthToken('fam-123')).toBe('mock_token_abc');

      clearRoomAuthToken('fam-123');
      expect(getRoomAuthToken('fam-123')).toBeNull();
    });
  });

  describe('favorite rooms management', () => {
    it('records and returns visited rooms in descending order of visit time', () => {
      expect(getFavoriteRooms()).toEqual([]);

      recordVisitedRoom({ roomId: 'room-1', name: '房1', hasPassword: false });
      recordVisitedRoom({ roomId: 'room-2', name: '房2', hasPassword: true });

      const rooms = getFavoriteRooms();
      expect(rooms).toHaveLength(2);
      expect(rooms[0]?.roomId).toBe('room-2');
      expect(rooms[1]?.roomId).toBe('room-1');
      expect(rooms[0]?.hasPassword).toBe(true);
    });

    it('deduplicates when visiting the same room again', () => {
      recordVisitedRoom({ roomId: 'fam-1', name: '旧名字', hasPassword: false });
      recordVisitedRoom({ roomId: 'fam-2', name: '房2', hasPassword: false });
      recordVisitedRoom({ roomId: 'fam-1', name: '新名字', hasPassword: true });

      const rooms = getFavoriteRooms();
      expect(rooms).toHaveLength(2);
      expect(rooms[0]?.roomId).toBe('fam-1');
      expect(rooms[0]?.name).toBe('新名字');
      expect(rooms[0]?.hasPassword).toBe(true);
    });

    it('removes a room from favorite list', () => {
      recordVisitedRoom({ roomId: 'room-a', name: 'A', hasPassword: false });
      recordVisitedRoom({ roomId: 'room-b', name: 'B', hasPassword: false });

      removeFavoriteRoom('room-a');
      const rooms = getFavoriteRooms();
      expect(rooms).toHaveLength(1);
      expect(rooms[0]?.roomId).toBe('room-b');
    });
  });
});
