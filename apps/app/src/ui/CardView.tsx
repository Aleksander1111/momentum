import { Fragment, type ReactNode } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { entityLinkTarget, type Block, type Card, type CardDiff, type ContextItem, type Inline, type Mark } from '@momentum/contract';
import { C, F } from './theme';
import { H, T } from './Text';
import { Diagram } from './Diagram';
import { DiagramDiff, SpanText } from './DiagramDiff';
import { TypePill } from './domains';
import { EntityLink, EntityLinks } from './EntityRef';
import { ProjectLogo } from './ProjectLogo';
import { SelectionMenu } from './SelectionMenu';
import { SelectionScope } from './SelectionScope';
import { chatContext } from '../lib/context';
import { pathSegments } from '../lib/format';

/** Native texts are selectable for the selection menu; on the web the selection scope sets user-select */
const SELECTABLE = Platform.OS === 'web' ? {} : { selectable: true };

/** Text as it reads now: removed runs left out */
function plain(c: Inline[]): string {
  return c
    .map((i) => (i.t === 'del' ? '' : 'v' in i ? i.v : 'c' in i ? plain(i.c) : ''))
    .join('')
    .trim();
}

const markStyle = (m: Mark) =>
  m === 'ins' ? { backgroundColor: C.ins } : { backgroundColor: C.del, textDecorationLine: 'line-through' as const };

function Inlines({ c }: { c: Inline[] }): ReactNode {
  return c.map((i, k) => {
    switch (i.t) {
      case 'text':
        return <Fragment key={k}>{i.v}</Fragment>;
      case 'strong':
        return (
          <Text key={k} style={{ fontWeight: '700' }}>
            <Inlines c={i.c} />
          </Text>
        );
      case 'em':
        return (
          <Text key={k} style={{ fontStyle: 'italic' }}>
            <Inlines c={i.c} />
          </Text>
        );
      case 'code':
        return (
          <Text key={k} style={{ fontFamily: F.mono }}>
            {i.v}
          </Text>
        );
      case 'link': {
        // A link to an entity reads as every entity named in the app does
        const entity = entityLinkTarget(i.href);
        if (entity)
          return (
            <EntityLink key={k} path={entity}>
              <Inlines c={i.c} />
            </EntityLink>
          );
        // Only a link to the web opens, as in chats: a model writes the card, and another scheme could open anything
        if (!/^https?:\/\//i.test(i.href))
          return (
            <Fragment key={k}>
              <Inlines c={i.c} />
            </Fragment>
          );
        return (
          <Text
            key={k}
            style={{ color: C.accent, textDecorationLine: 'underline' }}
            onPress={() => void Linking.openURL(i.href)}
          >
            <Inlines c={i.c} />
          </Text>
        );
      }
      case 'br':
        return <Fragment key={k}>{'\n'}</Fragment>;
      case 'ins':
      case 'del':
        return (
          <Text key={k} style={markStyle(i.t)}>
            <Inlines c={i.c} />
          </Text>
        );
    }
  });
}

/** A whole list item or table row added or removed: its text marked too */
const marked = (c: Inline[], m: Mark | null | undefined): Inline[] => (m ? [{ t: m, c }] : c);

const rowWash = (m: Mark | null | undefined) => (m === 'ins' ? C.insRow : m === 'del' ? C.delRow : undefined);

function cellWeights(head: Inline[][], rows: Inline[][][]): number[] {
  const n = Math.max(head.length, ...rows.map((r) => r.length));
  return Array.from({ length: n }, (_, col) =>
    Math.max(4, plain(head[col] ?? []).length, ...rows.map((r) => plain(r[col] ?? []).length)),
  );
}

function Table({ head, rows, marks }: { head: Inline[][]; rows: Inline[][][]; marks?: (Mark | null)[] }) {
  const weights = cellWeights(head, rows);
  const cell = (c: Inline[] | undefined, col: number, header: boolean, last: boolean, mark: Mark | null) => (
    <View
      key={col}
      style={{
        flex: weights[col],
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRightWidth: last ? 0 : 1,
        borderColor: C.line,
        backgroundColor: header ? C.card : undefined,
      }}
    >
      <T {...SELECTABLE} style={{ fontSize: 13, fontWeight: header ? '700' : '400' }}>
        <Inlines c={marked(c ?? [], mark)} />
      </T>
    </View>
  );
  const line = (cells: Inline[][], header: boolean, key: number, mark: Mark | null) => (
    <View key={key} style={{ flexDirection: 'row', borderTopWidth: key === 0 ? 0 : 1, borderColor: C.line, backgroundColor: rowWash(mark) }}>
      {weights.map((_, col) => cell(cells[col], col, header, col === weights.length - 1, mark))}
    </View>
  );
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, marginTop: 6, marginBottom: 14 }}>
      {head.length ? line(head, true, 0, null) : null}
      {rows.map((r, i) => line(r, false, head.length ? i + 1 : i, marks?.[i] ?? null))}
    </View>
  );
}

