import { allSettledLimited } from '../src/core/concurrency';

test('limits active tasks while preserving result order and failures', async () => {
  let active = 0;
  let peak = 0;
  const tasks = [0, 1, 2, 3].map(index => async () => {
    active += 1;
    peak = Math.max(peak, active);
    await Promise.resolve();
    active -= 1;
    if (index === 2) throw new Error('failed');
    return index;
  });
  const result = await allSettledLimited(tasks, 2);
  expect(peak).toBe(2);
  expect(result.map(item => item.status)).toEqual(['fulfilled', 'fulfilled', 'rejected', 'fulfilled']);
  expect((result[3] as PromiseFulfilledResult<number>).value).toBe(3);
});
