import { useState, useEffect, useRef } from 'react';
import { PatternLock } from './components/PatternLock.js';
import {
  addRecentUser,
  getRecentUsers,
  getRememberedUsername,
  removeRecentUser,
  setCurrentUser,
  setRememberedUsername,
  type UserAccount
} from './game/playerId.js';
import { sound } from './sound.js';

interface AuthScreenProps {
  onSuccess: (user: UserAccount) => void;
  onShowRules: () => void;
}

type AuthMode = 'login' | 'register';

export function AuthScreen({ onSuccess, onShowRules }: AuthScreenProps) {
  // 默认展示登录页面，符合绝大多数常用场景
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState(() => getRememberedUsername());
  const [rememberMe, setRememberMe] = useState(true);
  const [recentUsers, setRecentUsers] = useState<string[]>(() => getRecentUsers());
  const [pattern, setPattern] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 用户名可用性状态（仅注册时触发检测）：null=未检测, 'checking'=检测中, 'available'=可用, 'taken'=已被占用
  const [usernameStatus, setUsernameStatus] = useState<
    null | 'checking' | 'available' | 'taken'
  >(null);
  const [usernameFeedback, setUsernameFeedback] = useState<string | null>(null);

  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 用户名输入实时/防抖查重（仅注册模式有效）
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
            setUsernameFeedback('⚠️ 该用户名已被注册');
          }
        }
      } catch {
        setUsernameStatus(null);
        setUsernameFeedback(null);
      }
    }, 350);

    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, [username, mode]);

  const switchMode = (targetMode: AuthMode) => {
    setMode(targetMode);
    setErrorMsg(null);
    setPattern('');
  };

  const handleSelectRecentUser = (name: string) => {
    setUsername(name);
    setErrorMsg(null);
    setPattern('');
    sound.haptic('selection');
  };

  const handleRemoveRecentUser = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    removeRecentUser(name);
    setRecentUsers(getRecentUsers());
  };

  const handleClearPattern = () => {
    setPattern('');
    setErrorMsg(null);
    sound.haptic('light');
  };

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

        // 如果登录时用户不存在，贴心提示切换注册
        if (mode === 'login' && data.error === 'USER_NOT_FOUND') {
          setErrorMsg('该用户名尚未注册，请先注册账号');
        } else if (mode === 'register' && data.error === 'USERNAME_EXISTS') {
          setUsernameStatus('taken');
          setUsernameFeedback('⚠️ 该用户名已被注册');
        }
        return;
      }

      // 记住用户名与多账号保存
      if (rememberMe) {
        setRememberedUsername(trimmedName);
      } else {
        setRememberedUsername(null);
      }
      addRecentUser(trimmedName);

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

  const pointCount = pattern ? pattern.length : 0;

  return (
    <div className="app join-screen-container">
      <div className="join-card auth-card">
        {/* 品牌标识 */}
        <div className="join-brand">
          <img src="/favicon.svg" alt="Gameday Logo" className="join-brand-logo" />
          <h1 className="join-title">Gameday</h1>
          <div className="join-slogan-badge">Gameday · 游戏日</div>
          <p className="join-subtitle">
            {mode === 'login' ? '家庭联机 · 手势密码极速登录' : '家庭联机 · 极简手势账号注册'}
          </p>
        </div>

        {/* 顶部优雅切换器 */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'tab-active' : ''}`}
            onClick={() => switchMode('login')}
          >
            手势登录
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'register' ? 'tab-active' : ''}`}
            onClick={() => switchMode('register')}
          >
            新玩家注册
          </button>
        </div>

        {/* 本机家庭常用账号快速填入胶囊 */}
        {recentUsers.length > 0 && (
          <div className="auth-recent-users-bar">
            <span className="auth-recent-label">快速选择：</span>
            <div className="auth-recent-tags">
              {recentUsers.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`auth-recent-pill ${username === name ? 'is-selected' : ''}`}
                  onClick={() => handleSelectRecentUser(name)}
                  title={`点击快速填入【${name}】`}
                >
                  <span className="recent-user-avatar">👤</span>
                  <span className="recent-user-text">{name}</span>
                  <span
                    className="recent-user-del"
                    onClick={(e) => handleRemoveRecentUser(e, name)}
                    title="移除记录"
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form className="join-form" onSubmit={handleSubmit}>
          {/* 用户名输入区 */}
          <div className="join-input-group">
            <div className="auth-input-label-row">
              <label className="join-label">
                {mode === 'login' ? '玩家用户名' : '起一个好听且唯一的用户名'}
              </label>
              {username && (
                <button
                  type="button"
                  className="auth-input-clear-btn"
                  onClick={() => {
                    setUsername('');
                    setUsernameStatus(null);
                    setUsernameFeedback(null);
                  }}
                  title="清空输入"
                >
                  清空
                </button>
              )}
            </div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={mode === 'login' ? '输入您的用户名' : '2-12 位中英文或数字'}
              maxLength={12}
              className={`auth-input ${
                usernameStatus === 'taken'
                  ? 'input-error'
                  : usernameStatus === 'available'
                    ? 'input-success'
                    : ''
              }`}
            />

            {/* 注册模式查重反馈 */}
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
                    onClick={() => switchMode('login')}
                  >
                    直接使用此号登录 →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 手势密码绘制区域 */}
          <div className="join-input-group">
            <div className="auth-pattern-header">
              <label className="join-label">
                {mode === 'login' ? '绘制您的手势密码' : '设置手势密码（九宫格连线 ≥4 点）'}
              </label>
              <div className="pattern-meta-row">
                <span
                  className={`pattern-point-count ${
                    pointCount >= 4 ? 'count-valid' : pointCount > 0 ? 'count-short' : ''
                  }`}
                >
                  {pointCount === 0
                    ? '请连线'
                    : pointCount >= 4
                      ? `✓ 已连 ${pointCount} 点`
                      : `已连 ${pointCount} 点 (需≥4)`}
                </span>
                {pointCount > 0 && (
                  <button
                    type="button"
                    className="pattern-clear-btn"
                    onClick={handleClearPattern}
                    title="清除并重画手势"
                  >
                    🔄 重画
                  </button>
                )}
              </div>
            </div>

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

          {/* 记住我的用户名勾选项 */}
          <div className="auth-remember-row">
            <label className="auth-remember-label">
              <input
                type="checkbox"
                className="auth-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>记住用户名（下次免手打）</span>
            </label>
          </div>

          {/* 错误提示横幅 */}
          {errorMsg && (
            <div className="auth-error-banner">
              <span>⚠️ {errorMsg}</span>
              {mode === 'login' && errorMsg.includes('尚未注册') && (
                <button
                  type="button"
                  className="feedback-link-btn banner-link-btn"
                  onClick={() => switchMode('register')}
                >
                  立即去注册 →
                </button>
              )}
            </div>
          )}

          {/* 提交主操作按钮 */}
          <button
            type="submit"
            disabled={loading || (mode === 'register' && usernameStatus === 'taken')}
            className="primary-action-btn pulse-glow join-btn"
          >
            {loading
              ? '验证中…'
              : mode === 'login'
                ? '🔓 手势验证并登录'
                : '✨ 立即注册并进入'}
          </button>
        </form>

        {/* 底部引导切换链接 */}
        <div className="auth-bottom-switch">
          {mode === 'login' ? (
            <div className="auth-switch-text">
              还没有玩家账号？
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => switchMode('register')}
              >
                立即注册新账号 →
              </button>
            </div>
          ) : (
            <div className="auth-switch-text">
              已有玩家账号？
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => switchMode('login')}
              >
                直接返回登录 →
              </button>
            </div>
          )}
        </div>

        {/* 辅助操作 */}
        <div className="join-helper-actions">
          <button type="button" className="text-action-btn" onClick={onShowRules}>
            📖 掼蛋规则快速入门
          </button>
        </div>
      </div>
    </div>
  );
}
