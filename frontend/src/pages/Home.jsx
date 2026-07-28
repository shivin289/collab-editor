import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDocument, listRecentDocuments } from '../api';

export default function Home() {
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    listRecentDocuments()
      .then(setRecentDocs)
      .catch(() => {
        // Non-critical: if this fails, the create-new flow still works.
        setRecentDocs([]);
      });
  }, []);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const doc = await createDocument('Untitled Document');
      navigate(`/doc/${doc.id}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="home-page">
      <h1>Collab Editor</h1>
      <p className="tagline">Real-time collaborative text editing. No sign-up required.</p>

      <button className="primary-btn" onClick={handleCreate} disabled={loading}>
        {loading ? 'Creating...' : '+ New Document'}
      </button>

      {error && <p className="error-text">{error}</p>}

      {recentDocs.length > 0 && (
        <div className="recent-docs">
          <h2>Recent Documents</h2>
          <ul>
            {recentDocs.map((doc) => (
              <li key={doc.id}>
                <a href={`/doc/${doc.id}`}>{doc.title}</a>
                <span className="doc-meta">
                  {new Date(doc.updated_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
