import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/services/api';
import axios from 'axios';
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
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Pre-generation conversational flow
  const [aiStep, setAiStep] = useState<'upload' | 'chat' | 'confirmed'>('upload');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiChatHistory, setAiChatHistory] = useState<Array<{role:'user'|'assistant', content:string}>>([]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiImageBase64, setAiImageBase64] = useState<string>('');
  const [aiConfirmedInstructions, setAiConfirmedInstructions] = useState<string>('');
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  // Close all modals on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewModal(false);
        setDeleteConfirm(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Safety: close modals if navigating away and coming back (state reset)
  useEffect(() => {
    setShowNewModal(false);
    setDeleteConfirm(null);
  }, [location.pathname]);

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
    setAiError(null);
    try {
      let projectData: any;
      try {
        const { data } = await api.post('/projects', { name: newName, description: newDesc || undefined });
        projectData = data;
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create project. Check server connection.';
        setAiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        setCreating(false);
        return;
      }
      const data = projectData;
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
          let sldFailed = false;
          try {
            setAiGenerating(true);
            setAiError(null);

            // Compress image client-side to JPEG (max 1600px, 85% quality)
            const compressedBase64 = await new Promise<string>((resolve, reject) => {
              const img = new Image();
              const url = URL.createObjectURL(aiFile);
              img.onload = () => {
                const MAX = 1600;
                let { width, height } = img;
                if (width > MAX || height > MAX) {
                  const scale = MAX / Math.max(width, height);
                  width = Math.round(width * scale);
                  height = Math.round(height * scale);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
                const b64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
                URL.revokeObjectURL(url);
                resolve(b64);
              };
              img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
              img.src = url;
            });

            // Queue job on backend (returns jobId instantly — no timeout)
            const queueRes = await axios.post('/api/sld-generate', {
              image: compressedBase64,
              mimeType: 'image/jpeg',
              instructions: (aiConfirmedInstructions || aiInstructions).trim() || undefined,
            }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });

            if (!queueRes.data.jobId) throw new Error(queueRes.data.error || 'Failed to queue SLD job');
            const jobId = queueRes.data.jobId;

            // Poll backend for result (up to 90 seconds)
            let layout = null;
            for (let i = 0; i < 30; i++) {
              await new Promise(r => setTimeout(r, 3000));
              const statusRes = await api.get(`/sld/status/${jobId}`);
              if (statusRes.data.status === 'done') { layout = statusRes.data.layout; break; }
              if (statusRes.data.status === 'error') throw new Error(statusRes.data.error || 'AI generation failed');
            }
            if (!layout) throw new Error('AI generation timed out after 90 seconds');

            // Support both old { elements, connections } and new { pages: [{name, elements, connections}] }
            const pages: Array<{ name: string; elements: any[]; connections: any[] }> =
              layout.pages && layout.pages.length > 0
                ? layout.pages
                : layout.elements && layout.elements.length > 0
                  ? [{ name: layout.name || 'AI Generated SLD', elements: layout.elements, connections: layout.connections || [] }]
                  : [];

            if (pages.length > 0) {
              const normalizeEl = (el: any) => ({
                ...el,
                type: el.type || el.elementType || 'Feeder',
                zIndex: el.zIndex ?? 0,
                width: el.width ?? 80,
                height: el.height ?? 80,
                properties: { tagBindings: {}, label: el.label || '', ...(el.properties || {}) },
              });

              // Save original SLD image to project (for AI chat context)
              try {
                await api.put(`/projects/${data.id}`, {
                  sldImage: compressedBase64,
                  sldImageMime: 'image/jpeg',
                });
              } catch (e) { console.warn('Could not save SLD image to project:', e); }

              // Save first page into the already-created page
              await api.put(`/projects/${data.id}/pages/${pageId}`, {
                name: pages[0].name,
                elements: pages[0].elements.map(normalizeEl),
                connections: pages[0].connections || [],
                backgroundColor: '#FFFFFF',
              });

              // Create additional pages (page 2, 3, ...)
              for (let pg = 1; pg < pages.length; pg++) {
                const newPage = await api.post(`/projects/${data.id}/pages`, { name: pages[pg].name });
                await api.put(`/projects/${data.id}/pages/${newPage.data.id}`, {
                  name: pages[pg].name,
                  elements: pages[pg].elements.map(normalizeEl),
                  connections: pages[pg].connections || [],
                  backgroundColor: '#FFFFFF',
                });
              }
            } else {
              sldFailed = true;
              setAiError('AI could not detect any SLD elements in the image. Please upload a clearer electrical diagram and try again.');
            }
          } catch (err: any) {
            sldFailed = true;
            const msg = err?.response?.data?.error || err?.message || 'AI generation failed. Server may be unavailable.';
            setAiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
          } finally {
            setAiGenerating(false);
          }
          // Don't navigate if SLD generation failed — stay on modal so user sees error
          if (sldFailed) {
            setCreating(false);
            return;
          }
        }
      }
      setShowNewModal(false);
      setNewName('');
      setNewDesc('');
      setCreationMode('blank');
      setSelectedTemplate('');
      setAiInstructions('');
      setAiStep('upload');
      setAiAnalysis('');
      setAiChatHistory([]);
      setAiChatInput('');
      setAiImageBase64('');
      setAiConfirmedInstructions('');
      localStorage.setItem('gridvision-last-project', data.id);
      navigate(`/app/projects/${data.id}/edit`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Something went wrong. Please try again.';
      setAiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
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
          onClick={() => { setShowNewModal(true); setAiError(null); setAiFile(null); setAiInstructions(''); setCreationMode('blank'); setAiStep('upload'); setAiAnalysis(''); setAiChatHistory([]); setAiImageBase64(''); setAiConfirmedInstructions(''); }}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false); }}>
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

              {/* AI upload zone + instructions */}
              {creationMode === 'ai' && (
                <div className="space-y-3">
                  {/* Upload box — always visible */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <Upload className="w-7 h-7 mx-auto text-gray-400 mb-1.5" />
                    <p className="text-sm font-medium text-gray-600">Upload SLD Image</p>
                    <p className="text-xs text-gray-400 mt-0.5">AI reads it instantly and tells you what it understood</p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0] || null;
                        setAiFile(file); setAiError(null);
                        if (!file) return;
                        // Auto-analyze immediately on file pick
                        setAiStep('upload');
                        setAiAnalysis(''); setAiChatHistory([]); setAiConfirmedInstructions('');
                        setAiAnalyzing(true);
                        try {
                          const b64 = await new Promise<string>((resolve, reject) => {
                            const url = URL.createObjectURL(file);
                            const img = new window.Image();
                            img.onload = () => {
                              const MAX = 1600;
                              let { naturalWidth: w, naturalHeight: h } = img;
                              if (w > MAX || h > MAX) { const r = MAX / Math.max(w, h); w = Math.round(w * r); h = Math.round(h * r); }
                              const c = document.createElement('canvas'); c.width = w; c.height = h;
                              c.getContext('2d')!.drawImage(img, 0, 0, w, h);
                              URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
                            };
                            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
                            img.src = url;
                          });
                          setAiImageBase64(b64);
                          const res = await axios.post('/api/sld/analyze', { image: b64, mimeType: 'image/jpeg' }, { timeout: 60000 });
                          const analysis = res.data.analysis as string;
                          setAiAnalysis(analysis);
                          setAiChatHistory([{ role: 'assistant', content: analysis }]);
                          setAiStep('chat');
                        } catch (err: any) {
                          setAiError(err?.response?.data?.error || err?.message || 'Analysis failed');
                        } finally { setAiAnalyzing(false); }
                      }}
                      className="mt-2 text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {aiFile && !aiAnalyzing && <p className="text-xs text-green-600 mt-1">Selected: {aiFile.name}</p>}
                    {aiAnalyzing && <p className="text-xs text-blue-500 mt-1 animate-pulse">Reading your diagram...</p>}
                  </div>

                  {/* Chat window — shown once analysis is ready */}
                  {(aiChatHistory.length > 0 || aiAnalyzing) && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Messages */}
                      <div className="bg-gray-50 max-h-52 overflow-y-auto p-3 space-y-2">
                        {aiChatHistory.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[95%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                              msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-700'
                            }`}>{msg.content}</div>
                          </div>
                        ))}
                        {aiChatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400 animate-pulse">AI is thinking...</div>
                          </div>
                        )}
                      </div>

                      {/* Confirmed banner */}
                      {aiStep === 'confirmed' && (
                        <div className="bg-green-50 border-t border-green-200 px-3 py-2 flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                          <p className="text-xs text-green-700 font-medium">Confirmed — ready to generate</p>
                        </div>
                      )}

                      {/* Input bar */}
                      <div className="border-t border-gray-200 flex items-center gap-2 px-3 py-2 bg-white">
                        <input
                          type="text"
                          value={aiChatInput}
                          onChange={(e) => setAiChatInput(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key !== 'Enter' || e.shiftKey || !aiChatInput.trim() || aiChatLoading) return;
                            e.preventDefault();
                            const msg = aiChatInput.trim(); setAiChatInput('');
                            const newHistory = [...aiChatHistory, { role: 'user' as const, content: msg }];
                            setAiChatHistory(newHistory); setAiChatLoading(true);
                            try {
                              const res = await axios.post('/api/sld/pre-chat', {
                                message: msg,
                                history: newHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
                                imageBase64: aiImageBase64, mimeType: 'image/jpeg',
                              }, { timeout: 30000 });
                              setAiChatHistory(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
                              if (res.data.confirmedSpec?.ready) {
                                setAiConfirmedInstructions(res.data.confirmedSpec.instructions);
                                setAiStep('confirmed');
                              }
                            } catch {
                              setAiChatHistory(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble. Please try again.' }]);
                            } finally { setAiChatLoading(false); }
                          }}
                          placeholder="Tell AI what you want — pages, feeders per page, what to skip... (Enter to send)"
                          className="flex-1 text-xs py-1.5 focus:outline-none placeholder-gray-400"
                        />
                        <span className="text-xs text-gray-300">↵</span>
                      </div>
                    </div>
                  )}

                  {aiError && <p className="text-xs text-red-500">{aiError}</p>}
                  {aiGenerating && <p className="text-xs text-blue-600 text-center animate-pulse">Generating SLD... this may take 30-90 seconds</p>}
                </div>
              )}
            </div>

            {aiError && (
              <div className="mx-5 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-medium">Error</p>
                <p className="text-xs text-red-500 mt-0.5">{aiError}</p>
              </div>
            )}
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating || aiGenerating || (creationMode === 'ai' && aiStep === 'upload' && !!aiFile)}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
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
