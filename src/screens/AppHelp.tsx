import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { sourceHelp } from '../assets/sourceHelp';
import { PageHeader } from '../components/PageHeader';
import { useAppTheme } from '../theme/AppTheme';

export function AppHelp({
  back,
  open,
}: {
  back: () => void;
  open: (url: string) => void;
}) {
  const { colors, dark, t } = useAppTheme();
  const html = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${sourceHelp.css}
body{min-width:200px;max-width:980px;margin:0 auto;padding:45px;background:${dark ? '#212121' : '#fff'}}
.markdown-body{background:transparent;color:${dark ? '#fff' : '#1f2328'}}
</style></head><body><div id="mdviewer" class="markdown-body"></div><script>${sourceHelp.marked}</script><script>document.getElementById('mdviewer').innerHTML=marked.parse(${JSON.stringify(sourceHelp.markdown).replace(/</g, '\\u003c')});</script></body></html>`,
    [dark],
  );
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader sourceTone title={t('mineHelpTitle')} onBack={back} />
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={s.flex}
        onShouldStartLoadWithRequest={request => {
          if (
            request.url === 'about:blank' ||
            request.url.startsWith('about:blank#')
          )
            return true;
          if (/^https?:\/\//i.test(request.url)) open(request.url);
          return false;
        }}
      />
    </View>
  );
}
const s = StyleSheet.create({ flex: { flex: 1 } });
