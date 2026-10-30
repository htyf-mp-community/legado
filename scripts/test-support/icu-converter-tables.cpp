// Test/build-time export of ICU mapping facts and malformed-sequence lengths.
// No native code from this utility is shipped in the app.
#include <unicode/ucnv.h>
#include <unicode/ucnv_err.h>
#include <unicode/uversion.h>
#include <iostream>
#include <sstream>
#include <string>
#include <iomanip>
#include <vector>

std::string quote(const std::u16string &value) {
  std::ostringstream out; out << '"';
  for(auto c:value) out << "\\u" << std::hex << std::setfill('0') << std::setw(4) << int(c);
  return out.str()+'"';
}
struct Result {std::u16string text; int error;};
Result convert(UConverter *converter,const std::vector<char> &bytes,bool flush) {
  UErrorCode status=U_ZERO_ERROR;ucnv_resetToUnicode(converter);
  UChar output[8];UChar *target=output;const char *input=bytes.data();
  ucnv_toUnicode(converter,&target,output+8,&input,input+bytes.size(),nullptr,flush,&status);
  int8_t length=0;char invalid[32];
  if(U_FAILURE(status)){UErrorCode e=U_ZERO_ERROR;length=32;ucnv_getInvalidChars(converter,invalid,&length,&e);}
  return {std::u16string(output,target),U_FAILURE(status)?length:0};
}
UConverter *open(const char *name) {
  UErrorCode status=U_ZERO_ERROR;auto c=ucnv_open(name,&status);
  if(U_FAILURE(status)){std::cerr<<name<<':'<<u_errorName(status);std::exit(1);}
  ucnv_setToUCallBack(c,UCNV_TO_U_CALLBACK_STOP,nullptr,nullptr,nullptr,&status);return c;
}
char16_t cell(const Result &result) {
  if(result.text.size()>1){std::cerr<<"Unexpected multi-unit mapping";std::exit(1);}
  return !result.text.empty()?result.text[0]:result.error?result.error-1:2;
}
int main() {
  UVersionInfo version;u_getVersion(version);
  std::cout<<"{\"icuVersion\":\""<<int(version[0])<<'.'<<int(version[1])<<"\",\"single\":{";
  bool comma=false;
  for(auto name:{"ISO-8859-1","ISO-8859-2","ISO-8859-5","ISO-8859-6","ISO-8859-7","ISO-8859-8","ISO-8859-8-I","ISO-8859-9","windows-1250","windows-1251","windows-1252","windows-1253","windows-1254","windows-1255","windows-1256","KOI8-R"}) {
    auto c=open(name);std::u16string table;
    for(int i=0;i<256;i++){auto r=convert(c,{char(i)},true);table.push_back(r.text.empty()?u'\ufffd':r.text[0]);}
    if(comma)std::cout<<',';comma=true;std::cout<<'"'<<name<<"\":"<<quote(table);ucnv_close(c);
  }
  std::cout<<"},\"multi\":{";comma=false;
  for(auto name:{"Big5","Shift_JIS","GBK","GB18030","EUC-KR","EUC-JP","GB2312","ibm-949"}) {
    auto c=open(name);if(comma)std::cout<<',';comma=true;std::cout<<'"'<<name<<"\":{";
    std::u16string single;std::ostringstream rows,triples;bool rowComma=false,tripleComma=false;
    for(int first=0;first<256;first++) {
      auto r=convert(c,{char(first)},false);
      if(!r.text.empty()){single.push_back(r.text[0]);continue;}
      if(r.error){single.push_back(u'\ufffd');continue;}
      single.push_back(0);std::u16string row;
      for(int second=0;second<256;second++) {
        auto pair=convert(c,{char(first),char(second)},false);row.push_back(cell(pair));
        if(std::string(name)=="EUC-JP" && first==0x8f && !pair.error && pair.text.empty()) {
          std::u16string triple;
          for(int third=0;third<256;third++)triple.push_back(cell(convert(c,{char(first),char(second),char(third)},true)));
          if(tripleComma)triples<<',';tripleComma=true;triples<<'"'<<second<<"\":"<<quote(triple);
        }
      }
      if(rowComma)rows<<',';rowComma=true;rows<<'"'<<first<<"\":"<<quote(row);
    }
    std::cout<<"\"single\":"<<quote(single)<<",\"double\":{"<<rows.str()<<"},\"triple\":{"<<triples.str()<<"}}";ucnv_close(c);
  }
  std::cout<<"},\"gb18030Ranges\":[";auto gb=open("GB18030");int previous=-9;comma=false;
  for(int index=0;index<126*10*126*10;index++) {
    int n=index;int fourth=n%10+0x30;n/=10;int third=n%126+0x81;n/=126;int second=n%10+0x30;int first=n/10+0x81;
    auto r=convert(gb,{char(first),char(second),char(third),char(fourth)},true);
    int value=r.error||r.text.empty()?-1:r.text.size()==2?0x10000+((r.text[0]-0xd800)<<10)+(r.text[1]-0xdc00):r.text[0];
    if((value<0&&previous>=0)||(value>=0&&(previous<0||value!=previous+1))){if(comma)std::cout<<',';comma=true;std::cout<<'['<<index<<','<<value<<']';}previous=value;
  }
  ucnv_close(gb);std::cout<<"],\"cns\":{";auto tw=open("cns-11643-1992"),cn=open("ibm-5478");
  for(int plane=0;plane<=2;plane++) {
    if(plane>0)std::cout<<',';std::cout<<'"'<<plane<<"\":[";
    for(int row=0x21;row<=0x7e;row++)for(int col=0x21;col<=0x7e;col++) {
      if(row>0x21||col>0x21)std::cout<<',';
      auto r=plane?convert(tw,{char(0x80+plane),char(row),char(col)},true):convert(cn,{char(row),char(col)},true);
      std::cout<<(r.error||r.text.empty()?-1:r.text.size()==2?0x10000+((r.text[0]-0xd800)<<10)+(r.text[1]-0xdc00):r.text[0]);
    }
    std::cout<<']';
  }
  ucnv_close(tw);ucnv_close(cn);std::cout<<"},\"jis\":[";auto jp=open("ISO-2022-JP");
  for(int row=0x21;row<=0x7e;row++)for(int col=0x21;col<=0x7e;col++) {
    if(row>0x21||col>0x21)std::cout<<',';
    auto r=convert(jp,{char(0x1b),char(0x24),char(0x42),char(row),char(col)},true);
    std::cout<<(r.error||r.text.empty()?-1:r.text[0]);
  }
  ucnv_close(jp);std::cout<<"]}\n";
}
