export type ArticleSource = 'random' | 'recommended' | 'adjacent';

export interface ImageAttribution {
  artist: string | null;
  license: string | null;
  credit: string | null;
}

export interface WikiArticle {
  id: number;
  title: string;
  extract: string;
  image: string | null;
  url: string;
  description: string;
  source: ArticleSource;
  attribution?: ImageAttribution;
}

/** Slim record of a liked article, persisted to storage/backend. */
export interface LikedArticleRecord {
  id: number;
  title: string;
  description: string;
  image: string | null;
  url: string;
  extract: string;
}

export interface InterestMap {
  [keyword: string]: number;
}

/** Shape persisted to localStorage (and mirrored to the backend). */
export interface PersistedData {
  interests: InterestMap;
  likedTitles: string[];
  likedArticles: LikedArticleRecord[];
  seenIds: number[];
  clickedIds: number[];
}

export interface AuthResponse {
  token: string;
  username: string;
}

export interface ApiLike {
  id: number;
  title: string;
  description: string;
  extract: string;
  image: string | null;
  url: string;
  created_at: string;
}

export interface ApiInterests {
  interests: InterestMap;
  likedTitles: string[];
  seenIds: number[];
  clickedIds: number[];
}
