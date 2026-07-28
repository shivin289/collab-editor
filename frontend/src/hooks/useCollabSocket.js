import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

/**
 * Manages the socket connection for one document room.
 * Handles: joining, receiving initial state, broadcasting local edits,
 * receiving remote edits, and tracking presence/cursors of other users.
 */
export function useCollabSocket(documentId, userName) {
  const socketRef = useRef(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [users, setUsers] = useState([]);
  const [myColor, setMyColor] = useState(null);
  const [connected, setConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!documentId || !userName) return undefined;

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-document', { documentId, userName });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('document-state', (data) => {
      setContent(data.content);
      setTitle(data.title);
      setMyColor(data.you.color);
    });

    // A remote peer's edit - apply it directly to local state.
    // We do NOT call sendContentChange here, which is what stops this from
    // being re-broadcast back out (avoiding an infinite echo loop).
    socket.on('content-change', ({ content: newContent }) => {
      setContent(newContent);
    });

    socket.on('users-updated', (userList) => {
      setUsers(userList.filter((u) => u.socketId !== socket.id));
    });

    socket.on('error-message', (msg) => setErrorMessage(msg));

    return () => {
      socket.emit('leave-document');
      socket.disconnect();
    };
  }, [documentId, userName]);

  // Called by the editor whenever the LOCAL user types something.
  const sendContentChange = useCallback(
    (newContent) => {
      setContent(newContent);
      socketRef.current?.emit('content-change', { documentId, content: newContent });
    },
    [documentId]
  );

  const sendCursorMove = useCallback(
    (cursorIndex) => {
      socketRef.current?.emit('cursor-move', { documentId, cursorIndex });
    },
    [documentId]
  );

  return {
    content,
    title,
    users,
    myColor,
    connected,
    errorMessage,
    sendContentChange,
    sendCursorMove,
  };
}
