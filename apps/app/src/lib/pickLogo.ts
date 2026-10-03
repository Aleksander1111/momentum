import * as ImagePicker from 'expo-image-picker';

const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Native: an image from the photo library as a data URL; null when the user cancels */
export async function pickLogo(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], base64: true, quality: 0.8 });
  const a = r.canceled ? null : r.assets[0];
  if (!a?.base64) return null;
  const type = a.mimeType && TYPES.includes(a.mimeType) ? a.mimeType : 'image/jpeg';
  return `data:${type};base64,${a.base64}`;
}
