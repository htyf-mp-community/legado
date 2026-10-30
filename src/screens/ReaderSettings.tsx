import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PageHeader } from '../components/PageHeader';
import { ChineseConverter } from '../components/ChineseConverter';
import {
  defaultReaderPreferences,
  loadReaderPreferences,
  normalizeReaderPreferences,
  saveReaderPreferences,
  type PageAnimation,
  type ReaderOrientation,
  type ReaderPreferences,
  type ReaderTheme,
} from '../data/readerPreferences';
import { useAppTheme } from '../theme/AppTheme';

export function ReaderSettings({ back }: { back: () => void }) {
  const { colors, t } = useAppTheme();
  const [preferences, setPreferences] = useState(defaultReaderPreferences);
  useEffect(() => {
    void loadReaderPreferences().then(setPreferences);
  }, []);
  const change = (patch: Partial<ReaderPreferences>) => {
    const next = normalizeReaderPreferences({ ...preferences, ...patch });
    setPreferences(next);
    void saveReaderPreferences(next);
  };
  const themes: Array<[ReaderTheme, string]> = [
    ['paper', t('paper')],
    ['green', t('eyeCare')],
    ['night', t('night')],
    ['epaper', t('epaper')],
  ];
  const animations: Array<[PageAnimation, string]> = [
    ['none', t('none')],
    ['slide', t('slide')],
    ['cover', t('cover')],
    ['fade', t('fade')],
  ];
  const orientations: Array<[ReaderOrientation, string]> = [
    ['auto', t('autoRotate')],
    ['portrait', t('portrait')],
    ['landscape', t('landscape')],
  ];
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('readerSettings')} onBack={back} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('typography')}
        </Text>
        <ChineseConverter value={preferences.chineseConverterType} change={chineseConverterType => change({ chineseConverterType })} />
        <Stepper
          label={t('fontSize')}
          value={preferences.fontSize}
          step={1}
          change={fontSize => change({ fontSize })}
        />
        <Stepper
          label={t('lineSpacing')}
          value={preferences.lineHeight}
          step={2}
          change={lineHeight => change({ lineHeight })}
        />
        <Stepper
          label={t('letterSpacing')}
          value={preferences.letterSpacing}
          step={0.1}
          change={letterSpacing => change({ letterSpacing })}
        />
        <Stepper
          label={t('paragraphSpacing')}
          value={preferences.paragraphSpacing}
          step={1}
          change={paragraphSpacing => change({ paragraphSpacing })}
        />
        <Stepper
          label={t('horizontalInsets')}
          value={preferences.contentInsetHorizontal}
          step={2}
          change={contentInsetHorizontal => change({ contentInsetHorizontal })}
        />
        <Stepper
          label={t('verticalInsets')}
          value={preferences.contentInsetVertical}
          step={2}
          change={contentInsetVertical => change({ contentInsetVertical })}
        />
        <Toggle
          label={t('boldText')}
          value={preferences.textBold}
          change={textBold => change({ textBold })}
        />
        <Toggle
          label={t('textFullJustify')}
          value={preferences.textFullJustify}
          change={textFullJustify => change({ textFullJustify })}
        />
        <Toggle
          label={t('selectReaderText')}
          value={preferences.selectText}
          change={selectText => change({ selectText })}
        />
        {/* TODO(htyf-native): React Native does not expose selected text or the native selection action-menu model; see docs/htyf-migration-gaps.md. */}
        <View
          accessibilityRole="summary"
          style={[s.unavailable, { borderColor: colors.border }]}
        >
          <Text style={[s.unavailableTitle, { color: colors.text }]}>
            {t('textSelectionMenuConfig')}
          </Text>
          <Text style={{ color: colors.muted }}>
            {t('textSelectionMenuUnavailable')}
          </Text>
        </View>
        <Toggle
          label={t('paragraphIndent')}
          value={!!preferences.paragraphIndent}
          change={enabled => change({ paragraphIndent: enabled ? '　　' : '' })}
        />
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('background')}
        </Text>
        <Choices
          values={themes}
          selected={preferences.theme}
          choose={theme => change({ theme })}
        />
        {preferences.theme === 'paper' ? (
          <>
            <Field
              label={t('dayBackground')}
              value={preferences.paperBackground}
              change={paperBackground => change({ paperBackground })}
            />
            <Field
              label={t('dayText')}
              value={preferences.paperForeground}
              change={paperForeground => change({ paperForeground })}
            />
          </>
        ) : preferences.theme === 'night' ? (
          <>
            <Field
              label={t('nightBackground')}
              value={preferences.nightBackground}
              change={nightBackground => change({ nightBackground })}
            />
            <Field
              label={t('nightText')}
              value={preferences.nightForeground}
              change={nightForeground => change({ nightForeground })}
            />
          </>
        ) : preferences.theme === 'epaper' ? (
          <>
            <Field
              label={t('epaperBackground')}
              value={preferences.epaperBackground}
              change={epaperBackground => change({ epaperBackground })}
            />
            <Field
              label={t('epaperText')}
              value={preferences.epaperForeground}
              change={epaperForeground => change({ epaperForeground })}
            />
          </>
        ) : null}
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('readingMode')}
        </Text>
        <Choices
          values={[
            ['scroll', t('scrollReading')],
            ['page', t('pageReading')],
          ]}
          selected={preferences.mode}
          choose={mode => change({ mode: mode as ReaderPreferences['mode'] })}
        />
        {preferences.mode === 'page' ? (
          <>
            <Text style={[s.label, { color: colors.text }]}>
              {t('doublePageMode')}
            </Text>
            <Choices
              values={[
                ['single', t('singlePage')],
                ['double', t('doublePage')],
                ['landscape', t('landscapeDoublePage')],
                ['tabletLandscape', t('tabletLandscapeDoublePage')],
              ]}
              selected={preferences.doublePageMode}
              choose={doublePageMode => change({ doublePageMode })}
            />
          </>
        ) : null}
        <Text style={[s.label, { color: colors.text }]}>
          {t('readerImageClickMode')}
        </Text>
        <Choices
          values={[
            ['default', t('imageClickDefault')],
            ['preview', t('imageClickPreview')],
            ['compat', t('imageClickCompat')],
            ['disabled', t('imageClickDisabled')],
            ['double', t('imageClickDouble')],
          ]}
          selected={preferences.imageClickMode}
          choose={imageClickMode => change({ imageClickMode })}
        />
        <Text style={[s.label, { color: colors.text }]}>
          {t('highlightActionTrigger')}
        </Text>
        <Choices
          values={[
            ['click', t('highlightTriggerClick')],
            ['longPress', t('highlightTriggerLongPress')],
            ['off', t('highlightTriggerOff')],
          ]}
          selected={preferences.highlightActionTrigger}
          choose={highlightActionTrigger => change({ highlightActionTrigger })}
        />
        <Text style={[s.label, { color: colors.text }]}>
          {t('readerProgressBehavior')}
        </Text>
        <Choices
          values={[
            ['page', t('progressByPage')],
            ['chapter', t('progressByChapter')],
          ]}
          selected={preferences.progressBarBehavior}
          choose={progressBarBehavior => change({ progressBarBehavior })}
        />
        {preferences.mode === 'page' ? (
          <>
            <Text style={[s.label, { color: colors.text }]}>
              {t('pageAnimation')}
            </Text>
            <Choices
              values={animations}
              selected={preferences.pageAnimation}
              choose={pageAnimation => change({ pageAnimation })}
            />
          </>
        ) : null}
        <Text style={[s.label, { color: colors.text }]}>
          {t('orientation')}
        </Text>
        <Choices
          values={orientations}
          selected={preferences.orientation}
          choose={orientation => change({ orientation })}
        />
        <Toggle
          label={t('hideReaderStatusBar')}
          value={preferences.hideStatusBar}
          change={hideStatusBar => change({ hideStatusBar })}
        />
        <Toggle
          label={t('readerChromeFollowsPage')}
          value={preferences.readerChromeFollowsPage}
          change={readerChromeFollowsPage =>
            change({ readerChromeFollowsPage })
          }
        />
        <Toggle
          label={t('volumeKeyPaging')}
          value={preferences.volumeKeyPage}
          change={volumeKeyPage => change({ volumeKeyPage })}
        />
        <Stepper
          label={t('pageSwipeThreshold')}
          value={preferences.pageSwipeThreshold}
          step={4}
          change={pageSwipeThreshold => change({ pageSwipeThreshold })}
        />
        <Stepper
          label={t('pageEdgeInset')}
          value={preferences.pageEdgeInset}
          step={4}
          change={pageEdgeInset => change({ pageEdgeInset })}
        />
        <Toggle
          label={t('pullToToggleBookmark')}
          value={preferences.pullToToggleBookmark}
          change={pullToToggleBookmark => change({ pullToToggleBookmark })}
        />
        {preferences.pullToToggleBookmark ? (
          <Stepper
            label={t('pullBookmarkDistance')}
            value={preferences.pullBookmarkDistance}
            step={4}
            change={pullBookmarkDistance => change({ pullBookmarkDistance })}
          />
        ) : null}
        <Toggle
          label={t('twoFingerReplacePreview')}
          value={preferences.twoFingerReplacePreview}
          change={twoFingerReplacePreview =>
            change({ twoFingerReplacePreview })
          }
        />
        <Text style={{ color: colors.muted }}>
          {t('twoFingerReplacePreviewHelp')}
        </Text>
        <Toggle
          label={t('disableReaderReturnKey')}
          value={preferences.disableReturnKey}
          change={disableReturnKey => change({ disableReturnKey })}
        />
        <Text style={{ color: colors.muted }}>
          {t('disableReaderReturnKeyHelp')}
        </Text>
        <Toggle
          label={t('adaptSpecialStyle')}
          value={preferences.adaptSpecialStyle}
          change={adaptSpecialStyle => change({ adaptSpecialStyle })}
        />
        <Text style={{ color: colors.muted }}>
          {t('adaptSpecialStyleHelp')}
        </Text>
        <Toggle
          label={t('showBrightnessOverlay')}
          value={preferences.showBrightnessOverlay}
          change={showBrightnessOverlay => change({ showBrightnessOverlay })}
        />
        <Toggle
          label={t('showReaderTitleAddition')}
          value={preferences.showReaderTitleAddition}
          change={showReaderTitleAddition =>
            change({ showReaderTitleAddition })
          }
        />
        <Toggle
          label={t('showReaderTitleChapterNameOnly')}
          value={preferences.showReaderTitleChapterNameOnly}
          disabled={!preferences.showReaderTitleAddition}
          change={showReaderTitleChapterNameOnly =>
            change({ showReaderTitleChapterNameOnly })
          }
        />
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('readerHeaderFooter')}
        </Text>
        <Toggle
          label={t('showHeader')}
          value={preferences.showReaderHeader}
          change={showReaderHeader => change({ showReaderHeader })}
        />
        <Toggle
          label={t('showFooter')}
          value={preferences.showReaderFooter}
          change={showReaderFooter => change({ showReaderFooter })}
        />
        <Stepper
          label={t('readerInfoSize')}
          value={preferences.readerInfoTextSize}
          step={1}
          change={readerInfoTextSize => change({ readerInfoTextSize })}
        />
        <Field
          label={t('headerLeft')}
          value={preferences.headerLeftTemplate}
          change={headerLeftTemplate => change({ headerLeftTemplate })}
        />
        <Field
          label={t('headerMiddle')}
          value={preferences.headerMiddleTemplate}
          change={headerMiddleTemplate => change({ headerMiddleTemplate })}
        />
        <Field
          label={t('headerRight')}
          value={preferences.headerRightTemplate}
          change={headerRightTemplate => change({ headerRightTemplate })}
        />
        <Field
          label={t('footerLeft')}
          value={preferences.footerLeftTemplate}
          change={footerLeftTemplate => change({ footerLeftTemplate })}
        />
        <Field
          label={t('footerMiddle')}
          value={preferences.footerMiddleTemplate}
          change={footerMiddleTemplate => change({ footerMiddleTemplate })}
        />
        <Field
          label={t('footerRight')}
          value={preferences.footerRightTemplate}
          change={footerRightTemplate => change({ footerRightTemplate })}
        />
        <Text style={{ color: colors.muted }}>{t('templateHelp')}</Text>
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('mangaSettings')}
        </Text>
        <Toggle
          label={t('mangaHorizontal')}
          value={preferences.mangaHorizontal}
          change={mangaHorizontal => change({ mangaHorizontal })}
        />
        <Toggle
          label={t('hideMangaTitle')}
          value={preferences.disableMangaTitle}
          change={disableMangaTitle => change({ disableMangaTitle })}
        />
        <Toggle
          label={t('mangaFitScreen')}
          value={preferences.mangaFitScreen}
          change={mangaFitScreen => change({ mangaFitScreen })}
        />
        <Toggle
          label={t('mangaTapScroll')}
          value={preferences.mangaTapScroll}
          change={mangaTapScroll => change({ mangaTapScroll })}
        />
        <Toggle
          label={t('mangaAutoNext')}
          value={preferences.mangaAutoNext}
          change={mangaAutoNext => change({ mangaAutoNext })}
        />
        {/* TODO(htyf-native): Keep-awake remains unavailable until the configured native work in docs/htyf-migration-gaps.md is authorized. */}
        <Text
          style={[s.note, { color: colors.muted, borderColor: colors.border }]}
        >
          {t('readerNativeSettingsUnavailable')}
        </Text>
      </ScrollView>
    </View>
  );
}

