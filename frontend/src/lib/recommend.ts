import type { InterestMap, WikiArticle } from '../types';

const STOP_WORDS = new Set<string>([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can',
  'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'about', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further',
  'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both', 'each',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if', 'while', 'that',
  'this', 'it', 'its', 'he', 'she', 'they', 'them', 'his', 'her', 'their', 'which', 'who',
  'whom', 'what', 'also', 'born', 'known', 'one', 'two', 'first', 'second', 'new', 'used',
  'many', 'made', 'called', 'since', 'part', 'over', 'found', 'people', 'years',
]);

/**
 * Tracks user interests from liked articles via keyword extraction.
 * Serves a mix of related and random "discovery" articles.
 *
 * This is a plain class (not React state) so that its internal frequency
 * maps and sets can mutate cheaply; the app persists/reads a snapshot of it
 * via `getSnapshot` / `loadSnapshot` at the seams where React needs to know
 * something changed (e.g. after a like).
 */
export class RecommendationEngine {
  interests: InterestMap = {};
  likedTitles: string[] = [];
  seenIds: Set<number> = new Set();
  seenTitles: Set<string> = new Set();
  clickedIds: Set<number> = new Set();

  private extractKeywords(article: Pick<WikiArticle, 'title' | 'description' | 'extract'>): string[] {
    const text = `${article.title} ${article.description} ${article.extract}`.toLowerCase();
    const words: string[] = text.match(/[a-z]{3,}/g) || [];
    const keywords: Record<string, number> = {};
    for (const w of words) {
      if (!STOP_WORDS.has(w) && w.length > 3) {
        keywords[w] = (keywords[w] || 0) + 1;
      }
    }
    return Object.entries(keywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word]) => word);
  }

  addLike(article: WikiArticle): void {
    this.likedTitles.push(article.title);
    const keywords = this.extractKeywords(article);
    const titleWords: string[] = article.title.toLowerCase().match(/[a-z]{3,}/g) || [];
    const descWords: string[] = (article.description || '').toLowerCase().match(/[a-z]{3,}/g) || [];

    for (const kw of keywords) {
      let boost = 1;
      if (titleWords.includes(kw)) boost = 4;
      else if (descWords.includes(kw)) boost = 2.5;
      this.interests[kw] = (this.interests[kw] || 0) + boost;
    }

    // Gentle decay on all interests to keep the profile fresh.
    for (const k of Object.keys(this.interests)) {
      this.interests[k] *= 0.95;
      if (this.interests[k] < 0.3) delete this.interests[k];
    }
  }

  removeLike(article: Pick<WikiArticle, 'title' | 'description' | 'extract'>): void {
    this.likedTitles = this.likedTitles.filter((t) => t !== article.title);
    const keywords = this.extractKeywords(article);
    for (const kw of keywords) {
      if (this.interests[kw]) {
        this.interests[kw] = Math.max(0, this.interests[kw] - 3);
        if (this.interests[kw] < 0.3) delete this.interests[kw];
      }
    }
  }

  scoreArticle(article: WikiArticle): number {
    if (Object.keys(this.interests).length === 0) return 0;
    const keywords = this.extractKeywords(article);
    let score = 0;
    let matches = 0;
    for (const kw of keywords) {
      if (this.interests[kw]) {
        score += this.interests[kw];
        matches++;
      }
    }
    if (matches >= 3) score *= 1.3;
    if (article.image) score *= 1.15;
    if (article.extract && article.extract.length < 100) score *= 0.5;
    return score;
  }

  getTopInterests(n = 3): string[] {
    return Object.entries(this.interests)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([word]) => word);
  }

  /** Mild boost when the user opens the full article (~40% of a like). */
  trackClick(article: WikiArticle): void {
    if (this.clickedIds.has(article.id)) return; // only count once per article
    this.clickedIds.add(article.id);
    const keywords = this.extractKeywords(article);
    const titleWords: string[] = article.title.toLowerCase().match(/[a-z]{3,}/g) || [];
    for (const kw of keywords) {
      let boost = 0.4;
      if (titleWords.includes(kw)) boost = 1.2;
      this.interests[kw] = (this.interests[kw] || 0) + boost;
    }
  }

  /** Build varied search queries to avoid repetitive results. */
  getSearchQueries(): string[] {
    const sorted = Object.entries(this.interests).sort((a, b) => b[1] - a[1]);
    if (sorted.length < 2) return [sorted.map((s) => s[0]).join(' ')];
    const queries: string[] = [];
    queries.push(`${sorted[0][0]} ${sorted[1][0]}`);
    if (sorted.length >= 4) {
      const mid = sorted[2 + Math.floor(Math.random() * Math.min(3, sorted.length - 2))];
      queries.push(`${sorted[0][0]} ${mid[0]}`);
    }
    return queries;
  }

  markSeen(id: number, title: string): void {
    this.seenIds.add(id);
    this.seenTitles.add(title);
  }

  hasSeen(id: number, title: string): boolean {
    return this.seenIds.has(id) || this.seenTitles.has(title);
  }
}
