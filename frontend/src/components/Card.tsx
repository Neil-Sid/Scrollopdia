import { useState } from 'react';
import type { WikiArticle } from '../types';

const GRADIENTS = [
  'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
  'linear-gradient(135deg, #2d1b69, #11998e)',
  'linear-gradient(135deg, #1e3c72, #2a5298)',
  'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  'linear-gradient(135deg, #141e30, #243b55)',
  'linear-gradient(135deg, #1f1c2c, #928dab)',
  'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
  'linear-gradient(135deg, #232526, #414345)',
];

interface CardProps {
  article: WikiArticle;
  index: number;
  isLiked: boolean;
  onToggleLike: (article: WikiArticle) => void;
  onShare: (article: WikiArticle) => void;
  onOpen: (article: WikiArticle) => void;
  onLinkClick: (article: WikiArticle) => void;
}

export default function Card({ article, index, isLiked, onToggleLike, onShare, onOpen, onLinkClick }: CardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageErrored, setImageErrored] = useState(false);

  const grad = GRADIENTS[index % GRADIENTS.length];
  const firstLetter = article.title.charAt(0).toUpperCase();
  const showImage = Boolean(article.image) && !imageErrored;

  return (
    <div className="card" data-index={index}>
      <div
        className="card-bg"
        style={article.image ? { backgroundImage: `url('${article.image}')` } : undefined}
      />
      <div className="card-inner">
        <div className="card-image-wrap">
          <div className="card-image-placeholder" style={{ background: grad }}>
            <span className="placeholder-letter">{firstLetter}</span>
          </div>
          {showImage && (
            <img
              className={`card-image${imageLoaded ? ' loaded' : ''}`}
              crossOrigin="anonymous"
              alt={article.title}
              src={article.image as string}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageErrored(true)}
            />
          )}
          {article.attribution && (
            <div className="img-attribution">
              {[article.attribution.artist, article.attribution.license].filter(Boolean).join(' · ') ||
                'Wikimedia Commons'}
            </div>
          )}
        </div>
        <div className="card-content">
          <div className="card-category">{article.description || 'Wikipedia Article'}</div>
          <h2 className="card-title">{article.title}</h2>
          <p className="card-extract">{article.extract}</p>
          <div className="card-footer">
            <a
              className="card-link"
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onLinkClick(article)}
            >
              Read full article →
            </a>
          </div>
        </div>
      </div>
      <div className="side-actions">
        <button
          className={`action-btn${isLiked ? ' liked' : ''}`}
          onClick={() => onToggleLike(article)}
          aria-label="Like"
        >
          <div className="action-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill={isLiked ? 'white' : 'none'}
              stroke="white"
              strokeWidth={2}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <span className="action-label">Like</span>
        </button>
        <button className="action-btn" onClick={() => onShare(article)} aria-label="Share">
          <div className="action-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </div>
          <span className="action-label">Share</span>
        </button>
        <button className="action-btn" onClick={() => onOpen(article)} aria-label="Open">
          <div className="action-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </div>
          <span className="action-label">Open</span>
        </button>
      </div>
    </div>
  );
}
