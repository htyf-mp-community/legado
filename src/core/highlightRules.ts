import type { HighlightRule, HighlightRuleStyle } from '../types';
import { parseHighlightStyle } from '../data/highlightRules';

export type RuleHighlightMatch = { start: number; end: number; ruleId: number; style: HighlightRuleStyle };
export type HighlightSegment = {
  text: string;
  style?: HighlightRuleStyle;
  ruleIds: number[];
};
const inScope = (scope: string | undefined, context: string) => !scope || scope.split(/[,\n]/).some(item => context.includes(item.trim()));
export function matchHighlightRules(text: string, rules: HighlightRule[], target: 'title' | 'body', context = '', maxMatches = 10000): RuleHighlightMatch[] {
  const matches: RuleHighlightMatch[] = [];
  for (const rule of [...rules].sort((a, b) => a.order - b.order)) {
    if (!rule.isEnabled || !inScope(rule.scope, context) || (target === 'title' ? !rule.applyToTitle : !rule.applyToBody)) continue;
    try {
      const expression = rule.isRegex ? new RegExp(rule.pattern, 'gu') : new RegExp(rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gu');
      for (const match of text.matchAll(expression)) {
        if (matches.length >= maxMatches) return matches;
        const start = match.index ?? 0, end = start + match[0].length;
        if (end > start) matches.push({ start, end, ruleId: rule.id, style: parseHighlightStyle(rule.style) });
      }
    } catch { continue; }
  }
  return matches;
}

export function highlightSegments(text: string, matches: RuleHighlightMatch[]): HighlightSegment[] {
  const boundaries = new Set([0, text.length]);
  matches.forEach(match => { boundaries.add(match.start); boundaries.add(match.end); });
  const points = [...boundaries].filter(point => point >= 0 && point <= text.length).sort((a, b) => a - b), output: HighlightSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index], end = points[index + 1];
    if (end <= start) continue;
    const active = matches.filter(match => match.start <= start && match.end >= end);
    const style = active.length ? active.reduce<HighlightRuleStyle>((merged, match) => ({ ...merged, ...match.style, underline: match.style.underline ?? merged.underline, strike: match.style.strike ?? merged.strike }), {}) : undefined;
    const ruleIds = [...new Set(active.map(match => match.ruleId))];
    const value = text.slice(start, end), previous = output[output.length - 1];
    if (previous && JSON.stringify(previous.style) === JSON.stringify(style) && previous.ruleIds.join() === ruleIds.join()) previous.text += value;
    else output.push({ text: value, style, ruleIds });
  }
  return output;
}
