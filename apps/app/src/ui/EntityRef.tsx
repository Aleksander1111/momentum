import { createContext, useContext, type ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { TypeNode } from '@momentum/contract';
import { api } from '../lib/api';
import { embedded } from '../lib/embed';
import { pathSegments } from '../lib/format';
import { C, useTheme, useWide } from './theme';
import { T } from './Text';
import { DomainIcon, TypePill, domainColour } from './domains';

/**
 * An entity named anywhere in the app — a card, a chat message, an answer, the references of an entity, an event — reads
 * the same: the glyph of its main type, its title in that type's colour, and a press opens it.
 */

export interface EntityRefItem {
  path: string;
  title?: string | null;
  type?: string | null;
  /** A muted note after the title, such as the relation a reference has */
  note?: string | null;
}

/** "Product/Feature/offline-feed" → its type, "Product/Feature", and a name, "Offline feed" */
export function entityName(path: string): { name: string; type: string } {
  const parts = pathSegments(path);
  const last = (parts.at(-1) ?? path).replace(/[-_]+/g, ' ').trim();
  return { name: last.charAt(0).toUpperCase() + last.slice(1), type: parts.slice(0, 2).join('/') };
}

type Open = ((path: string) => void) | null;

function find(nodes: TypeNode[], path: string): string | null {
  for (const n of nodes) {
    const hit = n.entities.find((e) => e.path === path)?.title ?? find(n.children, path);
    if (hit) return hit;
  }
  return null;
}

/**
 * An entity's title, from the tree of its project the Explorer shows: where an entity is named by its path alone, as in
 * a chat's code or a run's list of what it wrote, it still reads by its title. Null when it is not in the tree.
 */
export function useEntityTitle(workspace: string | null | undefined, path: string, known?: string | null): string | null {
  const { data } = useQuery({ queryKey: ['types', workspace], queryFn: () => api.types(workspace as string), enabled: !!workspace && !known });
  return known || (data ? find(data.types, path) : null);
}

/** Where entity links open: the workspace they belong to and, on a screen that shows entities itself, how it opens one */
interface Links {
  workspace: string | null;
  open?: Open;
}

const LinksContext = createContext<Links>({ workspace: null });

export function EntityLinks({ workspace, open, children }: Links & { children: ReactNode }) {
  const outer = useContext(LinksContext);
  return (
    <LinksContext.Provider value={{ workspace, open: open !== undefined ? open : workspace === outer.workspace ? outer.open : undefined }}>
      {children}
    </LinksContext.Provider>
  );
}

/** How a press on an entity opens it here; null where nothing opens, such as the embedded timeline */
export function useOpenEntity(workspace?: string | null): Open {
  const ctx = useContext(LinksContext);
  const wide = useWide();
  const ws = workspace ?? ctx.workspace;
  if (!ws || embedded) return null;
  if (ctx.open && ws === ctx.workspace) return ctx.open;
  // Wide, the explorer shows the entity beside its tree; narrow, the entity has the screen
  return (path) =>
    wide ? router.navigate({ pathname: '/explorer', params: { ws, path } }) : router.push({ pathname: '/explorer/entity', params: { ws, path } });
}

/** The workspace entity links in this part of the screen belong to */
export const useLinksWorkspace = () => useContext(LinksContext).workspace;

/** One entity as a row: glyph, title in its type's colour, the note muted after it */
export function EntityRef({
  workspace,
  path,
  title,
  type,
  note,
  size = 13.5,
}: EntityRefItem & { workspace?: string | null; size?: number }) {
  const { scheme } = useTheme();
  const open = useOpenEntity(workspace);
  const t = type || entityName(path).type;
  const colour = domainColour(t, scheme);
  const linked = useLinksWorkspace();
  const label = useEntityTitle(workspace ?? linked, path, title) || entityName(path).name;
  const body = (hovered: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <DomainIcon type={t} size={Math.round(size + 1)} color={colour} />
      <T numberOfLines={1} style={{ flexShrink: 1, fontSize: size }}>
        <Text style={{ color: colour, fontWeight: '600', textDecorationLine: hovered ? 'underline' : 'none' }}>{label}</Text>
        {note ? <Text style={{ color: C.muted, fontSize: size - 1.5 }}>{`  ${note}`}</Text> : null}
      </T>
    </View>
  );
  if (!open) return body(false);
  return (
    <Pressable onPress={() => open(path)} accessibilityRole="link" accessibilityLabel={label}>
      {({ hovered }) => body(!!hovered)}
    </Pressable>
  );
}

/** Entities grouped by type, in the order their types first appear: the type's pill, then each entity of it */
export function EntityRefs({ workspace, items, size }: { workspace?: string | null; items: EntityRefItem[]; size?: number }) {
  const groups = new Map<string, EntityRefItem[]>();
  for (const item of items) {
    const type = item.type || entityName(item.path).type;
    groups.set(type, [...(groups.get(type) ?? []), item]);
  }
  return (
    <View style={{ gap: 10 }}>
      {[...groups].map(([type, entities]) => (
        <View key={type} style={{ gap: 4, alignItems: 'flex-start' }}>
          {type ? <TypePill type={type} /> : null}
          <View style={{ paddingLeft: 10, gap: 3, alignSelf: 'stretch' }}>
            {entities.map((e, i) => (
              <EntityRef key={`${e.path}:${e.note ?? ''}:${i}`} workspace={workspace} {...e} size={size} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Inline in running text: the glyph and the label in the type's colour, on a faint wash of it */
export function EntityLink({ path, children, size }: { path: string; children?: ReactNode; size?: number }) {
  const { scheme } = useTheme();
  const ctx = useContext(LinksContext);
  const open = useOpenEntity(ctx.workspace);
  const { type, name: fromPath } = entityName(path);
  // A label given is the link's own; only a path alone is named by the entity's title
  const name = useEntityTitle(ctx.workspace, path, children ? fromPath : null) || fromPath;
  const colour = domainColour(type, scheme);
  const glyph = Math.round((size ?? 14) * 0.95);
  return (
    <Text
      onPress={open ? () => open(path) : undefined}
      accessibilityRole={open ? 'link' : undefined}
      // The path on hover, on the web
      {...(Platform.OS === 'web' ? ({ title: path } as object) : {})}
      style={{ color: colour, fontWeight: '600', backgroundColor: colour + '1a', borderRadius: 4 }}
    >
      <View style={{ paddingLeft: 2, paddingRight: 3, transform: [{ translateY: 2 }] }}>
        <DomainIcon type={type} size={glyph} color={colour} />
      </View>
      {children ?? name}
      {' '}
    </Text>
  );
}
