import {
  EMAIL_MAX_LENGTH,
  emailSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  RESET_CODE_PATTERN,
} from "@sayly/shared";

export type FieldErrors = {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  token?: string;
  challengeId?: string;
};

export type PasswordRule = {
  label: string;
  ok: boolean;
};

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) {
    return "Email is required.";
  }
  if (value.length > EMAIL_MAX_LENGTH) {
    return "Email is too long.";
  }
  // Same check as the server, so an address the app accepts is never rejected there.
  if (!emailSchema.safeParse(value).success) {
    return "Please enter a valid email address.";
  }
  return undefined;
}

function validateLoginPassword(password: string): string | undefined {
  if (!password) {
    return "Password is required.";
  }
  return undefined;
}

export function passwordRules(password: string): PasswordRule[] {
  return PASSWORD_RULES.map((rule) => ({ label: rule.label, ok: rule.test(password) }));
}

export function validateRegisterPassword(password: string): string | undefined {
  if (!password) {
    return "Password is required.";
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return "Password is too long.";
  }
  if (password.includes("\u0000")) {
    return "Password contains invalid characters.";
  }
  if (passwordRules(password).some((rule) => !rule.ok)) {
    return `Use ${PASSWORD_MIN_LENGTH} characters with an uppercase letter, a number, and a symbol.`;
  }
  return undefined;
}

export function validateResetToken(token: string): string | undefined {
  const value = token.trim();
  if (!value) {
    return "Reset code is required.";
  }
  if (!RESET_CODE_PATTERN.test(value)) {
    return "Enter the 8-digit code.";
  }
  return undefined;
}

export function validateLoginForm(input: { email: string; password: string }): FieldErrors {
  return {
    email: validateEmail(input.email),
    password: validateLoginPassword(input.password),
  };
}

export function validateRegisterForm(input: { email: string; password: string }): FieldErrors {
  return {
    email: validateEmail(input.email),
    password: validateRegisterPassword(input.password),
  };
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function mapBackendFields(fields: Record<string, string> | undefined): FieldErrors {
  if (!fields) {
    return {};
  }

  return {
    email: fields.email,
    password: fields.password,
    displayName: fields.displayName,
    token: fields.token ?? fields.code,
    challengeId: fields.challengeId,
  };
}
