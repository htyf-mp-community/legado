import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type TextProps,
} from 'react-native';
import WebView from 'react-native-webview';
import {
  readerContentSegments,
  type ReaderHtml,
  type ReaderImage,
} from '../core/readerImages';
import {
  boundedSpecialHtmlHeight,
  readerSpecialHtmlDocument,
  readerSpecialHtmlHeightScript,
} from '../core/readerSpecialHtml';
import type {
  HighlightActionTrigger,
  ReaderImageClickMode,
} from '../data/readerPreferences';
import type { HighlightRule } from '../types';
import { useAppTheme } from '../theme/AppTheme';
import { RuleHighlightedText } from './RuleHighlightedText';

export function ReaderRichContent({
  text,
  rules,
  context,
  style,
  selectable,
  imageClickMode,
  imageHeaders,
  onPreview,
  onOpenLink,
  highlightActionTrigger,
  onHighlightRule,
  imageStyle = 'default',
  specialHtmlPageHeight,
  onTextLayout,
}: {
  text: string;
  rules: HighlightRule[];
  context: string;
  style?: StyleProp<TextStyle>;
  selectable: boolean;
  imageClickMode: ReaderImageClickMode;
  imageHeaders?: Record<string, string>;
  onPreview: (image: ReaderImage) => void;
  onOpenLink: (url: string) => void;
  highlightActionTrigger: HighlightActionTrigger;
  onHighlightRule: (value: { ruleId: number; text: string }) => void;
  imageStyle?: 'default' | 'full' | 'text' | 'single';
  specialHtmlPageHeight?: number;
  onTextLayout?: TextProps['onTextLayout'];
}) {
  const { colors } = useAppTheme();
  const segments = readerContentSegments(text);
  return (
    <View>
      {segments.map((segment, index) =>
        segment.type === 'image' ? (
          <ReaderInlineImage
            key={`${segment.image.src}:${index}`}
            image={segment.image}
            mode={imageClickMode}
            headers={imageHeaders}
            onPreview={onPreview}
            onOpenLink={onOpenLink}
            imageStyle={imageStyle}
          />
        ) : segment.type === 'html' ? (
          <ReaderInlineHtml
            key={`html:${index}`}
            value={segment.html}
            textStyle={style}
            onOpenLink={onOpenLink}
            pageHeight={specialHtmlPageHeight}
          />
        ) : segment.type === 'link' ? (
          <Pressable
            key={`${segment.link.url}:${index}`}
            accessibilityRole="link"
            accessibilityLabel={segment.link.text}
            onPress={() => onOpenLink(segment.link.url)}
          >
            <Text
              style={[
                style,
                { color: colors.primary, textDecorationLine: 'underline' },
              ]}
            >
              {segment.link.text}
            </Text>
          </Pressable>
        ) : segment.text ? (
          <RuleHighlightedText
            key={`text:${index}`}
            text={segment.text}
            rules={rules}
            target="body"
            context={context}
            style={style}
            selectable={selectable}
            highlightActionTrigger={highlightActionTrigger}
            onHighlightRule={onHighlightRule}
            onTextLayout={segments.length === 1 ? onTextLayout : undefined}
          />
        ) : null,
      )}
    </View>
  );
}

