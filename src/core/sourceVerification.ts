import { SourceRuleError, SourceVerificationCancelledError } from './errors';

export type SourceVerificationRequest = {sourceUrl: string; url: string; title: string; headers?: Record<string, string>; refetch?: boolean; html?: string};
export type ActiveSourceVerification = SourceVerificationRequest & {id: number};
export type SourceVerificationResult = {url: string; html: string};
type Waiter = {resolve: (value: SourceVerificationResult) => void; reject: (error: Error) => void; cleanup: () => void};
type Flight = {key: string; request: ActiveSourceVerification; waiters: Set<Waiter>};

/** Serializes interactive verification and lets concurrent requests share a browser. */
export function createSourceVerificationCoordinator() {
  let nextId = 0;
  const listeners = new Set<(request: ActiveSourceVerification | null) => void>();
  const flights: Flight[] = [];
  const current = () => flights[0]?.request ?? null;
  const notify = () => { for (const listener of listeners) listener(current()); };
  const remove = (flight: Flight) => {
    const index = flights.indexOf(flight);
    if (index < 0) return;
    flights.splice(index, 1);
    if (index === 0) notify();
  };
  const settle = (flight: Flight, result?: SourceVerificationResult) => {
    for (const waiter of flight.waiters) {
      waiter.cleanup();
      if (result) waiter.resolve(result);
      else waiter.reject(new SourceVerificationCancelledError());
    }
    flight.waiters.clear();
    remove(flight);
  };
  return {
    current,
    subscribe(listener: (request: ActiveSourceVerification | null) => void) {
      listeners.add(listener);
      listener(current());
      return () => {
        listeners.delete(listener);
        if (!listeners.size) while (flights.length) settle(flights[0]);
      };
    },
    request(request: SourceVerificationRequest, signal?: AbortSignal): Promise<SourceVerificationResult> {
      if (!listeners.size) return Promise.reject(new SourceRuleError('浏览器验证界面不可用'));
      if (signal?.aborted) return Promise.reject(new SourceVerificationCancelledError());
      const host = /^(https?):\/\/([^/?#]+)/i.exec(request.url)?.[0].toLowerCase();
      if (!host) return Promise.reject(new SourceRuleError('浏览器验证地址无效'));
      const shareable = request.refetch !== false && request.html == null;
      const key = `${request.sourceUrl}\0${host}`;
      let flight = shareable ? flights.find(item => item.key === key && item.request.refetch !== false && item.request.html == null) : undefined;
      const created = !flight;
      if (!flight) {
        flight = {key, request:{...request,id:++nextId}, waiters:new Set()};
        flights.push(flight);
      }
      const target = flight;
      const promise = new Promise<SourceVerificationResult>((resolve, reject) => {
        const abort = () => {
          target.waiters.delete(waiter);
          waiter.cleanup();
          reject(new SourceVerificationCancelledError());
          if (!target.waiters.size) remove(target);
        };
        const waiter: Waiter = {resolve, reject, cleanup: () => signal?.removeEventListener('abort', abort)};
        target.waiters.add(waiter);
        signal?.addEventListener('abort', abort, {once:true});
        if (signal?.aborted) abort();
      });
      if (created && flights[0] === target) notify();
      return promise;
    },
    finish(id: number, result: SourceVerificationResult) {
      const flight = flights[0];
      if (flight?.request.id === id) settle(flight, result);
    },
    cancel(id: number) {
      const flight = flights[0];
      if (flight?.request.id === id) settle(flight);
    },
  };
}
export const sourceVerification = createSourceVerificationCoordinator();
