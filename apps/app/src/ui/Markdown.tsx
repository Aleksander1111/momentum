import type { ReactNode } from 'react';
import { Linking, Text, View, type TextStyle } from 'react-native';
import { entityLinkTarget } from '@momentum/contract';
import { C, F } from './theme';
import { T } from './Text';
import { EntityLink, useLinksWorkspace } from './EntityRef';

type Part = { kind: 'p'; text: string } | { kind: 'list'; ordered: boolean; items: string[] };

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;

function parse(md: string): Part[] {
  const parts: Part[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) parts.push({ kind: 'p', text: para.join('\n') });
    para = [];
  };
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
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
    } else if (m[5]) out.push(<Text key={k} style={{ fontWeight: '700' }}>{tok.slice(2, -2)}</Text>);
    else out.push(<Text key={k} style={{ fontStyle: 'italic' }}>{tok.slice(1, -1)}</Text>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Assistant message markdown: paragraphs, bullet and numbered lists, links, inline code and emphasis. */
export function Markdown({ text, style }: { text: string; style: TextStyle }) {
  const parts = parse(text);
  const entities = !!useLinksWorkspace();
  return (
    <View>
      {parts.map((p, i) =>
        p.kind === 'p' ? (
          <T key={i} style={[style, parts[i - 1]?.kind === 'p' ? { marginTop: 6 } : null]}>
            {inline(p.text, entities)}
          </T>
        ) : (
          <View key={i} style={{ marginTop: 6 }}>
            {p.items.map((item, n) => (
              <View key={n} style={{ flexDirection: 'row' }}>
                <T style={[style, { width: 18 }]}>{p.ordered ? `${n + 1}.` : '•'}</T>
                <T style={[style, { flex: 1 }]}>{inline(item, entities)}</T>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}
