interface HeaderProps {
  onToggleLikes: () => void;
  username: string | null;
  onAccountClick: () => void;
}

export default function Header({ onToggleLikes, username, onAccountClick }: HeaderProps) {
  return (
    <div className="header">
      <div className="header-left">
        <div className="header-title">
          Scroll<span>opedia</span>
        </div>
      </div>
      <div className="header-right">
        <button className="account-btn" onClick={onAccountClick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {username || 'Sign in'}
        </button>
        <button className="likes-tab-btn" onClick={onToggleLikes}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          Liked
        </button>
      </div>
    </div>
  );
}
