import pool from './pool.js';

export async function createDocument(title = 'Untitled Document') {
  const result = await pool.query(
    `INSERT INTO documents (title) VALUES ($1) RETURNING id, title, content, created_at`,
    [title]
  );
  return result.rows[0];
}

export async function getDocument(id) {
  const result = await pool.query(
    `SELECT id, title, content, created_at, updated_at FROM documents WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function updateDocumentContent(id, content) {
  const result = await pool.query(
    `UPDATE documents SET content = $1, updated_at = now() WHERE id = $2 RETURNING id, updated_at`,
    [content, id]
  );
  return result.rows[0] || null;
}

export async function renameDocument(id, title) {
  const result = await pool.query(
    `UPDATE documents SET title = $1, updated_at = now() WHERE id = $2 RETURNING id, title`,
    [title, id]
  );
  return result.rows[0] || null;
}

export async function listRecentDocuments(limit = 20) {
  const result = await pool.query(
    `SELECT id, title, updated_at FROM documents ORDER BY updated_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}