function Blocks({
  blocks,
  inList,
  mark,
  onElement,
}: {
  blocks: Block[];
  inList?: boolean;
  /** The list item these blocks make up was added or removed whole */
  mark?: Mark | null;
  onElement?: (element: string) => void;
}): ReactNode {
  return blocks.map((b, k) => {
    switch (b.t) {
      case 'p':
        return inList ? (
          <T key={k} {...SELECTABLE} style={{ fontSize: 14.5, lineHeight: 21 }}>
            <Inlines c={marked(b.c, mark)} />
          </T>
        ) : (
          <T key={k} {...SELECTABLE} style={{ color: C.muted, fontSize: 15, lineHeight: 21, marginBottom: 10 }}>
            <Inlines c={marked(b.c, mark)} />
          </T>
        );
      case 'h':
        return (
          <H key={k} {...SELECTABLE} style={{ fontSize: b.depth <= 1 ? 20 : b.depth === 2 ? 18 : 16, marginTop: 4, marginBottom: 8 }}>
            <Inlines c={marked(b.c, mark)} />
          </H>
        );
      case 'list':
        return (
          <View key={k} style={{ marginBottom: inList ? 0 : 14 }}>
            {b.items.map((item, n) => (
              <View key={n} style={{ flexDirection: 'row', marginVertical: 2, backgroundColor: rowWash(b.marks?.[n]) }}>
                <T style={{ width: 18, fontSize: 14.5, lineHeight: 21 }}>{b.ordered ? `${n + 1}.` : '•'}</T>
                <View style={{ flex: 1 }}>
                  <Blocks blocks={item} inList mark={b.marks?.[n] ?? mark} onElement={onElement} />
                </View>
              </View>
            ))}
          </View>
        );
      case 'table':
        return <Table key={k} head={b.head} rows={b.rows} marks={b.marks} />;
      case 'code':
        return (
          <View key={k} style={{ backgroundColor: C.card, borderRadius: 8, padding: 10, marginBottom: 10 }}>
            {b.diff ? (
              <SpanText spans={b.diff} />
            ) : (
              <T {...SELECTABLE} style={{ fontFamily: F.mono, fontSize: 13 }}>
                {b.v}
              </T>
            )}
          </View>
        );
      case 'quote':
        return (
          <View key={k} style={{ borderLeftWidth: 3, borderLeftColor: C.line, paddingLeft: 12, marginBottom: 10 }}>
            <Blocks blocks={b.c} inList={inList} mark={mark} onElement={onElement} />
          </View>
        );
      case 'diagram':
        return b.before && b.diff ? (
          <DiagramDiff key={k} svg={b.svg} elements={b.elements} before={b.before} diff={b.diff} onAdd={onElement} />
        ) : (
          <Diagram key={k} svg={b.svg} elements={b.elements} onAdd={onElement} />
        );
      case 'hr':
        return <View key={k} style={{ height: 1, backgroundColor: C.line, marginVertical: 10 }} />;
      case 'ins':
      case 'del':
        // A block added or removed whole: tinted, with a bar at its left edge
        return (
          <View
            key={k}
            style={{
              backgroundColor: rowWash(b.t),
              borderLeftWidth: 3,
              borderLeftColor: b.t === 'ins' ? C.ok : C.no,
              paddingLeft: 8,
              paddingTop: 4,
              marginBottom: 10,
              borderRadius: 2,
            }}
          >
            <Blocks blocks={b.c} inList={inList} onElement={onElement} />
          </View>
        );
    }
  });
}

