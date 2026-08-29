import { useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { PageHeader } from '../components/PageHeader';
import { exportBookFile, type BookExportFormat } from '../core/bookExport';
import type { Book } from '../types';
import { useAppTheme } from '../theme/AppTheme';

export function BookExport({ book, back }: { book?: Book; back: () => void }) {
  const {colors,t}=useAppTheme();
  const [running,setRunning]=useState(false),[message,setMessage]=useState(''),[path,setPath]=useState('');
  const run=async(format:BookExportFormat)=>{if(!book||running)return;const label=format.toUpperCase();setRunning(true);setMessage(t('exporting',{format:label}));try{const value=await exportBookFile(book,format);setPath(value);setMessage(t('exportComplete'));await Share.share({title:book.name,url:`file://${value}`,message:t('exportShareMessage',{name:book.name,path:value})},{dialogTitle:t('shareBook',{name:book.name})});}catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setRunning(false);}};
  const button=(format:BookExportFormat,primary=false)=><Pressable accessibilityRole="button" disabled={!book||running} style={primary?s.primary:[s.secondary,{borderColor:colors.primary}]} onPress={()=>void run(format)}><Text style={primary?s.primaryText:[s.secondaryText,{color:colors.primary}]}>{t('exportAndShare',{format:format.toUpperCase()})}</Text></Pressable>;
  return <View style={[s.flex,{backgroundColor:colors.background}]}><PageHeader title={t('exportTitle')} onBack={back}/><View style={s.content}><Text style={[s.name,{color:colors.text}]}>{book?.name??t('bookNotFound')}</Text><Text style={[s.note,{color:colors.muted}]}>{t('exportNote')}</Text>{running?<ActivityIndicator/>:null}{message?<Text style={[s.message,{color:colors.primary}]}>{message}</Text>:null}{path?<Text selectable style={[s.path,{color:colors.muted}]}>{path}</Text>:null}{button('epub',true)}{button('pdf',true)}{button('txt')}{button('json')}</View></View>;
}
const s=StyleSheet.create({flex:{flex:1},content:{padding:22,gap:16},name:{fontSize:23,fontWeight:'800'},note:{color:'#666',lineHeight:22},message:{color:'#285d42',fontWeight:'700'},path:{color:'#666',fontSize:12},primary:{minHeight:50,borderRadius:25,backgroundColor:'#285d42',alignItems:'center',justifyContent:'center'},primaryText:{color:'#fff',fontWeight:'700'},secondary:{minHeight:50,borderRadius:25,borderWidth:1,borderColor:'#285d42',alignItems:'center',justifyContent:'center'},secondaryText:{color:'#285d42',fontWeight:'700'}});
