declare module 'expo-keep-awake' {
  export function activateKeepAwakeAsync(tag?: string): Promise<void>;
  export function deactivateKeepAwake(tag?: string): Promise<void>;
}
