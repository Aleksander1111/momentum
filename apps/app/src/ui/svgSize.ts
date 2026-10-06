/** Intrinsic width and aspect ratio of a server-rendered SVG (PlantUML sets viewBox and width/height). */
export function svgSize(svg: string): { width: number; ratio: number } {
  const open = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? '';
  const vb = /viewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(open);
  const vw = vb ? Number(vb[3]) : NaN;
  const vh = vb ? Number(vb[4]) : NaN;
  const maxW = /max-width:\s*([\d.]+)px/i.exec(open);
  const attrW = /\swidth\s*=\s*["']([\d.]+)(px)?["']/i.exec(open);
  const attrH = /\sheight\s*=\s*["']([\d.]+)(px)?["']/i.exec(open);
  const width = maxW ? Number(maxW[1]) : attrW ? Number(attrW[1]) : vw;
  const ratio = vw > 0 && vh > 0 ? vw / vh : attrW && attrH ? Number(attrW[1]) / Number(attrH[1]) : 2;
  return { width: Number.isFinite(width) && width > 0 ? width : 320, ratio };
}

/**
 * PlantUML sizes each label for the font it measured with and stretches the text to that length; drawn in another
 * font, a label spreads letter by letter. Without the lengths every label keeps its font's own spacing.
 */
export const naturalText = (svg: string) => svg.replace(/\s(?:textLength|lengthAdjust)="[^"]*"/g, '');
