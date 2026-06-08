import { useState } from 'react';
import { Plus, X } from 'lucide-react';

// 用户自定义标签的「身份配色」调色板：每个键是用户可选的标签色标识（数据驱动，
// 由 tag.color 决定），必须保持 8 种互相可区分的色相。设计令牌只有 2 个市场色 +
// 少量语义色，没有 8 色调色板可映射，故此处刻意保留原始 Tailwind 调色板（非中性/
// 非涨跌语义，属于装饰性身份色）。结构/中性 class 仍走 token。
const COLOR_MAP = {
  red:    'bg-red-500/20 text-red-400 border-red-500/30',
  blue:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  green:  'bg-green-500/20 text-green-400 border-green-500/30',
  amber:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  pink:   'bg-pink-500/20 text-pink-400 border-pink-500/30',
  cyan:   'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const COLOR_DOT = {
  red: 'bg-red-500', blue: 'bg-blue-500', green: 'bg-green-500', amber: 'bg-amber-500',
  purple: 'bg-purple-500', pink: 'bg-pink-500', cyan: 'bg-cyan-500', orange: 'bg-orange-500',
};

/**
 * WatchlistTags - 水平标签筛选栏
 */
export function WatchlistTags({ tags, activeTag, onSelect, onCreate, onDelete, TAG_COLORS }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim(), newColor);
    setNewName('');
    setShowCreate(false);
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
      {/* 全部 */}
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 px-3 py-1 text-xs rounded-full border transition-colors ${
          activeTag === null
            ? 'bg-accent-soft text-accent border-accent'
            : 'bg-bg-sunken text-ink-muted border-line hover:border-line-strong'
        }`}
      >
        全部
      </button>

      {/* 用户标签 */}
      {tags.map(tag => (
        <div key={tag.id} className="group relative shrink-0">
          <button
            onClick={() => onSelect(activeTag === tag.id ? null : tag.id)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              activeTag === tag.id
                ? COLOR_MAP[tag.color] || COLOR_MAP.blue
                : 'bg-bg-sunken text-ink-muted border-line hover:border-line-strong'
            }`}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${COLOR_DOT[tag.color] || 'bg-ink-faint'}`} />
            {tag.name}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(tag.id); }}
            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-bg-sunken text-ink-muted hover:bg-danger hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={8} />
          </button>
        </div>
      ))}

      {/* 创建标签 */}
      {showCreate ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="标签名"
            className="w-20 px-2 py-1 text-xs bg-bg-sunken border border-line rounded text-ink placeholder-ink-faint focus:outline-none focus:border-accent"
            autoFocus
          />
          <div className="flex gap-0.5">
            {TAG_COLORS.map(c => (
              // 色块取自标签身份调色板 COLOR_DOT（数据驱动，保留原色）；选中态用中性描边
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-4 h-4 rounded-full ${COLOR_DOT[c]} ${newColor === c ? 'ring-2 ring-accent' : 'opacity-50 hover:opacity-100'}`}
              />
            ))}
          </div>
          <button onClick={handleCreate} className="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent-hover">
            确定
          </button>
          <button onClick={() => setShowCreate(false)} className="text-ink-muted hover:text-ink">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="shrink-0 w-6 h-6 rounded-full bg-bg-sunken border border-line text-ink-muted hover:text-accent hover:border-accent flex items-center justify-center transition-colors"
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}

export { COLOR_DOT };
