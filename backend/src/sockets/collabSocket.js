import { getDocument, updateDocumentContent } from '../db/documents.js';
import { assignColor } from './colors.js';

// In-memory presence state, keyed by documentId.
// NOTE: this is intentionally in-memory (not in Postgres) since presence is
// ephemeral - it should reset if the server restarts, unlike document content.
// roomUsers.get(documentId) -> Map<socketId, { userName, color, cursorIndex }>
const roomUsers = new Map();

// Debounce timers so we don't hit Postgres on every keystroke.
// One timer per document; each new edit resets it.
const saveTimers = new Map();
const SAVE_DEBOUNCE_MS = 1000;

function getRoomUserList(documentId) {
  const users = roomUsers.get(documentId);
  if (!users) return [];
  return Array.from(users.entries()).map(([socketId, u]) => ({
    socketId,
    userName: u.userName,
    color: u.color,
    cursorIndex: u.cursorIndex,
  }));
}

function scheduleSave(documentId, content) {
  clearTimeout(saveTimers.get(documentId));
  const timer = setTimeout(async () => {
    try {
      await updateDocumentContent(documentId, content);
    } catch (err) {
      console.error(`Failed to save document ${documentId}:`, err);
    }
  }, SAVE_DEBOUNCE_MS);
  saveTimers.set(documentId, timer);
}

export function registerCollabHandlers(io) {
  io.on('connection', (socket) => {
    let currentDocId = null;

    socket.on('join-document', async ({ documentId, userName }) => {
      try {
        const doc = await getDocument(documentId);
        if (!doc) {
          socket.emit('error-message', 'Document not found');
          return;
        }

        currentDocId = documentId;
        socket.join(documentId);

        if (!roomUsers.has(documentId)) {
          roomUsers.set(documentId, new Map());
        }
        const usersInRoom = roomUsers.get(documentId);
        const color = assignColor(usersInRoom);
        usersInRoom.set(socket.id, {
          userName: userName || 'Anonymous',
          color,
          cursorIndex: 0,
        });

        // Send the joining client the current document state + who else is here.
        socket.emit('document-state', {
          content: doc.content,
          title: doc.title,
          you: { socketId: socket.id, color },
        });

        // Tell everyone in the room (including the new user) the updated presence list.
        io.to(documentId).emit('users-updated', getRoomUserList(documentId));
      } catch (err) {
        console.error('Error joining document:', err);
        socket.emit('error-message', 'Failed to join document');
      }
    });

    // Content sync strategy: last-write-wins broadcast.
    // Trade-off note (for interviews): this is simple and works well for the
    // common case of non-overlapping edits, but two users typing in the exact
    // same spot in the same tick can produce a jump. A production version
    // would use an OT/CRDT library (e.g. Yjs) for true conflict-free merges.
    socket.on('content-change', ({ documentId, content }) => {
      if (documentId !== currentDocId) return;
      socket.to(documentId).emit('content-change', { content, fromSocketId: socket.id });
      scheduleSave(documentId, content);
    });

    socket.on('cursor-move', ({ documentId, cursorIndex }) => {
      if (documentId !== currentDocId) return;
      const usersInRoom = roomUsers.get(documentId);
      if (!usersInRoom || !usersInRoom.has(socket.id)) return;
      usersInRoom.get(socket.id).cursorIndex = cursorIndex;
      socket.to(documentId).emit('cursor-update', {
        socketId: socket.id,
        cursorIndex,
      });
    });

    function leaveCurrentDocument() {
      if (!currentDocId) return;
      const usersInRoom = roomUsers.get(currentDocId);
      if (usersInRoom) {
        usersInRoom.delete(socket.id);
        if (usersInRoom.size === 0) {
          roomUsers.delete(currentDocId);
          clearTimeout(saveTimers.get(currentDocId));
          saveTimers.delete(currentDocId);
        } else {
          io.to(currentDocId).emit('users-updated', getRoomUserList(currentDocId));
        }
      }
      currentDocId = null;
    }

    socket.on('leave-document', leaveCurrentDocument);
    socket.on('disconnect', leaveCurrentDocument);
  });
}
