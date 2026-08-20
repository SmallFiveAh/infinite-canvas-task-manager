import React, { useLayoutEffect, useRef, useState } from 'react';
import './index.css';

const menuItems = [
  {
    type: 'item',
    label: '粘贴',
    shortcut: 'Ctrl+V',
    onClick: () => {},
  },
  {
    type: 'item',
    label: '解锁全部',
    onClick: () => {},
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    label: '本地导入',
    hasSubmenu: true,
    onClick: () => {},
  },
  {
    type: 'item',
    label: '在线嵌入',
    hasSubmenu: true,
    onClick: () => {},
  },
  {
    type: 'item',
    label: '素材库',
    hasSubmenu: true,
    onClick: () => {},
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    label: '视图',
    hasSubmenu: true,
    onClick: () => {},
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    label: '偏好设置',
    onClick: () => {},
  },
];

function ContextMenu({ visible, position, onClose }) {
  const menuRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!visible) return;
    setOffset({ x: 0, y: 0 });
  }, [visible]);

  useLayoutEffect(() => {
    if (!visible || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    let dx = 0;
    let dy = 0;
    if (position.x + rect.width > viewW) {
      dx = Math.max(-position.x, viewW - rect.width - 4 - position.x);
    }
    if (position.y + rect.height > viewH) {
      dy = Math.max(-position.y, viewH - rect.height - 4 - position.y);
    }
    setOffset((prev) => {
      if (prev.x === dx && prev.y === dy) return prev;
      return { x: dx, y: dy };
    });
  }, [visible, position]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: position.x + offset.x,
        top: position.y + offset.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => {
        if (item.type === 'separator') {
          return <div key={`sep-${index}`} className="context-menu-separator" />;
        }

        return (
          <button
            key={`item-${index}`}
            className="context-menu-item"
            onClick={() => {
              item.onClick?.();
              onClose?.();
            }}
          >
            <span className="context-menu-item-label">{item.label}</span>
            <span className="context-menu-item-right">
              {item.shortcut && (
                <span className="context-menu-item-shortcut">{item.shortcut}</span>
              )}
              {item.hasSubmenu && (
                <span className="context-menu-item-arrow">
                  <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
                    <path
                      d="M1 1L5 5L1 9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ContextMenu;
