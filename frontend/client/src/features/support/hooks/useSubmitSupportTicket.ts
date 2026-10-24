import { useMutation } from "@tanstack/react-query";

import { isApiError } from "@/lib/api/errors";

import { createSupportTicket } from "../api/supportApi";
import { SUPPORT_EMAIL } from "../model/supportLinks";

/** Sends a contact message, feature request or bug report. */
export function useSubmitSupportTicket() {
  return useMutation({ mutationFn: createSupportTicket });
}

export function supportErrorMessage(error: unknown) {
  if (isApiError(error) && error.isRateLimited) {
    return "You've sent a lot of messages recently. Please try again in an hour.";
  }
  if (isApiError(error) && error.isValidation) {
    return error.message || "Please check the form and try again.";
  }
  return `Check your connection and try again. Your text is still here.\n\nYou can also email us at ${SUPPORT_EMAIL}.`;
}
