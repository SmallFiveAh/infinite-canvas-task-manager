import { useEffect, useRef, useState, useCallback } from 'react'
import ContextMenu from '../contextMenu'
import './index.css'

/**
 * 无限画布组件 - Excalidraw 风格
 *  - 暖米白纸张背景 + 淡灰色点阵网格
 *  - 拖拽平移（鼠标左键按住空白区域）
 *  - 滚轮缩放（以鼠标位置为中心）
 *  - 支持便签元素渲染与拖拽移动
 *
 * 支持受控 / 非受控两种模式：
 *  - 受控：由父层（App）持有 scale & offset，通过 onTransformChange 回写
 *  - 非受控：未提供对应 props 时，组件内部自管
 */
function InfiniteCanvas({
  scale: scaleProp,
  offset: offsetProp,
  viewMode = 'hand',
  onTransformChange,
  onContainerReady,
  elements = [],
  onUpdateElement,
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  // 通过 useCallback ref 的方式将容器 DOM 暴露给父组件
  const setContainerRef = useCallback((el) => {
    containerRef.current = el
    if (onContainerReady) {
      onContainerReady(el)
    }
  }, [onContainerReady])

  const scaleControlled = scaleProp !== undefined
  const offsetControlled = offsetProp !== undefined

  const [innerScale, setInnerScale] = useState(1)
  const [innerOffset, setInnerOffset] = useState({ x: 0, y: 0 })

  const scale = scaleControlled ? scaleProp : innerScale
  const offset = offsetControlled ? offsetProp : innerOffset

  const updateTransform = useCallback((nextScale, nextOffset) => {
    if (onTransformChange) {
      onTransformChange(nextScale, nextOffset)
    } else {
      if (!scaleControlled) setInnerScale(nextScale)
      if (!offsetControlled && nextOffset) setInnerOffset(nextOffset)
    }
  }, [onTransformChange, scaleControlled, offsetControlled])

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 })

  // 框选状态：select 模式下左键拖拽产生矩形框
  // marquee = { startX, startY, curX, curY }（容器局部坐标），null 表示无框选
  const [marquee, setMarquee] = useState(null)

  // 交互状态（使用 ref 避免频繁 re-render）
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ screenX: 0, screenY: 0, offsetX: 0, offsetY: 0 })
  const scaleRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const isMarqueeRef = useRef(false)

  // 元素拖拽状态
  const elementDragRef = useRef({
    isDragging: false,
    elementId: null,
    offsetX: 0, // 鼠标相对元素左上角的偏移（画布坐标系）
    offsetY: 0,
  })

  // 点阵网格参数
  const BASE_GRID = 20
  const BASE_DOT_RADIUS = 1.4
  const DRAW_INTERVAL_THRESHOLD = 10
  const MAX_DOTS_ON_SCREEN = 8000

  // 同步 ref，供事件回调使用最新值
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { offsetRef.current = offset }, [offset])

  // viewMode：'hand' 允许左键拖拽平移；'select' 禁用左键平移（留给选择交互）
  const viewModeRef = useRef(viewMode)
  useEffect(() => {
    viewModeRef.current = viewMode
    const el = containerRef.current
    if (!el) return
    el.style.cursor = viewMode === 'hand' ? 'grab' : 'default'
  }, [viewMode])

  /**
   * 推导网格渲染参数
   */
  const deriveGridMetrics = (curScale, viewW, viewH) => {
    const step = BASE_GRID
    const screenGap = step * curScale

    const ratio = screenGap / 20
    const shrinkProtect = ratio < 1 ? Math.pow(ratio, 0.6) : ratio
    const dotR = Math.max(1.2, Math.min(2.4, BASE_DOT_RADIUS * shrinkProtect))

    const normGap = screenGap / 20
    const dotAlpha = Math.max(0.50, Math.min(0.7, 0.5 * (normGap < 1 ? Math.pow(normGap, 0.5) : normGap)))

    // 计算 drawInterval
    let drawInterval = 1
    if (screenGap < DRAW_INTERVAL_THRESHOLD) {
      drawInterval = Math.ceil(DRAW_INTERVAL_THRESHOLD / screenGap)
    }

    // 屏幕点数上限保护
    const realStep = step * drawInterval
    const cols = Math.ceil(viewW / realStep) + 2
    const rows = Math.ceil(viewH / realStep) + 2
    const estDots = cols * rows
    if (estDots > MAX_DOTS_ON_SCREEN) {
      const k = Math.ceil(Math.sqrt(estDots / MAX_DOTS_ON_SCREEN))
      drawInterval *= Math.max(1, k)
    }

    return {
      step,
      dotR,
      drawInterval,
      dotAlpha,
    }
  }

  /**
   * 绘制 Excalidraw 风格点阵网格
   */
  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    const width = container.clientWidth
    const height = container.clientHeight

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const curScale = scaleRef.current
    const curOffset = offsetRef.current

    // 清空画布
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 可视范围（画布坐标系）
    const viewLeft = -curOffset.x / curScale
    const viewTop = -curOffset.y / curScale
    const viewW = width / curScale
    const viewH = height / curScale
    const viewRight = viewLeft + viewW
    const viewBottom = viewTop + viewH

    const metrics = deriveGridMetrics(curScale, viewW, viewH)
    const { step, dotR, drawInterval, dotAlpha } = metrics

    const realStep = step * drawInterval

    const pad = realStep
    const startX = Math.floor((viewLeft - pad) / realStep) * realStep
    const startY = Math.floor((viewTop - pad) / realStep) * realStep
    const endX = Math.ceil((viewRight + pad) / realStep) * realStep
    const endY = Math.ceil((viewBottom + pad) / realStep) * realStep

    const dotColor = `rgba(148, 142, 138, ${dotAlpha.toFixed(3)})`

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    for (let gx = startX; gx <= endX; gx += realStep) {
      for (let gy = startY; gy <= endY; gy += realStep) {
        const sx = gx * curScale + curOffset.x
        const sy = gy * curScale + curOffset.y
        ctx.beginPath()
        ctx.arc(sx, sy, dotR, 0, Math.PI * 2)
        ctx.fillStyle = dotColor
        ctx.fill()
      }
    }
  }, [])

  // 初次渲染 + 窗口 resize 时重绘
  useEffect(() => {
    drawGrid()
    const onResize = () => drawGrid()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [drawGrid])

  // scale / offset 变化时重绘
  useEffect(() => { drawGrid() }, [scale, offset, drawGrid])

  /**
   * 容器局部坐标 → 画布坐标
   */
  const localToCanvas = useCallback((localX, localY) => {
    return {
      x: (localX - offsetRef.current.x) / scaleRef.current,
      y: (localY - offsetRef.current.y) / scaleRef.current,
    }
  }, [])

  /**
   * 判断点击是否命中某个便签元素（返回元素 or null）
   */
  const hitTestElement = useCallback((canvasX, canvasY) => {
    // 从后向前遍历（后渲染的在上层）
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i]
      if (el.type !== 'sticky') continue
      if (
        canvasX >= el.x &&
        canvasX <= el.x + el.width &&
        canvasY >= el.y &&
        canvasY <= el.y + el.height
      ) {
        return el
      }
    }
    return null
  }, [elements])

  /** ===== 交互：鼠标按下 =====
   *  优先检测是否点中便签元素 → 拖拽元素
   *  否则：hand 模式平移画布 / select 模式框选
   */
  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const localX = e.clientX - rect.left
    const localY = e.clientY - rect.top
    const { x: canvasX, y: canvasY } = localToCanvas(localX, localY)

    // 检测是否点中便签
    const hit = hitTestElement(canvasX, canvasY)
    if (hit) {
      elementDragRef.current = {
        isDragging: true,
        elementId: hit.id,
        offsetX: canvasX - hit.x,
        offsetY: canvasY - hit.y,
      }
      container.style.cursor = 'move'
      return
    }

    if (viewModeRef.current === 'hand') {
      isDraggingRef.current = true
      dragStartRef.current = {
        screenX: e.clientX,
        screenY: e.clientY,
        offsetX: offsetRef.current.x,
        offsetY: offsetRef.current.y,
      }
      container.style.cursor = 'grabbing'
    } else {
      // select 模式：启动框选
      isMarqueeRef.current = true
      setMarquee({ startX: localX, startY: localY, curX: localX, curY: localY })
    }
  }

  /** ===== 交互：鼠标移动 ===== */
  const handleMouseMove = (e) => {
    const container = containerRef.current
    if (!container) return

    // 便签元素拖拽中
    if (elementDragRef.current.isDragging) {
      const rect = container.getBoundingClientRect()
      const localX = e.clientX - rect.left
      const localY = e.clientY - rect.top
      const { x: canvasX, y: canvasY } = localToCanvas(localX, localY)
      const { elementId, offsetX, offsetY } = elementDragRef.current
      const newX = canvasX - offsetX
      const newY = canvasY - offsetY
      onUpdateElement?.(elementId, newX, newY)
      return
    }

    if (isMarqueeRef.current) {
      const rect = container.getBoundingClientRect()
      setMarquee((prev) => prev ? {
        ...prev,
        curX: e.clientX - rect.left,
        curY: e.clientY - rect.top,
      } : prev)
      return
    }

    if (!isDraggingRef.current) return
    const dx = e.clientX - dragStartRef.current.screenX
    const dy = e.clientY - dragStartRef.current.screenY
    const newOffset = {
      x: dragStartRef.current.offsetX + dx,
      y: dragStartRef.current.offsetY + dy,
    }
    offsetRef.current = newOffset
    updateTransform(scaleRef.current, newOffset)
  }

  /** ===== 交互：鼠标抬起 / 离开画布，结束拖拽或框选 ===== */
  const endDrag = () => {
    if (elementDragRef.current.isDragging) {
      elementDragRef.current = {
        isDragging: false,
        elementId: null,
        offsetX: 0,
        offsetY: 0,
      }
      if (containerRef.current) {
        containerRef.current.style.cursor = viewModeRef.current === 'hand' ? 'grab' : 'default'
      }
      return
    }

    if (isMarqueeRef.current) {
      isMarqueeRef.current = false
      // 空画布上无元素可选，释放即清除框（符合 Figma/Excalidraw 行为）
      setMarquee(null)
      return
    }
    isDraggingRef.current = false
    if (containerRef.current) {
      containerRef.current.style.cursor = viewModeRef.current === 'hand' ? 'grab' : 'default'
    }
  }

  /** ===== 交互：滚轮缩放（以鼠标位置为中心） ===== */
  const handleWheel = (e) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const curScale = scaleRef.current
    const curOffset = offsetRef.current

    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const newScale = Math.min(Math.max(curScale * zoomFactor, 0.1), 5)
    const newOffset = {
      x: mouseX - (mouseX - curOffset.x) * (newScale / curScale),
      y: mouseY - (mouseY - curOffset.y) * (newScale / curScale),
    }

    scaleRef.current = newScale
    offsetRef.current = newOffset
    updateTransform(newScale, newOffset)
  }

  /** ===== 点击缩放指示器恢复 100% ===== */
  const handleResetZoom = () => {
    scaleRef.current = 1
    offsetRef.current = { x: 0, y: 0 }
    updateTransform(1, { x: 0, y: 0 })
  }

  /** ===== 右键菜单 ===== */
  const handleContextMenu = (e) => {
    e.preventDefault()
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY })
  }

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev))
  }, [])

  useEffect(() => {
    if (!contextMenu.visible) return
    const handleClickOutside = () => closeContextMenu()
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    window.addEventListener('click', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu.visible, closeContextMenu])

  return (
    <div
      ref={setContainerRef}
      className="infinite-canvas-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
    >
      <canvas ref={canvasRef} className="infinite-canvas-canvas" />

      {/* 元素层：便签等 */}
      <div className="infinite-canvas-elements" style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
      }}>
        {elements.map((el) => {
          if (el.type === 'sticky') {
            const style = {
              position: 'absolute',
              left: el.x * scale + offset.x,
              top: el.y * scale + offset.y,
              width: el.width * scale,
              height: el.height * scale,
              background: el.bg,
              border: `1.5px solid ${el.border}`,
              borderRadius: el.shape === 'irregular' ? '8px 14px 10px 12px' : '10px',
              transform: el.shape === 'irregular' ? 'rotate(-0.5deg)' : 'none',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              pointerEvents: 'auto',
              cursor: 'grab',
              padding: `${8 * scale}px ${12 * scale}px`,
              fontSize: `${15 * scale}px`,
              color: 'var(--ink-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              transition: 'box-shadow 0.15s ease',
            }
            return (
              <div
                key={el.id}
                className="canvas-sticky-note"
                style={style}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'
                }}
              >
                <div className="sticky-corner-fold" style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: `${14 * scale}px`,
                  height: `${14 * scale}px`,
                  background: `linear-gradient(135deg, transparent 50%, ${el.border} 50%, ${el.border} 100%)`,
                  borderRadius: `0 ${el.shape === 'irregular' ? '12px' : '8px'} 0 0`,
                  opacity: 0.6,
                }} />
              </div>
            )
          }
          return null
        })}
      </div>

      {marquee && (() => {
        const left = Math.min(marquee.startX, marquee.curX)
        const top = Math.min(marquee.startY, marquee.curY)
        const width = Math.abs(marquee.curX - marquee.startX)
        const height = Math.abs(marquee.curY - marquee.startY)
        // 拖拽距离过小（纯点击）时不显示框，避免闪烁
        if (width < 2 && height < 2) return null
        return (
          <div
            className="marquee-selection"
            style={{ left, top, width, height }}
            aria-hidden="true"
          />
        )
      })()}
      <div className="infinite-canvas-hud" onClick={handleResetZoom} role="button" tabIndex={0} title="点击恢复到 100%">
        <i className="hud-icon bi bi-arrows-fullscreen" aria-hidden="true" />
        <span className="hud-text">{(scale * 100).toFixed(0)}%</span>
      </div>
      <ContextMenu
        visible={contextMenu.visible}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        onClose={closeContextMenu}
      />
    </div>
  )
}

export default InfiniteCanvas
