import com.google.gson.Gson;
import java.text.DecimalFormat;
import java.util.*;
import java.util.regex.Pattern;

/** JVM oracle transcribing BookHelp/AppPattern/StringUtils without Android dependencies. */
public class BookMetadataOracle {
  static final Pattern NAME = Pattern.compile("\\s+作\\s*者.*|\\s+\\S+\\s+著");
  static final Pattern AUTHOR = Pattern.compile("^\\s*作\\s*者[:：\\s]+|\\s+著");
  static final Pattern NUMBER = Pattern.compile("-?[0-9]+");
  static final DecimalFormat FORMAT = new DecimalFormat("#.#");
  static String count(String value) {
    if (!NUMBER.matcher(value).matches()) return value;
    try {
      int n = Integer.parseInt(value);
      if (n <= 0) return "";
      return n > 10000 ? FORMAT.format(n * 1.0f / 10000d) + "万字" : n + "字";
    } catch (NumberFormatException ex) { return null; }
  }
  static void add(List<List<String>> rows, String input, String output) {
    rows.add(Arrays.asList(input, output));
  }
  public static void main(String[] args) {
    Locale.setDefault(Locale.CHINA);
    String[] ws={"", " ", "\t", "\n", "\r\n", "\u000b", "\u00a0", "\u2003", "\u3000", "\u0000"};
    String[] names={"西游记", "  骆驼祥子", "A", "", "作 者", "\uD83D\uDCDA书", "多\n行", "名\u0085行"};
    String[] suffix={"", " 作者：张三", " 作 者 李四", " 张三 著", " A 著续", "\n作者:甲\n尾", "\u00a0作者：甲", "\tX\t著"};
    String[] authors={"老舍", "作者： 老舍", " 作 者 : A 著", "作者A", "作者：", "", "\u00a0作者：A", "著", "张三 著续", "\uD83D\uDCDA"};
    Map<String,List<List<String>>> out = new LinkedHashMap<>();
    List<List<String>> n = new ArrayList<>(), a = new ArrayList<>(), w = new ArrayList<>();
    for(String left:ws) for(String name:names) for(String tail:suffix) {String v=left+name+tail; add(n,v,NAME.matcher(v).replaceAll("").trim());}
    for(String left:ws) for(String author:authors) for(String right:ws) {String v=left+author+right; add(a,v,AUTHOR.matcher(v).replaceAll("").trim());}
    String[] fixed={"", "0", "-0", "-1", "1", "0012", "9999", "10000", "10001", "2147483647", "2147483648", "-2147483648", "-2147483649", "1.2", "10000字", " 123 ", "+2", "１２３", "99万", "NaN"};
    for(String v:fixed) add(w,v,count(v));
    for(int v=10000; v<=300000; v+=137) {String s=Integer.toString(v);add(w,s,count(s));}
    for(int v=10500; v<=1000000; v+=1000) {String s=Integer.toString(v);add(w,s,count(s));}
    Random random=new Random(23112026L);
    for(int i=0;i<1500;i++) {String s=Integer.toString(random.nextInt(Integer.MAX_VALUE));add(w,s,count(s));}
    out.put("name",n);out.put("author",a);out.put("wordCount",w);
    System.out.println(new Gson().toJson(out));
  }
}
