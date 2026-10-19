import { ExpoRoot } from 'expo-router';
import { fromFile } from './lib/snapshot';

/**
 * The root of the app: the routes under `app`. An export opened from its own file has no page path to start from, so
 * it starts on the Explorer. Kept apart from the entry, as Expo Router asks, so Fast Refresh follows the routes.
 */
export function App() {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} location={fromFile ? '/explorer' : undefined} />;
}
