import type { ReactNode } from 'react';
import { Linking, ScrollView, Text, View, type TextStyle } from 'react-native';
import { entityLinkTarget } from '@momentum/contract';
import { C, F } from './theme';
import { H, T } from './Text';
import { Table, TABLE_TEXT } from './Table';
import { EntityLink, useLinksWorkspace } from './EntityRef';

type Part =
  | { kind: 'p'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'h'; depth: number; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' };

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;
const RULE = /^\s*(?:-\s*){3,}$|^\s*(?:\*\s*){3,}$|^\s*(?:_\s*){3,}$/;
/** The line under a table's header: | --- | :---: | */
const DIVIDER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** The cells of a table row: "| a | b |" or "a | b"; an escaped \| stays in its cell */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));
}

function parse(md: string): Part[] {
  const parts: Part[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) parts.push({ kind: 'p', text: para.join('\n') });
    para = [];
  };
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i]!.trim().startsWith(fence[1]!); i++) code.push(lines[i]!);
      parts.push({ kind: 'code', text: code.join('\n') });
      continue;
    }
    // A table: a row of cells, then the divider under it
    const next = lines[i + 1] ?? '';
    if (line.includes('|') && next.includes('-') && DIVIDER.test(next)) {
      flush();
      const head = cells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i]!.includes('|') && lines[i]!.trim(); i++) rows.push(cells(lines[i]!));
      i--;
      parts.push({ kind: 'table', head, rows });
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flush();
      parts.push({ kind: 'h', depth: h[1]!.length, text: h[2]! });
      continue;
    }
    if (RULE.test(line)) {
      flush();
      parts.push({ kind: 'hr' });
      continue;
    }
    if (/^\s*>/.test(line)) {
      flush();
      const quoted = [line.replace(/^\s*>\s?/, '')];
      while (i + 1 < lines.length && /^\s*>/.test(lines[i + 1]!)) quoted.push(lines[++i]!.replace(/^\s*>\s?/, ''));
      parts.push({ kind: 'quote', text: quoted.join('\n') });
      continue;
    }
    const b = BULLET.exec(line);
    const n = b ? null : NUMBER.exec(line);
    if (b || n) {
      flush();
      const ordered = !!n;
      const text = (b ?? n)?.[1] ?? '';
      const last = parts[parts.length - 1];
      if (last && last.kind === 'list' && last.ordered === ordered) last.items.push(text);
      else parts.push({ kind: 'list', ordered, items: [text] });
    } else if (!line.trim()) {
      flush();
    } else {
      para.push(line);
    }
  }
  flush();
  return parts;
}

/**
 * Links, inline code, bold and italics. An entity named by its path, as a link [title](Domain/Type/name) or as code
 * `Domain/Type/name`, reads as entities do everywhere in the app once the workspace it belongs to is known.
 */
function inline(text: string, entities: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\[([^\]]+)\]\(\s*<?([^)\s>]+)>?\s*\))|(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = out.length;
    if (m[1]) {
      // A label keeps its own formatting, such as a file named in code: [`docs/a.md`](docs/a.md)
      const label = inline(m[2]!, false);
      const href = m[3]!;
      const entity = entities ? entityLinkTarget(href) : null;
      if (entity)
        out.push(
          <EntityLink key={k} path={entity}>
            {label}
          </EntityLink>,
        );
      else if (/^https?:\/\//.test(href))
        out.push(
          <Text key={k} style={{ color: C.accent, textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(href)}>
            {label}
          </Text>,
        );
      else out.push(<Text key={k}>{label}</Text>);
    } else if (m[4]) {
      const code = tok.slice(1, -1);
      const entity = entities ? entityLinkTarget(code) : null;
      out.push(entity ? <EntityLink key={k} path={entity} /> : <Text key={k} style={{ fontFamily: F.mono }}>{code}</Text>);
    } else if (m[5]) out.push(<Text key={k} style={{ fontWeight: '700' }}>{inline(tok.slice(2, -2), entities)}</Text>);
    else out.push(<Text key={k} style={{ fontStyle: 'italic' }}>{inline(tok.slice(1, -1), entities)}</Text>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A cell's text as it reads, for measuring its width: the markup left out but the backticks around its code */
const readable = (cell: string) => cell.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_]/g, '');

/** Assistant message markdown: paragraphs, headings, lists, tables, code blocks, quotes, links, inline code and emphasis. */
export function Markdown({ text, style }: { text: string; style: TextStyle }) {
  const parts = parse(text);
  const entities = !!useLinksWorkspace();
  const size = style.fontSize ?? 14.5;
  const line = style.lineHeight ?? 20;
  return (
    <View>
      {parts.map((p, i) => {
        // One gap between any two blocks, a wider one above a heading
        const gap = i === 0 ? null : { marginTop: p.kind === 'h' ? 12 : 8 };
        switch (p.kind) {
          case 'p':
            return (
              <T key={i} style={[style, gap]}>
                {inline(p.text, entities)}
              </T>
            );
          case 'h':
            return (
              <H key={i} style={[{ fontSize: p.depth <= 1 ? size + 4 : p.depth === 2 ? size + 2.5 : size + 1, lineHeight: line + 3 }, gap]}>
                {inline(p.text, entities)}
              </H>
            );
          case 'list':
            return (
              <View key={i} style={gap}>
                {p.items.map((item, n) => (
                  <View key={n} style={{ flexDirection: 'row' }}>
                    <T style={[style, { width: 18 }]}>{p.ordered ? `${n + 1}.` : '•'}</T>
                    <T style={[style, { flex: 1 }]}>{inline(item, entities)}</T>
                  </View>
                ))}
              </View>
            );
          case 'code':
            // Code keeps its lines: a long one scrolls sideways
            return (
              <ScrollView key={i} horizontal style={[{ backgroundColor: C.card, borderRadius: 8 }, gap]} contentContainerStyle={{ padding: 10 }}>
                <T style={{ fontFamily: F.mono, fontSize: size - 1.5, lineHeight: line - 1 }}>{p.text}</T>
              </ScrollView>
            );
          case 'table': {
            const all = [p.head, ...p.rows];
            return (
              <Table
                key={i}
                texts={all.map((r) => r.map(readable))}
                header
                style={{ marginTop: gap ? 8 : 0, marginBottom: 0 }}
                cell={(r, c) => <T style={[TABLE_TEXT, { fontWeight: r === 0 ? '700' : '400' }]}>{inline(all[r]?.[c] ?? '', entities)}</T>}
              />
            );
          }
          case 'quote':
            return (
              <View key={i} style={[{ borderLeftWidth: 3, borderLeftColor: C.line, paddingLeft: 10 }, gap]}>
                <T style={[style, { color: C.muted }]}>{inline(p.text, entities)}</T>
              </View>
            );
          case 'hr':
            return <View key={i} style={[{ height: 1, backgroundColor: C.line }, gap]} />;
        }
      })}
    </View>
  );
}

/** Whether the text has a table or a code block: a message holding one takes the full width, so its columns fit */
export const hasWideBlocks = (text: string) => parse(text).some((p) => p.kind === 'table' || p.kind === 'code');
