import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { InTreeSheet } from './InTreeSheet';
import { useAppTheme } from '../theme/AppTheme';
import type { useBookCatalogue } from '../hooks/useBookCatalogue';
export function BookCatalogueStatus({
  state,
}: {
  state: ReturnType<typeof useBookCatalogue>;
}) {
  const { colors, t } = useAppTheme();
  return (
    <>
      {state.needed && !state.loading ? (
        <View style={s.notice}>
          <Text
            accessibilityRole={state.error ? 'alert' : undefined}
            style={{
              color: state.error ? colors.danger : colors.muted,
              flex: 1,
            }}
          >
            {state.error || t('bookListCataloguePending')}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={s.action}
            onPress={state.retry}
          >
            <Text style={{ color: colors.accent }}>{t('retry')}</Text>
          </Pressable>
        </View>
      ) : null}
      <InTreeSheet
        visible={state.needed && state.loading}
        onDismiss={state.cancel}
      >
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 20 }}
        >
          {t('bookListLoadingCatalogue')}
        </Text>
        <ActivityIndicator
          color={colors.accent}
          style={{ marginVertical: 20 }}
        />
        <Pressable
          accessibilityRole="button"
          style={s.action}
          onPress={state.cancel}
        >
          <Text style={{ color: colors.accent }}>{t('cancel')}</Text>
        </Pressable>
      </InTreeSheet>
    </>
  );
}
const s = StyleSheet.create({
  notice: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  action: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
