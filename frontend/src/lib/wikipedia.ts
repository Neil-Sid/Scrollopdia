import type { ArticleSource, ImageAttribution, WikiArticle } from '../types';
import type { RecommendationEngine } from './recommend';

interface WikiSummary {
  title?: string;
  pageid?: number;
  extract?: string;
  description?: string;
  type?: string;
  originalimage?: { source: string };
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

interface WikiSearchResponse {
  query?: { search?: { title: string }[] };
}

interface WikiLinksResponse {
  query?: { pages?: Record<string, { links?: { title: string }[] }> };
}

interface WikiImageInfoResponse {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: { extmetadata?: Record<string, { value?: string }> }[];
      }
    >;
  };
}

function toArticle(d: WikiSummary, source: ArticleSource): WikiArticle | null {
  if (!d.title || !d.pageid) return null;
  return {
    title: d.title,
    extract: d.extract || '',
    image: d.originalimage?.source || d.thumbnail?.source || null,
    url: d.content_urls?.desktop?.page || '#',
    description: d.description || '',
    id: d.pageid,
    source,
  };
}

/** Filter out stubs, disambiguation pages, and other low-quality results. */
export function isQualityArticle(article: WikiArticle | null): article is WikiArticle {
  if (!article) return false;
  if (article.extract && article.extract.length < 80) return false;
  return true;
}

export async function fetchImageAttribution(imageUrl: string): Promise<ImageAttribution | null> {
  try {
    const urlParts = imageUrl.split('/');
    let filename = decodeURIComponent(urlParts[urlParts.length - 1]);
    if (imageUrl.includes('/thumb/')) {
      filename = decodeURIComponent(urlParts[urlParts.length - 2]);
    }
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(
        filename,
      )}&prop=imageinfo&iiprop=extmetadata&format=json&origin=*`,
    );
    const data = (await res.json()) as WikiImageInfoResponse;
    const page = Object.values(data.query?.pages || {})[0];
    const meta = page?.imageinfo?.[0]?.extmetadata;
    if (!meta) return null;
    const artist = meta.Artist?.value?.replace(/<[^>]*>/g, '').trim() || null;
    const license = meta.LicenseShortName?.value || meta.License?.value || null;
    const credit = meta.Credit?.value?.replace(/<[^>]*>/g, '').trim() || null;
    return { artist, license, credit };
  } catch {
    return null;
  }
}

export async function fetchRandomArticle(engine: RecommendationEngine): Promise<WikiArticle | null> {
  try {
    const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
    const data = (await res.json()) as WikiSummary;
    if (!data.title || !data.pageid) return null;
    if (engine.hasSeen(data.pageid, data.title)) return null;
    return toArticle(data, 'random');
  } catch {
    return null;
  }
}

export async function searchWikiArticles(
  query: string,
  engine: RecommendationEngine,
  limit = 5,
): Promise<WikiArticle[]> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query,
      )}&srlimit=${limit}&format=json&origin=*`,
    );
    const data = (await res.json()) as WikiSearchResponse;
    const titles = (data.query?.search || []).map((r) => r.title);
    const summaries = await Promise.all(
      titles.map(async (title): Promise<WikiArticle | null> => {
        try {
          const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
          const d = (await r.json()) as WikiSummary;
          if (!d.title || !d.pageid) return null;
          if (engine.hasSeen(d.pageid, d.title)) return null;
          return toArticle(d, 'recommended');
        } catch {
          return null;
        }
      }),
    );
    return summaries.filter((a): a is WikiArticle => a !== null);
  } catch {
    return [];
  }
}

