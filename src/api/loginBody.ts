// El backend espera email o username, no un campo mezclado
export function loginBody(identifier: string, password: string) {
  const value = identifier.trim();
  if (value.includes("@")) {
    return { email: value, password };
  }
  return { username: value, password };
}
