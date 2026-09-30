/** Web: the session lives in an httpOnly cookie set by POST /session; no token is held in JS. */
export async function getToken(): Promise<string | null> {
  return null;
}

export async function setToken(_token: string): Promise<void> {}

export async function clearToken(): Promise<void> {}
