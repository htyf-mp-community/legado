import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import { InTreeSheet } from './InTreeSheet';
import { pickBookListText } from '../core/bookListFile';
import { useAppTheme } from '../theme/AppTheme';
export function BookListImportSheet({
  visible,
  dismiss,
  submit,
}: {
  visible: boolean;
  dismiss: () => void;
  submit: (input: string) => void;
}) {
  const { colors, t } = useAppTheme();
  const [value, setValue] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    if (visible) {
      setValue('');
      setError('');
    }
  }, [visible]);
  const choose = async () => {
    try {
      const raw = await pickBookListText();
      dismiss();
      submit(raw);
    } catch (cause) {
      if (
        !(
          isErrorWithCode(cause) && cause.code === errorCodes.OPERATION_CANCELED
        )
      )
        setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <InTreeSheet visible={visible} onDismiss={dismiss}>
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 20, marginBottom: 12 }}
      >
        {t('bookListImport')}
      </Text>
      <BottomSheetTextInput
        accessibilityLabel={t('bookListInput')}
        placeholder="url/json"
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={setValue}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          minHeight: 90,
          maxHeight: 240,
          padding: 8,
          color: colors.text,
          borderBottomWidth: 1,
          borderColor: colors.border,
          textAlignVertical: 'top',
        }}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      <View style={s.footer}>
        <Action label={t('bookListSelectFile')} press={() => void choose()} />
        <View style={{ flex: 1 }} />
        <Action label={t('cancel')} press={dismiss} />
        <Action
          label={t('confirm')}
          press={() => {
            dismiss();
            submit(value);
          }}
        />
      </View>
    </InTreeSheet>
  );
}
function Action({ label, press }: { label: string; press: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" style={s.action} onPress={press}>
      <Text style={{ color: colors.accent }}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    flexWrap: 'wrap',
  },
  action: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
});
