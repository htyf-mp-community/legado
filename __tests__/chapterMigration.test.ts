import reference from './fixtures/chapterMigrationReference.json';
import {
  migrationChapterIndex,
  migrationChapterNumber,
  pureMigrationChapterTitle,
} from '../src/core/chapterMigration';
test.each(reference.cases)(
  'matches the source JVM case: index=$oldIndex title=$oldTitle',
  value => {
    expect(pureMigrationChapterTitle(value.oldTitle)).toBe(value.pure);
    expect(migrationChapterNumber(value.oldTitle)).toBe(value.number);
    value.newTitles.forEach((title, index) => {
      expect(pureMigrationChapterTitle(title)).toBe(value.titles[index].pure);
      expect(migrationChapterNumber(title)).toBe(value.titles[index].number);
    });
    expect(
      migrationChapterIndex(
        value.oldIndex,
        value.oldTitle,
        value.newTitles.map(title => ({ title })),
        value.oldCount,
        value.searchAllNumbers,
      ),
    ).toBe(value.result);
  },
);
