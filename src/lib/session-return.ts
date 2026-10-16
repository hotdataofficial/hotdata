export function sessionReturn(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/dashboard";
  const path = value.split(/[?#]/)[0];
  return /^\/(?:api|login|register|session-refresh)(?:\/|$)/.test(path) ? "/dashboard" : value;
}
