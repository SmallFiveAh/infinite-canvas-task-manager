import { useState, useCallback, useRef } from 'react'
import InfiniteCanvas from './InfiniteCanvas'
import LeftSidebar from './leftSidebar'
import Toolbar from './toolBar'
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
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
    </div>
  )
}

export default App
