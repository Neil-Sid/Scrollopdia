import type { LikedArticleRecord } from '../types';

const GRADIENTS = [
  'linear-gradient(135deg, #1a1a2e, #0f3460)',
  'linear-gradient(135deg, #2d1b69, #11998e)',
  'linear-gradient(135deg, #1e3c72, #2a5298)',
  'linear-gradient(135deg, #0f0c29, #24243e)',
];

interface LikesPanelProps {
  open: boolean;
  onClose: () => void;
  likedArticles: LikedArticleRecord[];
  topInterests: string[];
  onRemove: (id: number) => void;
}

export default function LikesPanel({ open, onClose, likedArticles, topInterests, onRemove }: LikesPanelProps) {
  return (
    <>
      <div className={`likes-panel${open ? ' open' : ''}`}>
        <div className="likes-panel-header">
          <h2 className="likes-panel-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--wiki-red)" stroke="var(--wiki-red)" strokeWidth={2}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            Liked Articles
          </h2>
          <button className="likes-panel-close" onClick={onClose}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="likes-panel-interests">
          {topInterests.length > 0 && (
            <>
              <span className="interest-tag-label">Your interests</span>
              {topInterests.map((kw) => (
                <span className="interest-tag" key={kw}>
                  {kw}
                </span>
              ))}
            </>
          )}
        </div>

        <div className="likes-panel-list">
          {likedArticles.length === 0 ? (
            <div className="likes-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <p>No liked articles yet</p>
              <span>Like articles to build your personalized feed</span>
            </div>
          ) : (
            likedArticles.map((a, i) => (
              <div
                className="liked-item"
                key={a.id}
                onClick={() => window.open(a.url, '_blank')}
              >
                {a.image ? (
                  <img
                    className="liked-item-img"
                    src={a.image}
                    alt=""
                    onError={(e) => {
                      const el = e.currentTarget;
                      el.style.display = 'none';
                      const placeholder = el.nextElementSibling as HTMLElement | null;
                      if (placeholder) placeholder.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="liked-item-placeholder"
                  style={{
                    background: GRADIENTS[i % GRADIENTS.length],
                    display: a.image ? 'none' : 'flex',
                  }}
                >
                  {a.title.charAt(0)}
                </div>
                <div className="liked-item-info">
                  <div className="liked-item-title">{a.title}</div>
                  <div className="liked-item-desc">{a.description || 'Wikipedia Article'}</div>
                </div>
                <button
                  className="liked-item-remove"
                  title="Remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(a.id);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      <div className={`likes-panel-backdrop${open ? ' open' : ''}`} onClick={onClose} />
    </>
  );
}
