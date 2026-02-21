/**
 * Shared password validation for account security.
 * Used by SettingsDialog and AccountManagementDialog so both enforce the same policy.
 */

export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a new password against security requirements.
 * Returns { valid: true } or { valid: false, error: "message" }.
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    };
  }
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
    return {
      valid: false,
      error:
        "Password must include uppercase, lowercase, number, and special character",
    };
  }
  return { valid: true };
}

/**
 * Validates that password and confirmation match.
 */
export function validatePasswordMatch(
  password: string,
  confirmPassword: string
): PasswordValidationResult {
  if (password !== confirmPassword) {
    return { valid: false, error: "Passwords do not match" };
  }
  return { valid: true };
}
