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

  // 网格参数
  const GRID_SIZE = 40 // 点间距（画布单位）
  const DOT_RADIUS = 1.5 // 点半径（屏幕像素）

  // 同步 ref，供事件回调使用最新值
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { offsetRef.current = offset }, [offset])

  /**
   * 绘制点阵网格
   * 思路：计算当前视口在画布坐标系下的可视范围，然后按间距绘制点
   */
  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    const width = container.clientWidth
    const height = container.clientHeight

    // 高清屏适配：canvas 物理尺寸 = 显示尺寸 × DPR
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const curScale = scaleRef.current
    const curOffset = offsetRef.current

    // 重置变换矩阵，先清空画布
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 应用 DPR 缩放 + 画布变换
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.translate(curOffset.x, curOffset.y)
    ctx.scale(curScale, curScale)

    // 计算可视范围（画布坐标）
    const viewLeft = -curOffset.x / curScale
    const viewTop = -curOffset.y / curScale
    const viewRight = viewLeft + width / curScale
    const viewBottom = viewTop + height / curScale

    // 扩展边界避免边缘截断
    const pad = GRID_SIZE
    const startX = Math.floor((viewLeft - pad) / GRID_SIZE) * GRID_SIZE
    const startY = Math.floor((viewTop - pad) / GRID_SIZE) * GRID_SIZE
    const endX = Math.ceil((viewRight + pad) / GRID_SIZE) * GRID_SIZE
    const endY = Math.ceil((viewBottom + pad) / GRID_SIZE) * GRID_SIZE

    // 点阵颜色：按点大小 / 层级做深浅区分（四边点风格）
    const majorColor = 'rgba(148, 163, 184, 0.75)'  // 主点（每 5 格一个，更大更明显）
    const minorColor = 'rgba(148, 163, 184, 0.35)'  // 次点

    // 取消变换，以屏幕像素为单位画点（保证点大小不随缩放而剧烈变化）
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    for (let gx = startX; gx <= endX; gx += GRID_SIZE) {
      for (let gy = startY; gy <= endY; gy += GRID_SIZE) {
        // 画布坐标 → 屏幕坐标
        const sx = gx * curScale + curOffset.x
        const sy = gy * curScale + curOffset.y

        // 判断是否为关键点（每 5 格一个大一点的点，形成四边点层级）
        const isMajor = (gx / GRID_SIZE) % 5 === 0 && (gy / GRID_SIZE) % 5 === 0

        ctx.beginPath()
        ctx.arc(sx, sy, isMajor ? DOT_RADIUS * 1.8 : DOT_RADIUS, 0, Math.PI * 2)
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
      {/* 缩放指示器（右下角） */}
      <div className="infinite-canvas-hud">
        缩放 {(scale * 100).toFixed(0)}%
      </div>
    </div>
  )
}

export default InfiniteCanvas
