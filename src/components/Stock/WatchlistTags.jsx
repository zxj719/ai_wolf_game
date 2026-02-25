import { useState } from 'react';
import { Plus, X } from 'lucide-react';

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
            ? 'bg-amber-600/20 text-amber-400 border-amber-500/30'
            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
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
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${COLOR_DOT[tag.color] || 'bg-zinc-500'}`} />
            {tag.name}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(tag.id); }}
            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-zinc-700 text-zinc-400 hover:bg-red-600 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
            className="w-20 px-2 py-1 text-xs bg-zinc-800 border border-zinc-600 rounded text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-600"
            autoFocus
          />
          <div className="flex gap-0.5">
            {TAG_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-4 h-4 rounded-full ${COLOR_DOT[c]} ${newColor === c ? 'ring-2 ring-white/50' : 'opacity-50 hover:opacity-100'}`}
              />
            ))}
          </div>
          <button onClick={handleCreate} className="px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-500">
            确定
          </button>
          <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-zinc-300">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="shrink-0 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-amber-400 hover:border-amber-600 flex items-center justify-center transition-colors"
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}

export { COLOR_DOT };
