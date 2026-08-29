import { useState } from 'react';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { coverDisplayText, loadCoverPreferences } from '../data/coverPreferences';
import { useAppTheme } from '../theme/AppTheme';

export function BookCover({ name, author, uri, style }: { name: string; author?: string; uri?: string; style?: StyleProp<ViewStyle> }) {
  const [failed, setFailed] = useState(false);
  const { colors, t, dark } = useAppTheme(),network=useNetInfo(),preferences=loadCoverPreferences(),remote=/^https?:/i.test(uri??''),networkAllowed=!preferences.loadOnlyWifi||!remote||network.type==='wifi'||network.type==='ethernet',fallback=dark?preferences.defaultCoverDark||preferences.defaultCover:preferences.defaultCover,showName=dark?preferences.showNameDark:preferences.showName,showAuthor=dark?preferences.showAuthorDark:preferences.showAuthor,source=uri&&networkAllowed&&!failed?uri:preferences.useDefaultCover&&fallback?fallback:undefined,title=coverDisplayText(name,preferences.keepPunctuation)||name,displayTitle=preferences.horizontal?title:[...title].slice(0,6).join('\n');
  return <View style={[s.cover,{ backgroundColor: colors.primary }, style]}>{source?<Image accessibilityLabel={t('namedBookCover', { name })} source={{ uri:source }} resizeMode="cover" style={s.image} onError={() => setFailed(true)} />:<View style={s.words}>{showName?<Text numberOfLines={preferences.horizontal?3:6} style={s.text}>{displayTitle}</Text>:null}{showAuthor&&author?<Text numberOfLines={1} style={s.author}>{coverDisplayText(author,preferences.keepPunctuation)||author}</Text>:null}</View>}</View>;
}
const s = StyleSheet.create({ cover:{overflow:'hidden',alignItems:'center',justifyContent:'center'},image:{width:'100%',height:'100%'},words:{padding:6,alignItems:'center',gap:4},text:{color:'#fff',fontWeight:'700',textAlign:'center',lineHeight:17},author:{color:'#eef5ef',fontSize:11,textAlign:'center'} });
