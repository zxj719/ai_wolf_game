import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Award, Activity } from 'lucide-react';
import { getModelLeaderboard } from '../services/authService';

export function ModelLeaderboard() {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [selectedRole, setSelectedRole] = useState('all');
  const [sortBy, setSortBy] = useState('winRate');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const roles = ['all', '狼人', '村民', '预言家', '女巫', '猎人', '守卫'];

  useEffect(() => {
    loadLeaderboard();
  }, [selectedRole, sortBy]);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const options = {
        sortBy,
        limit: 50
      };

      if (selectedRole !== 'all') {
        options.role = selectedRole;
      }

      const response = await getModelLeaderboard(options);

      if (response.success) {
        setLeaderboardData(response.data || []);
      } else {
        setError(response.error || '加载失败');
      }
    } catch (err) {
      console.error('Failed to load model leaderboard:', err);
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value) => {
    return (value * 100).toFixed(1) + '%';
  };

  const getRankIcon = (index) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Award className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="text-zinc-400 text-sm">#{index + 1}</span>;
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-amber-500" />
          <h2 className="text-2xl font-bold text-zinc-100">AI 模型排行榜</h2>
        </div>
        <Activity className="w-5 h-5 text-zinc-500" />
      </div>

      {/* 筛选器 */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-zinc-400">角色筛选</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="bg-zinc-800 text-zinc-100 px-4 py-2 rounded border border-zinc-700 focus:border-amber-600 focus:outline-none"
          >
            {roles.map(role => (
              <option key={role} value={role}>
                {role === 'all' ? '全部角色' : role}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-zinc-400">排序方式</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-zinc-800 text-zinc-100 px-4 py-2 rounded border border-zinc-700 focus:border-amber-600 focus:outline-none"
          >
            <option value="winRate">胜率</option>
            <option value="totalGames">总场次</option>
            <option value="wins">胜场</option>
          </select>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent"></div>
          <p className="text-zinc-400 mt-4">加载中...</p>
        </div>
      )}

      {/* 错误状态 */}
      {error && !loading && (
        <div className="text-center py-12">
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadLeaderboard}
            className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {/* 排行榜表格 */}
      {!loading && !error && leaderboardData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">排名</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">模型</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">角色</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">胜率</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">总场次</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">胜/负</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((item, index) => (
                <tr
                  key={`${item.model_id}-${item.role}`}
                  className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {getRankIcon(index)}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <span className="text-zinc-100 font-medium">{item.model_name}</span>
                      <span className="text-xs text-zinc-500 truncate max-w-[200px]" title={item.model_id}>
                        {item.model_id}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.role === '狼人' ? 'bg-red-900/30 text-red-400' :
                      item.role === '预言家' ? 'bg-blue-900/30 text-blue-400' :
                      item.role === '女巫' ? 'bg-purple-900/30 text-purple-400' :
                      item.role === '猎人' ? 'bg-orange-900/30 text-orange-400' :
                      item.role === '守卫' ? 'bg-green-900/30 text-green-400' :
                      'bg-zinc-700 text-zinc-300'
                    }`}>
                      {item.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-bold ${
                      item.win_rate >= 0.6 ? 'text-green-400' :
                      item.win_rate >= 0.5 ? 'text-amber-400' :
                      'text-zinc-400'
                    }`}>
                      {formatPercentage(item.win_rate)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-300">
                    {item.total_games}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-green-400">{item.wins}</span>
                    <span className="text-zinc-500"> / </span>
                    <span className="text-red-400">{item.losses}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 空状态 */}
      {!loading && !error && leaderboardData.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-400">暂无数据</p>
          <p className="text-sm text-zinc-500 mt-2">完成游戏后模型数据将显示在这里</p>
        </div>
      )}

      {/* 说明文字 */}
      <div className="mt-6 pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-500">
          💡 提示：排行榜展示所有 AI 模型在不同角色下的表现。模型被等概率随机分配，确保公平竞争。
        </p>
      </div>
    </div>
  );
}
