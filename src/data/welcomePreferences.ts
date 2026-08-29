import { appStorage } from './storage';
const KEY='welcome.preferences.v1';
export type WelcomePreferences={showTime:number;customWelcome:boolean;image:string;imageDark:string;showText:boolean;showIcon:boolean;showTextDark:boolean;showIconDark:boolean};
export const defaultWelcomePreferences:WelcomePreferences={showTime:500,customWelcome:false,image:'',imageDark:'',showText:true,showIcon:true,showTextDark:true,showIconDark:true};
export function normalizeWelcomePreferences(value:Partial<WelcomePreferences>):WelcomePreferences{return{...defaultWelcomePreferences,...value,showTime:Math.max(0,Math.min(800,Math.round(Number(value.showTime??500)))),image:String(value.image??''),imageDark:String(value.imageDark??'')}}
export function loadWelcomePreferences(){const raw=appStorage.getString(KEY);if(!raw)return defaultWelcomePreferences;try{return normalizeWelcomePreferences(JSON.parse(raw) as Partial<WelcomePreferences>)}catch{return defaultWelcomePreferences}}
export function saveWelcomePreferences(value:WelcomePreferences){const normalized=normalizeWelcomePreferences(value);appStorage.set(KEY,JSON.stringify(normalized));return normalized}
