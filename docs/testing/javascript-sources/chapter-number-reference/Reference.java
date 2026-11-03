import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.*;
public class Reference {
 static HashMap<Character,Integer> map=new HashMap<>();
 static {for(String s:new String[]{"零一二三四五六七八九十","〇壹贰叁肆伍陆柒捌玖拾"})for(int i=0;i<s.length();i++)map.put(s.charAt(i),i);map.put('两',2);map.put('百',100);map.put('佰',100);map.put('千',1000);map.put('仟',1000);map.put('万',10000);map.put('亿',100000000);}
 static int convert(String in){
  StringBuilder b=new StringBuilder();for(char c:in.toCharArray())b.append(c==12288?' ':c>=65281&&c<=65374?(char)(c-65248):c);String num=b.toString().replaceAll("\\s+","");
  try{return Integer.parseInt(num);}catch(Exception ignored){}
  int result=0,tmp=0,billion=0;char[] cn=num.toCharArray();
  try {for(int i=0;i<cn.length;i++){int t=map.get(cn[i]);if(t==100000000){result+=tmp;result*=t;billion=billion*100000000+result;result=0;tmp=0;}else if(t==10000){result+=tmp;result*=t;tmp=0;}else if(t>=10){if(tmp==0)tmp=1;result+=t*tmp;tmp=0;}else tmp=i>=2&&i==cn.length-1&&map.get(cn[i-1])>10?t*map.get(cn[i-1])/10:tmp*10+t;}return result+tmp+billion;}catch(Exception e){return -1;}
 }
 static String chapter(String s){Matcher m=Pattern.compile("(第)(.+?)(章)").matcher(s);return m.find()?m.group(1)+convert(m.group(2))+m.group(3):s;}
 public static void main(String[] args)throws Exception{BufferedReader r=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8));String s;while((s=r.readLine())!=null){String value=new String(Base64.getDecoder().decode(s),StandardCharsets.UTF_8);System.out.println(Base64.getEncoder().encodeToString(chapter(value).getBytes(StandardCharsets.UTF_8)));}}
}
