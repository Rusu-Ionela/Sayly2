import { validateRegisterPassword } from "@/features/auth/validation";

export type PasswordFields = { current: string; next: string; confirm: string };

export type PasswordFormState = {
  /** Rule the new password breaks (shown once the user typed something). */
  nextError?: string;
  /** "Passwords do not match" once the confirmation is being typed. */
  confirmError?: string;
  /** Both new-password fields filled in and identical. */
  matches: boolean;
  canSubmit: boolean;
};

/** Live validation for the change-password form, shown under each field as the user types. */
export function passwordFormState(values: PasswordFields): PasswordFormState {
  const nextError = values.next ? validateRegisterPassword(values.next) : undefined;
  const matches = Boolean(values.confirm) && values.next === values.confirm;
  const confirmError = values.confirm && !matches ? "Passwords do not match" : undefined;

  return {
    nextError,
    confirmError,
    matches,
    canSubmit: Boolean(values.current && values.next) && !nextError && matches,
  };
}
