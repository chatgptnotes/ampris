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
