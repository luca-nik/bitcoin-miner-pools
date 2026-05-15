const BASE = import.meta.env.VITE_API_URL || '';

export async function fetchJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export function postJSON(path) {
  return fetch(`${BASE}${path}`, { method: 'POST' }).then((res) => {
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  });
}
