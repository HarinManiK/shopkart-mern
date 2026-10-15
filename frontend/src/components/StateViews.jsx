import { Link } from 'react-router-dom';

// Small presentational components so every page shows loading / error / empty
// states the same way.
export function Loading({ message = 'Loading...' }) {
  return (
    <div className="state-box" role="status">
      <div className="spinner" />
      <p>{message}</p>
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong.', message, onRetry }) {
  return (
    <div className="state-box error" role="alert">
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {onRetry && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, message, actionLabel, actionTo }) {
  return (
    <div className="state-box">
      {icon && <div className="icon">{icon}</div>}
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {actionLabel && (
        <Link to={actionTo} className="btn btn-primary">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
