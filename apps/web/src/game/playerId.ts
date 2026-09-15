const STORAGE_KEY = 'guandan:playerId';

/** 联机模式用来认领座位/断线重连的设备标识，不是账号系统（那是 P3 的事）。 */
export function getOrCreatePlayerId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
