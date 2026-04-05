const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getToken() {
  return localStorage.getItem('token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Error desconocido');
  }

  return res.json();
}

export const api = {
  login: (email, password) =>
    request('POST', '/auth/login', { email, password }),

  chat: (mensaje, session_id) =>
    request('POST', '/chat', { mensaje, session_id: session_id ?? null }),

  getSessions: () =>
    request('GET', '/sessions'),

  getMessages: (sessionId) =>
    request('GET', `/sessions/${sessionId}/messages`),

  // Instructor
  getInstructorSessions: () =>
    request('GET', '/instructor/sessions'),

  getInstructorMessages: (sessionId) =>
    request('GET', `/instructor/sessions/${sessionId}/messages`),
};
