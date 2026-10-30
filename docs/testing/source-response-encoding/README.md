# 响应编码验收 / Response encoding acceptance

2026-10-30，本地 **0.0.42**。完整 1:1 迁移仍未完成。仅在独立 iOS 模拟器调试，未执行 Android 构建或设备操作。
Local **0.0.42**. Full migration parity remains incomplete. Device work targets only the dedicated iOS Simulator.

## 修改 / Changes

此前缺少 charset 响应头时，使用请求编码或平台 UTF-8 文本接口；即使 HTML 明确声明 GBK，也会乱码。现在读取原始响应字节，按原版顺序移除长度大于 3 的 UTF-8 BOM、读取有效响应头 charset、读取 HTML head 声明，再调用原版默认 ICU 检测器。请求 charset 只控制请求编码。
Headerless responses previously used the request encoding or platform UTF-8 text conversion, corrupting pages even when HTML declared GBK. Raw bytes now follow the native order: remove a UTF-8 BOM only when length exceeds three, use valid response-header charset, inspect HTML head declarations, then run the native default detector. Request encoding remains separate.

| 原版规格 / Native contract | 目标 / Target |
| --- | --- |
| `EncodingDetect.getHtmlEncode`，严格 head 字节查找与 UTF-8 正则回退、meta 顺序 / strict head scan, regex fallback, ordered meta fields | `src/core/sourceResponse.ts` |
| 原项目自带 ICU 默认检测器，8000 字节统计边界、原始字节识别、候选排序 / source-bundled default ICU recognizers, input limits and tie order | `src/core/sourceCharset.ts`, `src/data/sourceCharsetData.json` |
| 系统 Charset/ICU 解码边界 / system Charset/ICU decoding boundary | `src/core/sourceCharsetDecode.ts`, frozen ICU **77.1** converter facts |
| 原项目固定 OkHttp **5.4.0** MediaType 参数解析 / source-pinned MediaType parser | `sourceHeaderCharset` |
| `Utf8BomUtils` 和 `OkHttpUtils.ResponseBody.text` 的顺序 / response decoding order | `decodeSourceResponse`, `executeSourceRequest` |

包含 UTF-8/16/32、常用单字节编码、GBK/GB18030、Big5、Shift_JIS、EUC-JP/KR、ISO-2022-JP/KR/CN 的转换与转义状态。转换表在开发机生成，运行时只使用 TypeScript/JSON 和已有 iconv-lite；没有新增 npm 依赖、原生模块或原生工程修改。许可证随包保留。
The implementation covers the default detector's Unicode, single/multibyte and ISO-2022 families. Tables are generated on the development machine; runtime uses TypeScript/JSON and existing iconv-lite only. No npm dependencies, native modules or native project changes were added. Licenses are retained in the archive.

## 对照与回归 / Comparison and regression

**214 suites / 1,053 tests pass**。**3,398** 组输入的原版候选列表、置信度、语言、同分顺序和 HTML 声明一致，共 **18,737** 条候选记录；响应字节输出与固定 ICU 77.1 参考一致。覆盖多语种、长输入、随机字节、BOM、代理项、截断、ISO-2022 非法/连续转义、头部冲突与无效参数。TypeScript 和 ESLint 通过。
All **214 suites / 1,053 tests pass**. Candidate/confidence/language/tie order and HTML declarations match **3,398** original-method inputs, totaling **18,737** candidate records. Decoded output matches the pinned ICU 77.1 reference. Cases include multilingual/long/random input, BOMs, surrogates, truncation, malformed/adjacent ISO-2022 escapes and conflicting/invalid headers. TypeScript and ESLint pass.

检测器与 Kotlin 方法从只读原项目直接编译，Android 文件描述符接口仅用不可调用的边界桩；Jsoup 为 **1.16.2**。MediaType 从原项目固定版本的官方源码 JAR 原样编译。转换参考为本机 ICU 77.1，使用 Java CharsetDecoder 的 U+FFFD 替换回调。保留 JDK 解码摘要供诊断：**1,746** 组与 ICU 不同，因此没有把 JDK 转换表直接作为 Android 规格。
Detector and Kotlin methods compile unchanged from the read-only source, with unused Android file-descriptor stubs and Jsoup **1.16.2**. MediaType compiles unchanged from the source-pinned official archive. Conversion uses local ICU 77.1 with Java's U+FFFD replacement callback. JDK decoding digests are diagnostic: **1,746** inputs differ from ICU, so JDK mappings are not treated as Android conversion behavior.

