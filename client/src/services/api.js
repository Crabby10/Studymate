const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(endpoint, options = {}, token = null) {
  const url = `${BASE_URL}${endpoint}`;
  
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set Content-Type only if it's not a FormData (Multer upload)
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Documents
  uploadDocument: async (file, token) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return request('/documents/upload', {
      method: 'POST',
      body: formData,
    }, token);
  },

  getDocuments: async (token) => {
    return request('/documents', { method: 'GET' }, token);
  },

  deleteDocument: async (id, token) => {
    return request(`/documents/${id}`, { method: 'DELETE' }, token);
  },

  // Chats
  getChats: async (token) => {
    return request('/chats', { method: 'GET' }, token);
  },

  createChat: async (chatData, token) => {
    return request('/chats', {
      method: 'POST',
      body: JSON.stringify(chatData),
    }, token);
  },

  getChat: async (id, token) => {
    return request(`/chats/${id}`, { method: 'GET' }, token);
  },

  deleteChat: async (id, token) => {
    return request(`/chats/${id}`, { method: 'DELETE' }, token);
  },

  sendMessage: async (chatId, text, token) => {
    return request(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }, token);
  },

  // Study Tools
  generateStudyTool: async (docId, type, token) => {
    return request('/study/generate', {
      method: 'POST',
      body: JSON.stringify({ docId, type }),
    }, token);
  },

  getSummary: async (docId, token) => {
    return request(`/study/summaries/${docId}`, { method: 'GET' }, token);
  },

  getQuiz: async (docId, token) => {
    return request(`/study/quizzes/${docId}`, { method: 'GET' }, token);
  },

  // Stats
  getStats: async (token) => {
    return request('/stats', { method: 'GET' }, token);
  }
};
