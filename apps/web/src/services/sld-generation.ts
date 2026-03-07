import type { SLDLayout } from '@gridvision/shared';
import { api } from './api';

interface SLDGenerationResponse {
  success: boolean;
  layout: SLDLayout;
  metadata: {
    originalFilename: string;
    fileSize: number;
    mimeType: string;
    generatedAt: string;
    user: string;
  };
}

export async function generateSLD(file: File, instructions?: string): Promise<SLDLayout> {
  const formData = new FormData();
  formData.append('file', file);
  if (instructions?.trim()) {
    formData.append('instructions', instructions.trim());
  }

  const response = await api.post<SLDGenerationResponse>('/sld/generate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90000,
  });

  return response.data.layout;
}

// Text-to-SLD: generate from description (no image needed)
export async function generateSLDFromText(description: string, instructions?: string): Promise<SLDLayout> {
  const response = await api.post('/sld/generate-text', {
    description,
    instructions: instructions?.trim() || undefined,
  }, { timeout: 60000 });
  // Response is SLDLayout directly (not wrapped in .layout)
  return response.data as SLDLayout;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chatWithSLDAI(
  message: string,
  elements: any[],
  connections: any[],
  projectName?: string
): Promise<{ elements: any[]; connections: any[]; explanation: string }> {
  const response = await api.post('/sld/chat', {
    message,
    elements,
    connections,
    projectName: projectName || 'SLD',
  });
  return response.data;
}