短小无声明文本仍保留原版统计结果：GBK 的“**三体**”四个字节会被判断为 ISO-8859-7；声明 GBK 后正确解码。旧测试把请求 charset 当成了响应声明，已改为提供实际响应头，并将无声明反例加入原版语料。
Native detection remains statistical: four headerless GBK bytes for 三体 are classified as ISO-8859-7; a GBK declaration decodes correctly. The old test incorrectly treated request charset as a response declaration. It now supplies a real response header, while the headerless counterexample is retained in the native corpus.

证据 / Evidence: [initial red](red.log), [legacy assumption red](legacy-assumption-red.log), [passing tests](tests.log), [native comparison](native-comparison.json), [reference runner](../../../scripts/source-response-reference.py), [iOS fixture](../../../scripts/source-response-fixture.mjs).

复现 / Reproduce:

```sh
python3 scripts/source-response-reference.py \
  --source-root /Users/dgz/code/github/legado \
  --kotlin-lib /Users/dgz/.gradle/wrapper/dists/gradle-9.3.1-bin/23ovyewtku6u96viwx3xl3oks/gradle-9.3.1/lib \
  --jsoup-jar /private/tmp/legado-ios-debug/source-response-encoding/jsoup-1.16.2.jar \
  --okhttp-sources /private/tmp/legado-ios-debug/source-response-encoding/okhttp-jvm-5.4.0-sources.jar \
  --icu-root /opt/homebrew/Cellar/icu4c@77/77.1_1 \
  --icu-2022-source /private/tmp/legado-ios-debug/source-response-encoding/ucnv2022.cpp \
  --output __tests__/fixtures/sourceResponse.native.json \
  --tables-output src/data/sourceCharsetData.json \
  --decoder-output src/data/sourceCharsetDecodeData.json
```

