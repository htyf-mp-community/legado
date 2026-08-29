import { appStorage } from './storage';
const KEY='diagnostic.preferences.v1';
export type DiagnosticPreferences={recordLog:boolean;recordHttpLog:boolean};
export const defaultDiagnosticPreferences:DiagnosticPreferences={recordLog:true,recordHttpLog:false};
export function loadDiagnosticPreferences(){const raw=appStorage.getString(KEY);if(!raw)return defaultDiagnosticPreferences;try{return{...defaultDiagnosticPreferences,...JSON.parse(raw) as Partial<DiagnosticPreferences>}}catch{return defaultDiagnosticPreferences}}
export function saveDiagnosticPreferences(value:DiagnosticPreferences){appStorage.set(KEY,JSON.stringify(value));return value}
