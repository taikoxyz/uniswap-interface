/**
 * Matches the iframe-embeddable widget route: `/widget`, plus `/widget/` to agree with the
 * server-side trailing-slash normalization in vercel.json (which 308-redirects it to `/widget`).
 * Deliberately NOT looser than that: the widget must only render on paths covered by the
 * `frame-ancestors` header in vercel.json, which matches `/widget` exactly — a multi-slash
 * variant like `/widget//` would render without the framing allowlist.
 */
export function isWidgetPath(pathname: string): boolean {
  return /^\/widget\/?$/.test(pathname)
}
