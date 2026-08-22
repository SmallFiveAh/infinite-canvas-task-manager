import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import InfiniteCanvas from './InfiniteCanvas'
import LeftSidebar from './leftSidebar'
import Toolbar from './toolBar'
import BottomBar from './bottomBar'
import { DEFAULT_STICKY } from './stickyPalette'
import './App.css'

function App() {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [activeTool, setActiveTool] = useState('select')
  const [viewMode, setViewMode] = useState('select')
  const [isToolLocked, setIsToolLocked] = useState(false)
  const [elements, setElements] = useState([])
  const [selectedIds, setSelectedIds] = useState([])

  // Toolbar 需要获取画布容器尺寸，用于以视口中心为锚计算缩放后的 offset
  const canvasContainerRef = useRef(null)
  const elementIdRef = useRef(0)

  const handleTransformChange = useCallback((nextScale, nextOffset) => {
    setScale(nextScale)
    if (nextOffset) {
      setOffset(nextOffset)
    }
  }, [])

  const handleToolChange = useCallback((toolId) => {
    setActiveTool(toolId)
  }, [])

  const handleViewModeChange = useCallback((modeId) => {
    setViewMode(modeId)
  }, [])

  const toggleToolLock = useCallback(() => {
    setIsToolLocked((v) => !v)
  }, [])

  /**
   * 在画布指定位置创建便签
   * @param {object} stickyPreset - 便签样式预设
   * @param {object} canvasPos - 画布坐标系 {x, y}
   */
  const createStickyNote = useCallback((stickyPreset, canvasPos) => {
    const preset = stickyPreset || DEFAULT_STICKY
    const id = `sticky-${++elementIdRef.current}`
    const newSticky = {
      id,
      type: 'sticky',
      x: canvasPos ? canvasPos.x - preset.width / 2 : 200,
      y: canvasPos ? canvasPos.y - preset.height / 2 : 200,
      width: preset.width,
      height: preset.height,
      bg: preset.bg,
      border: preset.border,
      shape: preset.shape || 'rect',
      subShape: preset.subShape || null,
      text: '',
    }
    setElements((prev) => [...prev, newSticky])
    return newSticky
  }, [])

  /**
   * 屏幕坐标转换为画布坐标
   */
  const screenToCanvas = useCallback((clientX, clientY) => {
    const container = canvasContainerRef.current
    if (!container) return { x: 0, y: 0 }
    const rect = container.getBoundingClientRect()
    const localX = clientX - rect.left
    const localY = clientY - rect.top
    return {
      x: (localX - offset.x) / scale,
      y: (localY - offset.y) / scale,
    }
  }, [offset, scale])

  /**
   * 更新元素位置（拖拽移动）
   */
  const updateElementPosition = useCallback((id, newX, newY) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, x: newX, y: newY } : el))
    )
  }, [])

  /**
   * 更新元素尺寸（四角手柄拖拽缩放）
   * @param {string} id - 元素 id
   * @param {object} patch - { x, y, width, height } 新的几何属性
   */
  const resizeElement = useCallback((id, patch) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...patch } : el))
    )
  }, [])

  /**
   * 批量更新元素位置（多选拖拽整组移动）
   * @param {Array<{id, x, y}>} updates - 需要更新的元素及其新位置
   */
  const updateElementsBatch = useCallback((updates) => {
    if (!updates || updates.length === 0) return
    const map = new Map(updates.map((u) => [u.id, u]))
    setElements((prev) =>
      prev.map((el) => {
        const u = map.get(el.id)
        return u ? { ...el, x: u.x, y: u.y } : el
      })
    )
  }, [])

  /**
   * 组合 ID 生成器
   */
  const groupIdRef = useRef(0)

  /**
   * 对齐 / 分布选中元素
   *  - left / center-h / right：水平对齐到选区边界
   *  - top / center-v / bottom：垂直对齐到选区边界
   *  - distribute-h / distribute-v：等间距分布（首尾元素固定，中间元素重排）
   *
   * @param {string} type - 对齐/分布类型
   */
  const handleAlign = useCallback((type) => {
    if (!selectedIds || selectedIds.length < 2) return
    setElements((prev) => {
      const selSet = new Set(selectedIds)
      const sel = prev.filter((el) => selSet.has(el.id))
      if (sel.length < 2) return prev

      // 选区边界
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const el of sel) {
        if (el.x < minX) minX = el.x
        if (el.x + el.width > maxX) maxX = el.x + el.width
        if (el.y < minY) minY = el.y
        if (el.y + el.height > maxY) maxY = el.y + el.height
      }
      const centerH = (minX + maxX) / 2
      const centerV = (minY + maxY) / 2

      // 分布：至少需要 3 个元素
      if (type === 'distribute-h' || type === 'distribute-v') {
        if (sel.length < 3) return prev
        const horizontal = type === 'distribute-h'
        const sorted = [...sel].sort((a, b) =>
          horizontal ? a.x - b.x : a.y - b.y
        )
        const first = sorted[0]
        const last = sorted[sorted.length - 1]
        const startEdge = horizontal ? first.x : first.y
        const endEdge = horizontal ? last.x + last.width : last.y + last.height
        const sumSizes = sorted.reduce(
          (s, el) => s + (horizontal ? el.width : el.height), 0
        )
        const totalGap = endEdge - startEdge - sumSizes
        const gap = totalGap / (sorted.length - 1)

        const updates = {}
        let cursor = startEdge
        for (const el of sorted) {
          updates[el.id] = horizontal
            ? { x: cursor, y: el.y }
            : { x: el.x, y: cursor }
          cursor += (horizontal ? el.width : el.height) + gap
        }
        return prev.map((el) =>
          updates[el.id] ? { ...el, ...updates[el.id] } : el
        )
      }

      // 对齐
      return prev.map((el) => {
        if (!selSet.has(el.id)) return el
        let { x, y } = el
        switch (type) {
          case 'left': x = minX; break
          case 'center-h': x = centerH - el.width / 2; break
          case 'right': x = maxX - el.width; break
          case 'top': y = minY; break
          case 'center-v': y = centerV - el.height / 2; break
          case 'bottom': y = maxY - el.height; break
          default: break
        }
        return { ...el, x, y }
      })
    })
  }, [selectedIds])

  /**
   * 组合：为所有选中元素分配同一个 groupId
   */
  const handleGroup = useCallback(() => {
    if (!selectedIds || selectedIds.length < 2) return
    const gid = `group-${++groupIdRef.current}`
    setElements((prev) => prev.map((el) =>
      selectedIds.includes(el.id) ? { ...el, groupId: gid } : el
    ))
  }, [selectedIds])

  /**
   * 取消组合：移除选中元素所涉及的所有组合
   */
  const handleUngroup = useCallback(() => {
    if (!selectedIds || selectedIds.length === 0) return
    setElements((prev) => {
      const selSet = new Set(selectedIds)
      const touched = new Set()
      for (const el of prev) {
        if (selSet.has(el.id) && el.groupId) touched.add(el.groupId)
      }
      if (touched.size === 0) return prev
      return prev.map((el) =>
        touched.has(el.groupId) ? { ...el, groupId: undefined } : el
      )
    })
  }, [selectedIds])

  // 是否可组合 / 可取消组合
  const canGroup = selectedIds.length >= 2
  const canUngroup = useMemo(
    () => elements.some((el) => selectedIds.includes(el.id) && el.groupId),
    [elements, selectedIds]
  )

  // 快捷键：Ctrl/Cmd+G 组合，Ctrl/Cmd+Shift+G 取消组合
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target
      if (target && (target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key !== 'g') return
      e.preventDefault()
      if (e.shiftKey) handleUngroup()
      else handleGroup()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleGroup, handleUngroup])

  return (
    <div className="app-layout">
      <Toolbar
        scale={scale}
        offset={offset}
        canvasContainerRef={canvasContainerRef}
        onTransformChange={handleTransformChange}
        activeTool={activeTool}
        onToolChange={handleToolChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        isToolLocked={isToolLocked}
        onToggleLock={toggleToolLock}
      />
      <LeftSidebar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        isToolLocked={isToolLocked}
        createStickyNote={createStickyNote}
        screenToCanvas={screenToCanvas}
        scale={scale}
      />
      <InfiniteCanvas
        scale={scale}
        offset={offset}
        viewMode={viewMode}
        onTransformChange={handleTransformChange}
        onContainerReady={(el) => { canvasContainerRef.current = el }}
        elements={elements}
        onUpdateElement={updateElementPosition}
        onResizeElement={resizeElement}
        onUpdateElements={updateElementsBatch}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
      <BottomBar
        selectedCount={selectedIds.length}
        canGroup={canGroup}
        canUngroup={canUngroup}
        onAlign={handleAlign}
        onGroup={handleGroup}
        onUngroup={handleUngroup}
      />
    </div>
  )
}

export default App
