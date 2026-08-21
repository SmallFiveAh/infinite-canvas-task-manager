import { useState } from 'react'
import './index.css'

/**
 * 便签样式面板 - 仿 Figma 风格
 *  - 矩形 / 异形 两种形状分类
 *  - 正方形(1:1) 8色 + 长方形(2:1) 8色 共16种便签样式
 *
 *  纯展示组件，不包含 overlay/定位，由外层（如 Popover）负责定位与关闭
 */

// 便签颜色方案
const STICKY_COLORS = {
  square: [
    { bg: '#FEF9C3', border: '#FDE68A', name: '浅黄' },
    { bg: '#DCFCE7', border: '#BBF7D0', name: '浅绿' },
    { bg: '#DBEAFE', border: '#BFDBFE', name: '浅蓝' },
    { bg: '#FCE7F3', border: '#FBCFE8', name: '浅粉' },
    { bg: '#FEF08A', border: '#FACC15', name: '柠黄' },
    { bg: '#6EE7B7', border: '#34D399', name: '翠绿' },
    { bg: '#93C5FD', border: '#60A5FA', name: '天蓝' },
    { bg: '#D8B4FE', border: '#C084FC', name: '淡紫' },
  ],
  rectangle: [
    { bg: '#FEF9C3', border: '#FDE68A', name: '浅黄' },
    { bg: '#DCFCE7', border: '#BBF7D0', name: '浅绿' },
    { bg: '#DBEAFE', border: '#BFDBFE', name: '浅蓝' },
    { bg: '#FCE7F3', border: '#FBCFE8', name: '浅粉' },
    { bg: '#FEF08A', border: '#FACC15', name: '柠黄' },
    { bg: '#6EE7B7', border: '#34D399', name: '翠绿' },
    { bg: '#93C5FD', border: '#60A5FA', name: '天蓝' },
    { bg: '#D8B4FE', border: '#C084FC', name: '淡紫' },
  ],
}

// 默认橙色便签（直接拖放使用）
export const DEFAULT_STICKY = {
  shape: 'rect',
  ratio: '2:1',
  width: 180,
  height: 90,
  bg: '#FFEDD5',
  border: '#FDBA74',
  name: '橙色便签',
}

function StickyPalette({ onSelect }) {
  const [shapeTab, setShapeTab] = useState('rect') // 'rect' 矩形 | 'irregular' 异形

  const handleSelect = (style, ratio) => {
    const isSquare = ratio === '1:1'
    const preset = {
      shape: shapeTab,
      ratio,
      width: isSquare ? 120 : 180,
      height: isSquare ? 120 : 90,
      bg: style.bg,
      border: style.border,
      name: style.name,
    }
    onSelect?.(preset)
  }

  const squareColors = STICKY_COLORS.square
  const rectColors = STICKY_COLORS.rectangle

  return (
    <div className="sticky-palette-panel">
      <div className="sticky-palette-header">
        <span className="sticky-palette-title">便签样式</span>
      </div>

      {/* 形状分类 Tab */}
      <div className="sticky-palette-tabs">
        <button
          className={`sticky-tab-btn ${shapeTab === 'rect' ? 'active' : ''}`}
          onClick={() => setShapeTab('rect')}
        >
          矩形
        </button>
        <button
          className={`sticky-tab-btn ${shapeTab === 'irregular' ? 'active' : ''}`}
          onClick={() => setShapeTab('irregular')}
        >
          异形
        </button>
      </div>

      {/* 正方形 (1:1) */}
      <div className="sticky-palette-section">
        <div className="sticky-palette-section-label">正方形 (1:1)</div>
        <div className="sticky-palette-grid">
          {squareColors.map((color, idx) => (
            <button
              key={`sq-${idx}`}
              className={`sticky-swatch square ${shapeTab === 'irregular' ? 'irregular' : ''}`}
              style={{ background: color.bg, borderColor: color.border, color: color.border }}
              onClick={() => handleSelect(color, '1:1')}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* 长方形 (2:1) */}
      <div className="sticky-palette-section">
        <div className="sticky-palette-section-label">长方形 (2:1)</div>
        <div className="sticky-palette-grid">
          {rectColors.map((color, idx) => (
            <button
              key={`rect-${idx}`}
              className={`sticky-swatch rectangle ${shapeTab === 'irregular' ? 'irregular' : ''}`}
              style={{ background: color.bg, borderColor: color.border, color: color.border }}
              onClick={() => handleSelect(color, '2:1')}
              title={color.name}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default StickyPalette
