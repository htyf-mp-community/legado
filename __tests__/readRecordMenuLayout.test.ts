import { readRecordMenuFrame } from '../src/layout/readRecordMenu';
const window = { width: 400, height: 800 };
test('without valid capsule data the popup keeps its original window layout', () => {
  expect(readRecordMenuFrame(window, 80, 20, null, 180)).toEqual({
    top: 80,
    right: 8,
    width: 260,
    maxHeight: 692,
  });
  expect(
    readRecordMenuFrame(
      window,
      80,
      20,
      {
        left: NaN,
        right: 400,
        top: 0,
        bottom: 100,
      },
      180,
    ),
  ).toEqual(readRecordMenuFrame(window, 80, 20, null, 180));
});
test('only a popup overlapping the capsule on both axes moves', () => {
  const baseline = readRecordMenuFrame(window, 80, 20, null, 180);
  expect(
    readRecordMenuFrame(
      window,
      80,
      20,
      {
        left: 10,
        right: 30,
        top: 70,
        bottom: 110,
      },
      180,
    ),
  ).toEqual(baseline);
  expect(
    readRecordMenuFrame(
      window,
      80,
      20,
      {
        left: 300,
        right: 390,
        top: 0,
        bottom: 60,
      },
      180,
    ),
  ).toEqual(baseline);
  expect(
    readRecordMenuFrame(
      window,
      80,
      20,
      {
        left: 300,
        right: 390,
        top: 70,
        bottom: 110,
      },
      180,
    ),
  ).toMatchObject({ top: 80, right: 110, width: 260 });
});
test('a wide occlusion moves the local popup below it while preserving touch width', () => {
  expect(
    readRecordMenuFrame(
      window,
      80,
      20,
      {
        left: 80,
        right: 390,
        top: 70,
        bottom: 110,
      },
      180,
    ),
  ).toEqual({ top: 120, right: 8, width: 260, maxHeight: 652 });
});
test('orientation recalculates the viewport and does not infer size from capsule edges', () => {
  const capsule = { left: 300, right: 390, top: 70, bottom: 110 };
  expect(
    readRecordMenuFrame({ width: 800, height: 400 }, 80, 20, capsule, 180),
  ).toEqual({ top: 80, right: 8, width: 260, maxHeight: 292 });
});

test('pending and short menu measurements do not move an unrelated popup below the capsule', () => {
  const capsule = { left: 300, right: 390, top: 230, bottom: 260 };
  expect(readRecordMenuFrame(window, 80, 20, capsule, 0)).toEqual(
    readRecordMenuFrame(window, 80, 20, null, 0),
  );
  expect(readRecordMenuFrame(window, 80, 20, capsule, 60)).toEqual(
    readRecordMenuFrame(window, 80, 20, null, 60),
  );
});

test('an unmeasured popup does not invent a capsule intersection', () => {
  expect(
    readRecordMenuFrame(
      window,
      80,
      20,
      { left: 300, right: 390, top: 70, bottom: 110 },
      0,
    ),
  ).toEqual(readRecordMenuFrame(window, 80, 20, null, 0));
});
