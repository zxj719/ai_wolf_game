import React, { useState, useEffect } from 'react';
import { getUserStats, getGameHistory } from '../services/gameService';
import { useAuth } from '../contexts/AuthContext';

export function UserStats({ onClose }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' | 'history'
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, historyRes] = await Promise.all([
        getUserStats(),
        getGameHistory(10, 0)
      ]);

      if (statsRes.success) {
        setStats(statsRes.stats);
      }
      if (historyRes.success) {
        setHistory(historyRes.history);
        setHasMore(historyRes.pagination.hasMore);
      }
    } catch (error) {
      console.error('Load data error:', error);
    }
    setLoading(false);
  };

  const loadMoreHistory = async () => {
    const nextPage = page + 1;
    const res = await getGameHistory(10, nextPage * 10);
    if (res.success) {
      setHistory([...history, ...res.history]);
      setHasMore(res.pagination.hasMore);
      setPage(nextPage);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-bg-raised rounded-xl p-8">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto" />
          <p className="text-ink-muted mt-4">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-raised rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h2 className="text-xl font-bold text-accent">
            {user?.username} 的战绩
          </h2>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink text-2xl"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-line">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-3 text-center transition-colors ${
              activeTab === 'stats'
                ? 'text-accent border-b-2 border-accent'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            统计数据
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-center transition-colors ${
              activeTab === 'history'
                ? 'text-accent border-b-2 border-accent'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            对局记录
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'stats' && stats && (
            <div className="space-y-6">
              {/* Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg-sunken rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-ink">{stats.totalGames}</div>
                  <div className="text-ink-muted text-sm">总场次</div>
                </div>
                <div className="bg-bg-sunken rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-accent">{stats.winRate}%</div>
                  <div className="text-ink-muted text-sm">胜率</div>
                </div>
                <div className="bg-bg-sunken rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-state-win-good">{stats.wins}</div>
                  <div className="text-ink-muted text-sm">胜利</div>
                </div>
                <div className="bg-bg-sunken rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-state-win-evil">{stats.losses}</div>
                  <div className="text-ink-muted text-sm">失败</div>
                </div>
              </div>

              {/* Recent Results */}
              {stats.recentResults && stats.recentResults.length > 0 && (
                <div>
                  <h3 className="text-ink mb-2">最近10场</h3>
                  <div className="flex gap-1">
                    {stats.recentResults.map((result, i) => (
                      <div
                        key={i}
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                          result === 'win'
                            ? 'bg-success-soft text-success'
                            : 'bg-danger-soft text-danger'
                        }`}
                      >
                        {result === 'win' ? 'W' : 'L'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Role Stats */}
              {stats.roleStats && stats.roleStats.length > 0 && (
                <div>
                  <h3 className="text-ink mb-2">角色统计</h3>
                  <div className="space-y-2">
                    {stats.roleStats.map((role, i) => (
                      <div key={i} className="flex items-center justify-between bg-bg-sunken rounded p-2">
                        <span className="text-ink">{role.role}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-ink-muted text-sm">{role.games} 场</span>
                          <span className="text-success text-sm">{role.wins} 胜</span>
                          <span className="text-accent text-sm">
                            {role.games > 0 ? Math.round((role.wins / role.games) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="text-center text-ink-muted py-8">
                  暂无对局记录
                </div>
              ) : (
                <>
                  {history.map((game, i) => (
                    <div
                      key={game.id || i}
                      className={`flex items-center justify-between p-3 rounded-lg border border-line ${
                        game.result === 'win'
                          ? 'bg-success-soft'
                          : 'bg-danger-soft'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            game.result === 'win'
                              ? 'bg-success-soft text-success'
                              : 'bg-danger-soft text-danger'
                          }`}
                        >
                          {game.result === 'win' ? '胜利' : '失败'}
                        </span>
                        <div>
                          <div className="text-ink">{game.role}</div>
                          <div className="text-ink-muted text-xs">{game.game_mode}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-ink-muted text-sm">
                          {formatDuration(game.duration_seconds)}
                        </div>
                        <div className="text-ink-faint text-xs">
                          {formatDate(game.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {hasMore && (
                    <button
                      onClick={loadMoreHistory}
                      className="w-full py-2 text-accent hover:text-accent-hover text-sm"
                    >
                      加载更多
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
