import { isApiError } from "@/lib/api/errors";

/** User-facing copy for a failed profile load/save. Server validation messages are already readable. */
export function profileErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.isNetwork) {
      return "You're offline. Check your connection — your changes were not saved.";
    }
    if (error.status === 413) {
      return "Your storage is full. Remove some photos from chats and try again.";
    }
    if (error.isRateLimited) {
      return "Too many changes in a row. Please wait a moment and try again.";
    }
    if (error.isValidation && error.message) {
      return error.message;
    }
    if (error.status === 404) {
      return "This profile is no longer available.";
    }
  }
  if (error instanceof TypeError) {
    return "You're offline. Check your connection — your changes were not saved.";
  }
  return "Something went wrong while saving your profile. Please try again.";
}
