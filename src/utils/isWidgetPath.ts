/**
 * Matches the iframe-embeddable widget route, tolerating trailing slashes
 * (`/widget`, `/widget/`) so client-side checks agree with the server-side
 * trailing-slash normalization in vercel.json.
 */
export function isWidgetPath(pathname: string): boolean {
  return /^\/widget\/*$/.test(pathname)
}
