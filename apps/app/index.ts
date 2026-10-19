// `@expo/metro-runtime` first, so Fast Refresh works on the web
import '@expo/metro-runtime';
import 'expo-router/build/fast-refresh';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { App } from './src/App';

// The entry registers the root and nothing more
renderRootComponent(App);
