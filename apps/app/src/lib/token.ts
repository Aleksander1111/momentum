import * as SecureStore from 'expo-secure-store';

const KEY = 'momentum.session';
let cached: string | null | undefined;

/** Native: the session token lives in SecureStore and is sent as a bearer token. */
export async function getToken(): Promise<string | null> {
  if (cached === undefined) cached = await SecureStore.getItemAsync(KEY);
  return cached;
}

export async function setToken(token: string): Promise<void> {
  cached = token;
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  cached = null;
  await SecureStore.deleteItemAsync(KEY);
}
