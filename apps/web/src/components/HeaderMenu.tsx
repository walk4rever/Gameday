import { useEffect, useRef, useState } from 'react';

export interface HeaderMenuItem {
  id: string;
  icon?: string;
  label: string;
  sublabel?: string;
  badge?: string;
  danger?: boolean;
  onClick: () => void;
}

export interface HeaderMenuProps {
  items: HeaderMenuItem[];
  triggerLabel?: string;
  triggerIcon?: string;
  title?: string;
  headerContent?: React.ReactNode;
  className?: string;
}

export function HeaderMenu({
  items,
  triggerLabel = '更多',
  triggerIcon = '⚙️',
  title,
  headerContent,
  className = ''
}: HeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 监听 Escape 键自动关闭
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleItemClick = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className={`header-menu-wrapper ${className}`} ref={menuRef}>
      <button
        type="button"
        className={`header-menu-trigger ${open ? 'is-active' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={title || '快捷设置菜单'}
        title={title || '快捷设置与选项'}
      >
        <span className="trigger-icon">{triggerIcon}</span>
        {triggerLabel && <span className="trigger-text">{triggerLabel}</span>}
      </button>

      {open && (
        <>
          {/* 移动端与全屏无感点击穿透遮罩 */}
          <div
            className="header-menu-overlay"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* 浮动菜单列表 */}
          <div className="header-menu-dropdown" role="menu">
            {headerContent && <div className="header-menu-custom-header">{headerContent}</div>}
            {title && <div className="header-menu-heading">{title}</div>}
            <div className="header-menu-list">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={`header-menu-item ${item.danger ? 'item-danger' : ''}`}
                  onClick={() => handleItemClick(item.onClick)}
                >
                  {item.icon && <span className="item-icon">{item.icon}</span>}
                  <div className="item-content">
                    <span className="item-label">{item.label}</span>
                    {item.sublabel && <span className="item-sublabel">{item.sublabel}</span>}
                  </div>
                  {item.badge && <span className="item-badge">{item.badge}</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
