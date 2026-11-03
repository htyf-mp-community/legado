import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AppThemeProvider } from '../../../src/theme/AppTheme';
import { OnlineBookDetail } from '../../../src/screens/OnlineBookDetail';
import type { Book, SearchBook } from '../../../src/types';
const base = 'http://127.0.0.1:18217';
const initialBook: SearchBook = {
  bookUrl: `${base}/detail`,
  origin: base,
  originName: '文件源验收',
  name: '文件源验收书',
  author: '验收作者',
  sourceType: 3,
};
export default function DeviceHarness() {
  const [result, setResult] = useState<{ book: Book; read?: boolean }>();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <BottomSheetModalProvider>
            {result ? (
              <View style={{ paddingTop: 100, paddingHorizontal: 20 }}>
                <Text accessibilityLabel="导入结果" style={{ fontSize: 24 }}>
                  导入结果：{result.read ? '阅读' : '加入书架'}
                </Text>
                <Text style={{ fontSize: 20 }}>{result.book.name}</Text>
                <Text style={{ fontSize: 20 }}>{result.book.content}</Text>
              </View>
            ) : (
              <OnlineBookDetail
                initialBook={initialBook}
                back={() => {}}
                search={() => {}}
                added={(book, read) => setResult({ book, read })}
              />
            )}
          </BottomSheetModalProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
