import { useEffect, useRef, useState, useCallback } from 'react'
import './index.css'

/**
 * 无限画布组件
 *  - 点阵网格（四边点，不连线）
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

  // 基础网格参数
  const BASE_GRID = 40           // 基础画布单位间距（固定不变，像刻度表的刻度间距）
  const BASE_DOT_RADIUS = 1.4    // 次点基础半径（屏幕像素，scale=1 screenGap=40 时的基准）
  const DRAW_INTERVAL_THRESHOLD = 8  // 目标屏幕点间距（跳点后约等于此值）
  const MAX_DOTS_ON_SCREEN = 6000    // 屏幕上最多绘制的点数量上限（硬性能保护）
  const MIN_MINOR_ALPHA = 0.12       // 次点透明度低于此值时直接卸载（看不见的不画）
  const MIN_MINOR_R = 0.75           // 次点半径小于此值时直接卸载（看不见的不画）

  // 同步 ref，供事件回调使用最新值
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { offsetRef.current = offset }, [offset])

  /**
   * 根据当前缩放比例计算网格渲染参数（刻度表模式：step 固定不变）
   * 点阵在画布坐标系中永远固定在 BASE_GRID 的整数倍位置，缩放时只是屏幕像素间距平滑变化。
   *
   * 分级卸载策略（缩小时）：
   *   1. 先卸载次点（hideMinor）：次点太小/太淡看不见，直接不画，只保留主点（5x5 大网格）
   *   2. 再跳点绘制（drawInterval）：如果主点也太密 / 估算点数超上限，每 N 格画 1 格
   * 以上两步都不改变点阵坐标的对齐基准，不会出现"跳变"感。
   */
  const deriveGridMetrics = (curScale, viewW, viewH) => {
    const step = BASE_GRID                              // 刻度间距固定，像尺子刻度不随缩放变
    const screenGap = step * curScale                   // 屏幕上点与点的像素间距（随缩放平滑变化）

    // 主点层级：每 N 个次点一个主点，固定为 5（像厘米/毫米刻度的 1cm 标）
    const majorEvery = 5

    // 点半径：与 screenGap 按比例缩放，但有上下限（太大像饼，太小看不见）
    const ratio = screenGap / 40
    const minorR = Math.max(0.5, Math.min(2.4, BASE_DOT_RADIUS * ratio))
    const majorR = minorR * 1.8

    // 颜色透明度随密度平滑变化
    const normGap = screenGap / 40
    const minorAlpha = Math.max(0.05, Math.min(0.5, 0.38 * normGap))
    const majorAlpha = Math.max(0.25, Math.min(0.85, 0.75 * Math.sqrt(normGap)))

    // ========== 分级卸载 1：次点太小/太淡 → 卸载次点，只保留主点 ==========
    const hideMinor = minorAlpha < MIN_MINOR_ALPHA || minorR < MIN_MINOR_R

    // 当前基础绘制的"实际单元格大小"（hideMinor 时直接按 majorEvery 格作为一单元，天然变疏）
    const unitStep = hideMinor ? step * majorEvery : step
    const unitScreenGap = unitStep * curScale

    // ========== 计算 drawInterval：基础跳点，让单元屏幕间距 ≈ DRAW_INTERVAL_THRESHOLD ==========
    let drawInterval = 1
    if (unitScreenGap < DRAW_INTERVAL_THRESHOLD) {
      drawInterval = Math.ceil(DRAW_INTERVAL_THRESHOLD / unitScreenGap)
    }

    // ========== 分级卸载 2：屏幕点数上限保护 → 再增大 drawInterval ==========
    // 估算将绘制的网格行列数（基于可视范围和真实绘制步长）
    const realStep = unitStep * drawInterval
    const cols = Math.ceil(viewW / realStep) + 2
    const rows = Math.ceil(viewH / realStep) + 2
    const estDots = cols * rows
    if (estDots > MAX_DOTS_ON_SCREEN) {
      // 需要放大 drawInterval，使估算点数 ≤ 上限
      // estDots / k² ≤ MAX  →  k ≥ sqrt(estDots / MAX)
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
   * 绘制点阵网格（刻度表模式 + 分级卸载）
   * 点阵永远固定在画布坐标系 BASE_GRID 的整数倍位置，缩放时屏幕间距平滑变化，无跳变。
   *
   * 缩小时按"看不见就不画"原则分级卸载：
   *   Level 0（正常）：画主点 + 次点，间距随缩放平滑变化
   *   Level 1（卸载次点）：次点太小/太淡 → 只画主点网格（每 5×5 格 1 个点）
   *   Level 2（跳点）：主点仍过密或点数超上限 → 每 N 个主点画 1 个
   */
  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    const width = container.clientWidth
    const height = container.clientHeight

    // 高清屏适配
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

    // 取得渲染参数（传入可视尺寸以便估算点数上限）
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

    // 真实绘制步长（unitStep = hideMinor ? step*5 : step；再乘 drawInterval 跳点）
    const realStep = unitStep * drawInterval

    // 扩展边界避免边缘截断
    const pad = realStep
    const startX = Math.floor((viewLeft - pad) / realStep) * realStep
    const startY = Math.floor((viewTop - pad) / realStep) * realStep
    const endX = Math.ceil((viewRight + pad) / realStep) * realStep
    const endY = Math.ceil((viewBottom + pad) / realStep) * realStep

    // 颜色
    const minorColor = `rgba(148, 163, 184, ${minorAlpha.toFixed(3)})`
    const majorColor = `rgba(148, 163, 184, ${majorAlpha.toFixed(3)})`

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // ===== 核心绘制循环 =====
    // hideMinor 时：unitStep = step * majorEvery，所以网格天然对齐到主点位置
    //              此时每个点都是主点，直接画大的（不用再判断 isMajor）
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

    // 正常模式：主点 + 次点都画，用 unitStep=step，drawInterval 可能>1
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
    // 只响应鼠标左键
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

    // 以鼠标位置为中心的缩放公式：
    // 屏幕点 P = 画布点 C × scale + offset
    // 缩放前后屏幕点 P 不变，推导新 offset
    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const newScale = Math.min(Math.max(curScale * zoomFactor, 0.1), 5) // 限制缩放范围
    const newOffset = {
      x: mouseX - (mouseX - curOffset.x) * (newScale / curScale),
      y: mouseY - (mouseY - curOffset.y) * (newScale / curScale),
    }

    scaleRef.current = newScale
    offsetRef.current = newOffset
    setScale(newScale)
    setOffset(newOffset)
  }

  /** ===== 交互：点击缩放指示器，恢复到 100% 并重置偏移 ===== */
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
      {/* 缩放指示器（右下角），点击恢复到 100% */}
      <div className="infinite-canvas-hud" onClick={handleResetZoom} role="button" tabIndex={0} title="点击恢复到 100%">
        缩放 {(scale * 100).toFixed(0)}%
      </div>
    </div>
  )
}

export default InfiniteCanvas
