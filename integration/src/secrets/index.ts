/**
 * Retrieves a secret by key from the environment.
 * NEVER logs the secret value.
 */
export function getSecret(key: string): string {
  const value = process.env[key];
  if (value === undefined) {
    throw new Error(`Secret required but missing: ${key}`);
  }
  return value;
}

/**
 * Checks if a secret exists without returning it.
 */
export function hasSecret(key: string): boolean {
  return process.env[key] !== undefined;
}
