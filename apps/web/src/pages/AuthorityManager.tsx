import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { ShieldCheck, Plus, Edit, Trash2, X, User } from 'lucide-react';

interface Authority {
  id: string;
  userId: string;
  userName: string;
  level: number;
  permissions: string[];
  zones: string[];
  activeFrom?: string;
  activeTo?: string;
  isActive: boolean;
  projectId: string;
}

const LEVELS = [
  { value: 1, label: 'Operator', color: 'bg-green-600', emoji: '🟢' },
  { value: 2, label: 'Supervisor', color: 'bg-blue-600', emoji: '🔵' },
  { value: 3, label: 'Engineer', color: 'bg-orange-600', emoji: '🟠' },
  { value: 4, label: 'Admin', color: 'bg-red-600', emoji: '🔴' },
];

const PERMISSIONS = [
  { value: 'control', label: 'Control' },
  { value: 'acknowledge_alarms', label: 'Acknowledge Alarms' },
  { value: 'bypass_interlocks', label: 'Bypass Interlocks' },
  { value: 'modify_tags', label: 'Modify Tags' },
  { value: 'modify_sequences', label: 'Modify Sequences' },
  { value: 'emergency_stop', label: 'Emergency Stop' },
];

export default function AuthorityManager() {
  const { projectId } = useParams<{ projectId: string }>();
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [activeOps, setActiveOps] = useState<Authority[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Authority | null>(null);

  const [formUserId, setFormUserId] = useState('');
  const [formUserName, setFormUserName] = useState('');
  const [formLevel, setFormLevel] = useState(1);
  const [formPerms, setFormPerms] = useState<string[]>([]);
  const [formZones, setFormZones] = useState('');
  const [formActiveFrom, setFormActiveFrom] = useState('');
  const [formActiveTo, setFormActiveTo] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) return;
    const [aRes, actRes, mRes] = await Promise.all([
      api.get('/authority', { params: { projectId } }),
      api.get('/authority/active', { params: { projectId } }),
      api.get(`/projects/${projectId}/members`).catch(() => ({ data: [] })),
    ]);
    setAuthorities(aRes.data);
    setActiveOps(actRes.data);
    setMembers(mRes.data);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null); setFormUserId(''); setFormUserName(''); setFormLevel(1);
    setFormPerms([]); setFormZones(''); setFormActiveFrom(''); setFormActiveTo(''); setFormIsActive(true);
    setShowModal(true);
  };

  const openEdit = (a: Authority) => {
    setEditing(a); setFormUserId(a.userId); setFormUserName(a.userName); setFormLevel(a.level);
    setFormPerms(a.permissions || []); setFormZones((a.zones || []).join(', '));
    setFormActiveFrom(a.activeFrom ? new Date(a.activeFrom).toISOString().slice(0, 16) : '');
    setFormActiveTo(a.activeTo ? new Date(a.activeTo).toISOString().slice(0, 16) : '');
    setFormIsActive(a.isActive);
    setShowModal(true);
  };

  const save = async () => {
    const payload = {
      userId: formUserId, userName: formUserName, level: formLevel,
      permissions: formPerms, zones: formZones.split(',').map(z => z.trim()).filter(Boolean),
      activeFrom: formActiveFrom ? new Date(formActiveFrom).toISOString() : null,
      activeTo: formActiveTo ? new Date(formActiveTo).toISOString() : null,
      isActive: formIsActive, projectId,
    };
    if (editing) await api.put(`/authority/${editing.id}`, payload);
    else await api.post('/authority', payload);
    setShowModal(false); load();
  };

  const del = async (id: string) => { if (confirm('Remove authority?')) { await api.delete(`/authority/${id}`); load(); } };

  const togglePerm = (p: string) => {
    setFormPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const levelInfo = (level: number) => LEVELS.find(l => l.value === level) || LEVELS[0];

  const selectMember = (userId: string) => {
    setFormUserId(userId);
    const m = members.find((m: any) => (m.user?.id || m.userId) === userId);
    if (m) setFormUserName(m.user?.name || m.userName || '');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-green-400" />
          <h1 className="text-2xl font-bold text-white">Authority Manager</h1>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Operator
        </button>
      </div>

      {/* Active Operators */}
      {activeOps.length > 0 && (
        <div className="bg-gray-800 border border-green-500/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-green-400 mb-3">Currently Active Operators</h3>
          <div className="flex flex-wrap gap-3">
            {activeOps.map(a => {
              const li = levelInfo(a.level);
              return (
                <div key={a.id} className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
                  <span>{li.emoji}</span>
                  <span className="text-white text-sm font-medium">{a.userName}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs text-white ${li.color}`}>{li.label}</span>
                  <span className="text-gray-400 text-xs">{(a.permissions as string[]).length} perms</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Authority List */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700"><tr>
            <th className="px-4 py-2 text-left text-gray-300">Operator</th>
            <th className="px-4 py-2 text-left text-gray-300">Level</th>
            <th className="px-4 py-2 text-left text-gray-300">Permissions</th>
            <th className="px-4 py-2 text-left text-gray-300">Zones</th>
            <th className="px-4 py-2 text-left text-gray-300">Shift</th>
            <th className="px-4 py-2 text-left text-gray-300">Status</th>
            <th className="px-4 py-2 text-left text-gray-300">Actions</th>
          </tr></thead>
          <tbody>
            {authorities.map(a => {
              const li = levelInfo(a.level);
              return (
                <tr key={a.id} className="border-t border-gray-700">
                  <td className="px-4 py-2 text-white font-medium">{a.userName}</td>
                  <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs text-white ${li.color}`}>{li.emoji} {li.label}</span></td>
                  <td className="px-4 py-2"><div className="flex flex-wrap gap-1">{(a.permissions as string[]).map(p => <span key={p} className="px-1.5 py-0.5 rounded text-xs bg-gray-600 text-gray-300">{p}</span>)}</div></td>
                  <td className="px-4 py-2 text-gray-300">{(a.zones as string[]).join(', ') || '—'}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{a.activeFrom ? `${new Date(a.activeFrom).toLocaleString()} - ${a.activeTo ? new Date(a.activeTo).toLocaleString() : '∞'}` : 'Always'}</td>
                  <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs ${a.isActive ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>{a.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-2 flex gap-1">
                    <button onClick={() => openEdit(a)} className="p-1 text-gray-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => del(a.id)} className="p-1 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {authorities.length === 0 && <div className="text-center text-gray-500 py-8">No operator authorities configured.</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit' : 'Add'} Operator Authority</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400">User</label>
                {members.length > 0 ? (
                  <select value={formUserId} onChange={e => selectMember(e.target.value)} className="w-full mt-1 px-3 py-2 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                    <option value="">Select user...</option>
                    {members.map((m: any) => <option key={m.user?.id || m.userId} value={m.user?.id || m.userId}>{m.user?.name || m.userName || m.user?.username}</option>)}
                  </select>
                ) : (
                  <div>
                    <input value={formUserId} onChange={e => setFormUserId(e.target.value)} placeholder="User ID" className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                    <input value={formUserName} onChange={e => setFormUserName(e.target.value)} placeholder="Name" className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-400">Authority Level</label>
                <select value={formLevel} onChange={e => setFormLevel(Number(e.target.value))} className="w-full mt-1 px-3 py-2 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.emoji} {l.label} ({l.value})</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">Permissions</label>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSIONS.map(p => (
                  <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formPerms.includes(p.value)} onChange={() => togglePerm(p.value)} className="rounded" />
                    <span className="text-sm text-gray-300">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div><label className="text-sm text-gray-400">Zones (comma-separated)</label><input value={formZones} onChange={e => setFormZones(e.target.value)} placeholder="Zone1, Zone2..." className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm text-gray-400">Shift Start</label><input type="datetime-local" value={formActiveFrom} onChange={e => setFormActiveFrom(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" /></div>
              <div><label className="text-sm text-gray-400">Shift End</label><input type="datetime-local" value={formActiveTo} onChange={e => setFormActiveTo(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" /></div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formIsActive} onChange={e => setFormIsActive(e.target.checked)} className="rounded" /><span className="text-sm text-gray-300">Active</span></label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-600 text-white rounded text-sm">Cancel</button>
              <button onClick={save} disabled={!formUserId || !formUserName} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
