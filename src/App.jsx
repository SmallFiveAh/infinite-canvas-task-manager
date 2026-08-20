import { useState, useCallback, useRef } from 'react'
import InfiniteCanvas from './InfiniteCanvas'
import LeftSidebar from './leftSidebar'
import Toolbar from './toolBar'
import './App.css'

function App() {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [activeTool, setActiveTool] = useState('select')
  const [viewMode, setViewMode] = useState('select')
  const [isToolLocked, setIsToolLocked] = useState(false)

  // Toolbar 需要获取画布容器尺寸，用于以视口中心为锚计算缩放后的 offset
  const canvasContainerRef = useRef(null)

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
      />
      <InfiniteCanvas
        scale={scale}
        offset={offset}
        onTransformChange={handleTransformChange}
        onContainerReady={(el) => { canvasContainerRef.current = el }}
      />
    </div>
  )
}

export default App
