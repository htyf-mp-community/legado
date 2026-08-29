import type { TextStyle } from 'react-native';
import type { HighlightRuleStyle } from '../types';

export const argb = (value: number | undefined) => {
  if (!value) return undefined;
  const unsigned = value >>> 0, alpha = ((unsigned >>> 24) & 255).toString(16).padStart(2, '0'), rgb = (unsigned & 0xffffff).toString(16).padStart(6, '0');
  return `#${rgb}${alpha}`;
};
export function highlightTextStyle(style: HighlightRuleStyle): TextStyle {
  const underline = style.underline, strike = style.strike, shadow = style.shadow, rounded = style.fillShape === 'ROUNDED' || style.fillShape === 'PILL';
  const customGeometry = ['MARKER', 'HALF', 'BASELINE'].includes(style.fillShape ?? '') || underline?.kind === 'WAVY';
  return { backgroundColor: customGeometry ? undefined : argb(style.fill), borderRadius: rounded ? style.fillShape === 'PILL' ? 999 : 5 : undefined, borderWidth: style.box ? 1 : undefined, borderColor: argb(style.box?.color), color: argb(style.textColor), fontWeight: style.bold ? '700' : undefined, fontStyle: style.italic ? 'italic' : undefined, textDecorationLine: underline?.kind === 'WAVY' ? strike ? 'line-through' : undefined : underline && strike ? 'underline line-through' : underline ? 'underline' : strike ? 'line-through' : undefined, textDecorationColor: argb(underline?.color ?? strike?.color), textDecorationStyle: underline?.kind === 'DOUBLE' ? 'double' : underline?.kind === 'DASHED' ? 'dashed' : underline?.kind === 'DOTTED' ? 'dotted' : 'solid', textShadowColor: argb(shadow?.color), textShadowRadius: shadow ? Math.max(0, Math.min(10, Number(shadow.radius) || 0)) : undefined, textShadowOffset: shadow ? { width: Math.max(-10, Math.min(10, Number(shadow.dx) || 0)), height: Math.max(-10, Math.min(10, Number(shadow.dy) || 0)) } : undefined };
}
