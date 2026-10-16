export function sessionReturn(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return "/dashboard";
  const path = value.split(/[?#]/)[0];
  return /^\/(?:api|login|register|session-refresh)(?:\/|$)/.test(path) ? "/dashboard" : value;
}