/** The headings each top-level block sits under */
function headingsOf(blocks: Block[]): string[][] {
  const stack: { depth: number; text: string }[] = [];
  return blocks.map((b) => {
    if (b.t !== 'h') return stack.map((s) => s.text);
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= b.depth) stack.pop();
    const under = stack.map((s) => s.text);
    stack.push({ depth: b.depth, text: plain(b.c) });
    return under;
  });
}

/** Opens the explorer on `ws`, with the tree expanded down to `folder` when given. */
function openInExplorer(ws: string, folder?: string) {
  router.navigate({ pathname: '/explorer', params: folder ? { ws, folder } : { ws } });
}

function Crumb({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link">
      {({ hovered }) => (
        <T style={{ fontSize: 13, color: hovered ? C.ink : C.muted, textDecorationLine: hovered ? 'underline' : 'none' }}>
          {label}
        </T>
      )}
    </Pressable>
  );
}

const Sep = () => <T style={{ fontSize: 13, color: C.faint }}>›</T>;

/** Breadcrumb: project logo, type in a pill coloured by its main type, then the folders below the type. */
function Crumbs({ workspace, type, path }: { workspace: string; type: string; path: string }) {
  const typeSegs = type.split('/');
  const segs = pathSegments(path);
  const folders = typeSegs.every((t, i) => segs[i] === t) ? segs.slice(typeSegs.length, -1) : [];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 4, flexShrink: 1 }}>
      <Pressable onPress={() => openInExplorer(workspace)} accessibilityRole="link" accessibilityLabel={workspace}>
        {({ hovered }) => <ProjectLogo name={workspace} size={32} style={{ opacity: hovered ? 0.8 : 1 }} />}
      </Pressable>
      <Sep />
      <TypePill type={type} onPress={() => openInExplorer(workspace, type)} />
      {folders.map((f, i) => (
        <Fragment key={i}>
          <Sep />
          <Crumb label={f} onPress={() => openInExplorer(workspace, [...typeSegs, ...folders.slice(0, i + 1)].join('/'))} />
        </Fragment>
      ))}
    </View>
  );
}

/**
 * Card heading (breadcrumb, `aside` at its right, serif title) followed by the card blocks. A card that changed since the
 * user last verified it shows the diff instead, with the words removed and added. Selected text and picked diagram
 * shapes can be added to the chat's context; `swipe` marks a card the left mouse button swipes.
 */
export function CardView({
  type,
  workspace,
  path,
  title,
  card,
  diff,
  aside,
  swipe,
}: {
  type: string;
  workspace: string;
  path: string;
  title: string;
  card: Card;
  diff?: CardDiff | null;
  aside?: ReactNode;
  swipe?: boolean;
}) {
  const shown = diff?.card ?? card;
  // The title is shown once; a leading heading repeating it is dropped.
  const first = shown[0];
  const lead = first && first.t === 'h' && plain(first.c) === title.trim() ? 1 : 0;
  const blocks = shown.slice(lead);
  const headings = headingsOf(shown).slice(lead);
  const add = (heading: string[], part: { quote: string } | { element: string }) =>
    chatContext.add({ workspace, path, title, heading, ...part } as ContextItem);
  return (
    <EntityLinks workspace={workspace}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          rowGap: 6,
          columnGap: 12,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Crumbs workspace={workspace} type={type} path={path} />
        {diff || aside ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {diff ? (
              <T style={{ fontSize: 13, fontWeight: '700' }}>
                <Text style={{ color: C.no }}>{`−${diff.removed}`}</Text> <Text style={{ color: C.ok }}>{`+${diff.added}`}</Text>
              </T>
            ) : null}
            {aside}
          </View>
        ) : null}
      </View>
      <SelectionScope swipe={swipe} onAdd={(quote, block) => add(block !== null ? (headings[block] ?? []) : [], { quote })}>
        <H {...SELECTABLE} style={{ fontSize: 24, lineHeight: 28, marginTop: 10, marginBottom: 10 }}>
          {diff?.title ? <Inlines c={diff.title} /> : title}
        </H>
        {blocks.map((b, i) => (
          <SelectionMenu
            key={i}
            block={i}
            onAdd={(quote) => {
              const q = quote.replace(/\s+/g, ' ').trim();
              if (q) add(headings[i] ?? [], { quote: q });
            }}
          >
            <Blocks blocks={[b]} onElement={(element) => add(headings[i] ?? [], { element })} />
          </SelectionMenu>
        ))}
      </SelectionScope>
    </EntityLinks>
  );
}
