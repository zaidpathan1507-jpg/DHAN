// Links built by the server carry the server's configured address. If that is still "localhost" (an old seed or a
// missing APP_BASE_URL) a deployed site must open the link on its own address instead.
export function localizeLink(url) {
  if (!url) return url;
  return url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, window.location.origin);
}
