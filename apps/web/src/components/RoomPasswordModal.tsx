import { useState } from 'react';
import { recordVisitedRoom, setRoomAuthToken } from '../game/roomManager.js';

interface RoomPasswordModalProps {
  roomId: string;
  roomName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function RoomPasswordModal({
  roomId,
  roomName,
  onSuccess,
  onCancel
}: RoomPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setPassword(clean);
    if (error) setError(null);
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password || password.length !== 6) {
      setError('请输入 6 位纯数字密码');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/room/verify-password?room=${encodeURIComponent(roomId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = (await res.json()) as {
        ok: boolean;
        token?: string;
        message?: string;
      };

      if (!res.ok || !data.ok || !data.token) {
        setError(data.message || '密码错误，请确认后重新输入');
        return;
      }

      // 验证成功，持久化凭证，免下次重复输入
      setRoomAuthToken(roomId, data.token);
      recordVisitedRoom({
        roomId,
        name: roomName,
        hasPassword: true
      });

      onSuccess();
    } catch {
      setError('网络校验失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="room-modal-backdrop">
      <div className="room-modal-card auth-verify-card" onClick={(e) => e.stopPropagation()}>
        <div className="room-modal-header">
          <div className="modal-header-title">
            <span className="modal-header-emoji">🔒</span>
            <h3>家庭房间密码验证</h3>
          </div>
        </div>

        <div className="verify-room-desc">
          <p className="verify-room-title">
            即将进入：<strong>{roomName || '专属房间'}</strong>
          </p>
          <p className="verify-room-id">房间号：<code>{roomId}</code></p>
          <p className="verify-room-sub">房主已为本房间设置了 6 位进房密码，请输入密码后进入对局：</p>
        </div>

        <form className="room-modal-form" onSubmit={handleVerify}>
          <div className="room-form-group">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className="room-form-input pass-verify-input"
              value={password}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="请输入 6 位数字密码"
              maxLength={6}
              autoFocus
              required
            />
          </div>

          {error && <div className="room-modal-error">⚠️ {error}</div>}

          <div className="room-modal-actions">
            <button
              type="button"
              className="room-btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              返回公共大厅
            </button>
            <button
              type="submit"
              className="room-btn-primary"
              disabled={loading || password.length !== 6}
            >
              {loading ? '正在验证…' : '验证并进入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
