import { appStorage } from './storage';

const KEY = 'cover.preferences.v1';
export type CoverPreferences = {
  loadOnlyWifi: boolean;
  useDefaultCover: boolean;
  horizontal: boolean;
  keepPunctuation: boolean;
  defaultCover: string;
  defaultCoverDark: string;
  showName: boolean;
  showAuthor: boolean;
  showNameDark: boolean;
  showAuthorDark: boolean;
};
export const defaultCoverPreferences: CoverPreferences = { loadOnlyWifi:false,useDefaultCover:false,horizontal:false,keepPunctuation:false,defaultCover:'',defaultCoverDark:'',showName:true,showAuthor:true,showNameDark:true,showAuthorDark:true };
export function normalizeCoverPreferences(value: Partial<CoverPreferences>): CoverPreferences { return { ...defaultCoverPreferences, ...value, defaultCover:String(value.defaultCover ?? ''), defaultCoverDark:String(value.defaultCoverDark ?? '') }; }
export function loadCoverPreferences() { const raw=appStorage.getString(KEY);if(!raw)return defaultCoverPreferences;try{return normalizeCoverPreferences(JSON.parse(raw) as Partial<CoverPreferences>)}catch{return defaultCoverPreferences} }
export function saveCoverPreferences(value: CoverPreferences) { const normalized=normalizeCoverPreferences(value);appStorage.set(KEY,JSON.stringify(normalized));return normalized }
export function coverDisplayText(value: string, keepPunctuation: boolean) { const trimmed=value.trim();return keepPunctuation?trimmed:trimmed.replace(/[\p{P}\p{S}\s]+/gu,'') }
