import './index.css'

/**
 * 左侧工具栏组件 - 无限画布任务管理器
 * 仿 Figma / Excalidraw 风格的垂直工具栏
 */
function LeftSidebar({ activeTool, onToolChange, isToolLocked }) {
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

  const handleToolClick = (toolId) => {
    onToolChange?.(toolId)
  }

  return (
    <aside className="left-sidebar" aria-label="左侧工具栏">
      <div className="left-sidebar-inner">
        <div className="sidebar-tools-top">
          {tools.map((tool, index) => {
            const isActive = activeTool === tool.id
            const showLock = isToolLocked && isActive
            return (
              <button
                key={tool.id}
                className={`sidebar-tool-btn ${isActive ? 'active' : ''} ${tool.topGradient ? 'has-top-gradient' : ''} ${tool.stickyNote ? 'is-sticky' : ''} ${tool.custom || ''} ${showLock ? 'is-locked' : ''}`}
                onClick={() => handleToolClick(tool.id)}
                title={`${tool.label}${showLock ? '（已锁定）' : ''}`}
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
    </aside>
  )
}

export default LeftSidebar
