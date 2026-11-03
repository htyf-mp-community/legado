import React from 'react';
import {act,create} from 'react-test-renderer';
import {Text,View} from 'react-native';

jest.mock('react-native',()=>({
  View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{create:(styles:unknown)=>styles},
}));
jest.mock('../src/theme/AppTheme',()=>({useAppTheme:()=>({colors:{primary:'#123'},t:(key:string)=>key})}));
import {CollapsibleBookIntro} from '../src/components/CollapsibleBookIntro';

beforeEach(()=>{(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;});

test('only offers expansion when the introduction exceeds four measured lines',async()=>{
  let tree!:ReturnType<typeof create>;
  await act(async()=>{tree=create(<CollapsibleBookIntro text="长简介"/>);});
  const measure=()=>tree.root.findAll(node=>node.type===Text&&typeof node.props.onTextLayout==='function')[0];
  const content=()=>tree.root.findAll(node=>node.type===Text&&node.props.children==='长简介'&&!node.props.onTextLayout)[0];
  expect(content().props.numberOfLines).toBe(4);
  await act(async()=>measure().props.onTextLayout({nativeEvent:{lines:[1,2,3,4]}}));
  expect(tree.root.findAllByProps({accessibilityLabel:'expandBookIntro'})).toHaveLength(0);
  await act(async()=>measure().props.onTextLayout({nativeEvent:{lines:[1,2,3,4,5]}}));
  await act(async()=>tree.root.findByProps({accessibilityLabel:'expandBookIntro'}).props.onPress());
  expect(content().props.numberOfLines).toBeUndefined();
  await act(async()=>tree.root.findByProps({accessibilityLabel:'collapseBookIntro'}).props.onPress());
  expect(content().props.numberOfLines).toBe(4);
  await act(async()=>measure().props.onTextLayout({nativeEvent:{lines:[1,2,3]}}));
  expect(tree.root.findAllByProps({accessibilityLabel:'expandBookIntro'})).toHaveLength(0);
  await act(async()=>tree.unmount());
});

test('resets expansion for a different introduction and hides the measurement from accessibility',async()=>{
  let tree!:ReturnType<typeof create>;
  await act(async()=>{tree=create(<CollapsibleBookIntro text="第一本"/>);});
  const measuring=tree.root.find(node=>node.type===View&&node.props.accessibilityElementsHidden===true);
  expect(measuring.props.importantForAccessibility).toBe('no-hide-descendants');
  const measure=tree.root.find(node=>node.type===Text&&typeof node.props.onTextLayout==='function');
  await act(async()=>measure.props.onTextLayout({nativeEvent:{lines:[1,2,3,4,5]}}));
  await act(async()=>tree.root.findByProps({accessibilityLabel:'expandBookIntro'}).props.onPress());
  await act(async()=>tree.update(<CollapsibleBookIntro text="第二本"/>));
  const content=tree.root.find(node=>node.type===Text&&node.props.children==='第二本'&&!node.props.onTextLayout);
  expect(content.props.numberOfLines).toBe(4);
  expect(tree.root.findAllByProps({accessibilityLabel:'collapseBookIntro'})).toHaveLength(0);
  await act(async()=>tree.unmount());
});
