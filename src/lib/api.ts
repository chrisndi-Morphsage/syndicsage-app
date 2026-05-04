import { supabase } from './supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL!;

export async function api(method: string, path: string, body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) {
    // Try refresh
    await supabase.auth.refreshSession();
    const { data: { session: newSession } } = await supabase.auth.getSession();
    const newToken = newSession?.access_token;
    const retry = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!retry.ok) throw new Error(`API error ${retry.status}`);
    return retry.json();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json();
}
