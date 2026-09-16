export interface UserAccount {
  id: string;
  username: string;
}

const USER_STORAGE_KEY = 'guandan:user';
const PLAYER_ID_KEY = 'guandan:playerId';
const PLAYER_NAME_KEY = 'guandan:playerName';

export function getCurrentUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserAccount;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: UserAccount | null): void {
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(PLAYER_ID_KEY, user.id);
    localStorage.setItem(PLAYER_NAME_KEY, user.username);
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function logoutUser(): void {
  setCurrentUser(null);
}

/** 获取当前玩家唯一设备/账号ID，优先使用登录账号ID */
export function getOrCreatePlayerId(): string {
  const user = getCurrentUser();
  if (user && user.id) {
    return user.id;
  }

  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(PLAYER_ID_KEY, id);
  return id;
}

const REMEMBERED_USERNAME_KEY = 'guandan:rememberedUsername';
const RECENT_USERS_KEY = 'guandan:recentUsers';

export function getRememberedUsername(): string {
  try {
    return localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setRememberedUsername(name: string | null): void {
  try {
    if (name && name.trim()) {
      localStorage.setItem(REMEMBERED_USERNAME_KEY, name.trim());
    } else {
      localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    }
  } catch {
    // ignore
  }
}

export function getRecentUsers(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_USERS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as string[];
    return Array.isArray(list) ? list.slice(0, 4) : [];
  } catch {
    return [];
  }
}

export function addRecentUser(name: string): void {
  try {
    const trimmed = name.trim();
    if (!trimmed) return;
    const list = getRecentUsers().filter((u) => u !== trimmed);
    list.unshift(trimmed);
    localStorage.setItem(RECENT_USERS_KEY, JSON.stringify(list.slice(0, 4)));
  } catch {
    // ignore
  }
}

export function removeRecentUser(name: string): void {
  try {
    const trimmed = name.trim();
    const list = getRecentUsers().filter((u) => u !== trimmed);
    localStorage.setItem(RECENT_USERS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/** 获取当前玩家昵称，优先使用登录用户名 */
export function getCurrentPlayerName(): string {
  const user = getCurrentUser();
  if (user && user.username) {
    return user.username;
  }
  const saved = localStorage.getItem(PLAYER_NAME_KEY);
  return saved && saved.trim() ? saved.trim() : '玩家';
}
