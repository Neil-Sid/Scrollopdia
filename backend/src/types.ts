export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface LikedArticleRow {
  id: number;
  user_id: number;
  article_id: number;
  title: string;
  description: string | null;
  extract: string | null;
  image: string | null;
  url: string | null;
  created_at: string;
}

export interface UserInterestsRow {
  user_id: number;
  interests: string; // JSON-encoded InterestMap
  liked_titles: string; // JSON-encoded string[]
  seen_ids: string; // JSON-encoded number[]
  clicked_ids: string; // JSON-encoded number[]
  updated_at: string;
}

export interface InterestMap {
  [keyword: string]: number;
}

export interface JwtPayload {
  userId: number;
  username: string;
}

export interface SignupBody {
  username?: string;
  password?: string;
}

export interface LoginBody {
  username?: string;
  password?: string;
}

export interface AddLikeBody {
  id?: number;
  title?: string;
  description?: string;
  extract?: string;
  image?: string;
  url?: string;
}

export interface PutInterestsBody {
  interests?: InterestMap;
  likedTitles?: string[];
  seenIds?: number[];
  clickedIds?: number[];
}

// Augment Express's Request type with the fields our auth middleware attaches.
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      username?: string;
    }
  }
}
