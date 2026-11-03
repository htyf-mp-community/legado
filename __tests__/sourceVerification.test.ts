import {createSourceVerificationCoordinator} from '../src/core/sourceVerification';

const first = {sourceUrl:'https://one.example',url:'https://one.example/check',title:'验证'};
const second = {sourceUrl:'https://two.example',url:'https://two.example/check',title:'验证'};

test('shares one verification among concurrent requests for the same source and origin', async () => {
  const coordinator = createSourceVerificationCoordinator();
  const shown = jest.fn();
  const unsubscribe = coordinator.subscribe(shown);
  const a = coordinator.request(first), b = coordinator.request({...first,url:'https://one.example/other'});
  expect(shown).toHaveBeenLastCalledWith(expect.objectContaining(first));
  const active = coordinator.current()!;
  coordinator.finish(active.id, {url:first.url,html:'verified'});
  await expect(a).resolves.toEqual({url:first.url,html:'verified'});
  await expect(b).resolves.toEqual({url:first.url,html:'verified'});
  expect(coordinator.current()).toBeNull();
  unsubscribe();
});

test('cancelling one waiter keeps the other alive; cancelling all advances the queue', async () => {
  const coordinator = createSourceVerificationCoordinator();
  coordinator.subscribe(() => {});
  const one = new AbortController(), two = new AbortController();
  const a = coordinator.request(first,one.signal), b = coordinator.request(first,two.signal), c = coordinator.request(second);
  const rejectA = expect(a).rejects.toThrow(/取消/), rejectB = expect(b).rejects.toThrow(/取消/);
  one.abort();
  expect(coordinator.current()?.sourceUrl).toBe(first.sourceUrl);
  two.abort();
  expect(coordinator.current()?.sourceUrl).toBe(second.sourceUrl);
  coordinator.finish(coordinator.current()!.id, {url:second.url,html:'done'});
  await Promise.all([rejectA,rejectB,expect(c).resolves.toEqual({url:second.url,html:'done'})]);
});

test('user cancellation and unmount reject waiters and do not leave pending work', async () => {
  const coordinator = createSourceVerificationCoordinator();
  const unsubscribe = coordinator.subscribe(() => {});
  const a = coordinator.request(first), b = coordinator.request(second);
  const rejectA = expect(a).rejects.toThrow(/取消/), rejectB = expect(b).rejects.toThrow(/取消/);
  coordinator.cancel(coordinator.current()!.id);
  unsubscribe();
  await Promise.all([rejectA,rejectB]);
  expect(coordinator.current()).toBeNull();
  await expect(coordinator.request(first)).rejects.toThrow(/不可用/);
});
