import { useState } from 'react';
import { recordVisitedRoom, setRoomAuthToken } from '../game/roomManager.js';

interface CreateRoomModalProps {
  playerName: string;
  onClose: () => void;
  onCreated: (roomId: string, name: string, password?: string) => void;
}

const NAME_SUGGESTIONS = [
  '拯救地球',
  '相亲相爱一家人',
  '常胜老友会',
  '周末欢聚局',
  '快乐老家',
  '四海皆兄弟',
  '阳光大茶馆',
  '棋牌风云会',
  '饭前不掼蛋等于没吃饭'
];

function getRandomName(): string {
  const idx = Math.floor(Math.random() * NAME_SUGGESTIONS.length);
  return NAME_SUGGESTIONS[idx] ?? '拯救地球';
}

function getRandomPass(): string {
  const digits = '123456789';
  let res = '';
  for (let i = 0; i < 6; i++) {
    res += digits[Math.floor(Math.random() * digits.length)];
  }
  return res;
}

export function CreateRoomModal({
  playerName,
  onClose,
  onCreated
}: CreateRoomModalProps) {
  const [name, setName] = useState<string>(getRandomName());
  const [enablePassword, setEnablePassword] = useState<boolean>(true);
  const [password, setPassword] = useState<string>('666888');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRandomizeName = () => {
    let next = getRandomName();
    while (next === name && NAME_SUGGESTIONS.length > 1) {
      next = getRandomName();
    }
    setName(next);
  };

  const handleRandomizePass = () => {
    setPassword(getRandomPass());
  };

  const handlePasswordChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setPassword(clean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim();
    if (!finalName) {
      setError('请输入房间名称');
      return;
    }
    if (enablePassword && (!password || password.length !== 6)) {
      setError('房间密码需为 6 位纯数字');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalName,
          password: enablePassword ? password : '',
          createdBy: playerName
        })
      });

      const data = (await res.json()) as {
        ok: boolean;
        roomId?: string;
        name?: string;
        hasPassword?: boolean;
        token?: string;
        message?: string;
      };

      if (!res.ok || !data.ok || !data.roomId) {
        setError(data.message || '创建房间失败，请重试');
        return;
      }

      // 记录到常用历史并保存授权
      if (data.token) {
        setRoomAuthToken(data.roomId, data.token);
      }
      recordVisitedRoom({
        roomId: data.roomId,
        name: data.name ?? finalName,
        hasPassword: Boolean(data.hasPassword)
      });

      onCreated(data.roomId, data.name ?? finalName, enablePassword ? password : undefined);
    } catch {
      setError('网络连接异常，创建房间失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="room-modal-backdrop" onClick={onClose}>
      <div className="room-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="room-modal-header">
          <div className="modal-header-title">
            <span className="modal-header-emoji">🏡</span>
            <h3>创建专属家庭房间</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="room-modal-form" onSubmit={handleSubmit}>
          {/* 房间名称 */}
          <div className="room-form-group">
            <label className="room-form-label">
              <span>房间名称</span>
              <button
                type="button"
                className="room-inline-btn"
                onClick={handleRandomizeName}
                title="换一个好听的名字"
              >
                🎲 随机灵感
              </button>
            </label>
            <input
              type="text"
              className="room-form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：拯救地球、周末快乐掼蛋局"
              maxLength={16}
              autoFocus
              required
            />
            <span className="room-form-tip">
              系统将为您自动生成专属不重复的唯一短网址（不可被陌生人随意探测）
            </span>
          </div>

          {/* 房间密码 */}
          <div className="room-form-group">
            <label className="room-checkbox-label">
              <input
                type="checkbox"
                checked={enablePassword}
                onChange={(e) => setEnablePassword(e.target.checked)}
              />
              <span>开启 6 位数字进房密码（防陌生人随意进入）</span>
            </label>

            {enablePassword && (
              <div className="password-input-wrap">
                <div className="password-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="room-form-input pass-input"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="请输入 6 位纯数字密码"
                    maxLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="room-inline-btn pass-random-btn"
                    onClick={handleRandomizePass}
                    title="生成易记数字密码"
                  >
                    🎲 随机密码
                  </button>
                </div>
                <span className="room-form-tip">
                  仅需向家人分享密码，验证通过后全家设备自动免密记忆。
                </span>
              </div>
            )}
          </div>

          {error && <div className="room-modal-error">⚠️ {error}</div>}

          <div className="room-modal-actions">
            <button
              type="button"
              className="room-btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="room-btn-primary"
              disabled={loading}
            >
              {loading ? '正在创建专属房间…' : '立即创建并进入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
