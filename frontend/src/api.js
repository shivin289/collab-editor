const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function createDocument(title) {
  const res = await fetch(`${API_BASE}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return handleResponse(res);
}

export async function fetchDocument(id) {
  const res = await fetch(`${API_BASE}/api/documents/${id}`);
  return handleResponse(res);
}

export async function listRecentDocuments() {
  const res = await fetch(`${API_BASE}/api/documents`);
  return handleResponse(res);
}

export async function renameDocument(id, title) {
  const res = await fetch(`${API_BASE}/api/documents/${id}/title`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return handleResponse(res);
}
