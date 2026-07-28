export default function UserPresence({ users, myColor, connected }) {
  return (
    <div className="presence-bar">
      <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
      <span className="connection-label">{connected ? 'Live' : 'Reconnecting...'}</span>

      <div className="user-badges">
        <span className="badge you" style={{ backgroundColor: myColor }}>
          You
        </span>
        {users.map((u) => (
          <span key={u.socketId} className="badge" style={{ backgroundColor: u.color }}>
            {u.userName}
          </span>
        ))}
      </div>

      {users.length === 0 && (
        <span className="alone-hint">You're the only one here — share the link to collaborate.</span>
      )}
    </div>
  );
}
