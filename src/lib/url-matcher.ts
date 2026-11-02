export function normalizeUrl(url: string): string {
  if (!url) return "";
  let clean = url.trim().toLowerCase();
  clean = clean.split("?")[0].split("#")[0];
  if (clean.endsWith("/")) clean = clean.slice(0, -1);
  return clean;
}

export function matchUrls(urlA: string, urlB: string): boolean {
  if (!urlA || !urlB) return false;
  if (urlA.trim() === urlB.trim()) return true;
  const normA = normalizeUrl(urlA);
  const normB = normalizeUrl(urlB);
  if (normA && normB && normA === normB) return true;

  const idMatchA = normA.match(/\/(?:p|posts|reel|share\/p)\/([a-zA-Z0-9_-]+)/);
  const idMatchB = normB.match(/\/(?:p|posts|reel|share\/p)\/([a-zA-Z0-9_-]+)/);
  if (idMatchA && idMatchB && idMatchA[1] === idMatchB[1]) return true;

  return false;
}

export function isUrlInList(targetUrl: string, list?: string[] | null): boolean {
  if (!targetUrl || !targetUrl.trim() || !list || !Array.isArray(list) || list.length === 0) {
    return false;
  }
  return list.some((item) => matchUrls(item, targetUrl));
}
