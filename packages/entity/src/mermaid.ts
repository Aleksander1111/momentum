import { createMermaidRenderer } from 'mermaid-isomorphic';
import type { DiagramRenderer } from './card.ts';

/**
 * Mermaid rendered to SVG on the server, in the Edge that ships with Windows, driven by Playwright.
 * Labels are SVG text rather than HTML so react-native-svg can draw them on mobile.
 */
export function createDiagramRenderer(channel = process.env.MOMENTUM_BROWSER_CHANNEL ?? 'msedge'): DiagramRenderer {
  const renderer = createMermaidRenderer({ launchOptions: { channel } });
  return async (sources) => {
    const results = await renderer(sources, {
      mermaidConfig: {
        htmlLabels: false,
        flowchart: { htmlLabels: false },
        theme: 'base',
        themeVariables: {
          fontFamily: 'Calibri, Segoe UI, Helvetica, Arial, sans-serif',
          primaryColor: '#FFFFFF',
          primaryBorderColor: '#2F3E46',
          primaryTextColor: '#2F3E46',
          lineColor: '#2F3E46',
        },
      },
    });
    return results.map((r) => (r.status === 'fulfilled' ? r.value.svg : ''));
  };
}
