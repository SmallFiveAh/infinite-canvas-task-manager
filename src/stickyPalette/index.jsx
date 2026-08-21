import { useState } from 'react'
import './index.css'

/**
 * 便签样式面板 - 仿 Figma 风格
 *  - 矩形 / 异形 两种形状分类
 *  - 矩形：正方形(1:1) 8色 + 长方形(2:1) 8色
 *  - 异形：水滴、波浪边、花朵、圆形、心形、齿轮 × 8色
 *
 *  纯展示组件，不包含 overlay/定位，由外层（如 Popover）负责定位与关闭
 */

// 便签颜色方案
const STICKY_COLORS = [
  { bg: '#FEF9C3', border: '#FDE68A', name: '浅黄' },
  { bg: '#DCFCE7', border: '#BBF7D0', name: '浅绿' },
  { bg: '#DBEAFE', border: '#BFDBFE', name: '浅蓝' },
  { bg: '#FCE7F3', border: '#FBCFE8', name: '浅粉' },
  { bg: '#FEF08A', border: '#FACC15', name: '柠黄' },
  { bg: '#6EE7B7', border: '#34D399', name: '翠绿' },
  { bg: '#93C5FD', border: '#60A5FA', name: '天蓝' },
  { bg: '#D8B4FE', border: '#C084FC', name: '淡紫' },
]

// 异形形状定义
const IRREGULAR_SHAPES = [
  { key: 'droplet', name: '水滴' },
  { key: 'wave', name: '波浪边' },
  { key: 'flower', name: '花朵' },
  { key: 'circle', name: '圆形' },
  { key: 'heart', name: '心形' },
  { key: 'gear', name: '齿轮' },
]

// 默认橙色便签（直接拖放使用）
export const DEFAULT_STICKY = {
  shape: 'rect',
  subShape: null,
  ratio: '2:1',
  width: 180,
  height: 90,
  bg: '#FFEDD5',
  border: '#FDBA74',
  name: '橙色便签',
}

function StickyPalette({ onSelect }) {
  const [shapeTab, setShapeTab] = useState('rect') // 'rect' 矩形 | 'irregular' 异形

  const handleRectSelect = (style, ratio) => {
    const isSquare = ratio === '1:1'
    const preset = {
      shape: 'rect',
      subShape: null,
      ratio,
      width: isSquare ? 120 : 180,
      height: isSquare ? 120 : 90,
      bg: style.bg,
      border: style.border,
      name: style.name,
    }
    onSelect?.(preset)
  }

  const handleIrregularSelect = (shape, style, _idx) => {
    // 异形便签统一为正方形，视觉效果更好
    const preset = {
      shape: 'irregular',
      subShape: shape.key,
      ratio: '1:1',
      width: 120,
      height: 120,
      bg: style.bg,
      border: style.border,
      name: `${shape.name}${style.name}`,
    }
    onSelect?.(preset)
  }

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

      {shapeTab === 'rect' ? (
        <>
          {/* 正方形 (1:1) */}
          <div className="sticky-palette-section">
            <div className="sticky-palette-section-label">正方形 (1:1)</div>
            <div className="sticky-palette-grid">
              {STICKY_COLORS.map((color, idx) => (
                <button
                  key={`sq-${idx}`}
                  className="sticky-swatch square"
                  style={{ background: color.bg, borderColor: color.border, color: color.border }}
                  onClick={() => handleRectSelect(color, '1:1')}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* 长方形 (2:1) */}
          <div className="sticky-palette-section">
            <div className="sticky-palette-section-label">长方形 (2:1)</div>
            <div className="sticky-palette-grid">
              {STICKY_COLORS.map((color, idx) => (
                <button
                  key={`rect-${idx}`}
                  className="sticky-swatch rectangle"
                  style={{ background: color.bg, borderColor: color.border, color: color.border }}
                  onClick={() => handleRectSelect(color, '2:1')}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* 异形形状：每种形状一行，8色 */}
          {IRREGULAR_SHAPES.map((shape) => (
            <div key={shape.key} className="sticky-palette-section">
              <div className="sticky-palette-section-label">{shape.name}</div>
              <div className="sticky-palette-grid">
                {STICKY_COLORS.map((color, idx) => (
                  <button
                    key={`${shape.key}-${idx}`}
                    className={`sticky-swatch irregular-shape shape-${shape.key}`}
                    style={{ background: color.bg, borderColor: color.border, color: color.border }}
                    onClick={() => handleIrregularSelect(shape, color, idx)}
                    title={`${shape.name} - ${color.name}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default StickyPalette
