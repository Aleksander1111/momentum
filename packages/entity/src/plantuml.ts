import type { DiagramRenderer } from './card.ts';

/** House style: dark on transparent, so the app's diagram backdrop shows through; `[Name]` is a plain box */
const STYLE = `<style>
root {
  FontName Calibri
  FontColor #2F3E46
  LineColor #2F3E46
  LineThickness 1
  BackGroundColor #FFFFFF
}
document { BackGroundColor transparent }
</style>
skinparam componentStyle rectangle`;

/** The source with the house style after its @start line; a source without one is wrapped in @startuml/@enduml */
export function styled(source: string): string {
  const lines = source.trim().split(/\r?\n/);
  if (!/^@start\w+/.test(lines[0] ?? '')) return `@startuml\n${STYLE}\n${lines.join('\n')}\n@enduml\n`;
  return `${lines[0]}\n${STYLE}\n${lines.slice(1).join('\n')}\n`;
}

/**
 * PlantUML rendered to SVG by the PlantUML server running on this machine (Docker, port 8080).
 * Labels are SVG text, so react-native-svg can draw them on mobile. A diagram that does not render is left empty.
 */
export function createDiagramRenderer(url = process.env.MOMENTUM_PLANTUML_URL ?? 'http://localhost:8080'): DiagramRenderer {
  const one = async (source: string): Promise<string> => {
    try {
      const res = await fetch(`${url}/svg`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: styled(source),
        signal: AbortSignal.timeout(30_000),
      });
      return res.ok ? await res.text() : '';
    } catch {
      return '';
    }
  };
  return (sources) => Promise.all(sources.map(one));
}
