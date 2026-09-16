import React, { useEffect, useState } from 'react';
import { Search, Plus, Minus, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../../context/AppContext';
import { getAdminUserFinanceProfile } from '../../lib/api';

export default function AdminUsersTab() {
  const { allUsers, fetchAllUsers, adjustUserPoints, config } = useAppContext();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [financeProfile, setFinanceProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const brand = config?.brand_color || '#f8812d';

  useEffect(() => {
    fetchAllUsers().finally(() => setLoading(false));
  }, []);

  const filtered = allUsers.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const openUser = async (user) => {
    setSelectedUser(user);
    setFinanceProfile(null);
    setProfileLoading(true);
    try {
      const payload = await getAdminUserFinanceProfile(user.id);
      setFinanceProfile(payload.finance_profile || null);
    } catch (error) {
      toast.error(error.message || 'User finance profile could not be loaded');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAdjust = async (userId, delta) => {
    const reason = window.prompt(`Reason for ${delta > 0 ? 'crediting' : 'debiting'} ${Math.abs(delta)} points?`, delta > 0 ? 'Admin-approved points credit' : 'Admin-approved points correction');
    if (!reason?.trim()) return;
    if (!window.confirm(`Confirm ${delta > 0 ? 'credit' : 'debit'} of ${Math.abs(delta)} points?`)) return;
    setAdjusting(userId + delta);
    const result = await adjustUserPoints(userId, delta, reason.trim());
    if (result.success) {
      await fetchAllUsers();
      toast.success(`${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} points`);
    } else {
      toast.error(result.message || 'Failed to adjust points');
    }
    setAdjusting(null);
  };

  const refresh = async () => {
    setLoading(true);
    await fetchAllUsers();
    setLoading(false);
    toast.success('Users refreshed');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
          />
        </div>
        {selectedUser ? (
          <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="User operations">
            <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:mx-auto sm:max-w-2xl sm:rounded-3xl">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">User operations</p><h3 className="mt-1 text-2xl font-black text-gray-950">{selectedUser.name}</h3><p className="text-sm font-semibold text-gray-500">{selectedUser.email}</p></div>
                <button type="button" onClick={() => setSelectedUser(null)} className="rounded-lg border p-2 text-gray-600" aria-label="Close user operations"><X size={18} /></button>
              </div>
              {profileLoading ? <div className="py-12 text-center text-sm font-bold text-gray-500">Loading authoritative finance profile…</div> : financeProfile ? (
                <div className="mt-5 space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ['Available points', financeProfile.available_points],
                      ['Reserved points', financeProfile.reserved_points],
                      ['Risk flags', financeProfile.risk_flags]
                    ].map(([name, value]) => <div key={name} className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-gray-400">{name}</p><p className="mt-2 text-2xl font-black text-gray-950">{Number(value || 0).toLocaleString()}</p></div>)}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 p-4"><p className="text-xs font-black uppercase tracking-wide text-gray-400">Funding</p><p className="mt-2 text-sm font-black text-gray-900">{financeProfile.pending_funding || 0} pending · {financeProfile.rejected_funding || 0} rejected</p></div>
                    <div className="rounded-2xl border border-gray-200 p-4"><p className="text-xs font-black uppercase tracking-wide text-gray-400">Ledger totals</p><p className="mt-2 text-sm font-black text-gray-900">{Number(financeProfile.purchased_points || 0).toLocaleString()} purchased · {Number(financeProfile.consumed_points || 0).toLocaleString()} consumed</p></div>
                  </div>
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Sensitive actions require server-side authorization, a reason, confirmation, and an audit record. This surface only exposes the existing points adjustment contract.</p>
                </div>
              ) : <div className="py-12 text-center text-sm font-bold text-gray-500">Finance profile unavailable.</div>}
            </div>
          </div>
        ) : null}
        <button onClick={refresh} className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Users ({filtered.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Email', 'Points', 'Referrals', 'Admin', 'Joined', 'Adjust Points'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900"><button type="button" onClick={() => openUser(u)} className="text-left font-bold hover:text-blue-600">{u.name}</button></td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                  <td className="px-6 py-4 text-sm font-bold" style={{ color: brand }}>{u.points}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.referral_count}</td>
                  <td className="px-6 py-4 text-sm">
                    {u.is_admin ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">Admin</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">User</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-1">
                      {[+10, +50, +100].map(delta => (
                        <button
                          key={delta}
                          onClick={() => handleAdjust(u.id, delta)}
                          disabled={adjusting === u.id + delta}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                        >
                          <Plus size={10} />{delta}
                        </button>
                      ))}
                      {[-10, -50].map(delta => (
                        <button
                          key={delta}
                          onClick={() => handleAdjust(u.id, delta)}
                          disabled={adjusting === u.id + delta}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                          <Minus size={10} />{Math.abs(delta)}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-6 py-10 text-center text-gray-500">No users found.</div>
        )}
      </div>
    </div>
  );
}
