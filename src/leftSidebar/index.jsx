import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import StickyPalette, { DEFAULT_STICKY } from '../stickyPalette'
import './index.css'

/**
 * 左侧工具栏组件 - 无限画布任务管理器
 * 仿 Figma / Excalidraw 风格的垂直工具栏
 *
 * 便签按钮特殊交互：
 *  - 按住并拖动：直接在拖放位置创建橙色默认便签
 *  - 单击（无拖动）：弹出便签样式面板，选择自定义样式
 */
function LeftSidebar({ activeTool, onToolChange, isToolLocked, createStickyNote, screenToCanvas, scale }) {
  const tools = [
    { id: 'palette', icon: 'bi-circle-square', label: '形状与流程图' },
    { id: 'text', icon: 'bi-type', label: '文字', framed: true },
    { id: 'freedraw', icon: 'bi-suit-club-fill', label: '手绘', custom: 'freedraw-curve' },
    { id: 'mindmap', icon: 'bi-diagram-3', label: '思维导图' },
    { id: 'sticky', icon: 'bi-sticky-fill', label: '便利贴', stickyNote: true },
    { id: 'table', icon: 'bi-grid-3x3-gap-fill', label: '表格', custom: 'table-icon' },
    { id: 'document', icon: 'bi-file-text', label: '文档', custom: 'doc-icon' },
    { id: 'list', icon: 'bi-list-check', label: '列表', custom: 'list-icon' },
    { id: 'card', icon: 'bi-card-text', label: '卡片', custom: 'card-icon' },
  ]

  // 便签面板显隐
  const [stickyPaletteVisible, setStickyPaletteVisible] = useState(false)
  // 便签拖动预览（屏幕坐标），拖动过程中实时跟随鼠标
  const [stickyPreview, setStickyPreview] = useState(null) // { x, y } | null
  // 便签按钮 DOM 引用（用于定位面板）
  const stickyBtnRef = useRef(null)

  // 便签拖放状态
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    moved: false,
  })
  const DRAG_THRESHOLD = 5 // 像素阈值，超过视为拖放而非点击

  const handleToolClick = (toolId) => {
    onToolChange?.(toolId)
  }

  /** ====== 便签按钮：区分鼠标按下拖放 vs 单击 ====== */
  const handleStickyMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    const state = dragStateRef.current
    state.isDragging = true
    state.moved = false
    state.startX = e.clientX
    state.startY = e.clientY
  }, [])

  const handleStickyMouseMove = useCallback((e) => {
    const state = dragStateRef.current
    if (!state.isDragging) return
    const dx = e.clientX - state.startX
    const dy = e.clientY - state.startY
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      state.moved = true
    }
    // 一旦判定为拖动，实时更新预览位置（让便签跟随鼠标）
    if (state.moved) {
      setStickyPreview({ x: e.clientX, y: e.clientY })
    }
  }, [])

  const handleStickyMouseUp = useCallback((e) => {
    const state = dragStateRef.current
    if (!state.isDragging) return
    const wasMoved = state.moved
    state.isDragging = false
    state.moved = false
    setStickyPreview(null)

    if (wasMoved) {
      // 拖放：在鼠标位置创建默认橙色便签
      const canvasPos = screenToCanvas?.(e.clientX, e.clientY)
      createStickyNote?.(DEFAULT_STICKY, canvasPos)
      onToolChange?.('sticky')
    } else {
      // 单击：弹出便签样式面板
      setStickyPaletteVisible(true)
      onToolChange?.('sticky')
    }
  }, [createStickyNote, screenToCanvas, onToolChange])

  // 全局监听鼠标移动/抬起，支持拖出按钮范围也能识别
  useEffect(() => {
    const onMove = (e) => handleStickyMouseMove(e)
    const onUp = (e) => handleStickyMouseUp(e)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [handleStickyMouseMove, handleStickyMouseUp])

  // 拖动过程中：把 body 光标改为 grabbing，避免文字选中
  useEffect(() => {
    if (!stickyPreview) return
    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
    }
  }, [stickyPreview])

  // 便签面板：外部点击 / Esc 关闭
  const paletteWrapRef = useRef(null)
  useEffect(() => {
    if (!stickyPaletteVisible) return
    const handleClickOutside = (e) => {
      const wrap = paletteWrapRef.current
      const btn = stickyBtnRef.current
      if (wrap && !wrap.contains(e.target) && btn && !btn.contains(e.target)) {
        setStickyPaletteVisible(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setStickyPaletteVisible(false)
    }
    // 使用 setTimeout 避免本次点击立即触发关闭
    const t = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside)
    }, 0)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [stickyPaletteVisible])

  /**
   * 便签样式面板选择回调
   */
  const handleStickyPaletteSelect = (preset) => {
    // 在画布中央（或偏移一点的位置）创建
    const container = document.querySelector('.infinite-canvas-container')
    if (container) {
      const rect = container.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const canvasPos = screenToCanvas?.(centerX, centerY)
      createStickyNote?.(preset, canvasPos)
    } else {
      createStickyNote?.(preset)
    }
    setStickyPaletteVisible(false)
  }

  return (
    <aside className="left-sidebar" aria-label="左侧工具栏">
      <div className="left-sidebar-inner">
        <div className="sidebar-tools-top">
          {tools.map((tool, index) => {
            const isActive = activeTool === tool.id
            const showLock = isToolLocked && isActive
            const isSticky = tool.id === 'sticky'

            const btnProps = isSticky
              ? {
                  ref: stickyBtnRef,
                  onMouseDown: handleStickyMouseDown,
                }
              : {
                  onClick: () => handleToolClick(tool.id),
                }

            return (
              <button
                key={tool.id}
                {...btnProps}
                className={`sidebar-tool-btn ${isActive ? 'active' : ''} ${tool.topGradient ? 'has-top-gradient' : ''} ${tool.stickyNote ? 'is-sticky' : ''} ${tool.custom || ''} ${showLock ? 'is-locked' : ''} ${isSticky ? 'sticky-tool-btn' : ''}`}
                title={`${tool.label}${showLock ? '（已锁定）' : ''}${isSticky ? ' · 拖放快速创建，单击选样式' : ''}`}
                aria-label={tool.label}
                data-index={index}
              >
                {tool.topGradient && (
                  <span className="top-gradient-bar" aria-hidden="true">
                    <span className="grad-1" />
                    <span className="grad-2" />
                    <span className="grad-3" />
                  </span>
                )}
                <i className={`bi ${tool.icon}`} aria-hidden="true" />
                {showLock && (
                  <span className="tool-lock-indicator" aria-hidden="true">
                    <i className="bi bi-lock-fill" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="sidebar-tools-bottom">
          <button
            className="sidebar-tool-btn more-btn"
            title="更多"
            aria-label="更多选项"
          >
            <i className="bi bi-three-dots" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 便签样式面板 - 定位在便签按钮右侧 */}
      {stickyPaletteVisible && (
        <StickyPalettePopover
          anchorRef={stickyBtnRef}
          wrapRef={paletteWrapRef}
          onSelect={handleStickyPaletteSelect}
        />
      )}

      {/* 便签拖动预览：跟随鼠标显示，松开后落到画布 */}
      {stickyPreview && (() => {
        const s = scale || 1
        const w = DEFAULT_STICKY.width * s
        const h = DEFAULT_STICKY.height * s
        return createPortal(
          <div
            className="sticky-drag-preview"
            style={{
              left: stickyPreview.x - w / 2,
              top: stickyPreview.y - h / 2,
              width: w,
              height: h,
              background: DEFAULT_STICKY.bg,
              borderColor: DEFAULT_STICKY.border,
            }}
          />,
          document.body
        )
      })()}
    </aside>
  )
}

/**
 * 便签面板 Popover - 定位在便签按钮右侧
 *
 * 注：因外层 .left-sidebar 有 transform: translateY(-50%)，
 * 子元素的 position:fixed 不再以 viewport 为基准（会被 transform 创建 containing block）。
 * 所以改用 position:absolute 相对 .left-sidebar 本身定位，
 * 并通过「按钮 rect - sidebar rect」换算 sidebar 内的局部坐标。
 */
function StickyPalettePopover({ anchorRef, wrapRef, onSelect }) {
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const [ready, setReady] = useState(false)

  const updatePos = useCallback(() => {
    const btnEl = anchorRef?.current
    if (!btnEl) return
    // 向上找到最近的 fixed/absolute 定位祖先（即 .left-sidebar 或其 wrapper）
    let sidebarEl = btnEl
    while (
      sidebarEl &&
      sidebarEl.tagName !== 'ASIDE' &&
      sidebarEl.className &&
      typeof sidebarEl.className === 'string' &&
      !sidebarEl.className.includes('left-sidebar')
    ) {
      sidebarEl = sidebarEl.parentElement
    }
    // 兜底：直接拿上层 aside
    if (!sidebarEl || !sidebarEl.getBoundingClientRect) sidebarEl = btnEl.closest('.left-sidebar, aside')
    if (!sidebarEl) return
    const btnRect = btnEl.getBoundingClientRect()
    const sbRect = sidebarEl.getBoundingClientRect()
    // 局部坐标：相对 sidebar 容器左上角
    const localLeft = (btnRect.right - sbRect.left) + 12
    const localTop = (btnRect.top - sbRect.top) - 4
    setPos({ left: localLeft, top: localTop })
    setReady(true)
  }, [anchorRef])

  useEffect(() => {
    updatePos()
    const raf1 = requestAnimationFrame(updatePos)
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(updatePos))
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [updatePos])

  return (
    <div
      ref={wrapRef}
      className={`sticky-palette-popover-wrap ${ready ? 'is-ready' : ''}`}
      style={{
        left: pos.left,
        top: pos.top,
      }}
    >
      <StickyPalette onSelect={onSelect} />
    </div>
  )
}

export default LeftSidebar
