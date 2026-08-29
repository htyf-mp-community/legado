import type { HighlightRuleStyle } from '../types';

export type HighlightGeometry = {
  fillBand?: { topRatio: number; bottomRatio: number; marker: boolean };
  wavy?: { color?: number; width: number };
  emphasis?: { color?: number };
};

export function highlightGeometry(style: HighlightRuleStyle): HighlightGeometry {
  const shape = style.fillShape ?? 'RECTANGLE';
  const fillBand = style.fill == null ? undefined : shape === 'HALF'
    ? { topRatio: 0.5, bottomRatio: 0.94, marker: false }
    : shape === 'BASELINE'
      ? { topRatio: 0.82, bottomRatio: 0.96, marker: false }
      : shape === 'MARKER'
        ? { topRatio: 0.08, bottomRatio: 0.94, marker: true }
        : undefined;
  return {
    fillBand,
    wavy: style.underline?.kind === 'WAVY' ? { color: style.underline.color, width: Math.max(0.5, Number(style.underline.width) || 1.5) } : undefined,
    emphasis: style.underline == null && style.emphasis ? { color: style.emphasis.color } : undefined,
  };
}

export function wavePath(width: number, y: number, amplitude: number, wavelength = 6, step = 2): string {
  if (!(width > 0) || !(step > 0) || !(wavelength > 0)) return '';
  const points: string[] = [];
  const count = Math.ceil(width / step);
  for (let index = 0; index <= count; index += 1) {
    const x = index === count ? width : index * step;
    const waveY = y + amplitude * Math.sin((x / wavelength) * Math.PI * 2);
    points.push(`${index ? 'L' : 'M'}${x.toFixed(2)} ${waveY.toFixed(2)}`);
  }
  return points.join(' ');
}
