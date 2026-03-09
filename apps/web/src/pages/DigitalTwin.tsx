import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import {
  RefreshCw, ChevronLeft, Download, Maximize, Minimize,
  Loader2, Box, Image, Film, Play, Pause, Volume2, VolumeX,
} from 'lucide-react';

interface ProjectSummary {
  id: string;
  name: string;
  _count: { mimicPages: number };
}

type Mode = 'image' | 'video';

export default function DigitalTwin() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [mode, setMode] = useState<Mode>('image');

  // Image state
  const [image, setImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageCached, setImageCached] = useState(false);
  const [elementCount, setElementCount] = useState(0);

  // Video state
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoCached, setVideoCached] = useState(false);
  const [videoProgress, setVideoProgress] = useState('');
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [fullscreen, setFullscreen] = useState(false);
  const navigate = useNavigate();

  // Load projects
  useEffect(() => {
    api.get('/projects').then(({ data }) => {
      setProjects(data);
      const lastProject = localStorage.getItem('gridvision-last-project');
      if (lastProject && data.some((p: any) => p.id === lastProject)) {
        setSelectedProject(lastProject);
      } else if (data.length > 0) {
        setSelectedProject(data[0].id);
      }
    }).catch(() => {});
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Image generation ──
  const generateImage = useCallback(async (regenerate = false) => {
    if (!selectedProject) return;
    setImageLoading(true);
    setImageError(null);
    try {
      const { data } = await api.get(`/gemini/digital-twin/${selectedProject}${regenerate ? '?regenerate=true' : ''}`);
      setImage(data.image);
      setImageCached(data.cached);
      setElementCount(data.elementCount || 0);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Generation failed';
      setImageError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setImageLoading(false);
    }
  }, [selectedProject]);

  // ── Video generation ──
  const generateVideo = useCallback(async (regenerate = false) => {
    if (!selectedProject) return;
    setVideoLoading(true);
    setVideoError(null);
    setVideoUrl(null);
    setVideoProgress('Starting video generation...');

    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    try {
      const { data } = await api.post(`/gemini/digital-twin-video/${selectedProject}${regenerate ? '?regenerate=true' : ''}`);

      if (data.status === 'complete') {
        // Cached — video is ready
        setVideoUrl(data.videoUrl);
        setVideoCached(true);
        setVideoLoading(false);
        setVideoProgress('');
        return;
      }

      // Start polling
      const operationName = data.operationName;
      setVideoProgress('Generating cinematic flyover with Veo 3.1...');
      let elapsed = 0;

      pollRef.current = setInterval(async () => {
        elapsed += 5;
        try {
          const { data: status } = await api.get(
            `/gemini/digital-twin-video/${selectedProject}/status?operation=${encodeURIComponent(operationName)}`
          );

          if (status.done) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;

            if (status.error) {
              setVideoError(status.error);
              setVideoLoading(false);
              setVideoProgress('');
            } else {
              setVideoUrl(status.videoUrl);
              setVideoCached(false);
              setVideoLoading(false);
              setVideoProgress('');
            }
          } else {
            // Update progress text
            if (elapsed < 30) setVideoProgress('Rendering substation scene...');
            else if (elapsed < 60) setVideoProgress('Compositing drone camera path...');
            else if (elapsed < 90) setVideoProgress('Adding holographic overlays...');
            else if (elapsed < 120) setVideoProgress('Finalizing cinematic output...');
            else setVideoProgress(`Still rendering... (${elapsed}s elapsed)`);
          }
        } catch {
          // Ignore transient poll errors
        }
      }, 5000);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Video generation failed';
      setVideoError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setVideoLoading(false);
      setVideoProgress('');
    }
  }, [selectedProject]);

  // Auto-generate when project selected (image mode only)
  useEffect(() => {
    if (selectedProject && mode === 'image') {
      generateImage(false);
    }
  }, [selectedProject, generateImage, mode]);

  const handleDownloadImage = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image;
    a.download = `digital-twin-${selectedProject}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadVideo = () => {
    if (!videoSrc) return;
    const a = document.createElement('a');
    a.href = videoSrc;
    a.download = `digital-twin-${selectedProject}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Build absolute video URL — videoUrl is relative to API base (e.g. /gemini/digital-twin-video/xxx/file)
  const videoSrc = videoUrl ? `${api.defaults.baseURL}${videoUrl}` : null;

  // Fullscreen view
  if (fullscreen) {
    if (mode === 'video' && videoUrl) {
      return (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={() => setFullscreen(false)}>
          <video
            src={videoSrc!}
            autoPlay
            loop
            muted={muted}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white"
            onClick={() => setFullscreen(false)}
          >
            <Minimize className="w-5 h-5" />
          </button>
        </div>
      );
    }
    if (mode === 'image' && image) {
      return (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center cursor-pointer" onClick={() => setFullscreen(false)}>
          <img src={image} alt="Digital Twin" className="max-w-full max-h-full object-contain" />
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white"
            onClick={() => setFullscreen(false)}
          >
            <Minimize className="w-5 h-5" />
          </button>
        </div>
      );
    }
  }

  const loading = mode === 'image' ? imageLoading : videoLoading;
  const error = mode === 'image' ? imageError : videoError;
  const hasContent = mode === 'image' ? !!image : !!videoUrl;

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0 flex-wrap">
        <button onClick={() => navigate(-1)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Box className="w-5 h-5 text-cyan-400" />
        <h1 className="text-lg font-semibold text-white">Digital Twin</h1>

        {/* Mode toggle */}
        <div className="flex bg-gray-800 rounded-lg p-0.5 ml-2">
          <button
            onClick={() => setMode('image')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              mode === 'image' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Image className="w-3.5 h-3.5" />
            Image
          </button>
          <button
            onClick={() => setMode('video')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              mode === 'video' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Video
          </button>
        </div>

        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="ml-4 px-3 py-1.5 bg-gray-800 text-gray-200 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="flex-1" />

        {hasContent && (
          <>
            {mode === 'image' && (
              <span className="text-xs text-gray-500">
                {elementCount} elements {imageCached ? '(cached)' : '(fresh)'}
              </span>
            )}
            {mode === 'video' && (
              <span className="text-xs text-gray-500">
                Veo 3.1 {videoCached ? '(cached)' : '(fresh)'}
              </span>
            )}
            <button
              onClick={() => mode === 'image' ? generateImage(true) : generateVideo(true)}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm text-white rounded-lg disabled:opacity-50 transition-colors ${
                mode === 'video' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-cyan-600 hover:bg-cyan-500'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
            <button
              onClick={mode === 'image' ? handleDownloadImage : handleDownloadVideo}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => setFullscreen(true)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
              title="Fullscreen"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        {/* Loading state */}
        {loading ? (
          <div className="flex flex-col items-center gap-4 text-gray-400">
            <div className="relative">
              <Loader2 className={`w-16 h-16 animate-spin ${mode === 'video' ? 'text-purple-500' : 'text-cyan-500'}`} />
              {mode === 'video' ? (
                <Film className="w-6 h-6 text-purple-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              ) : (
                <Box className="w-6 h-6 text-cyan-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              )}
            </div>
            {mode === 'video' ? (
              <>
                <p className="text-lg font-medium text-gray-300">Generating Video Digital Twin...</p>
                <p className="text-sm text-purple-400">{videoProgress}</p>
                <p className="text-xs text-gray-600">Video generation takes 1-3 minutes</p>
                <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500/50 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-gray-300">Generating Digital Twin...</p>
                <p className="text-sm text-gray-500">Creating a photorealistic 3D visualization of your substation</p>
                <p className="text-xs text-gray-600">This may take 15-30 seconds</p>
              </>
            )}
          </div>
        ) : error ? (
          /* Error state */
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${mode === 'video' ? 'bg-purple-900/30' : 'bg-red-900/30'}`}>
              {mode === 'video' ? <Film className="w-8 h-8 text-purple-400" /> : <Box className="w-8 h-8 text-red-400" />}
            </div>
            <p className="text-red-400 font-medium">Generation Failed</p>
            <p className="text-sm text-gray-400">{error}</p>
            <button
              onClick={() => mode === 'image' ? generateImage(true) : generateVideo(true)}
              className={`px-4 py-2 text-white rounded-lg text-sm ${
                mode === 'video' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-cyan-600 hover:bg-cyan-500'
              }`}
            >
              Try Again
            </button>
          </div>
        ) : mode === 'image' && image ? (
          /* Image result */
          <img
            src={image}
            alt="Digital Twin - 3D Substation Visualization"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl shadow-cyan-500/10 cursor-pointer"
            onClick={() => setFullscreen(true)}
          />
        ) : mode === 'video' && videoUrl ? (
          /* Video result */
          <div className="relative max-w-full max-h-full flex flex-col items-center gap-3">
            <video
              ref={videoRef}
              src={videoSrc!}
              controls
              autoPlay
              loop
              muted={muted}
              className="max-w-full max-h-[calc(100vh-12rem)] object-contain rounded-lg shadow-2xl shadow-purple-500/10 cursor-pointer"
              onClick={() => setFullscreen(true)}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.paused ? v.play() : v.pause();
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
              >
                <Play className="w-5 h-5" />
              </button>
              <button
                onClick={() => setMuted(!muted)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
              >
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <span className="text-xs text-gray-500">Click video for fullscreen</span>
            </div>
          </div>
        ) : !selectedProject ? (
          /* No project selected */
          <div className="flex flex-col items-center gap-4 text-gray-500">
            <Box className="w-16 h-16 text-gray-700" />
            <p className="text-lg font-medium">Select a project to generate its Digital Twin</p>
          </div>
        ) : mode === 'video' && !videoUrl ? (
          /* Video not generated yet */
          <div className="flex flex-col items-center gap-4 text-gray-500">
            <Film className="w-16 h-16 text-purple-700" />
            <p className="text-lg font-medium text-gray-400">Generate a cinematic video of your substation</p>
            <p className="text-sm text-gray-600">Powered by Google Veo 3.1 — 8-second HD flyover with ambient audio</p>
            <button
              onClick={() => generateVideo(false)}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Film className="w-4 h-4" />
              Generate Video
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
