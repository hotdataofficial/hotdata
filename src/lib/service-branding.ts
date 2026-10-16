// Public identifiers must not reveal upstream routing or supplier names.
export function hotdataPlanCode(id: string) { return "HD_" + id.replace(/-/g, "").toUpperCase(); }
export function publicServiceError(message: string) {
  return /gsubz|vtpass|datastation|clubkonnect/i.test(message)
    ? "This Hotdata service is temporarily unavailable. Please try again or contact support."
    : message;
}
