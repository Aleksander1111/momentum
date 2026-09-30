import type { ReactNode } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import { F } from './theme';
import { T } from './Text';

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

/** Inline code, bold and italics. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = out.length;
    if (m[1]) out.push(<Text key={k} style={{ fontFamily: F.mono }}>{tok.slice(1, -1)}</Text>);
    else if (m[2]) out.push(<Text key={k} style={{ fontWeight: '700' }}>{tok.slice(2, -2)}</Text>);
    else out.push(<Text key={k} style={{ fontStyle: 'italic' }}>{tok.slice(1, -1)}</Text>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Assistant message markdown: paragraphs, bullet and numbered lists, inline code and emphasis. */
export function Markdown({ text, style }: { text: string; style: TextStyle }) {
  const parts = parse(text);
  return (
    <View>
      {parts.map((p, i) =>
        p.kind === 'p' ? (
          <T key={i} style={[style, parts[i - 1]?.kind === 'p' ? { marginTop: 6 } : null]}>
            {inline(p.text)}
          </T>
        ) : (
          <View key={i} style={{ marginTop: 6 }}>
            {p.items.map((item, n) => (
              <View key={n} style={{ flexDirection: 'row' }}>
                <T style={[style, { width: 18 }]}>{p.ordered ? `${n + 1}.` : '•'}</T>
                <T style={[style, { flex: 1 }]}>{inline(item)}</T>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}
