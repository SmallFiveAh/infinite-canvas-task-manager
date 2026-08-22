import { useEffect, useRef, useState, useCallback } from 'react'
import ContextMenu from '../contextMenu'
import './index.css'
import '../stickyPalette/index.css' // 引入异形便签样式

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
  onResizeElement,
  onUpdateElements,
  selectedIds = [],
  onSelectionChange,
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
  const marqueeStartShiftRef = useRef(false)
  const marqueeRef = useRef(null)
  const selectedIdsRef = useRef([])

  // 元素拖拽状态
  const elementDragRef = useRef({
    isDragging: false,
    elementId: null,
    offsetX: 0, // 鼠标相对元素左上角的偏移（画布坐标系）
    offsetY: 0,
  })

  // 多选组拖拽状态：整组按位移一起移动
  const groupDragRef = useRef({
    isDragging: false,
    startCanvasX: 0, // 鼠标按下时的画布坐标
    startCanvasY: 0,
    startPositions: {}, // { [id]: { x, y } } 各选中元素的起始位置
  })

  // 便签缩放拖拽状态（四角手柄拖拽）
  const resizeDragRef = useRef({
    isResizing: false,
    elementId: null,
    handle: null, // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    startCanvasX: 0, // 鼠标按下时的画布坐标
    startCanvasY: 0,
    origEl: null, // 原始几何 { x, y, width, height }
  })
  // 便签缩放最小尺寸（画布坐标系，与 scale 无关）
  const MIN_STICKY_W = 40
  const MIN_STICKY_H = 40

  // 点阵网格参数
  const BASE_GRID = 20
  const BASE_DOT_RADIUS = 1.4
  const DRAW_INTERVAL_THRESHOLD = 10
  const MAX_DOTS_ON_SCREEN = 8000

  // 同步 ref，供事件回调使用最新值
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { offsetRef.current = offset }, [offset])
  useEffect(() => { selectedIdsRef.current = selectedIds }, [selectedIds])

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
   * 根据手柄与鼠标位移计算便签新的几何属性
   *  - 始终保持「对角点」不动
   *  - 涉及左/上边移动的手柄，在 clamp 到最小尺寸时同步调整 x/y，
   *    保证对角点依然贴在原位
   *
   * @param {string} handle - 四角手柄标识
   * @param {object} orig - 原始几何 { x, y, width, height }
   * @param {number} dx - 鼠标在画布坐标系下的水平位移
   * @param {number} dy - 鼠标在画布坐标系下的垂直位移
   * @param {number} minW / minH - 最小尺寸
   * @returns {{x,y,width,height}} 新的几何
   */
  const computeResizePatch = useCallback((handle, orig, dx, dy, minW, minH) => {
    let { x, y, width, height } = orig
    switch (handle) {
      case 'bottom-right': // 左上角不动
        width = Math.max(minW, orig.width + dx)
        height = Math.max(minH, orig.height + dy)
        break
      case 'bottom-left': // 右上角不动
        width = Math.max(minW, orig.width - dx)
        height = Math.max(minH, orig.height + dy)
        x = orig.x + (orig.width - width)
        break
      case 'top-right': // 左下角不动
        width = Math.max(minW, orig.width + dx)
        height = Math.max(minH, orig.height - dy)
        y = orig.y + (orig.height - height)
        break
      case 'top-left': // 右下角不动
        width = Math.max(minW, orig.width - dx)
        height = Math.max(minH, orig.height - dy)
        x = orig.x + (orig.width - width)
        y = orig.y + (orig.height - height)
        break
      default:
        break
    }
    return { x, y, width, height }
  }, [])

  /**
   * 便签四角手柄鼠标按下：启动缩放拖拽
   *  - stopPropagation 阻止冒泡到容器，避免同时触发便签移动
   *  - 记录起始画布坐标与原始几何，供 mousemove 计算
   */
  const handleResizeHandleMouseDown = useCallback((e, elementId, handle) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const el = elements.find((it) => it.id === elementId)
    if (!el) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const localX = e.clientX - rect.left
    const localY = e.clientY - rect.top
    const { x: canvasX, y: canvasY } = localToCanvas(localX, localY)
    resizeDragRef.current = {
      isResizing: true,
      elementId,
      handle,
      startCanvasX: canvasX,
      startCanvasY: canvasY,
      origEl: { x: el.x, y: el.y, width: el.width, height: el.height },
    }
    container.style.cursor =
      handle === 'top-left' || handle === 'bottom-right' ? 'nwse-resize' : 'nesw-resize'
  }, [elements, localToCanvas])

  /**
   * 多选虚拟框鼠标按下：启动整组拖拽
   *  - 记录鼠标起始画布坐标与各选中元素的初始位置
   *  - stopPropagation 阻止冒泡到容器，避免触发单元素拖拽 / 平移 / 框选
   */
  const handleGroupDragMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const localX = e.clientX - rect.left
    const localY = e.clientY - rect.top
    const { x: canvasX, y: canvasY } = localToCanvas(localX, localY)
    const curSelected = selectedIdsRef.current
    if (curSelected.length < 2) return
    // 记录所有选中元素的起始位置，后续按鼠标位移整体平移
    const startPositions = {}
    for (const el of elements) {
      if (curSelected.includes(el.id)) {
        startPositions[el.id] = { x: el.x, y: el.y }
      }
    }
    groupDragRef.current = {
      isDragging: true,
      startCanvasX: canvasX,
      startCanvasY: canvasY,
      startPositions,
    }
    container.style.cursor = 'move'
  }, [elements, localToCanvas])

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

  /**
   * 获取框选矩形（画布坐标系）内的所有元素 ID
   */
  const getElementsInMarquee = useCallback((marqueeRect) => {
    if (!marqueeRect) return []
    const { left, top, right, bottom } = marqueeRect
    const ids = []
    for (const el of elements) {
      if (el.type !== 'sticky') continue
      // 矩形相交检测
      const elRight = el.x + el.width
      const elBottom = el.y + el.height
      if (el.x <= right && elRight >= left && el.y <= bottom && elBottom >= top) {
        ids.push(el.id)
      }
    }
    return ids
  }, [elements])

  /** ===== 交互：鼠标按下 =====
   *  中键（button === 1）：select 模式下平移画布，优先级最高，
   *                       覆盖元素拖拽 / 框选交互；hand 模式下不触发（左键已可平移）
   *  左键（button === 0）：优先检测是否点中便签元素 → 拖拽元素
   *                       否则：hand 模式平移画布 / select 模式框选
   */
  const handleMouseDown = (e) => {
    // 中键拖拽：仅 select 模式下提供平移画布的快捷方式
    // （hand 模式下左键已可平移，中键无需重复此功能）
    if (e.button === 1) {
      e.preventDefault() // 始终阻止浏览器默认的自动滚动行为
      if (viewModeRef.current === 'hand') return
      const container = containerRef.current
      if (!container) return
      isDraggingRef.current = true
      dragStartRef.current = {
        screenX: e.clientX,
        screenY: e.clientY,
        offsetX: offsetRef.current.x,
        offsetY: offsetRef.current.y,
      }
      container.style.cursor = 'grabbing'
      return
    }

    if (e.button !== 0) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const localX = e.clientX - rect.left
    const localY = e.clientY - rect.top
    const { x: canvasX, y: canvasY } = localToCanvas(localX, localY)
    const isShift = e.shiftKey

    // 检测是否点中便签
    const hit = hitTestElement(canvasX, canvasY)
    if (hit) {
      // select 模式下：点击元素更新选中状态
      if (viewModeRef.current === 'select') {
        const curSelected = selectedIdsRef.current
        if (isShift) {
          // Shift + 点击：切换单个元素选中（追加/取消）
          const isAlreadySelected = curSelected.includes(hit.id)
          const next = isAlreadySelected
            ? curSelected.filter((id) => id !== hit.id)
            : [...curSelected, hit.id]
          onSelectionChange?.(next)
        } else if (!curSelected.includes(hit.id)) {
          // 普通点击未选中的元素：单选该元素
          onSelectionChange?.([hit.id])
        }
      }
      elementDragRef.current = {
        isDragging: true,
        elementId: hit.id,
        offsetX: canvasX - hit.x,
        offsetY: canvasY - hit.y,
      }
      container.style.cursor = 'move'
      return
    }

    // 未点中任何元素
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
      // 非 Shift 状态下：空点击清空选中（在鼠标抬起时判断无移动再清空）
      marqueeStartShiftRef.current = isShift
      isMarqueeRef.current = true
      const mq = { startX: localX, startY: localY, curX: localX, curY: localY }
      marqueeRef.current = mq
      setMarquee(mq)
    }
  }

  /** ===== 交互：鼠标移动 ===== */
  const handleMouseMove = (e) => {
    const container = containerRef.current
    if (!container) return

    // 便签缩放拖拽中（四角手柄）
    if (resizeDragRef.current.isResizing) {
      const rect = container.getBoundingClientRect()
      const localX = e.clientX - rect.left
      const localY = e.clientY - rect.top
      const { x: canvasX, y: canvasY } = localToCanvas(localX, localY)
      const { handle, startCanvasX, startCanvasY, origEl, elementId } = resizeDragRef.current
      const dx = canvasX - startCanvasX
      const dy = canvasY - startCanvasY
      const patch = computeResizePatch(handle, origEl, dx, dy, MIN_STICKY_W, MIN_STICKY_H)
      onResizeElement?.(elementId, patch)
      return
    }

    // 多选组拖拽中：按鼠标位移整体平移所有选中元素
    if (groupDragRef.current.isDragging) {
      const rect = container.getBoundingClientRect()
      const localX = e.clientX - rect.left
      const localY = e.clientY - rect.top
      const { x: canvasX, y: canvasY } = localToCanvas(localX, localY)
      const { startCanvasX, startCanvasY, startPositions } = groupDragRef.current
      const dx = canvasX - startCanvasX
      const dy = canvasY - startCanvasY
      const updates = Object.keys(startPositions).map((id) => ({
        id,
        x: startPositions[id].x + dx,
        y: startPositions[id].y + dy,
      }))
      onUpdateElements?.(updates)
      return
    }

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

    if (isMarqueeRef.current && marqueeRef.current) {
      const rect = container.getBoundingClientRect()
      const next = {
        ...marqueeRef.current,
        curX: e.clientX - rect.left,
        curY: e.clientY - rect.top,
      }
      marqueeRef.current = next
      setMarquee(next)
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
    if (resizeDragRef.current.isResizing) {
      resizeDragRef.current = {
        isResizing: false,
        elementId: null,
        handle: null,
        startCanvasX: 0,
        startCanvasY: 0,
        origEl: null,
      }
      if (containerRef.current) {
        containerRef.current.style.cursor = viewModeRef.current === 'hand' ? 'grab' : 'default'
      }
      return
    }

    if (groupDragRef.current.isDragging) {
      groupDragRef.current = {
        isDragging: false,
        startCanvasX: 0,
        startCanvasY: 0,
        startPositions: {},
      }
      if (containerRef.current) {
        containerRef.current.style.cursor = viewModeRef.current === 'hand' ? 'grab' : 'default'
      }
      return
    }

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
      const marqueeSnapshot = marqueeRef.current
      isMarqueeRef.current = false
      marqueeRef.current = null
      setMarquee(null)

      // 计算框选覆盖的元素
      if (marqueeSnapshot && viewModeRef.current === 'select') {
        const { startX, startY, curX, curY } = marqueeSnapshot
        const width = Math.abs(curX - startX)
        const height = Math.abs(curY - startY)
        const isPureClick = width < 3 && height < 3

        if (isPureClick) {
          // 纯点击空白处：非 Shift 清空选中
          if (!marqueeStartShiftRef.current) {
            onSelectionChange?.([])
          }
        } else {
          // 框选：转换为画布坐标系矩形
          const leftLocal = Math.min(startX, curX)
          const topLocal = Math.min(startY, curY)
          const rightLocal = Math.max(startX, curX)
          const bottomLocal = Math.max(startY, curY)
          const { x: cx1, y: cy1 } = localToCanvas(leftLocal, topLocal)
          const { x: cx2, y: cy2 } = localToCanvas(rightLocal, bottomLocal)
          const marqueeRect = {
            left: Math.min(cx1, cx2),
            top: Math.min(cy1, cy2),
            right: Math.max(cx1, cx2),
            bottom: Math.max(cy1, cy2),
          }
          const hitIds = getElementsInMarquee(marqueeRect)
          if (marqueeStartShiftRef.current) {
            // Shift + 框选：并集（去重追加）
            const set = new Set([...selectedIdsRef.current, ...hitIds])
            onSelectionChange?.(Array.from(set))
          } else {
            onSelectionChange?.(hitIds)
          }
        }
      }
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

  // Esc 清空选中（输入框中不触发）
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return
      const target = e.target
      if (target && (target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (selectedIdsRef.current.length > 0) {
        onSelectionChange?.([])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSelectionChange])

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
            const isSelected = selectedIds.includes(el.id)
            const isIrregular = el.shape === 'irregular' && el.subShape
            const shapeClass = isIrregular ? `shape-${el.subShape}` : ''
            const subShape = el.subShape

            // Wrapper 类名：定位 + 选中态，不使用任何 clip-path / transform
            const wrapperClass = [
              'canvas-sticky-note',
              isIrregular ? 'has-irregular' : 'is-rect',
              isSelected ? 'is-selected' : '',
            ].filter(Boolean).join(' ')

            // Shape 内层类名：真正应用异形样式（clip-path / border-radius / transform）
            const shapeInnerClass = [
              'sticky-shape',
              isIrregular ? `irregular-shape ${shapeClass}` : 'rect-shape',
            ].filter(Boolean).join(' ')

            // Wrapper 外层样式：只负责定位、大小、鼠标交互
            const wrapperStyle = {
              position: 'absolute',
              left: el.x * scale + offset.x,
              top: el.y * scale + offset.y,
              width: el.width * scale,
              height: el.height * scale,
              pointerEvents: 'auto',
              cursor: 'grab',
              userSelect: 'none',
              outline: 'none',
              background: 'transparent', // 关键：wrapper 透明，不裁剪子元素
              overflow: 'visible', // 关键：允许手柄显示在外部
              fontSize: `${15 * scale}px`,
              transition: 'filter 0.15s ease',
            }

            // Shape 内层样式：真正承载背景、形状
            const shapeStyle = {
              position: 'absolute',
              inset: 0,
              background: el.bg,
              color: el.border,
              // 矩形：标准 border + box-shadow
              ...(isIrregular ? {} : {
                border: isSelected
                  ? `2.5px solid var(--accent-purple, #aa3bff)`
                  : `1.5px solid ${el.border}`,
                borderRadius: '10px',
                padding: `${8 * scale}px ${12 * scale}px`,
                boxShadow: isSelected
                  ? '0 0 0 3px rgba(170, 59, 255, 0.18), 0 6px 16px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)'
                  : '0 2px 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              }),
              // 异形：阴影通过 wrapper 的 filter 保证不被 clip-path 裁剪
              ...(isIrregular ? {
                boxShadow: isSelected
                  ? 'inset 0 0 0 3px rgba(170, 59, 255, 0.22)'
                  : 'inset 0 0 0 1.5px currentColor',
              } : {}),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }

            // Wrapper 外层给异形加一个悬浮阴影（用 drop-shadow，不会被 clip-path 裁剪）
            if (isIrregular) {
              wrapperStyle.filter = isSelected
                ? 'drop-shadow(0 6px 16px rgba(0,0,0,0.10)) drop-shadow(0 2px 4px rgba(0,0,0,0.06))'
                : 'drop-shadow(0 2px 6px rgba(0,0,0,0.06)) drop-shadow(0 1px 2px rgba(0,0,0,0.04))'
            }

            return (
              <div
                key={el.id}
                className={wrapperClass}
                style={wrapperStyle}
                data-selected={isSelected ? 'true' : 'false'}
                data-shape={el.shape}
                data-sub-shape={subShape || ''}
                onMouseEnter={(e) => {
                  if (!isSelected && isIrregular) {
                    e.currentTarget.style.filter =
                      'drop-shadow(0 6px 16px rgba(0,0,0,0.10)) drop-shadow(0 2px 4px rgba(0,0,0,0.06))'
                  } else if (!isSelected) {
                    const shapeEl = e.currentTarget.querySelector('.sticky-shape')
                    if (shapeEl) shapeEl.style.boxShadow = '0 6px 16px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected && isIrregular) {
                    e.currentTarget.style.filter =
                      'drop-shadow(0 2px 6px rgba(0,0,0,0.06)) drop-shadow(0 1px 2px rgba(0,0,0,0.04))'
                  } else if (!isSelected) {
                    const shapeEl = e.currentTarget.querySelector('.sticky-shape')
                    if (shapeEl) shapeEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'
                  }
                }}
              >
                {/* ===== 内层：真正的异形形状 ===== */}
                <div className={shapeInnerClass} style={shapeStyle}>
                  {/* 异形：内容安全区（防止文字溢出异形边缘） */}
                  {isIrregular ? (
                    <div
                      className="sticky-inner-content"
                      style={{
                        position: 'absolute',
                        inset: subShape === 'heart' ? '22% 15% 12% 15%'
                             : subShape === 'flower' ? '18%'
                             : subShape === 'gear' ? '16%'
                             : subShape === 'droplet' ? '18% 16% 16% 18%'
                             : subShape === 'wave' ? '14% 10%'
                             : '15%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--ink-primary)',
                        // 水滴形：内层 rotate(-45deg)，这里抵消回来
                        transform: subShape === 'droplet' ? 'rotate(45deg)' : 'none',
                        pointerEvents: 'none',
                      }}
                    >
                      {/* 便签文字占位 */}
                    </div>
                  ) : null}
                </div>

                {/* ===== 选中高亮外层光晕（异形：用一个稍微放大的副本放在后面作为发光边） ===== */}
                {isSelected && isIrregular && (
                  <div
                    className={`sticky-glow-layer irregular-shape ${shapeClass}`}
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: -3,
                      background: 'rgba(170, 59, 255, 0.18)',
                      zIndex: -1,
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* ===== 四角手柄：放在 wrapper 外层，永远不被 clip-path 裁剪 ===== */}
                {/* 多选时隐藏单元素手柄，改由整组虚拟框统一移动 */}
                {isSelected && selectedIds.length === 1 && (
                  <>
                    {[
                      { pos: 'top-left', left: -5, top: -5, cursor: 'nwse-resize' },
                      { pos: 'top-right', right: -5, top: -5, cursor: 'nesw-resize' },
                      { pos: 'bottom-left', left: -5, bottom: -5, cursor: 'nesw-resize' },
                      { pos: 'bottom-right', right: -5, bottom: -5, cursor: 'nwse-resize' },
                    ].map((handle) => (
                      <span
                        key={handle.pos}
                        className={`sticky-select-handle handle-${handle.pos}`}
                        onMouseDown={(e) => handleResizeHandleMouseDown(e, el.id, handle.pos)}
                        style={{
                          position: 'absolute',
                          width: 10,
                          height: 10,
                          background: '#ffffff',
                          border: '2px solid var(--accent-purple, #aa3bff)',
                          borderRadius: '50%',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.20), 0 0 0 2px rgba(255,255,255,0.60)',
                          left: handle.left !== undefined ? handle.left : undefined,
                          right: handle.right !== undefined ? handle.right : undefined,
                          top: handle.top !== undefined ? handle.top : undefined,
                          bottom: handle.bottom !== undefined ? handle.bottom : undefined,
                          zIndex: 10, // 最高层，绝对不被任何东西挡住
                          cursor: handle.cursor,
                        }}
                      />
                    ))}
                  </>
                )}
              </div>
            )
          }
          return null
        })}
      </div>

      {/* 多选虚拟框：包围所有选中元素，拖拽可整组移动 */}
      {selectedIds.length >= 2 && (() => {
        const selEls = elements.filter((el) => selectedIds.includes(el.id))
        if (selEls.length < 2) return null
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const el of selEls) {
          minX = Math.min(minX, el.x)
          minY = Math.min(minY, el.y)
          maxX = Math.max(maxX, el.x + el.width)
          maxY = Math.max(maxY, el.y + el.height)
        }
        const left = minX * scale + offset.x
        const top = minY * scale + offset.y
        const width = (maxX - minX) * scale
        const height = (maxY - minY) * scale
        return (
          <div
            className="group-selection-frame"
            style={{ left, top, width, height }}
            onMouseDown={handleGroupDragMouseDown}
          />
        )
      })()}

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
