export type QrRuleKind = 'bookSource' | 'rssSource' | 'replaceRule' | 'txtTocRule' | 'dictRule' | 'highlightRule' | 'autoTask' | 'ruleSubscription';
export type QrPayload = { kind: 'url' | QrRuleKind | 'text'; value: string; count?: number };
export function classifyQrPayload(input: string): QrPayload {
  const value = input.trim();
  if (/^(?:https?|legado|yuedu):\/\//i.test(value)) return { kind:'url', value };
  try {
    const parsed: unknown = JSON.parse(value);
    const wrapped = parsed && !Array.isArray(parsed) && typeof parsed === 'object' && (parsed as Record<string, unknown>).type === 'highlightRule'
      ? (parsed as Record<string, unknown>).rules : parsed;
    const list = Array.isArray(wrapped) ? wrapped : [wrapped];
    if (!list.length || !list.every(item => item && typeof item === 'object')) return { kind:'text', value };
    const records = list as Record<string, unknown>[];
    const every = (...keys: string[]) => records.every(item => keys.every(key => key in item));
    const kind: QrRuleKind | undefined = every('bookSourceUrl','bookSourceName') ? 'bookSource'
      : every('sourceUrl','sourceName') ? 'rssSource'
      : every('name','cron','script') ? 'autoTask'
      : every('name','url','type','autoUpdate') ? 'ruleSubscription'
      : every('urlRule','name') ? 'dictRule'
      : every('rule','name') ? 'txtTocRule'
      : every('pattern') && records.some(item => 'style' in item || 'applyToBody' in item || 'uuid' in item) ? 'highlightRule'
      : every('pattern') ? 'replaceRule' : undefined;
    if (kind) return { kind, value, count:list.length };
  } catch { /* plain text */ }
  return { kind:'text', value };
}
