import { Fragment, type ReactNode } from 'react';
import { Linking, Text, View } from 'react-native';
import type { Block, Card, Inline } from '@momentum/contract';
import { C, F } from './theme';
import { H, T } from './Text';
import { Diagram } from './Diagram';
import { lastSegment } from '../lib/format';

function plain(c: Inline[]): string {
  return c
    .map((i) => ('v' in i ? i.v : 'c' in i ? plain(i.c) : ''))
    .join('')
    .trim();
}

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
      case 'link':
        return (
          <Text
            key={k}
            style={{ color: C.accent, textDecorationLine: 'underline' }}
            onPress={() => void Linking.openURL(i.href)}
          >
            <Inlines c={i.c} />
          </Text>
        );
      case 'br':
        return <Fragment key={k}>{'\n'}</Fragment>;
    }
  });
}

function cellWeights(head: Inline[][], rows: Inline[][][]): number[] {
  const n = Math.max(head.length, ...rows.map((r) => r.length));
  return Array.from({ length: n }, (_, col) =>
    Math.max(4, plain(head[col] ?? []).length, ...rows.map((r) => plain(r[col] ?? []).length)),
  );
}

function Table({ head, rows }: { head: Inline[][]; rows: Inline[][][] }) {
  const weights = cellWeights(head, rows);
  const cell = (c: Inline[] | undefined, col: number, header: boolean, last: boolean) => (
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
      <T style={{ fontSize: 13, fontWeight: header ? '700' : '400' }}>
        <Inlines c={c ?? []} />
      </T>
    </View>
  );
  const line = (cells: Inline[][], header: boolean, key: number) => (
    <View key={key} style={{ flexDirection: 'row', borderTopWidth: key === 0 ? 0 : 1, borderColor: C.line }}>
      {weights.map((_, col) => cell(cells[col], col, header, col === weights.length - 1))}
    </View>
  );
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, marginTop: 6, marginBottom: 14 }}>
      {head.length ? line(head, true, 0) : null}
      {rows.map((r, i) => line(r, false, head.length ? i + 1 : i))}
    </View>
  );
}

function Blocks({ blocks, inList }: { blocks: Block[]; inList?: boolean }): ReactNode {
  return blocks.map((b, k) => {
    switch (b.t) {
      case 'p':
        return inList ? (
          <T key={k} style={{ fontSize: 14.5, lineHeight: 21 }}>
            <Inlines c={b.c} />
          </T>
        ) : (
          <T key={k} style={{ color: C.muted, fontSize: 15, lineHeight: 21, marginBottom: 10 }}>
            <Inlines c={b.c} />
          </T>
        );
      case 'h':
        return (
          <H key={k} style={{ fontSize: b.depth <= 1 ? 20 : b.depth === 2 ? 18 : 16, marginTop: 4, marginBottom: 8 }}>
            <Inlines c={b.c} />
          </H>
        );
      case 'list':
        return (
          <View key={k} style={{ marginBottom: inList ? 0 : 14 }}>
            {b.items.map((item, n) => (
              <View key={n} style={{ flexDirection: 'row', marginVertical: 2 }}>
                <T style={{ width: 18, fontSize: 14.5, lineHeight: 21 }}>{b.ordered ? `${n + 1}.` : '•'}</T>
                <View style={{ flex: 1 }}>
                  <Blocks blocks={item} inList />
                </View>
              </View>
            ))}
          </View>
        );
      case 'table':
        return <Table key={k} head={b.head} rows={b.rows} />;
      case 'code':
        return (
          <View key={k} style={{ backgroundColor: C.card, borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <T style={{ fontFamily: F.mono, fontSize: 13 }}>{b.v}</T>
          </View>
        );
      case 'quote':
        return (
          <View key={k} style={{ borderLeftWidth: 3, borderLeftColor: C.line, paddingLeft: 12, marginBottom: 10 }}>
            <Blocks blocks={b.c} inList={inList} />
          </View>
        );
      case 'diagram':
        return <Diagram key={k} svg={b.svg} />;
      case 'hr':
        return <View key={k} style={{ height: 1, backgroundColor: C.line, marginVertical: 10 }} />;
    }
  });
}

/** Card heading (`TYPE · WORKSPACE`, serif title) followed by the card blocks. */
export function CardView({
  type,
  workspace,
  title,
  card,
}: {
  type: string;
  workspace: string;
  title: string;
  card: Card;
}) {
  // The title is shown once; a leading heading repeating it is dropped.
  const first = card[0];
  const blocks = first && first.t === 'h' && plain(first.c) === title.trim() ? card.slice(1) : card;
  return (
    <View>
      <T style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.accent, fontWeight: '700' }}>
        {`${lastSegment(type)} · ${workspace}`}
      </T>
      <H style={{ fontSize: 24, lineHeight: 28, marginTop: 8, marginBottom: 10 }}>{title}</H>
      <Blocks blocks={blocks} />
    </View>
  );
}
