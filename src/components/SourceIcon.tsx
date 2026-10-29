import Svg, { Path } from 'react-native-svg';
import { sourceIcons } from '../assets/sourceIcons';

export type SourceIconName = keyof typeof sourceIcons;
export function SourceIcon({
  name,
  color,
  size = 24,
}: {
  name: SourceIconName;
  color: string;
  size?: number;
}) {
  const icon = sourceIcons[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={icon.viewBox}
      accessibilityElementsHidden
    >
      {icon.paths.map((path, index) => (
        <Path key={index} d={path} fill={color} />
      ))}
    </Svg>
  );
}
