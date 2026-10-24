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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) {
    return "Email is required.";
  }
  if (value.length > 254) {
    return "Email is too long.";
  }
  if (!EMAIL_PATTERN.test(value)) {
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
  return [
    { label: "Minimum 8 characters", ok: password.length >= 8 },
    { label: "At least one uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "At least one number", ok: /[0-9]/.test(password) },
    { label: "At least one symbol character", ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function validateRegisterPassword(password: string): string | undefined {
  if (!password) {
    return "Password is required.";
  }
  if (password.length > 128) {
    return "Password is too long.";
  }
  if (password.includes("\u0000")) {
    return "Password contains invalid characters.";
  }
  if (passwordRules(password).some((rule) => !rule.ok)) {
    return "Use 8 characters with an uppercase letter, a number, and a symbol.";
  }
  return undefined;
}

export function validateResetToken(token: string): string | undefined {
  const value = token.trim();
  if (!value) {
    return "Reset code is required.";
  }
  if (!/^\d{8}$/.test(value)) {
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
