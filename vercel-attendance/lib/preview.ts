/** Local preview only. Production never skips sign-in. */
export function previewMode() {
  return process.env.NODE_ENV !== "production" && (process.env.ATTENDANCE_PREVIEW || "").trim() === "1";
}
