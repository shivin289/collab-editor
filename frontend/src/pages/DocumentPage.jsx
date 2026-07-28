import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCollabSocket } from '../hooks/useCollabSocket';
import Editor from '../components/Editor';
import UserPresence from '../components/UserPresence';
import { renameDocument } from '../api';

// Simple per-tab identity - no auth system yet (v1 scope).
// sessionStorage (not localStorage) so each browser tab can act as a
// "different user" for demo purposes, which is handy when showing this off.
function getOrPromptUserName() {
  let name = sessionStorage.getItem('collab-username');
  if (!name) {
    name = window.prompt('Enter your name to join the document:', '') || 'Anonymous';
    sessionStorage.setItem('collab-username', name);
  }
  return name;
}

export default function DocumentPage() {
  const { id: documentId } = useParams();
  const [userName] = useState(getOrPromptUserName);
  const [titleInput, setTitleInput] = useState('');
  const titleSaveTimer = useRef(null);

  const {
    content,
    title,
    users,
    myColor,
    connected,
    errorMessage,
    sendContentChange,
    sendCursorMove,
  } = useCollabSocket(documentId, userName);

  // Keep the local title input in sync once the server tells us the real title.
  useEffect(() => {
    setTitleInput(title);
  }, [title]);

  function handleTitleChange(e) {
    const newTitle = e.target.value;
    setTitleInput(newTitle);
    clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = setTimeout(() => {
      renameDocument(documentId, newTitle).catch(() => {
        // Non-critical: title save failing shouldn't interrupt editing.
      });
    }, 800);
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    alert('Link copied! Share it so others can join and edit live.');
  }

  if (errorMessage) {
    return (
      <div className="error-page">
        <h2>{errorMessage}</h2>
        <a href="/">Back to home</a>
      </div>
    );
  }

  return (
    <div className="document-page">
      <header className="doc-header">
        <input
          className="title-input"
          value={titleInput}
          onChange={handleTitleChange}
          placeholder="Untitled Document"
        />
        <button className="share-btn" onClick={handleCopyLink}>
          Share
        </button>
      </header>

      <UserPresence users={users} myColor={myColor} connected={connected} />

      <Editor
        content={content}
        onChange={sendContentChange}
        onCursorMove={sendCursorMove}
      />
    </div>
  );
}
