// What frames the app: the backdrop, the headlines beside it, the finger that uses it and the logo
import { AbsoluteFill, Easing } from 'remotion';
import { C, F } from './theme.ts';
import { ramp } from './motion.ts';

export function Backdrop() {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 65% 45%, #FFFFFF 0%, ${C.behind1} 45%, ${C.behind2} 100%)` }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${C.line} 1.2px, transparent 1.2px)`,
          backgroundSize: '28px 28px',
          opacity: 0.55,
          maskImage: 'radial-gradient(ellipse at 65% 50%, black 20%, transparent 75%)',
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * A headline shown from `from` to `to`: its tag, then its words rising one after another; it leaves upwards.
 */
export function Headline({
  frame,
  from,
  to,
  tag,
  color,
  text,
  sub,
}: {
  frame: number;
  from: number;
  to: number;
  tag: string;
  color: string;
  text: string;
  sub?: string;
}) {
  if (frame < from || frame > to) return null;
  const out = ramp(frame, to - 10, 10, Easing.in(Easing.cubic));
  const words = text.split(' ');
  const tagIn = ramp(frame, from, 10, Easing.out(Easing.cubic));
  return (
    <div style={{ position: 'absolute', left: 120, top: 380, width: 700, opacity: 1 - out, transform: `translateY(${-30 * out}px)` }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: F.body,
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: 4,
          color,
          opacity: tagIn,
          transform: `translateX(${-20 * (1 - tagIn)}px)`,
          marginBottom: 22,
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: color }} />
        {tag.toUpperCase()}
      </div>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 84, lineHeight: 1.08, color: C.ink }}>
        {words.map((w, i) => {
          const t = ramp(frame, from + 4 + i * 3, 14, Easing.out(Easing.cubic));
          return (
            <span key={i} style={{ display: 'inline-block', opacity: t, transform: `translateY(${40 * (1 - t)}px)`, marginRight: '0.24em' }}>
              {w}
            </span>
          );
        })}
      </div>
      {sub ? (
        <div
          style={{
            fontFamily: F.body,
            fontSize: 32,
            color: C.muted,
            marginTop: 24,
            opacity: ramp(frame, from + 12 + words.length * 3, 12),
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

/** A finger pressing on the screen: the press shows as a ring */
export function Finger({ x, y, opacity, pressed }: { x: number; y: number; opacity: number; pressed: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: -26,
          top: -26,
          width: 52,
          height: 52,
          borderRadius: 26,
          background: 'rgba(91,91,214,.18)',
          border: '2px solid rgba(91,91,214,.5)',
          transform: `scale(${0.4 + 0.6 * pressed})`,
          opacity: pressed,
        }}
      />
      <svg width={64} height={64} viewBox="0 0 384 512" style={{ position: 'absolute', left: -18, top: -4, filter: 'drop-shadow(0 6px 10px rgba(30,41,59,.3))' }}>
        <path
          fill={C.ink}
          stroke="#fff"
          strokeWidth={22}
          d="M128 40c0-22.1 17.9-40 40-40s40 17.9 40 40V188.2c8.5-7.6 19.7-12.2 32-12.2c20.6 0 38.2 13 45 31.2c8.8-9.3 21.3-15.2 35-15.2c25.3 0 46 19.5 47.9 44.3c8.5-7.7 19.8-12.3 32.1-12.3c26.5 0 48 21.5 48 48v48 16 48c0 70.7-57.3 128-128 128l-16 0H240l-.1 0h-5.2c-5 0-9.9-.3-14.7-1c-55.3-5.6-106.2-34-140-79L8 336c-13.3-17.7-9.7-42.7 8-56s42.7-9.7 56 8l56 74.7V40z"
        />
      </svg>
    </div>
  );
}

/** The momentum logo: the arrow mark and the wordmark (apps/app/src/ui/Logo.tsx) */
const WORD =
  'M36.14-13.56L36.14 0L31.15 0L31.15-11.99Q31.15-15.45 30.17-16.99Q29.20-18.54 26.88-18.54L26.88-18.54Q24.92-18.54 23.56-16.59Q22.19-14.63 22.19-11.90L22.19-11.90L22.19 0L17.19 0L17.19-12.40Q17.19-18.54 12.85-18.54L12.85-18.54Q10.83-18.54 9.53-16.69Q8.23-14.85 8.23-11.90L8.23-11.90L8.23 0L3.24 0L3.24-22L8.23-22L8.23-18.52L8.31-18.52Q10.70-22.52 15.25-22.52L15.25-22.52Q17.53-22.52 19.24-21.26Q20.95-20.00 21.57-17.96L21.57-17.96Q24.02-22.52 28.88-22.52L28.88-22.52Q36.14-22.52 36.14-13.56L36.14-13.56ZM51.47 0.52L51.47 0.52Q46.38 0.52 43.34-2.57Q40.30-5.65 40.30-10.74L40.30-10.74Q40.30-16.29 43.47-19.40Q46.64-22.52 52.01-22.52L52.01-22.52Q57.16-22.52 60.04-19.49Q62.92-16.46 62.92-11.09L62.92-11.09Q62.92-5.82 59.82-2.65Q56.71 0.52 51.47 0.52ZM51.71-18.54L51.71-18.54Q48.79-18.54 47.09-16.50Q45.39-14.46 45.39-10.87L45.39-10.87Q45.39-7.41 47.11-5.42Q48.83-3.44 51.71-3.44L51.71-3.44Q54.65-3.44 56.23-5.39Q57.81-7.35 57.81-10.96L57.81-10.96Q57.81-14.59 56.23-16.56Q54.65-18.54 51.71-18.54ZM100.38-13.56L100.38 0L95.40 0L95.40-11.99Q95.40-15.45 94.42-16.99Q93.45-18.54 91.13-18.54L91.13-18.54Q89.17-18.54 87.81-16.59Q86.44-14.63 86.44-11.90L86.44-11.90L86.44 0L81.44 0L81.44-12.40Q81.44-18.54 77.10-18.54L77.10-18.54Q75.08-18.54 73.78-16.69Q72.48-14.85 72.48-11.90L72.48-11.90L72.48 0L67.49 0L67.49-22L72.48-22L72.48-18.52L72.56-18.52Q74.95-22.52 79.50-22.52L79.50-22.52Q81.78-22.52 83.49-21.26Q85.20-20.00 85.82-17.96L85.82-17.96Q88.27-22.52 93.12-22.52L93.12-22.52Q100.38-22.52 100.38-13.56L100.38-13.56ZM124.59-11.56L124.59-9.65L109.60-9.65Q109.68-6.60 111.48-4.94Q113.27-3.29 116.41-3.29L116.41-3.29Q119.93-3.29 122.87-5.39L122.87-5.39L122.87-1.38Q119.87 0.52 114.92 0.52L114.92 0.52Q110.07 0.52 107.31-2.48Q104.55-5.48 104.55-10.91L104.55-10.91Q104.55-16.05 107.59-19.28Q110.63-22.52 115.14-22.52L115.14-22.52Q119.65-22.52 122.12-19.62Q124.59-16.71 124.59-11.56L124.59-11.56ZM109.60-13.17L119.78-13.17Q119.76-15.86 118.51-17.35Q117.27-18.84 115.07-18.84L115.07-18.84Q112.93-18.84 111.43-17.27Q109.94-15.71 109.60-13.17L109.60-13.17ZM148.43-13.45L148.43 0L143.45 0L143.45-12.40Q143.45-18.56 139.09-18.56L139.09-18.56Q136.81-18.56 135.33-16.85Q133.85-15.15 133.85-12.55L133.85-12.55L133.85 0L128.84 0L128.84-22L133.85-22L133.85-18.35L133.93-18.35Q136.40-22.52 141.06-22.52L141.06-22.52Q144.65-22.52 146.54-20.18Q148.43-17.85 148.43-13.45L148.43-13.45ZM165.62-4.19L165.62-0.24Q164.15 0.49 161.77 0.49L161.77 0.49Q155.37 0.49 155.37-5.65L155.37-5.65L155.37-18.09L151.69-18.09L151.69-22L155.37-22L155.37-27.09L160.35-28.51L160.35-22L165.62-22L165.62-18.09L160.35-18.09L160.35-7.09Q160.35-5.13 161.06-4.30Q161.77-3.46 163.42-3.46L163.42-3.46Q164.69-3.46 165.62-4.19L165.62-4.19ZM188.60-22L188.60 0L183.61 0L183.61-3.48L183.53-3.48Q181.36 0.52 176.78 0.52L176.78 0.52Q168.98 0.52 168.98-8.85L168.98-8.85L168.98-22L173.97-22L173.97-9.37Q173.97-3.44 178.54-3.44L178.54-3.44Q180.76-3.44 182.18-5.07Q183.61-6.70 183.61-9.35L183.61-9.35L183.61-22L188.60-22ZM227.48-13.56L227.48 0L222.49 0L222.49-11.99Q222.49-15.45 221.52-16.99Q220.54-18.54 218.22-18.54L218.22-18.54Q216.26-18.54 214.90-16.59Q213.54-14.63 213.54-11.90L213.54-11.90L213.54 0L208.53 0L208.53-12.40Q208.53-18.54 204.19-18.54L204.19-18.54Q202.17-18.54 200.87-16.69Q199.57-14.85 199.57-11.90L199.57-11.90L199.57 0L194.59 0L194.59-22L199.57-22L199.57-18.52L199.66-18.52Q202.04-22.52 206.60-22.52L206.60-22.52Q208.87-22.52 210.58-21.26Q212.29-20.00 212.91-17.96L212.91-17.96Q215.36-22.52 220.22-22.52L220.22-22.52Q227.48-22.52 227.48-13.56L227.48-13.56Z';
const ARROW = { fill: 'none', stroke: C.accent, strokeWidth: 11, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function Logo({ width }: { width: number }) {
  return (
    <svg width={width} height={(width * 67.12) / 324.79} viewBox="66.68 53.44 324.79 67.12" style={{ display: 'block' }}>
      <g transform="translate(70,51) scale(0.72)">
        <g fill={C.accentSoft}>
          <path d="M7.98 23.75 A5.5 5.5 0 0 1 16.02 16.25 L39.12 41 L24.08 41 Z" />
          <path d="M29.98 23.75 A5.5 5.5 0 0 1 38.02 16.25 L61.12 41 L46.08 41 Z" />
          <path d="M51.98 23.75 A5.5 5.5 0 0 1 60.02 16.25 L83.12 41 L68.08 41 Z" />
        </g>
        <g fill={C.accent}>
          <path d="M27.35 44.5 L42.39 44.5 L44.02 46.25 L35.98 53.75 Z" />
          <path d="M49.35 44.5 L64.39 44.5 L66.02 46.25 L57.98 53.75 Z" />
          <path d="M71.35 44.5 L86.39 44.5 L88.02 46.25 L79.98 53.75 Z" />
        </g>
        <path d="M12 80 L40 50 L84 50" {...ARROW} />
        <path d="M34 80 L62 50" {...ARROW} />
        <path d="M56 80 L84 50" {...ARROW} />
      </g>
      <path transform="translate(147.82,102) skewX(-16)" d={WORD} fill={C.ink} />
    </svg>
  );
}

/** A headline centred at the top of the frame, over a soft wash so it reads over anything behind it */
export function TopHeadline({ frame, from, to, tag, color, text, sub }: { frame: number; from: number; to: number; tag: string; color: string; text: string; sub?: string }) {
  if (frame < from || frame > to) return null;
  const out = ramp(frame, to - 10, 10, Easing.in(Easing.cubic));
  const words = text.split(' ');
  const tagIn = ramp(frame, from, 10, Easing.out(Easing.cubic));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 300, opacity: 1 - out, transform: `translateY(${-24 * out}px)`, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(${C.behind1}F2 0%, ${C.behind1}CC 55%, transparent 100%)` }} />
      <div style={{ position: 'relative', textAlign: 'center', paddingTop: 44 }}>
        <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 20, letterSpacing: 6, color, opacity: tagIn, marginBottom: 10 }}>{tag.toUpperCase()}</div>
        <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 76, lineHeight: 1.05, color: C.ink }}>
          {words.map((w, i) => {
            const t = ramp(frame, from + 3 + i * 3, 14, Easing.out(Easing.cubic));
            return (
              <span key={i} style={{ display: 'inline-block', opacity: t, transform: `translateY(${34 * (1 - t)}px) scale(${0.9 + 0.1 * t})`, margin: '0 0.12em' }}>
                {w}
              </span>
            );
          })}
        </div>
        {sub ? <div style={{ fontFamily: F.body, fontSize: 28, color: C.muted, marginTop: 10, opacity: ramp(frame, from + 10 + words.length * 3, 12) }}>{sub}</div> : null}
      </div>
    </div>
  );
}
