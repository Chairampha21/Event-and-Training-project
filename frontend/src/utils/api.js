// Thin fetch wrapper for the CPSU ETMS Go backend. Attaches the JWT (if present)
// and normalizes error responses into a single Error type the UI can catch.

// In a forwarded dev environment (Codespaces, most cloud devcontainers) the
// browser's "localhost" is the user's own machine, not this container — so a
// hardcoded localhost:4000 silently fails from the browser even though the
// backend is reachable from inside the container. Ports are forwarded under
// the same hostname pattern as the frontend itself (the port number appears
// somewhere in the hostname), so swap 3000 for 4000 in the current origin.
function detectApiBase() {
  if (process.env.REACT_APP_API_BASE) return process.env.REACT_APP_API_BASE;
  const { hostname, protocol } = window.location;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname.includes('3000')) {
    return `${protocol}//${hostname.replace('3000', '4000')}/api`;
  }
  return 'http://localhost:4000/api';
}

const API_BASE = detectApiBase();

let authToken = null;
export function setAuthToken(token) {
  authToken = token;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body (shouldn't normally happen outside 204, but don't crash on it)
  }

  if (!res.ok) {
    throw new ApiError((data && data.error) || `เกิดข้อผิดพลาด (HTTP ${res.status})`, res.status);
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};
