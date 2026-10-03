import { Platform } from 'react-native';

/**
 * Web only: opened with ?embed, the app shows its screen without the tabs and opens nothing from it, so a page can
 * hold it beside another one: the test observer shows the timeline next to the app it drives
 */
export const embedded = Platform.OS === 'web' && typeof location !== 'undefined' && new URLSearchParams(location.search).has('embed');
