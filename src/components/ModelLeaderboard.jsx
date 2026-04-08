import React, { useEffect, useState } from 'react';
import { Trophy, TrendingUp, Award, Activity } from 'lucide-react';
import { authService } from '../services/authService';
import { getRoleLabel, getUiCopy } from '../i18n/locale.js';

const ROLE_KEYS = ['WEREWOLF', 'VILLAGER', 'SEER', 'WITCH', 'HUNTER', 'GUARD'];

export function ModelLeaderboard({ locale = 'zh' }) {
  const copy = getUiCopy(locale).modelLeaderboard;

  const [leaderboardData, setLeaderboardData] = useState([]);
  const [selectedRole, setSelectedRole] = useState('WEREWOLF');
  const [sortBy, setSortBy] = useState('winRate');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await authService.getModelLeaderboard({
          sortBy,
          limit: 50,
          role: getRoleLabel(selectedRole, 'zh'),
        });

        if (response.success) {
          setLeaderboardData(response.data || []);
        } else {
          setError(response.error || copy.loading);
        }
      } catch (err) {
        setError(err.message || copy.loading);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [copy.loading, selectedRole, sortBy]);

  const getRankIcon = (index) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (index === 1) return <Award className="h-5 w-5 text-slate-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-orange-400" />;
    return <span className="text-sm text-slate-400">#{index + 1}</span>;
  };

  return (
    <div className="rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-[0_12px_32px_rgba(68,85,119,0.08)]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/20">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="mac-eyebrow">AI</div>
            <h2 className="text-xl font-semibold text-slate-900">{copy.title}</h2>
          </div>
        </div>
        <Activity className="h-5 w-5 text-slate-400" />
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{copy.roleFilter}</span>
          <select
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value)}
            className="mac-select"
          >
            {ROLE_KEYS.map((roleKey) => (
              <option key={roleKey} value={roleKey}>
                {getRoleLabel(roleKey, locale)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{copy.sortBy}</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="mac-select"
          >
            <option value="winRate">{copy.sortWinRate}</option>
            <option value="totalGames">{copy.sortGames}</option>
            <option value="wins">{copy.sortWins}</option>
          </select>
        </label>
      </div>

      {loading && (
        <div className="py-10 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          <p className="mt-4 text-sm text-slate-500">{copy.loading}</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-600">
          {error}
        </div>
      )}

      {!loading && !error && leaderboardData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-slate-200/80 text-sm text-slate-500">
                <th className="px-4 py-3 text-left font-medium">{copy.rank}</th>
                <th className="px-4 py-3 text-left font-medium">{copy.model}</th>
                <th className="px-4 py-3 text-left font-medium">{copy.role}</th>
                <th className="px-4 py-3 text-right font-medium">{copy.winRate}</th>
                <th className="px-4 py-3 text-right font-medium">{copy.totalGames}</th>
                <th className="px-4 py-3 text-right font-medium">{copy.winLoss}</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((item, index) => (
                <tr key={`${item.model_id}-${item.role}-${index}`} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-4">{getRankIcon(index)}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-900">{item.model_name}</div>
                    <div className="mt-1 max-w-[280px] truncate text-xs text-slate-400" title={item.model_id}>
                      {item.model_id}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="mac-badge">{getRoleLabel(item.role, locale)}</span>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-slate-900">
                    {(item.win_rate * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-4 text-right text-slate-600">{item.total_games}</td>
                  <td className="px-4 py-4 text-right">
                    <span className="font-medium text-emerald-600">{item.wins}</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="font-medium text-rose-500">{item.losses}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && leaderboardData.length === 0 && (
        <div className="py-10 text-center">
          <Trophy className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-base font-medium text-slate-700">{copy.empty}</p>
          <p className="mt-2 text-sm text-slate-500">{copy.emptyDescription}</p>
        </div>
      )}

      <p className="mt-5 border-t border-slate-200/70 pt-4 text-xs leading-6 text-slate-400">{copy.note}</p>
    </div>
  );
}
