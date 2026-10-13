import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import type { Attachment } from '@momentum/contract';
import { api } from '../lib/api';
import { chatFiles, fileSize, type PendingFile } from '../lib/attachments';
import { getToken } from '../lib/token';
import { C, F } from './theme';
import { Icon } from './icons';
import { T } from './Text';

/** A file waiting in the composer: its thumbnail or glyph, name, and size, upload or why it was refused; × takes it out */
export function PendingFileChip({ file }: { file: PendingFile }) {
  const state = file.error ?? (file.attachment ? fileSize(file.size) : 'Uploading…');
  return (
    <View
      accessibilityLabel={`Attached ${file.name}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        maxWidth: '100%',
        backgroundColor: C.card,
        borderRadius: 8,
        borderWidth: file.error ? 1 : 0,
        borderColor: C.no,
        padding: 4,
      }}
    >
      {file.preview ? (
        <Image source={{ uri: file.preview }} style={{ width: 28, height: 28, borderRadius: 5 }} />
      ) : (
        <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="file" size={18} color={C.muted} />
        </View>
      )}
      <View style={{ flexShrink: 1 }}>
        <T numberOfLines={1} style={{ fontSize: 12.5, color: C.ink }}>
          {file.name}
        </T>
        <T numberOfLines={1} style={{ fontSize: 11.5, color: file.error ? C.no : C.muted }}>
          {state}
        </T>
      </View>
      <Pressable onPress={() => chatFiles.remove(file.key)} accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} hitSlop={8}>
        <T style={{ fontSize: 16, lineHeight: 18, color: C.muted, fontFamily: F.body, paddingHorizontal: 4 }}>×</T>
      </Pressable>
    </View>
  );
}

/** Natively the image is fetched with the session token; on the web the cookie goes with it */
function useSource(uri: string) {
  const [token, setToken] = useState<string | null | undefined>(Platform.OS === 'web' ? null : undefined);
  useEffect(() => {
    if (Platform.OS !== 'web') void getToken().then(setToken);
  }, []);
  if (token === undefined) return null;
  return token ? { uri, headers: { Authorization: `Bearer ${token}` } } : { uri };
}

/** Opens the file in a tab of its own; natively it shows only as an image */
const open = (uri: string) => {
  if (Platform.OS === 'web') window.open(uri, '_blank', 'noopener');
};

/** A file a message carried, on the user's bubble: an image as a picture, any other file as its name and size */
export function MessageAttachment({ workspace, attachment }: { workspace: string; attachment: Attachment }) {
  const uri = api.attachmentUrl(workspace, attachment.id);
  const source = useSource(uri);
  const image = /^image\/(png|jpeg|gif|webp)$/.test(attachment.type);
  if (image && source) {
    return (
      <Pressable onPress={() => open(uri)} accessibilityRole="link" accessibilityLabel={attachment.name}>
        <Image source={source} resizeMode="cover" style={{ width: 180, height: 120, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.14)' }} />
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={() => open(uri)}
      accessibilityRole="link"
      accessibilityLabel={attachment.name}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', backgroundColor: 'rgba(255,255,255,.14)', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 }}
    >
      <Icon name="file" size={14} color={C.surface} />
      <T numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, color: C.surface }}>
        {attachment.name}
        <T style={{ fontSize: 12.5, color: C.surface, opacity: 0.7 }}>{`  ${fileSize(attachment.size)}`}</T>
      </T>
    </Pressable>
  );
}
