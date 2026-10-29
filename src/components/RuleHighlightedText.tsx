import {
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type TextProps,
} from 'react-native';
import { highlightSegments, matchHighlightRules } from '../core/highlightRules';
import type { HighlightRule } from '../types';
import { highlightTextStyle } from '../core/highlightTextStyle';
import { highlightGeometry } from '../core/highlightGeometry';
import { HighlightDecoration } from './HighlightDecoration';
import type { HighlightActionTrigger } from '../data/readerPreferences';
export function RuleHighlightedText({
  text,
  rules,
  target,
  context,
  style,
  selectable = false,
  highlightActionTrigger = 'off',
  onHighlightRule,
  onTextLayout,
}: {
  text: string;
  rules: HighlightRule[];
  target: 'title' | 'body';
  context: string;
  style?: StyleProp<TextStyle>;
  selectable?: boolean;
  highlightActionTrigger?: HighlightActionTrigger;
  onHighlightRule?: (value: { ruleId: number; text: string }) => void;
  onTextLayout?: TextProps['onTextLayout'];
}) {
  const segments = highlightSegments(
    text,
    matchHighlightRules(text, rules, target, context),
  );
  const interaction = (ruleIds: number[], value: string) => {
    const ruleId = ruleIds[ruleIds.length - 1];
    if (ruleId === undefined || !onHighlightRule) return {};
    return {
      onPress:
        highlightActionTrigger === 'click'
          ? () => onHighlightRule({ ruleId, text: value })
          : undefined,
      onLongPress:
        highlightActionTrigger === 'longPress'
          ? () => onHighlightRule({ ruleId, text: value })
          : undefined,
    };
  };
  const decorated = segments.some(
    segment =>
      segment.style &&
      Object.values(highlightGeometry(segment.style)).some(Boolean),
  );
  if (decorated)
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel={text}
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'baseline',
        }}
      >
        {segments.flatMap((segment, segmentIndex) =>
          segment.text
            .split(/(\s+)/)
            .filter(Boolean)
            .map((part, partIndex) => (
              <View
                key={`${segmentIndex}:${partIndex}`}
                style={{ position: 'relative' }}
              >
                <HighlightDecoration style={segment.style ?? {}} />
                <Text
                  accessible={false}
                  {...interaction(segment.ruleIds, segment.text)}
                  style={[
                    style,
                    segment.style
                      ? highlightTextStyle(segment.style)
                      : undefined,
                  ]}
                >
                  {part}
                </Text>
              </View>
            )),
        )}
      </View>
    );
  return (
    <Text selectable={selectable} style={style} onTextLayout={onTextLayout}>
      {segments.map((segment, index) => (
        <Text
          key={`${index}:${segment.text.length}`}
          {...interaction(segment.ruleIds, segment.text)}
          style={segment.style ? highlightTextStyle(segment.style) : undefined}
        >
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}
