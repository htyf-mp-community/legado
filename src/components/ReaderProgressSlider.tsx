import { View, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
export function ReaderProgressSlider({
  value,
  max,
  step,
  label,
  disabled,
  onSeek,
  minimumTrackTintColor,
  maximumTrackTintColor,
}: {
  value: number;
  max: number;
  step: number;
  label: string;
  disabled: boolean;
  onSeek: (value: number) => void;
  minimumTrackTintColor: string;
  maximumTrackTintColor: string;
}) {
  return (
    <View
      style={s.control}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value }}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => {
        if (disabled) return;
        if (event.nativeEvent.actionName === 'increment')
          onSeek(Math.min(max, value + step));
        else if (event.nativeEvent.actionName === 'decrement')
          onSeek(Math.max(0, value - step));
      }}
    >
      <Slider
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={s.slider}
        minimumValue={0}
        maximumValue={max}
        step={1}
        value={value}
        disabled={disabled}
        minimumTrackTintColor={minimumTrackTintColor}
        maximumTrackTintColor={maximumTrackTintColor}
        onSlidingComplete={onSeek}
      />
    </View>
  );
}
const s = StyleSheet.create({
  control: { flex: 1, minHeight: 44, justifyContent: 'center' },
  slider: { width: '100%', height: 44 },
});
