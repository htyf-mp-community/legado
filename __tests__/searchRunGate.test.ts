import { SearchRunGate } from '../src/core/searchRunGate';

test('rejects stopped and superseded search runs', () => {
  const gate = new SearchRunGate();
  const first = gate.next();
  expect(gate.isCurrent(first)).toBe(true);
  gate.cancel();
  expect(gate.isCurrent(first)).toBe(false);
  const second = gate.next();
  const third = gate.next();
  expect(gate.isCurrent(second)).toBe(false);
  expect(gate.isCurrent(third)).toBe(true);
});
