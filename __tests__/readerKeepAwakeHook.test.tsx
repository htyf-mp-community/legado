import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';

const mockActivate=jest.fn(), mockDeactivate=jest.fn();
let mockClient: {activateKeepAwake:typeof mockActivate;deactivateKeepAwake:typeof mockDeactivate}|undefined = {activateKeepAwake:mockActivate,deactivateKeepAwake:mockDeactivate};
const mockRemove=jest.fn();
let mockStateHandler: (state: string) => void;
jest.mock('react-native', () => ({AppState:{currentState:'active',addEventListener:(_event: string, callback: (state: string) => void) => {mockStateHandler=callback; return {remove:mockRemove};}}}));
jest.mock('@htyf-mp/js-sdk', () => ({__esModule:true,default:{get client(){return mockClient;}}}));
import {useReaderKeepAwake} from '../src/hooks/useReaderKeepAwake';
import type {ScreenTimeoutSeconds} from '../src/core/readerKeepAwake';

function Reader({focused,seconds,onError=jest.fn()}:{focused:boolean;seconds:ScreenTimeoutSeconds;onError?:(error:unknown)=>void}) {
  useReaderKeepAwake(focused,seconds,onError);
  return null;
}
beforeEach(()=>{jest.clearAllMocks();mockClient={activateKeepAwake:mockActivate,deactivateKeepAwake:mockDeactivate};});
test('binds the lock to focus, foreground and component lifetime', async () => {
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  let tree!: ReactTestRenderer;
  await act(async () => {tree=create(<Reader focused seconds={-1}/>);});
  expect(mockActivate).toHaveBeenCalledTimes(1);
  expect(mockActivate).toHaveBeenCalledWith();
  await act(async () => {mockStateHandler('background');});
  expect(mockDeactivate).toHaveBeenCalledWith();
  await act(async () => {mockStateHandler('active');});
  expect(mockActivate).toHaveBeenCalledTimes(2);
  await act(async () => {tree.update(<Reader focused={false} seconds={-1}/>);});
  expect(mockDeactivate).toHaveBeenCalledTimes(2);
  await act(async () => {tree.update(<Reader focused seconds={-1}/>);});
  await act(async () => {tree.unmount();});
  expect(mockDeactivate).toHaveBeenCalledTimes(3);
  expect(mockRemove).toHaveBeenCalledTimes(1);
});

test('reports missing host capability without importing a shared Expo module',async()=>{
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  mockClient=undefined;const onError=jest.fn();let tree!:ReactTestRenderer;
  await act(async()=>{tree=create(<Reader focused seconds={-1} onError={onError}/>);});
  expect(onError).toHaveBeenCalledTimes(1);expect(mockActivate).not.toHaveBeenCalled();
  await act(async()=>tree.unmount());expect(mockDeactivate).not.toHaveBeenCalled();
});

test('releases the same host client that acquired the lock',async()=>{
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  let tree!:ReactTestRenderer;
  await act(async()=>{tree=create(<Reader focused seconds={-1}/>);});
  const replacement={activateKeepAwake:jest.fn(),deactivateKeepAwake:jest.fn()};mockClient=replacement;
  await act(async()=>tree.unmount());
  expect(mockDeactivate).toHaveBeenCalledTimes(1);expect(replacement.deactivateKeepAwake).not.toHaveBeenCalled();
});
