// Test-only ICU reference. Never linked into the iOS app or mini-program.
#include <unicode/ucnv.h>
#include <unicode/ucnv_err.h>
#include <unicode/ucnv_cb.h>
#include <unicode/uversion.h>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <iomanip>

// Java CharsetDecoder's replacement is U+FFFD, including single-byte errors.
void replacement(const void*,UConverterToUnicodeArgs *args,const char*,int32_t,UConverterCallbackReason reason,UErrorCode *status) {
  if(reason<=UCNV_IRREGULAR){*status=U_ZERO_ERROR;UChar value=0xfffd;ucnv_cbToUWriteUChars(args,&value,1,0,status);}
}

int main() {
  UVersionInfo version; u_getVersion(version);
  std::cerr << "ICU " << int(version[0]) << '.' << int(version[1]) << '\n';
  std::string line;
  while (std::getline(std::cin,line)) {
    auto tab=line.find('\t'); auto name=line.substr(0,tab), hex=line.substr(tab+1);
    std::vector<char> bytes;
    for(size_t i=0;i<hex.size();i+=2) bytes.push_back(char(std::stoi(hex.substr(i,2),nullptr,16)));
    UErrorCode status=U_ZERO_ERROR; UConverter *converter=ucnv_open(name.c_str(),&status);
    if(U_FAILURE(status)){std::cout << "error:" << u_errorName(status) << '\n';continue;}
    ucnv_setToUCallBack(converter,replacement,nullptr,nullptr,nullptr,&status);
    std::vector<UChar> output(bytes.size()*2+8);
    int32_t count=ucnv_toUChars(converter,output.data(),output.size(),bytes.data(),bytes.size(),&status);
    if(U_FAILURE(status))std::cout << "error:" << u_errorName(status);
    else for(int i=0;i<count;i++)std::cout << std::hex << std::setfill('0') << std::setw(4) << int(output[i]);
    std::cout << '\n'; ucnv_close(converter);
  }
}
