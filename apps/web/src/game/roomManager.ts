/**
 * 家庭房间本地管理与授权持久化
 */

export interface FavoriteRoom {
  roomId: string;
  name: string;
  hasPassword: boolean;
  lastVisitedAt: number;
}

const ROOM_TOKEN_KEY_PREFIX = 'gameday:room_token:';
const FAVORITE_ROOMS_KEY = 'gameday:fav_rooms_v1';

/**
 * 获取本地缓存的房间授权 Token
 */
export function getRoomAuthToken(roomId: string): string | null {
  try {
    return localStorage.getItem(`${ROOM_TOKEN_KEY_PREFIX}${roomId}`);
  } catch {
    return null;
  }
}

/**
 * 设置本地房间授权 Token（免重复输密）
 */
export function setRoomAuthToken(roomId: string, token: string): void {
  try {
    localStorage.setItem(`${ROOM_TOKEN_KEY_PREFIX}${roomId}`, token);
  } catch {
    // 忽略存储异常
  }
}

/**
 * 清除本地房间授权
 */
export function clearRoomAuthToken(roomId: string): void {
  try {
    localStorage.removeItem(`${ROOM_TOKEN_KEY_PREFIX}${roomId}`);
  } catch {
    // 忽略
  }
}

/**
 * 获取常用历史房间列表
 */
export function getFavoriteRooms(): FavoriteRoom[] {
  try {
    const raw = localStorage.getItem(FAVORITE_ROOMS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as FavoriteRoom[];
    if (Array.isArray(list)) {
      return list.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * 记录或更新访问的房间
 */
export function recordVisitedRoom(room: {
  roomId: string;
  name: string;
  hasPassword: boolean;
}): void {
  try {
    const rooms = getFavoriteRooms().filter((r) => r.roomId !== room.roomId);
    rooms.unshift({
      roomId: room.roomId,
      name: room.name || (room.roomId === 'default' ? '公共大厅' : '家庭游戏室'),
      hasPassword: Boolean(room.hasPassword),
      lastVisitedAt: Date.now()
    });
    // 保留最多最近 10 个常用房间
    localStorage.setItem(FAVORITE_ROOMS_KEY, JSON.stringify(rooms.slice(0, 10)));
  } catch {
    // 忽略存储异常
  }
}

/**
 * 移除常用房间
 */
export function removeFavoriteRoom(roomId: string): void {
  try {
    const rooms = getFavoriteRooms().filter((r) => r.roomId !== roomId);
    localStorage.setItem(FAVORITE_ROOMS_KEY, JSON.stringify(rooms));
  } catch {
    // 忽略
  }
}

/**
 * 生成一键复制的微信邀请文案
 */
export function generateShareText({
  roomId,
  roomName,
  hasPassword,
  password
}: {
  roomId: string;
  roomName: string;
  hasPassword?: boolean;
  password?: string;
}): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gd.air7fun.com';
  const url = `${origin}/?room=${encodeURIComponent(roomId)}`;

  const lines = [
    `🎴 掼蛋邀请：来「${roomName || '家庭游戏室'}」打牌啦！`,
    `🏠 房间号：${roomId}`
  ];

  if (hasPassword) {
    if (password) {
      lines.push(`🔑 房间密码：${password} （6位家庭防扰密码）`);
    } else {
      lines.push(`🔒 进房设有6位密码，请向房主索取密码直接进入`);
    }
  }

  lines.push(`🔗 点击链接直接入座：`);
  lines.push(url);
  lines.push(`📱 免下载即开即玩，进桌可自由选择对家搭档！`);

  return lines.join('\n');
}
