import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

const TOKEN_KEY = 'cc.token';
let memoryToken = null;
const unauthorizedListeners = new Set();

export function onUnauthorized(fn) {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

export async function getToken() {
  if (memoryToken) return memoryToken;
  memoryToken = await AsyncStorage.getItem(TOKEN_KEY);
  return memoryToken;
}

export async function setToken(token) {
  memoryToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message || 'Something went wrong');
    this.status = status;
    this.code = code || 'error';
    this.details = details || null;
  }
}

function buildUrl(path, params) {
  const url = path.startsWith('http') ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  if (!params) return url;
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return query ? `${url}${url.includes('?') ? '&' : '?'}${query}` : url;
}

async function parseResponse(res) {
  let payload = null;
  try {
    payload = await res.json();
  } catch (err) {
    payload = null;
  }
  if (!res.ok) {
    if (res.status === 401) {
      await setToken(null);
      unauthorizedListeners.forEach((fn) => fn());
    }
    const error = payload?.error || {};
    throw new ApiError(
      res.status,
      error.message || `Request failed (${res.status})`,
      error.code,
      error.details
    );
  }
  return payload?.data !== undefined ? payload.data : payload;
}

export async function api(path, { method = 'GET', body, params, headers = {}, signal } = {}) {
  const token = await getToken();
  const isForm = body instanceof FormData;
  const res = await fetch(buildUrl(path, params), {
    method,
    signal,
    headers: {
      Accept: 'application/json',
      ...(isForm || body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: isForm || body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse(res);
}

/** Multipart upload used for complaint images and marketplace photos. */
export function buildFormData({ uri, name, type, fields = {} }) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null) form.append(k, String(v));
  });
  if (uri) form.append('image', { uri, name: name || 'photo.jpg', type: type || 'image/jpeg' });
  return form;
}

export default { api, getToken, setToken, onUnauthorized, ApiError, buildFormData };
