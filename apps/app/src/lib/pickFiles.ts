import * as ImagePicker from 'expo-image-picker';
import type { PickedFile } from './attachments';

/** Native: photos and screenshots from the library, several at once, handed to `onPicked`; a cancel hands nothing */
export function pickFiles(onPicked: (files: PickedFile[]) => void, onError: () => void): void {
  ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, base64: true, quality: 0.9 }).then((r) => {
    if (r.canceled) return;
    const files = r.assets.flatMap((a, i) => {
      if (!a.base64) return [];
      const type = a.mimeType ?? 'image/jpeg';
      const name = a.fileName ?? `image-${i + 1}.${type.split('/')[1] ?? 'jpg'}`;
      return [{ name, data: `data:${type};base64,${a.base64}`, size: a.fileSize ?? Math.floor((a.base64.length * 3) / 4) }];
    });
    if (files.length) onPicked(files);
  }, onError);
}

/** Native fields take no pasted or dropped files */
export function listenForFiles(_field: unknown, _area: unknown, _onFiles: (files: PickedFile[]) => void): () => void {
  return () => {};
}
