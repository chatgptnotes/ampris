import { useRef, useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AnimatedBackground from '@/components/sld-generator/AnimatedBackground';
import SLDPreview from '@/components/sld-generator/SLDPreview';
import {
  Zap, Upload, Send, Bot, User, ImageIcon,
  Sparkles, X, RefreshCw, CheckCircle2, ChevronRight, Paperclip,
} from 'lucide-react';
import { generateSLD, type ChatMessage } from '@/services/sld-generation';
import type { SLDLayout } from '@gridvision/shared';

/* ─── tiny utils ─────────────────────────────────────────────────────────── */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function SLDGenerator() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hi! Upload your SLD drawing above, then describe exactly what you need — voltage levels, feeder names, special components, layout preferences. I'll generate the diagram following your instructions.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLayout, setGeneratedLayout] = useState<SLDLayout | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* scroll chat to bottom */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* handle file drop / select */
  const handleFile = useCallback(async (file: File) => {
    setUploadedFile(file);
    setGeneratedLayout(null);
    setError(null);
    const url = await fileToDataURL(file);
    setPreviewUrl(url);
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: `Drawing uploaded: **${file.name}** (${(file.size / 1024).toFixed(0)} KB). Now describe any specific requirements — feeder names, voltage levels, components to include/exclude — or just click **Generate SLD** to proceed with auto-detection.` },
    ]);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  /* build instructions string from chat history */
  const buildInstructions = () =>
    messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n');

  /* send a chat message */
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');

    // If no file yet, just acknowledge
    if (!uploadedFile) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: "Got it — I'll remember that when you upload your drawing. Please upload the SLD image above." },
      ]);
      return;
    }

    // Acknowledge the instruction
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: `Noted: "${text}". This will be applied when generating. Add more instructions or click **Generate SLD**.` },
    ]);
  }, [input, uploadedFile]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* GENERATE */
  const handleGenerate = useCallback(async () => {
    if (!uploadedFile) return;
    setIsGenerating(true);
    setError(null);
    setGeneratedLayout(null);

    const instructions = buildInstructions();
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: '🔄 Analyzing drawing and applying your instructions...' },
    ]);

    try {
      const layout = await generateSLD(uploadedFile, instructions);
      setGeneratedLayout(layout);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `✅ SLD generated successfully — **${layout.elements?.length ?? 0} elements** detected. Scroll down to preview. You can now open it in the Mimic Editor to refine further.`,
        },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Generation failed';
      setError(msg);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `❌ Error: ${msg}. Please check the drawing and try again.` },
      ]);
    } finally {
      setIsGenerating(false);
    }
  }, [uploadedFile, messages]);

  const handleRegenerate = () => {
    if (uploadedFile) handleGenerate();
  };

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen bg-[#0B1120] text-white overflow-x-hidden">
      <AnimatedBackground />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AI SLD Generator</h1>
              <p className="text-xs text-gray-400">Upload drawing · Chat instructions · Generate</p>
            </div>
          </div>
          <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1">
            Dashboard <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* ── Main grid: Upload+Chat (left) | Preview (right) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-4">

            {/* Upload zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !uploadedFile && fileInputRef.current?.click()}
              className={`relative rounded-2xl border-2 transition-all duration-200 cursor-pointer overflow-hidden
                ${uploadedFile
                  ? 'border-emerald-500/50 bg-emerald-500/5 cursor-default'
                  : dragging
                    ? 'border-cyan-400 bg-cyan-400/10 scale-[1.01]'
                    : 'border-gray-700 hover:border-blue-500/50 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              style={{ minHeight: '180px' }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {uploadedFile && previewUrl ? (
                <div className="flex items-center gap-4 p-4">
                  {previewUrl.startsWith('data:image') ? (
                    <img src={previewUrl} alt="uploaded" className="w-24 h-24 object-contain rounded-lg border border-gray-700 bg-black/20" />
                  ) : (
                    <div className="w-24 h-24 rounded-lg border border-gray-700 bg-black/20 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-sm font-medium text-emerald-400">Drawing uploaded</span>
                    </div>
                    <p className="text-white text-sm font-medium truncate">{uploadedFile.name}</p>
                    <p className="text-gray-400 text-xs">{(uploadedFile.size / 1024).toFixed(0)} KB</p>
                    <button
                      onClick={e => { e.stopPropagation(); setUploadedFile(null); setPreviewUrl(null); setGeneratedLayout(null); }}
                      className="mt-2 text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="shrink-0 p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-blue-500 transition-all"
                    title="Replace drawing"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-10 gap-3 text-center">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all
                    ${dragging ? 'bg-cyan-500/20 scale-110' : 'bg-blue-500/10'}`}>
                    <Upload className={`w-6 h-6 ${dragging ? 'text-cyan-400' : 'text-blue-400'}`} />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Drop your SLD drawing here</p>
                    <p className="text-gray-400 text-sm mt-1">or click to browse · Images, PDFs supported</p>
                  </div>
                  <div className="flex gap-2 text-xs text-gray-600">
                    {['JPG', 'PNG', 'PDF', 'WEBP'].map(f => (
                      <span key={f} className="px-2 py-0.5 rounded bg-white/5 border border-gray-800">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* AI Chat panel */}
            <div className="flex flex-col rounded-2xl border border-gray-800 bg-white/[0.02] overflow-hidden" style={{ height: '420px' }}>

              {/* Chat header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-white/[0.02] shrink-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">AI Instructions</p>
                  <p className="text-xs text-gray-500">Describe your requirements — the AI will follow them during generation</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center
                      ${msg.role === 'assistant' ? 'bg-gradient-to-br from-violet-500 to-blue-500' : 'bg-gradient-to-br from-blue-600 to-cyan-600'}`}>
                      {msg.role === 'assistant'
                        ? <Bot className="w-3.5 h-3.5 text-white" />
                        : <User className="w-3.5 h-3.5 text-white" />
                      }
                    </div>
                    <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed
                      ${msg.role === 'assistant'
                        ? 'bg-white/[0.05] text-gray-200 border border-gray-800'
                        : 'bg-blue-600/30 text-white border border-blue-500/30'
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: msg.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br/>')
                      }}
                    />
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input row */}
              <div className="shrink-0 border-t border-gray-800 p-3 flex gap-2 items-end bg-white/[0.01]">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={uploadedFile
                    ? 'e.g. "Use VCB for all feeders, label transformers as TR-1 and TR-2, add CT and PT on HV side..."'
                    : 'Upload a drawing first, then add your instructions here...'}
                  rows={2}
                  className="flex-1 bg-white/[0.05] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500/60 transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="shrink-0 w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!uploadedFile || isGenerating}
              className="w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2.5 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed
                bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500
                shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.01]"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generating SLD...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Generate SLD
                  {messages.filter(m => m.role === 'user').length > 0 && (
                    <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                      {messages.filter(m => m.role === 'user').length} instruction{messages.filter(m => m.role === 'user').length > 1 ? 's' : ''}
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Quick instruction suggestions */}
            {uploadedFile && !isGenerating && !generatedLayout && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Quick instructions</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Use VCB for all circuit breakers',
                    'Add CT and PT on each feeder',
                    'Include lightning arresters on HV side',
                    'Label transformers as TR-1, TR-2',
                    'Add earth switches on all isolators',
                    'Include bus section CB between busbars',
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(prev => prev ? prev + '. ' + suggestion : suggestion);
                        textareaRef.current?.focus();
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/10 transition-all"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN — SLD Preview ── */}
          <div className="flex flex-col">
            {generatedLayout || isGenerating || error ? (
              <SLDPreview
                file={uploadedFile}
                layout={generatedLayout}
                isGenerating={isGenerating}
                error={error}
                onRegenerate={handleRegenerate}
              />
            ) : (
              <div className="h-full min-h-[500px] rounded-2xl border-2 border-dashed border-gray-800 flex flex-col items-center justify-center gap-4 text-center p-8 bg-white/[0.01]">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-blue-400/60" />
                </div>
                <div>
                  <p className="text-gray-400 font-medium">SLD preview will appear here</p>
                  <p className="text-gray-600 text-sm mt-1">
                    {uploadedFile
                      ? 'Add instructions (optional) and click Generate SLD'
                      : 'Upload a drawing and click Generate SLD to begin'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-xs text-gray-600 mt-2">
                  <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 shrink-0">1</span> Upload SLD drawing</div>
                  <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 shrink-0">2</span> Chat your requirements</div>
                  <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 shrink-0">3</span> Generate &amp; open in editor</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-gray-800 pt-6 text-center text-xs text-gray-600">
          GridVision SCADA · AI SLD Generator · Built for MSEDCL Smart Distribution Substations
        </footer>
      </div>
    </div>
  );
}
