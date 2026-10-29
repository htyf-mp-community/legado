import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import { useNetInfo } from '@react-native-community/netinfo';
import { coverDisplayText } from '../data/coverPreferences';
import { useCoverPreferences } from '../hooks/useCoverPreferences';
import { verticalCoverGlyphs } from '../core/coverLayout';
import { useAppTheme } from '../theme/AppTheme';
import { displayBookCover, type BookCoverLayers } from '../core/bookCover';
import { useBookCoverRequest } from '../hooks/useBookCoverRequest';

const bundledCover = require('../assets/image_cover_default.jpg');
export function BookCover({
  name,
  author = '',
  uri,
  book,
  style,
}: {
  name: string;
  author?: string;
  uri?: string;
  book?: BookCoverLayers;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, t, dark } = useAppTheme(),
    preferences = useCoverPreferences(),
    network = useNetInfo();
  const [failedUri, setFailedUri] = useState<string>(),
    [loadedUri, setLoadedUri] = useState<string>(),
    [failedBackground, setFailedBackground] = useState<string>();
  const [width, setWidth] = useState(0);
  const fixedWidth = StyleSheet.flatten(style)?.width;
  const coverWidth = typeof fixedWidth === 'number' ? fixedWidth : width,
    height = (coverWidth * 4) / 3;
  const path = (book ? displayBookCover(book) : uri)?.trim(),
    remote = /^https?:/i.test(path ?? '');
  const allowed =
    !preferences.loadOnlyWifi ||
    !remote ||
    network.type === 'wifi' ||
    network.type === 'ethernet';
  const loadPath =
    !preferences.useDefaultCover && allowed && path ? path : undefined;
  const request = useBookCoverRequest(loadPath, book),
    loadKey = request ? JSON.stringify(request) : undefined;
  const background = dark
    ? preferences.defaultCoverDark
    : preferences.defaultCover;
  const showName = dark ? preferences.showNameDark : preferences.showName,
    showAuthor = dark ? preferences.showAuthorDark : preferences.showAuthor;
  const title = coverDisplayText(name, preferences.keepPunctuation),
    displayAuthor = coverDisplayText(author, preferences.keepPunctuation);
  const fallback =
    !loadKey || failedUri === loadKey || loadedUri !== loadKey;
  const glyphs = verticalCoverGlyphs(
    title,
    displayAuthor,
    showAuthor,
    coverWidth,
    height,
  );
  useEffect(() => {
    setFailedUri(undefined);
    setLoadedUri(undefined);
  }, [loadKey]);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('namedBookCover', { name })}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      style={[s.cover, style, coverWidth > 0 && { height }]}
    >
      <Image
        accessible={false}
        source={
          background && failedBackground !== background
            ? { uri: background }
            : bundledCover
        }
        resizeMode="cover"
        style={s.image}
        onError={() => setFailedBackground(background)}
      />
      {fallback && showName && coverWidth > 0 ? (
        preferences.horizontal ? (
          <HorizontalCover
            title={title}
            author={showAuthor ? displayAuthor : ''}
            width={coverWidth}
            height={height}
          />
        ) : (
          <Svg
            accessibilityElementsHidden
            style={s.image}
            width={coverWidth}
            height={height}
            viewBox={`0 0 ${coverWidth} ${height}`}
          >
            {glyphs.map((glyph, index) => (
              <SvgText
                key={index}
                x={glyph.x}
                y={glyph.y}
                textAnchor="middle"
                fontSize={glyph.size}
                fontWeight={glyph.bold ? '700' : '400'}
                fill={colors.background}
                stroke={colors.background}
                strokeWidth={glyph.size / (glyph.bold ? 6 : 5)}
              >
                {glyph.text}
              </SvgText>
            ))}
            {glyphs.map((glyph, index) => (
              <SvgText
                key={index}
                x={glyph.x}
                y={glyph.y}
                textAnchor="middle"
                fontSize={glyph.size}
                fontWeight={glyph.bold ? '700' : '400'}
                fill={colors.accent}
              >
                {glyph.text}
              </SvgText>
            ))}
          </Svg>
        )
      ) : null}
      {request && failedUri !== loadKey ? (
        <Image
          key={loadKey}
          accessible={false}
          source={request}
          resizeMode="cover"
          style={[s.image, { opacity: loadedUri === loadKey ? 1 : 0 }]}
          onLoad={() => setLoadedUri(loadKey)}
          onError={() => setFailedUri(loadKey)}
        />
      ) : null}
    </View>
  );
}
function HorizontalCover({
  title,
  author,
  width,
  height,
}: {
  title: string;
  author: string;
  width: number;
  height: number;
}) {
  const { colors } = useAppTheme();
  const [smallTitle, setSmallTitle] = useState(false);
  useEffect(() => setSmallTitle(false), [title, width]);
  return (
    <View accessibilityElementsHidden style={s.image}>
      <Text
        allowFontScaling={false}
        numberOfLines={4}
        onTextLayout={event => {
          if (
            !smallTitle &&
            (event.nativeEvent.lines.length > 1 ||
              event.nativeEvent.lines.some(line => line.width > width * 0.78))
          )
            setSmallTitle(true);
        }}
        style={{
          position: 'absolute',
          left: width * 0.11,
          top: height * 0.1,
          width: width * 0.78,
          fontSize: width / (smallTitle ? 9 : 7),
          fontWeight: '700',
          textAlign: 'center',
          color: colors.accent,
          textShadowColor: colors.background,
          textShadowRadius: width / 42,
          textShadowOffset: { width: 0, height: 0 },
        }}
      >
        {title}
      </Text>
      {author ? (
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.625}
          style={{
            position: 'absolute',
            right: width * 0.1,
            bottom: height * 0.08,
            maxWidth: width * 0.65,
            fontSize: width / 10,
            textAlign: 'right',
            color: colors.accent,
            textShadowColor: colors.background,
            textShadowRadius: width / 50,
            textShadowOffset: { width: 0, height: 0 },
          }}
        >
          {author}
        </Text>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  cover: { overflow: 'hidden', borderRadius: 4 },
  image: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
});
