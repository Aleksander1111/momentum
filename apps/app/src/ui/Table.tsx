import { useState, type ReactNode } from 'react';
import { Platform, ScrollView, View, type ViewStyle } from 'react-native';
import { C, F } from './theme';

const SIZE = 13;
const PAD = 8;

let canvas: CanvasRenderingContext2D | null | undefined;
/** The width a run of text takes on one line: measured on the web, estimated elsewhere */
function run(text: string, bold: boolean, mono: boolean): number {
  if (Platform.OS === 'web' && canvas === undefined) canvas = document.createElement('canvas').getContext('2d');
  if (!canvas) return text.length * SIZE * (mono ? 0.62 : bold ? 0.6 : 0.55);
  canvas.font = `${bold ? '700 ' : ''}${SIZE}px ${mono ? F.mono : F.body}`;
  return canvas.measureText(text).width;
}

/** The width of a cell's text, its `code` in the monospace font it shows in */
function width(text: string, bold: boolean): number {
  return text.split('`').reduce((sum, part, i) => sum + run(part, bold, i % 2 === 1), 0);
}

/** A cell's words, each opening with a backtick when it starts inside code, so it is measured in the right font */
function words(text: string): string[] {
  const out: string[] = [];
  let mono = false;
  for (const w of text.split(/\s+/)) {
    out.push(`${mono ? '`' : ''}${w}`);
    if ((w.split('`').length - 1) % 2 === 1) mono = !mono;
  }
  return out;
}

/**
 * Column widths for the table's texts in `room`: each column at least as wide as its longest word, so no word breaks,
 * and the rest of the room shared by how much more each needs to fit on one line. When the words alone are wider than
 * the room, the columns keep their words' widths and the table is wider than the room.
 */
export function columnWidths(texts: string[][], room: number, header: boolean): number[] {
  const n = Math.max(0, ...texts.map((r) => r.length));
  const cols = Array.from({ length: n }, (_, c) => {
    const cells = texts.map((r, i) => ({ text: r[c] ?? '', bold: header && i === 0 }));
    const word = Math.max(...cells.flatMap((x) => words(x.text).map((w) => width(w, x.bold))), 0);
    const line = Math.max(...cells.map((x) => width(x.text, x.bold)), 0);
    return { min: Math.ceil(word) + 2 * PAD + 1, full: Math.ceil(line) + 2 * PAD + 1 };
  });
  const min = cols.reduce((s, c) => s + c.min, 0);
  const full = cols.reduce((s, c) => s + c.full, 0);
  if (min >= room) return cols.map((c) => c.min);
  if (full <= room) return cols.map((c) => c.full + ((room - full) * c.full) / full);
  const want = full - min;
  return cols.map((c) => c.min + ((room - min) * (c.full - c.min)) / want);
}

/**
 * A table whose columns fit their content: words never break, long text wraps in the columns that have it. Wider than
 * the screen, it scrolls sideways, unless `fit` keeps it in the width (a card that swipes cannot also scroll sideways).
 */
export function Table({
  texts,
  cell,
  header,
  fit,
  rowStyle,
  style,
}: {
  /** Each cell's text, its code between backticks, the header row first when there is one: what widths are measured on */
  texts: string[][];
  cell: (row: number, col: number) => ReactNode;
  header: boolean;
  fit?: boolean;
  rowStyle?: (row: number) => ViewStyle | undefined;
  style?: ViewStyle;
}) {
  const [room, setRoom] = useState(0);
  const widths = room ? columnWidths(texts, room - 2, header) : [];
  const total = widths.reduce((s, w) => s + w, 0);
  const scale = fit && total > room - 2 ? (room - 2) / total : 1;
  const grid = (
    <View style={{ borderWidth: 1, borderColor: C.line, alignSelf: 'flex-start' }}>
      {texts.map((r, i) => (
        <View
          key={i}
          style={[{ flexDirection: 'row', borderTopWidth: i === 0 ? 0 : 1, borderColor: C.line, backgroundColor: header && i === 0 ? C.card : undefined }, rowStyle?.(i)]}
        >
          {widths.map((w, c) => (
            <View
              key={c}
              style={{ width: w * scale, paddingVertical: 6, paddingHorizontal: PAD, borderRightWidth: c === widths.length - 1 ? 0 : 1, borderColor: C.line }}
            >
              {cell(i, c)}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
  return (
    <View onLayout={(e) => setRoom(Math.floor(e.nativeEvent.layout.width))} style={[{ marginTop: 6, marginBottom: 14 }, style]}>
      {!room ? null : fit || total <= room - 2 ? (
        grid
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          {grid}
        </ScrollView>
      )}
    </View>
  );
}

export const TABLE_TEXT = { fontSize: SIZE, lineHeight: 18 };
