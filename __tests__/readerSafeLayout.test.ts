import { readerSafeLayout } from '../src/core/readerSafeLayout';

test('keeps reader chrome inside portrait safe areas', () => {
  expect(
    readerSafeLayout(
      { top: 47, bottom: 34, left: 0, right: 0 },
      null,
      390,
    ),
  ).toEqual(
    expect.objectContaining({
      top: 47,
      bottom: 34,
      progressBottom: 118,
      infoTop: 51,
      infoBottom: 38,
      infoBottomWithControls: 178,
      left: 0,
      right: 0,
      topRight: 390,
    }),
  );
});

test('keeps landscape controls out of side insets and the HTYF capsule', () => {
  expect(
    readerSafeLayout(
      { top: 0, bottom: 21, left: 44, right: 44 },
      { left: 700, top: 8, right: 820, bottom: 40 },
      844,
    ),
  ).toEqual(
    expect.objectContaining({
      left: 44,
      right: 44,
      topRight: 690,
      bottom: 21,
      progressBottom: 105,
      infoBottomWithControls: 165,
    }),
  );
});
