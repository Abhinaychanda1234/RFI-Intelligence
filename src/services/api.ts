import axios, { AxiosResponse } from 'axios';

// 🔥 CHANGE THIS ONLY IF BACKEND URL CHANGES
const BASE_URL = import.meta.env.PROD
  ? "https://rfi-intelligence-api-g2bff4c3hmfxatcj.centralindia-01.azurewebsites.net"
  : "/api";
// ─── Axios client ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Conversation {
  id: string;
  title: string;
  mode: string;
  starred: number;
  archived: number;
  message_count: number;
  last_message: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  files?: string;
  detected_vendor?: string;
  detected_country?: string;
  detected_vertical?: string;
  confidence_score?: number;
  tokens_used?: number;
  created_at: string;
}

export interface Document {
  id: string;
  name: string;
  original_name: string;
  file_type: string;
  file_size: number;
  region?: string;
  country?: string;
  vendor?: string;
  vertical?: string;
  doc_type?: string;
  year?: number;
  tags?: string;
  status: 'queued' | 'processing' | 'indexing' | 'indexed' | 'error';
  chunk_count?: number;
  created_at: string;
}

export interface RFISection {
  title: string;
  content: string;
  confidence: number;
}

export interface RFIResponse {
  id: string;
  title: string;
  prompt: string;
  vendor?: string;
  country?: string;
  vertical?: string;
  confidence_score: number;
  status: string;
  tokens_used?: number;
  content?: string;
  response?: string;
  sections?: RFISection[];
  created_at: string;
}

export interface KBStats {
  documents: {
    total_docs: number;
    indexed_docs: number;
    error_docs: number;
    regions: number;
    vendors: number;
  };
  chunks: { total: number };
  rfis: {
    total_rfis: number;
    avg_confidence: number;
    total_tokens: number;
  };
  conversations: { total_convos: number; total_messages: number };
  recentActivity: Array<{
    type: string;
    title: string;
    status: string;
    created_at: string;
  }>;
  byVendor: Array<{ vendor: string; count: number }>;
  byRegion: Array<{ region: string; count: number }>;
  totalTokens: number;
  totalApiCalls: number;
  aiModel: string;
}

export interface AttachedFile {
  name: string;
  size: string;
  type: string;
}

// ─── Chat API ────────────────────────────────────────────────────────────────
export const chatApi = {
  getConversations: (): Promise<AxiosResponse<{ conversations: Conversation[] }>> =>
    api.get('/chat/conversations'),

  createConversation: (title = 'New Chat', mode = 'rfi'): Promise<AxiosResponse<Conversation>> =>
    api.post('/chat/conversations', { title, mode }),

  getMessages: (id: string): Promise<AxiosResponse<{ conversation: Conversation; messages: ChatMessage[] }>> =>
    api.get(`/chat/conversations/${id}/messages`),

  updateConversation: (id: string, data: Partial<Conversation>): Promise<AxiosResponse> =>
    api.patch(`/chat/conversations/${id}`, data),

  deleteConversation: (id: string): Promise<AxiosResponse> =>
    api.delete(`/chat/conversations/${id}`),

  exportConversation: (id: string, format: string): string =>
    `${BASE_URL}/chat/conversations/${id}/export?format=${format}`,
};

// ─── Documents API ───────────────────────────────────────────────────────────
export const documentsApi = {
  list: (params?: Record<string, string>): Promise<AxiosResponse<{ documents: Document[]; stats: object }>> =>
    api.get('/documents', { params }),

  upload: (formData: FormData): Promise<AxiosResponse<{ documentId: string }>> =>
    api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  checkStatus: (id: string): Promise<AxiosResponse<{ id: string; status: string; chunk_count?: number }>> =>
    api.get(`/documents/${id}/status`),

  delete: (id: string): Promise<AxiosResponse> =>
    api.delete(`/documents/${id}`),
};

// ─── RFI API ─────────────────────────────────────────────────────────────────
export const rfiApi = {
  generate: (data: {
    prompt: string;
    vendor?: string;
    country?: string;
    region?: string;
    vertical?: string;
    sections?: string[];
  }): Promise<AxiosResponse<RFIResponse & {
    content: string;
    sections: RFISection[];
    confidence: number;
    context: { vendor?: string; country?: string; vertical?: string };
  }>> => api.post('/rfi/generate', data),

  detectContext: (prompt: string): Promise<AxiosResponse<{
    vendor?: string;
    country?: string;
    region?: string;
    vertical?: string;
  }>> => api.post('/rfi/detect-context', { prompt }),

  list: (params?: Record<string, string>): Promise<AxiosResponse<{ rfis: RFIResponse[] }>> =>
    api.get('/rfi', { params }),

  get: (id: string): Promise<AxiosResponse<RFIResponse>> =>
    api.get(`/rfi/${id}`),

  update: (id: string, data: object): Promise<AxiosResponse> =>
    api.patch(`/rfi/${id}`, data),

  delete: (id: string): Promise<AxiosResponse> =>
    api.delete(`/rfi/${id}`),

  exportUrl: (id: string, format: string): string =>
    `${BASE_URL}/rfi/${id}/export?format=${format}`,
};

// ─── Knowledge API ───────────────────────────────────────────────────────────
export const knowledgeApi = {
  getStats: (): Promise<AxiosResponse<KBStats>> =>
    api.get('/knowledge/stats'),

  search: (params: {
    q: string;
    region?: string;
    vendor?: string;
    vertical?: string;
    limit?: number;
  }): Promise<AxiosResponse<{
    results: Array<{
      id: string;
      content: string;
      section_type: string;
      doc_name: string;
      confidence: number;
      region?: string;
      vendor?: string;
      country?: string;
    }>;
    count: number;
  }>> => api.get('/knowledge/search', { params }),

  getSettings: (): Promise<AxiosResponse<Record<string, string>>> =>
    api.get('/knowledge/settings'),

  updateSettings: (settings: Record<string, string>): Promise<AxiosResponse> =>
    api.patch('/knowledge/settings', settings),
};

// ─── Admin API ───────────────────────────────────────────────────────────────
export const adminApi = {
  getStats: (): Promise<AxiosResponse> => api.get('/admin/stats'),
  getAuditLog: (): Promise<AxiosResponse> => api.get('/admin/audit-log'),
  reindex: (): Promise<AxiosResponse> => api.post('/admin/reindex'),
  clearHistory: (type: string): Promise<AxiosResponse> =>
    api.delete('/admin/clear-history', { data: { type } }),
};

// ─── SSE Streaming ───────────────────────────────────────────────────────────
export async function streamMessage(
  conversationId: string,
  content: string,
  mode: string,
  files: AttachedFile[],
  onToken: (token: string) => void,
  onDone: (tokensUsed: number) => void,
  onError: (err: string) => void
): Promise<void> {
  try {
    const response = await fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, content, mode, files }),
    });

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        errMsg = errBody.error || errMsg;
      } catch (e) {
  console.warn("Skipped malformed SSE data");
}
      onError(errMsg);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) { onError('No response stream available'); return; }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'token' && data.content) {
            onToken(data.content);
          } else if (data.type === 'done') {
            onDone(data.tokensUsed ?? 0);
          }
        } catch (e) {
  console.warn("Skipped malformed SSE data");
}
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Connection failed');
  }
}

export default api;