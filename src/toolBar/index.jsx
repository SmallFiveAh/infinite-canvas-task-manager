import { useState, useCallback, useEffect, useRef } from 'react'
import './index.css'

const VIEW_MODES = [
  { id: 'select', icon: 'bi-cursor', label: '选择 (V)' },
  { id: 'hand', icon: 'bi-hand-index-thumb', label: '移动 (H)' },
]

const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4]
const ZOOM_FACTOR = 1.1
const MIN_SCALE = 0.1
const MAX_SCALE = 5

/**
 * 以视口中心为锚的缩放
 * 参照 InfiniteCanvas.handleWheel 的公式：
 *   newOffset = center - (center - curOffset) * (newScale / curScale)
 */
function computeViewportCenteredTransform(curScale, curOffset, newScale, container) {
  if (!container) return { scale: newScale, offset: curOffset }
  const viewW = container.clientWidth
  const viewH = container.clientHeight
  const centerX = viewW / 2
  const centerY = viewH / 2
  const ratio = newScale / curScale
  return {
    scale: newScale,
    offset: {
      x: centerX - (centerX - curOffset.x) * ratio,
      y: centerY - (centerY - curOffset.y) * ratio,
    },
  }
}

function Toolbar({ scale = 1, offset = { x: 0, y: 0 }, canvasContainerRef, onTransformChange, activeTool, viewMode, onViewModeChange, isToolLocked, onToggleLock }) {
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false)
  const zoomMenuRef = useRef(null)

  const currentZoom = Math.round(scale * 100)

  // 视图模式按钮更新 viewMode（独立于 activeTool）
  const handleModeChange = (modeId) => {
    onViewModeChange?.(modeId)
  }

  const applyScale = useCallback((targetScale) => {
    const clamped = Math.min(Math.max(targetScale, MIN_SCALE), MAX_SCALE)
    if (Math.abs(clamped - scale) < 0.0001) return
    const container = canvasContainerRef?.current
    const { scale: ns, offset: no } = computeViewportCenteredTransform(
      scale,
      offset,
      clamped,
      container,
    )
    onTransformChange?.(ns, no)
  }, [scale, offset, canvasContainerRef, onTransformChange])

  const handleZoomIn = useCallback(() => {
    applyScale(scale * ZOOM_FACTOR)
  }, [scale, applyScale])

  const handleZoomOut = useCallback(() => {
    applyScale(scale / ZOOM_FACTOR)
  }, [scale, applyScale])

  const handleZoomReset = useCallback(() => {
    applyScale(1)
  }, [applyScale])

  const handleZoomTo = useCallback((val) => {
    applyScale(val)
    setZoomMenuOpen(false)
  }, [applyScale])

  // 缩放下拉菜单：外部点击 / Esc 关闭
  useEffect(() => {
    if (!zoomMenuOpen) return
    const handleClickOutside = (e) => {
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(e.target)) {
        setZoomMenuOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setZoomMenuOpen(false)
    }
    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [zoomMenuOpen])

  // 视图模式快捷键：V = 选择，H = 移动
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 在输入框 / 可编辑区域中不触发
      const target = e.target
      if (target && (target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'v') {
        onViewModeChange?.('select')
      } else if (key === 'h') {
        onViewModeChange?.('hand')
      } else {
        return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onViewModeChange])

  return (
    <header className="toolbar" role="toolbar" aria-label="顶部工具栏">
      <div className="toolbar-inner">
        {/* 左侧：锁定开关 + 视图模式 */}
        <div className="toolbar-group toolbar-group-left">
          <button
            className={`toolbar-btn lock-btn ${isToolLocked ? 'active' : ''}`}
            onClick={onToggleLock}
            title={isToolLocked ? '解锁工具（工具使用后自动切回选择）' : '锁定工具（工具使用后保持选中）'}
            aria-label={isToolLocked ? '解锁工具' : '锁定工具'}
            aria-pressed={isToolLocked}
          >
            <i className={`bi ${isToolLocked ? 'bi-lock-fill' : 'bi-unlock-fill'}`} aria-hidden="true" />
          </button>

          <div className="toolbar-divider" aria-hidden="true" />

          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              className={`toolbar-btn mode-btn ${viewMode === mode.id ? 'active' : ''}`}
              onClick={() => handleModeChange(mode.id)}
              title={mode.label}
              aria-label={mode.label}
            >
              <i className={`bi ${mode.icon}`} aria-hidden="true" />
            </button>
          ))}
        </div>

        {/* 右侧：缩放 + 操作 */}
        <div className="toolbar-group toolbar-group-right">
          <div className="zoom-control">
            <button
              className="toolbar-btn zoom-btn"
              onClick={handleZoomOut}
              title="缩小"
              aria-label="缩小"
            >
              <i className="bi bi-dash-lg" aria-hidden="true" />
            </button>

            <div className="zoom-picker-wrap" ref={zoomMenuRef}>
              <button
                className="toolbar-btn zoom-picker"
                onClick={() => setZoomMenuOpen((v) => !v)}
                title="缩放比例"
                aria-haspopup="listbox"
                aria-expanded={zoomMenuOpen}
              >
                <span className="zoom-value">{currentZoom}%</span>
              </button>
              {zoomMenuOpen && (
                <div className="zoom-menu" role="listbox">
                  {ZOOM_STEPS.map((step) => {
                    const active = Math.abs(scale - step) < 0.01
                    return (
                      <button
                        key={step}
                        className={`zoom-menu-item ${active ? 'selected' : ''}`}
                        onClick={() => handleZoomTo(step)}
                        role="option"
                      >
                        <span>{Math.round(step * 100)}%</span>
                        {active && <i className="bi bi-check2" aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              className="toolbar-btn zoom-btn"
              onClick={handleZoomIn}
              title="放大"
              aria-label="放大"
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
            </button>
          </div>

          <div className="toolbar-divider" aria-hidden="true" />

          <button
            className="toolbar-btn"
            title="撤销"
            aria-label="撤销"
          >
            <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
          </button>
          <button
            className="toolbar-btn"
            title="重做"
            aria-label="重做"
          >
            <i className="bi bi-arrow-clockwise" aria-hidden="true" />
          </button>

        </div>
      </div>
    </header>
  )
}

export default Toolbar
