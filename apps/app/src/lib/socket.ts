import { Platform } from 'react-native';
import { getToken } from './token';

/** This app on the voice sockets: the harness keeps its target and gives it the floor when it streams */
export const client = Math.random().toString(36).slice(2, 10);

/** The socket URL on the API's origin: same origin on the web, the mesh address on native */
export function socketUrl(path: string): string {
  const base = Platform.OS === 'web' ? `${location.protocol}//${location.host}` : (process.env.EXPO_PUBLIC_API_URL ?? '');
  return `${base.replace(/^http/, 'ws')}${path}${path.includes('?') ? '&' : '?'}client=${client}`;
}

/** Native sends the session as a bearer header; the web sends its cookie */
export async function openSocket(path: string): Promise<WebSocket> {
  const token = await getToken();
  const Socket = WebSocket as unknown as new (url: string, protocols?: string[] | null, options?: object) => WebSocket;
  return token ? new Socket(socketUrl(path), null, { headers: { Authorization: `Bearer ${token}` } }) : new WebSocket(socketUrl(path));
}