export async function fetchLinkedArticles(
  title: string,
  engine: RecommendationEngine,
  limit = 3,
): Promise<WikiArticle[]> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
        title,
      )}&prop=links&pllimit=${limit * 3}&plnamespace=0&format=json&origin=*`,
    );
    const data = (await res.json()) as WikiLinksResponse;
    const pages = Object.values(data.query?.pages || {});
    const links = pages[0]?.links || [];
    const shuffled = [...links].sort(() => Math.random() - 0.5).slice(0, limit);
    const summaries = await Promise.all(
      shuffled.map(async (link): Promise<WikiArticle | null> => {
        try {
          const r = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(link.title)}`,
          );
          const d = (await r.json()) as WikiSummary;
          if (!d.title || !d.pageid) return null;
          if (engine.hasSeen(d.pageid, d.title)) return null;
          if (d.type === 'disambiguation') return null;
          return toArticle(d, 'adjacent');
        } catch {
          return null;
        }
      }),
    );
    return summaries.filter((a): a is WikiArticle => a !== null);
  } catch {
    return [];
  }
}

/**
 * Loads a batch of articles using the recommendation engine: mostly related
 * content once the user has liked a few things, with random articles mixed
 * in for discovery. Mutates `engine.seenIds`/`seenTitles` as a side effect.
 */
export async function loadSmartArticles(engine: RecommendationEngine, count = 8): Promise<WikiArticle[]> {
  const topInterests = engine.getTopInterests(3);
  const hasInterests = topInterests.length > 0 && engine.likedTitles.length > 0;

  let articles: WikiArticle[] = [];

  if (hasInterests) {
    const relatedCount = Math.ceil(count * 0.6);
    const randomCount = count - relatedCount;

    const searchCount = Math.ceil(relatedCount * 0.55);
    const adjacentCount = relatedCount - searchCount;

    const queries = engine.getSearchQueries();
    const searchQuery = queries[Math.floor(Math.random() * queries.length)];

    const recentLiked = engine.likedTitles.slice(-5);
    const adjacentSeed = recentLiked[Math.floor(Math.random() * recentLiked.length)];

    const [searchResults, adjacentResults, randomResults] = await Promise.all([
      searchWikiArticles(searchQuery, engine, searchCount + 5),
      fetchLinkedArticles(adjacentSeed, engine, adjacentCount + 4),
      Promise.all(Array.from({ length: randomCount + 6 }, () => fetchRandomArticle(engine))),
    ]);

    const related = [...searchResults, ...adjacentResults].filter(isQualityArticle);
    const randoms = randomResults.filter(isQualityArticle);

    related.sort((a, b) => engine.scoreArticle(b) - engine.scoreArticle(a));

    // Interleave: 2 related -> 1 random -> 2 related -> 1 random ...
    let ri = 0;
    let di = 0;
    let streak = 0;
    for (let i = 0; i < count + 4 && articles.length < count; i++) {
      if (streak >= 2 && di < randoms.length) {
        articles.push(randoms[di++]);
        streak = 0;
      } else if (ri < related.length) {
        articles.push(related[ri++]);
        streak++;
      } else if (di < randoms.length) {
        articles.push(randoms[di++]);
        streak = 0;
      }
    }
  }

  if (articles.length < count) {
    const fillCount = count - articles.length;
    const extra = await Promise.all(Array.from({ length: fillCount + 6 }, () => fetchRandomArticle(engine)));
    const valid = extra.filter(isQualityArticle);
    valid.sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0));
    articles.push(...valid.slice(0, fillCount));
  }

  // Deduplicate within this batch and mark seen immediately.
  const final: WikiArticle[] = [];
  const batchIds = new Set<number>();
  for (const a of articles) {
    if (!a || !a.id) continue;
    if (batchIds.has(a.id) || engine.hasSeen(a.id, a.title)) continue;
    batchIds.add(a.id);
    engine.markSeen(a.id, a.title);
    final.push(a);
    if (final.length >= count) break;
  }

  return final;
}

/** Fetches image attribution for every article missing it. Returns only the ones that got enriched. */
export async function enrichAttributions(articles: WikiArticle[]): Promise<Map<number, ImageAttribution>> {
  const withImages = articles.filter((a) => a.image && !a.attribution);
  const enriched = new Map<number, ImageAttribution>();
  if (withImages.length === 0) return enriched;
  await Promise.all(
    withImages.map(async (article) => {
      const attr = await fetchImageAttribution(article.image as string);
      if (attr) enriched.set(article.id, attr);
    }),
  );
  return enriched;
}
