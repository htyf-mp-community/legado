import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
jest.mock('react-native', () => ({View:'View',Text:'Text',TextInput:'TextInput',Pressable:'Pressable',Switch:'Switch',ScrollView:'ScrollView',StyleSheet:{create:(value: unknown)=>value,hairlineWidth:1}}));
jest.mock('../src/components/PageHeader', () => ({PageHeader:()=>null}));
jest.mock('../src/components/ChineseConverter', () => ({ChineseConverter:()=>null}));
jest.mock('../src/theme/AppTheme', () => ({useAppTheme:()=>({colors:{background:'#fff',text:'#000',muted:'#777',border:'#ccc',surface:'#fff',primary:'#f60'},t:(key: string)=>key})}));
jest.mock('../src/data/storage', () => ({appStorage:{getString:jest.fn(),set:jest.fn()}}));
import {appStorage} from '../src/data/storage';
import {ReaderSettings} from '../src/screens/ReaderSettings';

test('selecting a timeout persists the chosen original option', async () => {
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  let tree!: ReactTestRenderer;
  await act(async () => {tree=create(<ReaderSettings back={jest.fn()}/>);});
  const selected = () => tree.root.findByProps({accessibilityLabel:'readerScreenTimeoutFiveMinutes'});
  expect(selected().props.accessibilityState.selected).toBe(false);
  await act(async () => selected().props.onPress());
  expect(selected().props.accessibilityState.selected).toBe(true);
  expect(appStorage.set).toHaveBeenCalledWith('reader.preferences.v1',expect.stringContaining('"screenTimeoutSeconds":300'));
  await act(async () => tree.unmount());
});
