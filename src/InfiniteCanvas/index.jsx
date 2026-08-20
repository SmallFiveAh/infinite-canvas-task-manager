import { useEffect, useRef, useState, useCallback } from 'react'
import './index.css'

/**
 * 无限画布组件 - Excalidraw 风格
 *  - 暖米白纸张背景 + 淡灰色点阵网格
 *  - 拖拽平移（鼠标左键按住空白区域）
 *  - 滚轮缩放（以鼠标位置为中心）
 */
function InfiniteCanvas() {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  // 画布状态：缩放比例 + 偏移量（画布坐标 → 屏幕坐标换算的核心）
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // 交互状态（使用 ref 避免频繁 re-render）
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ screenX: 0, screenY: 0, offsetX: 0, offsetY: 0 })
  const scaleRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })

  // Excalidraw 风格网格参数（加深版）
  const BASE_GRID = 20
  const BASE_DOT_RADIUS = 1.4
  const DRAW_INTERVAL_THRESHOLD = 10
  const MAX_DOTS_ON_SCREEN = 8000
  const MIN_MINOR_ALPHA = 0.12   // 降低 alpha 卸载门槛，让次点保留更久
  const MIN_MINOR_R = 1.0        // 提高次点最小半径，缩小时不致过小

  // 同步 ref，供事件回调使用最新值
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { offsetRef.current = offset }, [offset])

  /**
   * 推导网格渲染参数
   */
  const deriveGridMetrics = (curScale, viewW, viewH) => {
    const step = BASE_GRID
    const screenGap = step * curScale

    // 主点层级：每 N 个次点一个主点
    const majorEvery = 5

    // 点半径：缩小时有更高下限，不会变得太小
    const ratio = screenGap / 20
    // 引入非线性：缩小时下降更慢，放大时更接近线性
    const shrinkProtect = ratio < 1 ? Math.pow(ratio, 0.6) : ratio
    const minorR = Math.max(1.0, Math.min(2.4, BASE_DOT_RADIUS * shrinkProtect))
    const majorR = Math.max(1.8, minorR * 1.8)

    // 透明度：缩小时也不会变得太淡
    const normGap = screenGap / 20
    const minorAlpha = Math.max(0.14, Math.min(0.55, 0.35 * (normGap < 1 ? Math.pow(normGap, 0.5) : normGap)))
    const majorAlpha = Math.max(0.28, Math.min(0.85, 0.55 * Math.sqrt(normGap)))

    // 分级卸载 1：次点太小/太淡 → 卸载次点
    const hideMinor = minorAlpha < MIN_MINOR_ALPHA || minorR < MIN_MINOR_R

    const unitStep = hideMinor ? step * majorEvery : step
    const unitScreenGap = unitStep * curScale

    // 计算 drawInterval
    let drawInterval = 1
    if (unitScreenGap < DRAW_INTERVAL_THRESHOLD) {
      drawInterval = Math.ceil(DRAW_INTERVAL_THRESHOLD / unitScreenGap)
    }

    // 分级卸载 2：屏幕点数上限保护
    const realStep = unitStep * drawInterval
    const cols = Math.ceil(viewW / realStep) + 2
    const rows = Math.ceil(viewH / realStep) + 2
    const estDots = cols * rows
    if (estDots > MAX_DOTS_ON_SCREEN) {
      const k = Math.ceil(Math.sqrt(estDots / MAX_DOTS_ON_SCREEN))
      drawInterval *= Math.max(1, k)
    }

    return {
      step,
      majorEvery,
      minorR,
      majorR,
      screenGap,
      drawInterval,
      hideMinor,
      unitStep,
      minorAlpha,
      majorAlpha,
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
    const {
      step,
      majorEvery,
      minorR,
      majorR,
      drawInterval,
      hideMinor,
      unitStep,
      minorAlpha,
      majorAlpha,
    } = metrics

    const realStep = unitStep * drawInterval

    const pad = realStep
    const startX = Math.floor((viewLeft - pad) / realStep) * realStep
    const startY = Math.floor((viewTop - pad) / realStep) * realStep
    const endX = Math.ceil((viewRight + pad) / realStep) * realStep
    const endY = Math.ceil((viewBottom + pad) / realStep) * realStep

    // 加深版暖灰色网格点（stone 色系加深 1~2 级）
    const minorColor = `rgba(168, 162, 158, ${minorAlpha.toFixed(3)})`
    const majorColor = `rgba(120, 113, 108, ${majorAlpha.toFixed(3)})`

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (hideMinor) {
      for (let gx = startX; gx <= endX; gx += realStep) {
        for (let gy = startY; gy <= endY; gy += realStep) {
          const sx = gx * curScale + curOffset.x
          const sy = gy * curScale + curOffset.y
          ctx.beginPath()
          ctx.arc(sx, sy, majorR, 0, Math.PI * 2)
          ctx.fillStyle = majorColor
          ctx.fill()
        }
      }
      return
    }

    for (let gx = startX; gx <= endX; gx += realStep) {
      for (let gy = startY; gy <= endY; gy += realStep) {
        const sx = gx * curScale + curOffset.x
        const sy = gy * curScale + curOffset.y

        const isMajor =
          Math.round(gx / step) % majorEvery === 0 &&
          Math.round(gy / step) % majorEvery === 0

        ctx.beginPath()
        ctx.arc(sx, sy, isMajor ? majorR : minorR, 0, Math.PI * 2)
        ctx.fillStyle = isMajor ? majorColor : minorColor
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

  /** ===== 交互：鼠标按下开始拖拽 ===== */
  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    dragStartRef.current = {
      screenX: e.clientX,
      screenY: e.clientY,
      offsetX: offsetRef.current.x,
      offsetY: offsetRef.current.y,
    }
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing'
    }
  }

  /** ===== 交互：鼠标移动（拖拽中更新 offset） ===== */
  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return
    const dx = e.clientX - dragStartRef.current.screenX
    const dy = e.clientY - dragStartRef.current.screenY
    const newOffset = {
      x: dragStartRef.current.offsetX + dx,
      y: dragStartRef.current.offsetY + dy,
    }
    offsetRef.current = newOffset
    setOffset(newOffset)
  }

  /** ===== 交互：鼠标抬起 / 离开画布，结束拖拽 ===== */
  const endDrag = () => {
    isDraggingRef.current = false
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab'
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
    setScale(newScale)
    setOffset(newOffset)
  }

  /** ===== 点击缩放指示器恢复 100% ===== */
  const handleResetZoom = () => {
    scaleRef.current = 1
    offsetRef.current = { x: 0, y: 0 }
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  return (
    <div
      ref={containerRef}
      className="infinite-canvas-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} className="infinite-canvas-canvas" />
      <div className="infinite-canvas-hud" onClick={handleResetZoom} role="button" tabIndex={0} title="点击恢复到 100%">
        <span className="hud-icon">⊕</span>
        <span className="hud-text">{(scale * 100).toFixed(0)}%</span>
      </div>
    </div>
  )
}

export default InfiniteCanvas
