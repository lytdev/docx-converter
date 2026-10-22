export function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
/** Restrict URL schemes, control characters and protocol-relative URLs. Never fetch package relationships. */
export function safeUrl(url: string, image = false): string | undefined {
  const s = url.trim();
  if (!s || /[\u0000-\u0020\u007f\\]/.test(s) || s.startsWith('//')) return undefined;
  if (image && /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (!image && (/^mailto:/i.test(s) || /^#[^<>]*$/.test(s))) return s;
  if (!/^[^/?#]*:/.test(s) && !s.startsWith('data:')) return s;
  return undefined;
}
