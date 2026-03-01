const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type GeminiContentType = 'features' | 'infographic' | 'facts' | 'description';

export interface GeminiResponse {
  type: GeminiContentType;
  content: unknown;
}

export async function generateGeminiContent(type: GeminiContentType): Promise<GeminiResponse> {
  const response = await fetch(`${API_URL}/api/gemini/generate-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export interface InfographicResponse {
  image: string; // data:image/png;base64,...
  mimeType: string;
  cached: boolean;
}

export async function fetchInfographic(regenerate = false): Promise<InfographicResponse> {
  const url = `${API_URL}/api/gemini/infographic${regenerate ? '?regenerate=true' : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
