import type { Book } from '../types';

export const displayBookIntro = (book: Pick<Book, 'intro' | 'customIntro'>) =>
  book.customIntro || book.intro;

/** Match BookInfoEdit: an unchanged source introduction removes the override. */
export function editBookIntro(book: Book, text: string): Book {
  return { ...book, customIntro: text === book.intro ? undefined : text };
}
