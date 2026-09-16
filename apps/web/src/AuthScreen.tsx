import { useState, useEffect, useRef } from 'react';
import { PatternLock } from './components/PatternLock.js';
import { setCurrentUser, type UserAccount } from './game/playerId.js';
import { sound } from './sound.js';

interface AuthScreenProps {
  onSuccess: (user: UserAccount) => void;
  onShowRules: () => void;
}

type AuthMode = 'register' | 'login';

export function AuthScreen({ onSuccess, onShowRules }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('register');
  const [username, setUsername] = useState('');
  const [pattern, setPattern] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 用户名可用性状态：null=未检测, 'checking'=检测中, 'available'=可用, 'taken'=已被占用
  const [usernameStatus, setUsernameStatus] = useState<
    null | 'checking' | 'available' | 'taken'
  >(null);
  const [usernameFeedback, setUsernameFeedback] = useState<string | null>(null);

  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 用户名输入实时/防抖查重
  useEffect(() => {
    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
    }
    setErrorMsg(null);

    const trimmed = username.trim();
    if (mode !== 'register' || !trimmed) {
      setUsernameStatus(null);
      setUsernameFeedback(null);
      return;
    }

    if (trimmed.length < 2) {
      setUsernameStatus(null);
      setUsernameFeedback('用户名至少需要 2 个字符');
      return;
    }

    if (trimmed.length > 12) {
      setUsernameStatus(null);
      setUsernameFeedback('用户名最多 12 个字符');
      return;
    }

    setUsernameStatus('checking');
    setUsernameFeedback('正在检测用户名是否唯一…');

    checkTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/check-username?username=${encodeURIComponent(trimmed)}`
        );
        if (res.ok) {
          const data = (await res.json()) as { ok: boolean; available: boolean; message?: string };
          if (data.available) {
            setUsernameStatus('available');
            setUsernameFeedback('✓ 该用户名可以使用');
          } else {
            setUsernameStatus('taken');
            setUsernameFeedback('⚠️ 该用户名已被占用，请修改为不同用户名');
          }
        }
      } catch {
        setUsernameStatus(null);
        setUsernameFeedback(null);
      }
    }, 400);

    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, [username, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = username.trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 12) {
      setErrorMsg('请输入 2 到 12 位用户名');
      sound.haptic('error');
      return;
    }

    if (!pattern || pattern.length < 4) {
      setErrorMsg('手势密码至少需连接 4 个点');
      sound.haptic('error');
      return;
    }

    if (mode === 'register' && usernameStatus === 'taken') {
      setErrorMsg('该用户名已被占用，请修改为不同用户名后再试');
      sound.haptic('error');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedName,
          gesturePattern: pattern
        })
      });

      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        message?: string;
        user?: UserAccount;
      };

      if (!res.ok || !data.ok || !data.user) {
        const msg = data.message || (mode === 'register' ? '注册失败' : '登录失败');
        setErrorMsg(msg);
        sound.haptic('error');
        if (data.error === 'USERNAME_EXISTS') {
          setUsernameStatus('taken');
          setUsernameFeedback('⚠️ 该用户名已被占用，请修改为不同用户名');
        }
        return;
      }

      // 登录/注册成功
      sound.haptic('success');
      setCurrentUser(data.user);
      onSuccess(data.user);
    } catch {
      setErrorMsg('网络请求失败，请检查网络连接');
      sound.haptic('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app join-screen-container">
      <div className="join-card auth-card">
        <div className="join-brand">
          <div className="join-suits-emblem">
            <span className="suit-spade">♠</span>
            <span className="suit-heart">♥</span>
            <span className="suit-club">♣</span>
            <span className="suit-diamond">♦</span>
          </div>
          <h1 className="join-title">掼 蛋</h1>
          <p className="join-subtitle">家庭联机 · 极简手势账号 · 随时开战</p>
        </div>

        {/* 模式切换 Tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'register' ? 'tab-active' : ''}`}
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
              setPattern('');
            }}
          >
            极简注册
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'tab-active' : ''}`}
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
              setPattern('');
            }}
          >
            手势登录
          </button>
        </div>

        <form className="join-form" onSubmit={handleSubmit}>
          {/* 用户名输入与查重 */}
          <div className="join-input-group">
            <label className="join-label">
              {mode === 'register' ? '玩家用户名（全网唯一）' : '已注册用户名'}
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={mode === 'register' ? '起一个好听且唯一的昵称' : '输入您的用户名'}
              maxLength={12}
              autoFocus
              className={`auth-input ${
                usernameStatus === 'taken'
                  ? 'input-error'
                  : usernameStatus === 'available'
                    ? 'input-success'
                    : ''
              }`}
            />
            {usernameFeedback && mode === 'register' && (
              <div
                className={`auth-feedback ${
                  usernameStatus === 'taken'
                    ? 'feedback-error'
                    : usernameStatus === 'available'
                      ? 'feedback-success'
                      : 'feedback-info'
                }`}
              >
                <span>{usernameFeedback}</span>
                {usernameStatus === 'taken' && (
                  <button
                    type="button"
                    className="feedback-link-btn"
                    onClick={() => {
                      setMode('login');
                      setPattern('');
                      setErrorMsg(null);
                    }}
                  >
                    切换为登录 →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 手势密码绘制区域 */}
          <div className="join-input-group">
            <label className="join-label">
              {mode === 'register' ? '手势密码（九宫格连线，至少 4 点）' : '绘制您的手势密码'}
            </label>
            <div className="auth-pattern-wrapper">
              <PatternLock
                value={pattern}
                onChange={(p) => {
                  setPattern(p);
                  if (errorMsg) setErrorMsg(null);
                }}
                disabled={loading}
                error={Boolean(errorMsg)}
                size={230}
              />
            </div>
          </div>

          {/* 错误提示横幅 */}
          {errorMsg && (
            <div className="auth-error-banner">
              <span>⚠️ {errorMsg}</span>
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading || (mode === 'register' && usernameStatus === 'taken')}
            className="primary-action-btn pulse-glow join-btn"
          >
            {loading
              ? '处理中…'
              : mode === 'register'
                ? '✨ 立即注册并进入'
                : '🔓 手势验证并登录'}
          </button>
        </form>

        <div className="join-helper-actions">
          <button type="button" className="text-action-btn" onClick={onShowRules}>
            📖 掼蛋规则快速入门
          </button>
        </div>
      </div>
    </div>
  );
}
