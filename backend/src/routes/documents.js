import { Router } from 'express';
import {
  createDocument,
  getDocument,
  renameDocument,
  listRecentDocuments,
} from '../db/documents.js';

const router = Router();

// Create a new document -> returns its id so the client can redirect to /doc/:id
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    const doc = await createDocument(title);
    res.status(201).json(doc);
  } catch (err) {
    console.error('Failed to create document:', err);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Fetch a document's current content (used on page load before socket takes over)
router.get('/:id', async (req, res) => {
  try {
    const doc = await getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    console.error('Failed to fetch document:', err);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Rename a document
router.patch('/:id/title', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }
    const doc = await renameDocument(req.params.id, title.trim());
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    console.error('Failed to rename document:', err);
    res.status(500).json({ error: 'Failed to rename document' });
  }
});

// List recent documents (simple "recents" list, no auth yet)
router.get('/', async (req, res) => {
  try {
    const docs = await listRecentDocuments();
    res.json(docs);
  } catch (err) {
    console.error('Failed to list documents:', err);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

export default router;
