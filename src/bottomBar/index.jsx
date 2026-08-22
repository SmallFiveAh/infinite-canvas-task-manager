import './index.css'

/* ===== 图标：线性 SVG，与顶部工具栏风格一致 ===== */
const SvgIcon = ({ children, size = 17 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

// 水平对齐
const AlignLeftIcon = () => (
  <SvgIcon>
    <line x1="4" y1="3" x2="4" y2="21" />
    <rect x="7" y="5" width="13" height="5" rx="1" />
    <rect x="7" y="14" width="9" height="5" rx="1" />
  </SvgIcon>
)
const AlignCenterHIcon = () => (
  <SvgIcon>
    <line x1="12" y1="3" x2="12" y2="21" />
    <rect x="5" y="5" width="14" height="5" rx="1" />
    <rect x="7" y="14" width="10" height="5" rx="1" />
  </SvgIcon>
)
const AlignRightIcon = () => (
  <SvgIcon>
    <line x1="20" y1="3" x2="20" y2="21" />
    <rect x="4" y="5" width="13" height="5" rx="1" />
    <rect x="7" y="14" width="10" height="5" rx="1" />
  </SvgIcon>
)

// 垂直对齐
const AlignTopIcon = () => (
  <SvgIcon>
    <line x1="3" y1="4" x2="21" y2="4" />
    <rect x="5" y="6" width="5" height="13" rx="1" />
    <rect x="14" y="6" width="5" height="9" rx="1" />
  </SvgIcon>
)
const AlignCenterVIcon = () => (
  <SvgIcon>
    <line x1="3" y1="12" x2="21" y2="12" />
    <rect x="5" y="5" width="5" height="14" rx="1" />
    <rect x="14" y="7" width="5" height="10" rx="1" />
  </SvgIcon>
)
const AlignBottomIcon = () => (
  <SvgIcon>
    <line x1="3" y1="20" x2="21" y2="20" />
    <rect x="5" y="4" width="5" height="13" rx="1" />
    <rect x="14" y="8" width="5" height="9" rx="1" />
  </SvgIcon>
)

// 分布
const DistributeHIcon = () => (
  <SvgIcon>
    <rect x="3" y="6" width="4" height="12" rx="1" />
    <rect x="17" y="6" width="4" height="12" rx="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <polyline points="13,9 16,12 13,15" />
  </SvgIcon>
)
const DistributeVIcon = () => (
  <SvgIcon>
    <rect x="6" y="3" width="12" height="4" rx="1" />
    <rect x="6" y="17" width="12" height="4" rx="1" />
    <line x1="12" y1="9" x2="12" y2="15" />
    <polyline points="9,13 12,16 15,13" />
  </SvgIcon>
)

// 组合 / 取消组合
const GroupIcon = () => (
  <SvgIcon size={15}>
    <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 2.5" />
    <rect x="7" y="7" width="7" height="7" rx="1" />
    <rect x="11" y="11" width="7" height="7" rx="1" />
  </SvgIcon>
)
const UngroupIcon = () => (
  <SvgIcon size={15}>
    <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 2.5" />
    <rect x="6" y="6" width="5" height="5" rx="1" />
    <rect x="13" y="13" width="5" height="5" rx="1" />
  </SvgIcon>
)

const H_ALIGN = [
  { type: 'left', label: '左对齐', Icon: AlignLeftIcon },
  { type: 'center-h', label: '水平居中', Icon: AlignCenterHIcon },
  { type: 'right', label: '右对齐', Icon: AlignRightIcon },
  { type: 'distribute-h', label: '水平分布', Icon: DistributeHIcon },
]

const V_ALIGN = [
  { type: 'top', label: '顶对齐', Icon: AlignTopIcon },
  { type: 'center-v', label: '垂直居中', Icon: AlignCenterVIcon },
  { type: 'bottom', label: '底对齐', Icon: AlignBottomIcon },
  { type: 'distribute-v', label: '垂直分布', Icon: DistributeVIcon },
]

/**
 * 下方工具栏 - 居中对齐 + 分布 + 组合/取消组合
 * 样式与 src/toolBar 保持一致：吸底悬浮卡片，复用 .toolbar-btn / .toolbar-divider
 *
 * @param {number} selectedCount - 当前选中元素数量
 * @param {boolean} canGroup - 是否可组合（≥2 个选中）
 * @param {boolean} canUngroup - 是否可取消组合（选中元素中存在组合）
 * @param {(type:string)=>void} onAlign - 对齐/分布回调
 * @param {()=>void} onGroup - 组合回调
 * @param {()=>void} onUngroup - 取消组合回调
 */
function BottomBar({ selectedCount = 0, canGroup = false, canUngroup = false, onAlign, onGroup, onUngroup }) {
  // 对齐操作至少需要 2 个选中元素；分布至少需要 3 个
  const alignDisabled = selectedCount < 2
  const distributeDisabled = selectedCount < 3

  const isOpDisabled = (type) =>
    type.startsWith('distribute') ? distributeDisabled : alignDisabled

  return (
    <footer className="bottombar" role="toolbar" aria-label="下方工具栏">
      <div className="bottombar-inner">
        {/* 水平对齐组 */}
        <div className="bottombar-group">
          {H_ALIGN.map((op) => (
            <button
              key={op.type}
              className="toolbar-btn"
              onClick={() => onAlign?.(op.type)}
              disabled={isOpDisabled(op.type)}
              title={op.label}
              aria-label={op.label}
            >
              <op.Icon />
            </button>
          ))}
        </div>

        <div className="toolbar-divider" aria-hidden="true" />

        {/* 垂直对齐组 */}
        <div className="bottombar-group">
          {V_ALIGN.map((op) => (
            <button
              key={op.type}
              className="toolbar-btn"
              onClick={() => onAlign?.(op.type)}
              disabled={isOpDisabled(op.type)}
              title={op.label}
              aria-label={op.label}
            >
              <op.Icon />
            </button>
          ))}
        </div>

        <div className="toolbar-divider" aria-hidden="true" />

        {/* 组合 / 取消组合 */}
        <div className="bottombar-group">
          <button
            className="toolbar-btn"
            onClick={onGroup}
            disabled={!canGroup}
            title="组合 (Ctrl+G)"
            aria-label="组合"
          >
            <GroupIcon />
          </button>
          <button
            className="toolbar-btn"
            onClick={onUngroup}
            disabled={!canUngroup}
            title="取消组合 (Ctrl+Shift+G)"
            aria-label="取消组合"
          >
            <UngroupIcon />
          </button>
        </div>
      </div>
    </footer>
  )
}

export default BottomBar
