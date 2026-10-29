import { appStorage } from './storage';
export const loadOpenBookTitle = () =>
  appStorage.getBoolean('bookshelf.manage.open-title.v1') ?? true;
export function saveOpenBookTitle(value: boolean) {
  appStorage.set('bookshelf.manage.open-title.v1', value);
  return value;
}
export const loadDeleteBookOriginal = () =>
  appStorage.getBoolean('bookshelf.manage.delete-original.v1') ?? false;
export function saveDeleteBookOriginal(value: boolean) {
  appStorage.set('bookshelf.manage.delete-original.v1', value);
  return value;
}