测试依赖来自官方 Maven；ISO-2022 源文件来自 [ICU release-77-1](https://github.com/unicode-org/icu/blob/release-77-1/icu4c/source/common/ucnv2022.cpp)。本机 ICU 安装路径只用于测试/数据生成，不是应用运行条件。完整别名、其他系统 ICU 版本及原版 Android Runtime 的映射矩阵仍待核对。
Test dependencies come from official Maven and the linked ICU release. The local ICU path is only a test/data-generation requirement. Full aliases, other OS ICU versions and exact source Android-runtime mapping matrices remain open.

## 独立 iOS / Dedicated iOS

设备 / Device: **Legado HTYF 调试**, iPhone 17 Pro, iOS 26.5, UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`。沿用已安装 RN **0.86.2** 宿主和独立 `127.0.0.1:8097` 服务。

通过正常网络导入临时源，普通搜索关键词“编码验收”成功返回一本书。请求查询使用 GBK；响应为没有 charset 头的 GB18030 JSON。详情使用带 GBK meta 的 HTML，目录使用无声明 ISO-2022-JP HTML；正确显示两项日文目录。正常加入书架并开始阅读，UTF-16LE 响应头覆盖冲突 GBK meta，正文中文、日文与“𠮷”均可见。
Normal source import and ordinary search return one book. The query uses GBK while the response is headerless GB18030 JSON. Details use GBK-declared HTML; contents use headerless ISO-2022-JP and display two Japanese titles. Adding the book and starting the reader shows UTF-16LE content correctly despite a conflicting GBK meta declaration, including Chinese, Japanese and 𠮷.

截图 / Screenshots: [search](search.png), [details/TOC](detail-toc.png), [reader](reader.png)。本轮只核对该编码链；没有据此认定完整排版、分页、选区或手势通过。
This accepts the encoding flow, not complete layout, pagination, selection or gesture parity.

最终代码再次调试真实「📂阅读书屋」的《西游记》：搜索 **1** 条、详情成功、目录 **105** 项、第一项正文 **119** 字符。119 字符来自书源目录的前置页，不代表完整章节或全站正确，见 [真实源截图](real-source-debug.png)。
The final code also passes fresh real-source debugging: **1** search result, successful details, **105** TOC entries and **119** characters from the first front-matter entry. This does not establish complete-chapter or whole-site correctness.

通过正常 ZIP 导出比较，测试前后的 **25 项既有导出记录全部一致**，其中 **9 本书、8 条源、0 条规则、12 条阅读记录**摘要相同；没有直接读写 MMKV。临时源、书籍、阅读记录与新增搜索历史均已通过 UI 清理，两个本轮生成的缓存 ZIP 已校验后移除，临时 18213 服务已关闭。新增管理偏好 `bookshelf.manage.delete-original.v1` 单独记录：删除源文件在 UI 中未勾选，但导出值为 string 空串，不能据此认定布尔类型往返正确，见 [数据保留核对](preservation.json)。
Normal ZIP exports retain all **25 existing entries** exactly, including **9 books, 8 sources, 0 rules and 12 reading records**, without direct MMKV access. Temporary source/book/records/search history were removed through UI; only the two verified task-generated cache ZIPs were deleted. Port 18213 is stopped. A newly materialized management preference is recorded separately: its UI was unchecked, but the export contains an empty string, so boolean export/restore typing remains unaccepted.

冷启动后版本 **0.0.42**、独立存储 ID 和 RN **0.86.2**正确；书架 **9 本 / 在读 8 本**及原续读书籍保留，Web/MCP/定时任务全部关闭，见 [书架截图](final-shelf.png)、[本地请求记录](requests.json)、[验收状态](acceptance.json)。
Cold start retains version/storage/runtime identity, **9 books / 8 in progress** and the original continuation. Web, MCP and scheduled tasks remain off.

清理中发现阅读记录外层按钮遮蔽了内层删除按钮的 iOS 辅助功能入口。现为每行增加命名删除操作，仍使用既有确认框；红绿测试覆盖目标、取消和其他记录保留，实际 UI 只移除了本轮记录。没有更改记录模型：原版按书名聚合并删除，目标现有实现按 bookId，完整聚合/统计/删除语义仍待对齐，见 [缺失操作回归](accessibility-red.log)。
Each read-record row now exposes its existing confirmed delete operation to iOS accessibility. Tests and device cleanup verify target/cancel/preservation. Full native aggregation/statistics/deletion parity remains open: the source groups and deletes by book name, while the existing target uses bookId.

## 包与边界 / Archive and boundaries

[本地 iOS 包 / Local iOS archive](../../../dist/dist.dgz)：**2,591,980 bytes**，SHA-256 `aa04aba5622f101a0f298e60474e93a9fd8cdefaa80590af943a17b763d787af`。**342** 项冻结输入未变，ZIP、语法和 worklet 检查通过；460 个数组闭包，零异常闭包赋值。
The local archive has **342** frozen inputs, a valid ZIP/JavaScript payload and **460** array worklet closures with no unexpected assignments. See [package](package.json), [inputs](production-inputs.json), [worklets](worklet-audit.json).

**未发布**。配置/包远程地址只读返回 200/200，版本仍为 **0.0.34**，见 [remote availability](remote-availability.json)。独立源码调试不能替代真机 HTYF 宿主加载当前资源包。
**Unpublished**. Remote endpoints return 200/200 but metadata remains **0.0.34**. Source-based simulator debugging does not verify loading this archive in a physical HTYF host.

仍待完成：其他 Charset/别名/ICU 版本、极端 HTML 与解码错误反馈/取消矩阵，完整请求 body/headers/wire 语义、其他 URL/正文消费者、任意有界脚本、原版配置恢复、布尔备份类型与阅读记录聚合，以及全量视觉/手势/真实宿主验收。未缩减完整迁移目标。
Remaining work includes additional charsets/aliases/ICU versions, extreme HTML and error/cancellation behavior, complete request-wire and consumer semantics, bounded scripting, original configuration restore, typed backup and read-record aggregation, full visual/gesture and physical-host acceptance. The full goal is unchanged.
