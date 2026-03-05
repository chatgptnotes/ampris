import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Plus,
  FolderOpen,
  Users,
  FileText,
  Pencil,
  Settings,
  Trash2,
  Clock,
  Search,
  LayoutGrid,
  X,
  Upload,
  Sparkles,
  Grid3X3,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string | null };
  _count: { members: number; mimicPages: number };
  members: { role: string }[];
}

type CreationMode = 'blank' | 'template' | 'ai';

const TEMPLATES = [
  { id: '33-11kv', name: '33/11kV Distribution Substation', description: 'Standard distribution substation with incomer, transformer, and feeder bays' },
  { id: '132-33kv', name: '132/33kV Grid Substation', description: 'Grid substation with HV/LV voltage levels and bus coupler' },
  { id: 'industrial', name: 'Industrial Plant', description: 'Industrial power distribution with MCC, DG set, and capacitor bank' },
  { id: 'solar', name: 'Solar Farm', description: 'Solar farm with inverters, transformers, and grid connection' },
  { id: 'wind', name: 'Wind Farm', description: 'Wind farm with turbines, collection system, and substation' },
];

export default function ProjectHub() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creationMode, setCreationMode] = useState<CreationMode>('blank');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const fetchProjects = useCallback(async () => {
    try {
      const { data } = await api.get<Project[]>('/projects');
      setProjects(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/projects', { name: newName, description: newDesc || undefined });
      if (creationMode === 'template' && selectedTemplate) {
        const tpl = TEMPLATES.find((t) => t.id === selectedTemplate);
        await api.post(`/projects/${data.id}/pages`, { name: tpl?.name || 'Overview' });
      } else if (creationMode === 'blank') {
        await api.post(`/projects/${data.id}/pages`, { name: 'Overview' });
      } else if (creationMode === 'ai') {
        // Create default page first
        const pageRes = await api.post(`/projects/${data.id}/pages`, { name: 'AI Generated SLD' });
        const pageId = pageRes.data.id;

        // If file uploaded, send to SLD generation API
        if (aiFile) {
          try {
            setAiGenerating(true);
            setAiError(null);
            const formData = new FormData();
            formData.append('file', aiFile);
            const sldRes = await api.post('/sld/generate', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
              timeout: 90000,
            });
            const layout = sldRes.data.layout;
            if (layout && layout.elements) {
              // Save the generated layout into the page
              await api.put(`/projects/${data.id}/pages/${pageId}`, {
                name: layout.name || 'AI Generated SLD',
                elements: layout.elements.map((el: any) => ({
                  ...el,
                  elementType: el.type,
                })),
                connections: layout.connections || [],
                backgroundColor: '#FFFFFF',
              });
            }
          } catch (err: any) {
            const msg = err?.response?.data?.error || err?.message || 'AI generation failed';
            setAiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
          } finally {
            setAiGenerating(false);
          }
        }
      }
      setShowNewModal(false);
      setNewName('');
      setNewDesc('');
      setCreationMode('blank');
      setSelectedTemplate('');
      localStorage.setItem('gridvision-last-project', data.id);
      navigate(`/app/projects/${data.id}/edit`);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirm(null);
    } catch {
      // ignore
    }
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-full bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <FolderOpen className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">
            {search ? 'No projects match your search' : 'No projects yet'}
          </p>
          {!search && (
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create your first project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const userRole = project.members[0]?.role || 'VIEWER';
            const isOwner = userRole === 'OWNER';
            const canEdit = ['OWNER', 'ADMIN'].includes(userRole);
            return (
              <div
                key={project.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => { localStorage.setItem('gridvision-last-project', project.id); navigate(`/app/projects/${project.id}`); }}
              >
                {/* Thumbnail placeholder */}
                <div className="h-32 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg mb-4 flex items-center justify-center">
                  <Grid3X3 className="w-12 h-12 text-blue-300" />
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">{project.name}</h3>
                {project.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{project.description}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {project._count.members}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    {project._count.mimicPages} page{project._count.mimicPages !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
                    {userRole}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <button
                        onClick={() => navigate(`/app/projects/${project.id}/edit`)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => navigate(`/app/projects/${project.id}/members`)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Members"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                    )}
                    {isOwner && (
                      <button
                        onClick={() => setDeleteConfirm(project.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
              <button onClick={() => setShowNewModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Waluj 33/11kV Substation"
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!newName.trim() ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                  autoFocus
                />
                {!newName.trim() && <p className="text-xs text-red-500 mt-1">Project name is required to create</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Creation Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Creation Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { mode: 'blank' as CreationMode, icon: LayoutGrid, label: 'Blank' },
                    { mode: 'template' as CreationMode, icon: FileText, label: 'Template' },
                    { mode: 'ai' as CreationMode, icon: Sparkles, label: 'AI Generate' },
                  ].map(({ mode, icon: Icon, label }) => (
                    <button
                      key={mode}
                      onClick={() => setCreationMode(mode)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors ${
                        creationMode === mode
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template selection */}
              {creationMode === 'template' && (
                <div className="space-y-2">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                        selectedTemplate === tpl.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900">{tpl.name}</div>
                      <div className="text-xs text-gray-500">{tpl.description}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* AI upload zone */}
              {creationMode === 'ai' && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-600">Upload SLD Image</p>
                  <p className="text-xs text-gray-400 mt-1">AI will analyze and generate mimic pages automatically</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={(e) => { setAiFile(e.target.files?.[0] || null); setAiError(null); }}
                    className="mt-3 text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {aiFile && <p className="text-xs text-green-600 mt-2">Selected: {aiFile.name}</p>}
                  {aiGenerating && <p className="text-xs text-blue-600 mt-2 animate-pulse">Analyzing SLD with AI... this may take 30-60 seconds</p>}
                  {aiError && <p className="text-xs text-red-500 mt-2">{aiError}</p>}
                  <p className="text-xs text-gray-400 mt-2">Tip: If no file selected, an empty page will be created</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating || aiGenerating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {aiGenerating ? 'Generating SLD...' : creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Project</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will permanently delete the project and all its pages. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
