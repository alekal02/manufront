/** Cliente HTTP ManuControl */

function resolveApiBase() {
  let base = String(import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');
  if (!base) base = '/api';
  if (/^https?:\/\//i.test(base) && !/\/api$/i.test(base)) {
    base = `${base}/api`;
  }
  return base;
}

const API = resolveApiBase();
const AUTH_KEY = 'manu_auth';

export function loadAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveAuth(payload) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export async function api(path, { method = 'GET', body, token, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path.startsWith('/') ? path : `/${path}`}`, {
    method,
    headers,
    body: payload,
  });
  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        clearAuth();
        try {
          window.dispatchEvent(new CustomEvent('manu:auth-expired'));
        } catch {
          /* ignore */
        }
      }
      const err = new Error(data.error || res.statusText);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }
  if (!res.ok) {
    if (res.status === 401) clearAuth();
    const err = new Error(res.statusText);
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

export { API };