function ReaderInlineHtml({
  value,
  textStyle,
  onOpenLink,
  pageHeight,
}: {
  value: ReaderHtml;
  textStyle?: StyleProp<TextStyle>;
  onOpenLink: (url: string) => void;
  pageHeight?: number;
}) {
  const { colors, t } = useAppTheme(),
    [contentHeight, setContentHeight] = useState(44),
    flattened = StyleSheet.flatten(textStyle) ?? {},
    color = typeof flattened.color === 'string' ? flattened.color : colors.text,
    fontSize = typeof flattened.fontSize === 'number' ? flattened.fontSize : 16,
    lineHeight =
      typeof flattened.lineHeight === 'number'
        ? flattened.lineHeight
        : Math.ceil(fontSize * 1.5),
    html = readerSpecialHtmlDocument(value.html, value.baseUrl, {
      color,
      fontSize,
      lineHeight,
      background: 'transparent',
    }),
    boundedPageHeight =
      typeof pageHeight === 'number' ? Math.max(44, pageHeight) : undefined,
    height = boundedPageHeight
      ? Math.min(contentHeight, boundedPageHeight)
      : contentHeight,
    needsInnerScroll =
      boundedPageHeight !== undefined && contentHeight > boundedPageHeight;
  return (
    <WebView
      accessibilityLabel={t('readerSpecialHtml')}
      source={{ html }}
      originWhitelist={['about:blank', 'http://*', 'https://*', 'file://*']}
      javaScriptEnabled
      domStorageEnabled={false}
      scrollEnabled={needsInnerScroll}
      nestedScrollEnabled={false}
      bounces={false}
      setSupportMultipleWindows={false}
      javaScriptCanOpenWindowsAutomatically={false}
      injectedJavaScript={readerSpecialHtmlHeightScript}
      onMessage={event => {
        try {
          const message = JSON.parse(event.nativeEvent.data) as {
            type?: string;
            height?: unknown;
          };
          if (message.type !== 'height') return;
          const next = boundedSpecialHtmlHeight(message.height);
          if (next !== undefined) setContentHeight(next);
        } catch {
          // Ignore non-height messages from legacy source markup.
        }
      }}
      onShouldStartLoadWithRequest={request => {
        if (request.url === 'about:blank') return true;
        onOpenLink(request.url);
        return false;
      }}
      style={[s.specialHtml, { height, backgroundColor: 'transparent' }]}
    />
  );
}

function ReaderInlineImage({
  image,
  mode,
  headers,
  onPreview,
  onOpenLink,
  imageStyle,
}: {
  image: ReaderImage;
  mode: ReaderImageClickMode;
  headers?: Record<string, string>;
  onPreview: (image: ReaderImage) => void;
  onOpenLink: (url: string) => void;
  imageStyle: 'default' | 'full' | 'text' | 'single';
}) {
  const { colors, t } = useAppTheme(),
    [ratio, setRatio] = useState(1.5),
    [width, setWidth] = useState(280),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false),
    lastTap = useRef(0),
    activate = () => {
      if (mode === 'disabled') return;
      if (mode === 'double') {
        const now = Date.now();
        if (now - lastTap.current > 320) {
          lastTap.current = now;
          return;
        }
        lastTap.current = 0;
      }
      if (mode === 'preview') onPreview(image);
      else if (image.click) onOpenLink(image.click);
      else if (mode === 'compat' || mode === 'double') onPreview(image);
    },
    naturalHeight = width / ratio,
    height =
      imageStyle === 'full'
        ? Math.max(120, naturalHeight)
        : imageStyle === 'text'
          ? Math.min(96, Math.max(44, naturalHeight))
          : imageStyle === 'single'
            ? Math.min(640, Math.max(240, naturalHeight))
            : Math.min(420, Math.max(120, naturalHeight));
  return (
    <Pressable
      accessibilityRole={mode === 'disabled' ? 'image' : 'imagebutton'}
      accessibilityLabel={t('readerInlineImage')}
      disabled={mode === 'disabled'}
      onPress={activate}
      onLayout={event => setWidth(Math.max(1, event.nativeEvent.layout.width))}
      style={[
        s.imageBox,
        imageStyle === 'text' && s.textImage,
        imageStyle === 'single' && s.singleImage,
        { height, backgroundColor: colors.surface },
      ]}
    >
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {failed ? (
        <Text accessibilityRole="alert" style={{ color: colors.muted }}>
          {t('readerInlineImageFailed')}
        </Text>
      ) : (
        <Image
          source={{ uri: image.src, headers }}
          resizeMode="contain"
          style={StyleSheet.absoluteFill}
          onLoad={event => {
            const { width: naturalWidth, height: naturalHeight } =
              event.nativeEvent.source;
            if (naturalWidth > 0 && naturalHeight > 0)
              setRatio(naturalWidth / naturalHeight);
            setLoading(false);
          }}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  specialHtml: { width: '100%' },
  imageBox: {
    width: '100%',
    minHeight: 120,
    marginVertical: 12,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textImage: { width: '42%', minHeight: 44, alignSelf: 'center' },
  singleImage: { marginVertical: 24 },
});
