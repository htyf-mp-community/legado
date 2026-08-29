import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { argb } from '../core/highlightTextStyle';
import { highlightGeometry, wavePath } from '../core/highlightGeometry';
import type { HighlightRuleStyle } from '../types';

export function HighlightDecoration({ style }: { style: HighlightRuleStyle }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const geometry = highlightGeometry(style);
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => setSize(nativeEvent.layout);
  if (!geometry.fillBand && !geometry.wavy && !geometry.emphasis) return null;
  const fill = argb(style.fill) ?? 'transparent';
  const underlineColor = argb(geometry.wavy?.color) ?? argb(style.textColor) ?? '#000000ff';
  const emphasisColor = argb(geometry.emphasis?.color) ?? argb(style.textColor) ?? '#000000ff';
  return <View pointerEvents="none" onLayout={onLayout} style={StyleSheet.absoluteFill}>
    {size.width > 0 && size.height > 0 ? <Svg width={size.width} height={size.height}>
      {geometry.fillBand ? <>
        {geometry.fillBand.marker ? <Defs><LinearGradient id="marker" x1="0" x2="1"><Stop offset="0" stopColor={fill} stopOpacity={0}/><Stop offset="0.04" stopColor={fill}/><Stop offset="0.96" stopColor={fill}/><Stop offset="1" stopColor={fill} stopOpacity={0}/></LinearGradient></Defs> : null}
        <Rect x={0} y={size.height * geometry.fillBand.topRatio} width={size.width} height={size.height * (geometry.fillBand.bottomRatio - geometry.fillBand.topRatio)} rx={geometry.fillBand.marker ? 3 : 0} fill={geometry.fillBand.marker ? 'url(#marker)' : fill}/>
      </> : null}
      {geometry.wavy ? <Path d={wavePath(size.width, size.height - geometry.wavy.width * 1.5, geometry.wavy.width, 6, 2)} fill="none" stroke={underlineColor} strokeWidth={geometry.wavy.width}/> : null}
      {geometry.emphasis ? <Circle cx={size.width / 2} cy={Math.max(2, size.height * 0.12)} r={Math.min(2.2, Math.max(1.4, size.height * 0.06))} fill={emphasisColor}/> : null}
    </Svg> : null}
  </View>;
}