function Stepper({
  label,
  value,
  step,
  change,
}: {
  label: string;
  value: number;
  step: number;
  change: (value: number) => void;
}) {
  const { colors, t } = useAppTheme();
  return (
    <View style={[s.row, { borderColor: colors.border }]}>
      <Text style={[s.grow, { color: colors.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('decrease', { name: label })}
        style={s.button}
        onPress={() => change(value - step)}
      >
        <Text style={[s.symbol, { color: colors.primary }]}>−</Text>
      </Pressable>
      <Text style={[s.value, { color: colors.text }]}>
        {Math.round(value * 10) / 10}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('increase', { name: label })}
        style={s.button}
        onPress={() => change(value + step)}
      >
        <Text style={[s.symbol, { color: colors.primary }]}>＋</Text>
      </Pressable>
    </View>
  );
}
function Toggle({
  label,
  value,
  change,
  disabled = false,
}: {
  label: string;
  value: boolean;
  change: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[s.row, { borderColor: colors.border }, disabled && s.disabled]}
    >
      <Text style={[s.grow, { color: colors.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        value={value}
        onValueChange={change}
      />
    </View>
  );
}
function Choices<T extends string>({
  values,
  selected,
  choose,
}: {
  values: Array<[T, string]>;
  selected: string;
  choose: (value: T) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={s.wrap}>
      {values.map(([value, label]) => (
        <Pressable
          accessibilityRole="radio"
          accessibilityLabel={label}
          accessibilityState={{ selected: value === selected }}
          key={value}
          style={[
            s.choice,
            {
              backgroundColor: colors.surface,
              borderColor: value === selected ? colors.primary : colors.border,
            },
          ]}
          onPress={() => choose(value)}
        >
          <Text style={{ color: colors.text }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
function Field({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: (value: string) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          s.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      />
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  heading: { fontSize: 18, fontWeight: '800', marginTop: 10 },
  label: { fontWeight: '700' },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  disabled: { opacity: 0.45 },
  grow: { flex: 1 },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { fontSize: 22 },
  value: { minWidth: 42, textAlign: 'center', fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  note: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    marginTop: 10,
    lineHeight: 20,
  },
  unavailable: {
    minHeight: 60,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    gap: 4,
  },
  unavailableTitle: { fontWeight: '700' },
});
