import {useLayoutEffect,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View,type StyleProp,type TextStyle} from 'react-native';
import {useAppTheme} from '../theme/AppTheme';

/** Match the native detail page's four-line introduction and overflow toggle. */
export function CollapsibleBookIntro({text,style}:{text:string;style?:StyleProp<TextStyle>}) {
  const {colors,t}=useAppTheme();
  const [expanded,setExpanded]=useState(false),[canExpand,setCanExpand]=useState(false);
  const current=useRef(text);current.current=text;
  useLayoutEffect(()=>{setExpanded(false);setCanExpand(false);},[text]);
  return <View>
    <Text style={style} numberOfLines={expanded?undefined:4} ellipsizeMode="tail">{text}</Text>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.measure}>
      <Text style={style} numberOfLines={5} onTextLayout={event=>{
        if(current.current===text)setCanExpand(event.nativeEvent.lines.length>4);
      }}>{text}</Text>
    </View>
    {canExpand?<Pressable accessibilityRole="button" accessibilityLabel={t(expanded?'collapseBookIntro':'expandBookIntro')}
      accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)} style={styles.toggle}>
      <Text style={{color:colors.primary}}>{t(expanded?'collapseIntro':'expandIntro')}</Text>
    </Pressable>:null}
  </View>;
}
const styles=StyleSheet.create({
  measure:{position:'absolute',top:0,left:0,right:0,opacity:0},
  toggle:{alignSelf:'flex-end',minWidth:48,minHeight:48,paddingHorizontal:12,alignItems:'center',justifyContent:'center'},
});
