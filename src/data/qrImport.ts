import type { QrRuleKind } from '../core/qrPayload';
import { loadSources, mergeBookSources, parseBookSources, saveSources } from './sources';
import { loadRssSources, mergeRssSources, parseRssSources, saveRssSources } from './rss';
import { loadReplaceRules, mergeReplaceRules, parseReplaceRules, saveReplaceRules } from './replaceRules';
import { loadTxtTocRules, mergeTxtTocRules, parseTxtTocRules, saveTxtTocRules } from './txtTocRules';
import { loadDictRules, mergeDictRules, parseDictRules, saveDictRules } from './dictRules';
import { loadHighlightRules, mergeHighlightRules, parseHighlightRules, saveHighlightRules } from './highlightRules';
import { loadAutoTasks, mergeAutoTasks, parseAutoTasks, saveAutoTasks } from './autoTasks';
import { loadRuleSubscriptions, parseRuleSubscriptions, saveRuleSubscriptions, upsertRuleSubscription } from './ruleSubscriptions';

export async function importQrRules(kind: QrRuleKind, value: string): Promise<number> {
  if (kind === 'bookSource') { const incoming=parseBookSources(value); saveSources(mergeBookSources(await loadSources(),incoming)); return incoming.length; }
  if (kind === 'rssSource') { const incoming=parseRssSources(value); saveRssSources(mergeRssSources(loadRssSources(),incoming)); return incoming.length; }
  if (kind === 'replaceRule') { const incoming=parseReplaceRules(value); saveReplaceRules(mergeReplaceRules(loadReplaceRules(),incoming)); return incoming.length; }
  if (kind === 'txtTocRule') { const incoming=parseTxtTocRules(value); saveTxtTocRules(mergeTxtTocRules(loadTxtTocRules(),incoming)); return incoming.length; }
  if (kind === 'dictRule') { const incoming=parseDictRules(value); saveDictRules(mergeDictRules(loadDictRules(),incoming)); return incoming.length; }
  if (kind === 'highlightRule') { const incoming=parseHighlightRules(value); saveHighlightRules(mergeHighlightRules(loadHighlightRules(),incoming)); return incoming.length; }
  if (kind === 'autoTask') { const incoming=parseAutoTasks(value); saveAutoTasks(mergeAutoTasks(loadAutoTasks(),incoming)); return incoming.length; }
  if (kind === 'ruleSubscription') { const incoming=parseRuleSubscriptions(value); let current=loadRuleSubscriptions(); incoming.forEach(item=>{current=upsertRuleSubscription(current,item)}); saveRuleSubscriptions(current); return incoming.length; }
  return 0;
}
