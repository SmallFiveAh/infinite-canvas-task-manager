import { useState } from 'react'
import './index.css'

/**
 * 左侧工具栏组件 - 无限画布任务管理器
 * 仿 Figma / Excalidraw 风格的垂直工具栏
 */
function LeftSidebar() {
  const [activeTool, setActiveTool] = useState('select')

  const tools = [
    { id: 'palette', icon: 'bi-palette-fill', label: '调色板', topGradient: true },
    { id: 'select', icon: 'bi-pointer', label: '选择' },
    { id: 'zoom', icon: 'bi-search', label: '缩放' },
    { id: 'pencil', icon: 'bi-pencil', label: '铅笔', custom: 'pencil-curved' },
    { id: 'text', icon: 'bi-type', label: '文字', framed: true },
    { id: 'eraser', icon: 'bi-eraser-fill', label: '橡皮擦' },
    { id: 'sticky', icon: 'bi-sticky-fill', label: '便利贴', stickyNote: true },
    { id: 'freedraw', icon: 'bi-suit-club-fill', label: '手绘', custom: 'freedraw-curve' },
    { id: 'table', icon: 'bi-grid-3x3-gap-fill', label: '表格', custom: 'table-icon' },
    { id: 'document', icon: 'bi-file-text', label: '文档', custom: 'doc-icon' },
    { id: 'list', icon: 'bi-list-check', label: '列表', custom: 'list-icon' },
    { id: 'card', icon: 'bi-card-text', label: '卡片', custom: 'card-icon' },
  ]

  const handleToolClick = (toolId) => {
    setActiveTool(toolId)
  }

  return (
    <aside className="left-sidebar" aria-label="左侧工具栏">
      <div className="left-sidebar-inner">
        <div className="sidebar-tools-top">
          {tools.map((tool, index) => (
            <button
              key={tool.id}
              className={`sidebar-tool-btn ${activeTool === tool.id ? 'active' : ''} ${tool.topGradient ? 'has-top-gradient' : ''} ${tool.stickyNote ? 'is-sticky' : ''} ${tool.custom || ''}`}
              onClick={() => handleToolClick(tool.id)}
              title={tool.label}
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
            </button>
          ))}
        </div>
        <div className="sidebar-tools-bottom">
          <button
            className="sidebar-tool-btn more-btn"
            title="更多"
            aria-label="更多选项"
          >
            <span className="more-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>
    </aside>
  )
}

export default LeftSidebar
