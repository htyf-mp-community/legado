# Legado HTYF

将 Legado 阅读器还原为 HTYF React Native 小程序，迁移和逐项验收仍在进行。
A React Native HTYF migration of Legado. Feature and visual parity acceptance is still in progress.

## 预览、分享与使用 / Preview, Share and Use

**当前调试 / Current preview:** 使用独立的“Legado HTYF 调试”iPhone 17 Pro 模拟器（iOS 26.5）。本轮只调试 iOS。
Use the dedicated “Legado HTYF 调试” iPhone 17 Pro Simulator (iOS 26.5). This iteration targets iOS only.

**[配置分享入口 / Configured share entry](https://mp.dagouzhi.com/share?data=%7B%22type%22%3A%22app%22%2C%22entry%22%3A%22.%2Fsrc%2Findex.tsx%22%2C%22version%22%3A%220.0.47%22%2C%22name%22%3A%22Legado%22%2C%22appid%22%3A%22plugin_legado%22%2C%22rotate%22%3A%22auto%22%2C%22appUrlConfig%22%3A%22https%3A%2F%2Fraw.githubusercontent.com%2Fhtyf-mp-community%2Fdemo%2Fmain%2Fv2%2Fplugin_legado%2Flatest%2Fapp.json%22%2C%22zipUrl%22%3A%22https%3A%2F%2Fraw.githubusercontent.com%2Fhtyf-mp-community%2Fdemo%2Fmain%2Fv2%2Fplugin_legado%2Flatest%2Fdist.dgz%22%2C%22projectname%22%3A%22%E5%B0%8F%E7%A8%8B%E5%BA%8F%22%2C%22engines%22%3A%222.0.0%22%7D)**：该链接使用当前本地 `plugin_legado` / `0.0.47` 配置。本轮代码尚未部署，不能用它验证新增功能；App 扫码添加尚待验收。
This link uses the current local `plugin_legado` / `0.0.47` configuration. The current changes have not been deployed; App scan/add acceptance remains pending.
远程配置/包地址本次返回 HTTP 200/200，配置版本为 0.0.34；不能作为本轮本地 0.0.47 包的验收证据。
The configured remote config/package URLs returned HTTP 200/200; the config version is 0.0.34. This does not verify the local 0.0.47 archive.

![Legado HTYF 分享二维码 / Share QR code](docs/assets/htyf-share-qr.png)

1. 打开[红糖云服官网](https://mp.dagouzhi.com)，按其下载入口安装并打开 App。
   Visit the [official site](https://mp.dagouzhi.com), follow its download entry, and install/open the App.
2. 打开 App 的扫码/添加入口，扫描上方二维码；需要时允许相机访问。
   Open the App’s scan/add entry, scan this QR code, and allow camera access when requested.
3. 等待添加和加载，然后体验书架→书籍详情→阅读；通过“我的”检查书源、规则和备份；朗读引擎在阅读菜单或“其它设置→更多设置”中管理。
   Wait for adding/loading, then try Bookshelf → Book details → Reader, and My for sources, rules and backups. Manage speech engines from the reader or Other settings → More settings.
4. 将分享链接或二维码图片发给其他用户，即可按相同步骤添加。
   Share the link or QR image with another user to follow the same process.

在线使用前，必须先将当前构建的 `dist/app.json` 和 `dist/dist.dgz` 分别上传到配置地址和包地址。本轮已生成 iOS 资源包；本地包仍需在宿主内验收，远程入口尚未更新。打包或生成二维码不会自动上传。
Before remote use, upload the current `dist/app.json` and `dist/dist.dgz` to the configured metadata/package URLs. An iOS package has been generated for this iteration; host acceptance is pending and the remote entry has not been updated. Packaging and QR generation do not upload files.

- 配置 / Metadata: [app.json](https://raw.githubusercontent.com/htyf-mp-community/demo/main/v2/plugin_legado/latest/app.json)
- 资源包 / Package: [dist.dgz](https://raw.githubusercontent.com/htyf-mp-community/demo/main/v2/plugin_legado/latest/dist.dgz)
- 重新生成分享二维码 / Regenerate share QR: `node scripts/share-qr.mjs`

## 独立 iOS 调试 / Dedicated iOS Simulator

需要 macOS、Xcode、已安装的 iOS Simulator Runtime、CocoaPods 和 Node.js。
Requires macOS, Xcode, an installed iOS Simulator runtime, CocoaPods and Node.js.

```bash
npm ci --legacy-peer-deps
# 终端 1 / Terminal 1: 专用 Repack 服务 / dedicated Repack server
npm run start:ios
# 终端 2 / Terminal 2: 准备、编译、安装、启动 / prepare, build, install, launch
npm run ios:sim
```

调试脚本复用或创建专用模拟器，在 `/private/tmp/legado-ios-debug` 的工程副本中准备 Pods 和编译，保持仓库原生源码不变。已有构建时可执行 `npm run ios:sim -- --skip-build`。
The script reuses/creates the dedicated device, prepares Pods and builds a copy in `/private/tmp/legado-ios-debug`, keeping repository native sources unchanged. Use `npm run ios:sim -- --skip-build` when the build already exists.

临时服务为 `http://127.0.0.1:8097`，仅供同一 Mac 上的模拟器使用，不是 H5 或远程预览。
The temporary service at `http://127.0.0.1:8097` is for the Simulator on the same Mac, not an H5 or remote preview.

可选朗读验收 / Optional speech acceptance:

```bash
node scripts/http-tts-fixture.mjs
```

在“我的→其它设置→更多设置→朗读引擎→更多→网络导入”填入 `http://127.0.0.1:8098/engines`，选择“本机朗读验收（仅调试）”，再从阅读页打开“朗读”。此服务仅用 macOS 内置语音验证 HTTP 音频链路，不属于小程序生产运行时。
In My → Other settings → More settings → Speech engines → More → Import from URL, enter `http://127.0.0.1:8098/engines`, select the local test engine, and open Read aloud in the reader. This macOS built-in speech fixture only validates the HTTP audio flow and is not part of the production mini-program runtime.

## 实现与验收 / Implementation and Acceptance

0.0.47 修正原版敏感备份的致命预校验：Cookie/源变量密码与严格字段校验失败时，在普通数据恢复前停止；本地和 WebDAV 默认读取现有本地密码。349 个解析输入、336 个加密封装及 1,118 项回归通过，独立 iOS 验证无密码拦截和普通预览，前后 27 项导出完全一致；正确密码解密和忽略开关设备矩阵仍待验收，见 [预校验报告](docs/testing/native-restore-preflight/README.md)。本地包未发布，整体 1:1 仍未完成。
Version 0.0.47 makes native cookie/cache preflight fatal before ordinary restoration and defaults archive paths to the current local password. All 349 parser cases, 336 crypto envelopes and 1,118 regression tests pass. Dedicated iOS verifies password-required rejection and ordinary previews; all 27 exported entries remain identical. Correct-password and ignore-switch device matrices remain pending. See the [preflight report](docs/testing/native-restore-preflight/README.md). The local archive is unpublished and overall parity is incomplete.

0.0.46 对齐原版 ZIP 恢复的类别顺序、逐条记录提交与中途失败保留、媒体/任务时序及恢复排队；84 组原版序列和 1,105 项回归通过。独立 iOS 证实报错前两项保留、后续不执行，正常恢复后 27 项导出完全一致，见 [中途失败验收](docs/testing/native-restore-failure/README.md)。上轮临时数据清理仍待确认；完整备份/全量 1:1 与真机宿主保持 pending，本地包未发布。
Version 0.0.46 follows native ZIP category/record commit order, failure retention, media/task timing and serialized restores. All 84 finite native sequences and 1,105 regression tests pass. Dedicated iOS proves committed prefixes and skipped later work; resetting fixture values restores all 27 exported entries exactly. Previous cleanup, full backup/global parity and physical-host acceptance remain pending; the archive is unpublished.

0.0.45 修复旧版阅读记录导入会过滤 null 项、把非法计数归零的问题；769 组原版 Gson 输入和 1,092 项回归通过。独立 iOS 验证错误拒绝、合法重复字段恢复，27 项正常导出数据不变，见 [记录备份解析验收](docs/testing/read-record-import/README.md)。上轮临时数据清理仍等确认；原版恢复中途失败的部分写入一致性、全量迁移与真机宿主仍 pending。
Version 0.0.45 fixes silent null-member filtering and invalid-counter zeroing in native record imports. All 769 finite Gson cases and 1,092 regression tests pass; dedicated iOS verifies rejection and valid duplicate-field restore, with all 27 exported entries unchanged. Previous fixture cleanup awaits consent; native partial-write failure parity, full migration and physical-host acceptance remain pending.

0.0.44 阅读记录改为原版按书名聚合/删除、作者集合、SQL 搜索、排序与记录开关，4,717 个原版有限样例及 1,085 项回归通过；独立 iOS 验证原版 ZIP、跨设备汇总和真实计时，见 [阅读记录验收](docs/testing/read-records/README.md)。原有 9 本/8 源/12 记录不变；3 组临时记录、一书一源的清理被自动审批拦截，等待用户确认，当前数量包含临时数据。本地包未发布，完整 1:1 与真机宿主验收仍 pending。
Version 0.0.44 implements native title aggregation/deletion, author sets, SQL search, sorting and recording controls. All 4,717 finite native cases and 1,085 regression tests pass; dedicated iOS verifies native ZIP restore, cross-device totals and actual timing. Original data remains unchanged. Cleanup of three temporary groups, one book and one source awaits user confirmation after automatic approval rejection. The archive is unpublished; full parity and physical-host acceptance remain pending.

旧 `.htyf-migration` 报告目录已移除；以下历史条目保留说明，不作为当前验收证据。当前记录位于 `docs/testing/`。
The old `.htyf-migration` report directory has been removed. Historical descriptions below are retained; current evidence is under `docs/testing/`.

真实书源「阅读书屋」已在独立 iOS 验证搜索《西游记》、105 项目录与两章正文，详见 [真实书源验收](docs/testing/real-source-1321/README.md)。
0.0.29 补齐该源暴露的数字选择器、嵌套模板、文本/URL 提取和第一匹配替换语义；935 项测试通过，详情见 [元数据规则验收](docs/testing/source-metadata/README.md)。
The 0.0.29 real-source metadata follow-up fixes numbered selectors, nested templates, text/URL extraction, and first-match replacement semantics. All 935 tests pass; see the [acceptance report](docs/testing/source-metadata/README.md).

0.0.30 补齐旧式多索引、含终点区间、步长和排除语义，与原版 Kotlin 2,456 组输出一致；959 项测试通过，真实网站 iOS 调试四阶段成功，见 [索引规则验收](docs/testing/selector-index/README.md)。
Version 0.0.30 matches 2,456 native Kotlin index cases, including ordered indexes, inclusive ranges, steps and exclusion. All 959 tests and all four real-site iOS debug stages pass; see [index acceptance](docs/testing/selector-index/README.md).

0.0.31 补齐可见文本、直接文本换行、原始属性去重与标准组合列表语义，103 组原版输出一致；967 项测试通过。独立 iOS 可控正文与真实书源回归见 [HTML 文本验收](docs/testing/html-text/README.md)。
Version 0.0.31 matches 103 native HTML text/attribute/list cases and passes all 967 tests. Independent iOS controlled-content and real-source checks are recorded in [HTML text acceptance](docs/testing/html-text/README.md).

0.0.32 对齐集合 html/all、HTML5 树结构和原版序列化；109 组原版输出及真实章节 9,281 单元结果严格一致，975 项测试通过，见 [HTML 序列化验收](docs/testing/html-serialization/README.md)。新增两个固定纯 JS 依赖，原有版本与原生目录不变。
Version 0.0.32 matches 109 native collection-HTML cases and the real 9,281-unit chapter serialization, with all 975 tests passing; see [serialization acceptance](docs/testing/html-serialization/README.md). Two pinned pure-JS dependencies were added; existing versions and native directories are unchanged.

0.0.33 对齐正文格式化、单次 HTML4 解码、图片地址选择和逐段缩进，639 组原版格式化/段落/正则锚点输出一致；真实章节格式化 7,636 单元、原源全文替换后 7,510 单元逐字符串相等。990 项测试通过，独立 iOS 验证字面标签、实际段落测量和游标 352 的冷启动恢复，见 [正文格式验收](docs/testing/content-format/README.md)。本轮未增加依赖或修改原生目录。
Version 0.0.33 matches 639 native formatter/paragraph/regex-anchor cases. The real chapter matches at 7,636 units after formatting and 7,510 units after its original source replacement. All 990 tests pass; independent iOS verifies literal tags, measured paragraphs and cold restoration at cursor 352. See [content formatting acceptance](docs/testing/content-format/README.md). No dependencies or native directories changed this iteration.

0.0.35 对齐原版重复标题默认移除、书名/标点前缀、ASCII 空白、替换后标题回退和逐章保留标识，1,203 组原版输出一致，998 项测试通过。独立 iOS 验证默认移除、关闭/重启保留、再次启用及无匹配正文保留；原始缓存、九本书和八条书源完整记录不变，见 [重复标题验收](docs/testing/chapter-title/README.md)。用户真实源再次跑通搜索、详情、105 项目录与前置页正文。本轮无新依赖或原生修改。
Version 0.0.35 matches 1,203 native title-removal cases and passes all 998 tests. Independent iOS verifies automatic removal, per-chapter retention across restart, re-enabling and unmatched-body preservation. Raw cache and all nine existing books/eight sources remain unchanged. See [title-removal acceptance](docs/testing/chapter-title/README.md). The real source also passes live search/details/105-item contents/front-matter loading. No dependencies or native directories changed this iteration.


0.0.36 完整移植原版重分段、引号修复、词典/对话模式和随机长段切分，1,220 组原版输出/随机调用次数及真实缓存四组对照一致；1,001 项测试通过。独立 iOS 验证开关、23 段匹配、45 段随机结果的菜单重绘稳定与冷启动设置保留，见 [重分段验收](docs/testing/resegment/README.md)。无新依赖或原生修改；繁简转换和完整正文联动仍待完成。
Version 0.0.36 ports the complete native paragraph repair, quote/dictionary/dialogue handling and random long splits. All 1,220 native outputs/random call counts and four real cached-chapter comparisons match; all 1,001 tests pass. Dedicated iOS verifies toggles, 23 matching paragraphs, 45 random paragraphs stable across menu redraws and cold-start persistence. See [resegmentation acceptance](docs/testing/resegment/README.md). No new dependencies or native changes; Chinese conversion and full pipeline integration remain pending.

0.0.37 接入原版固定繁简词典和排除词，62,804 个键、1,422 组明确案例与 36 组重分段/转换顺序一致；1,010 项测试通过。独立 iOS 验证正文/标题先转换再替换、目录、模式切换、独立设置返回、冷启动和停用恢复，并补齐菜单勾选状态，见 [繁简转换验收](docs/testing/chinese-conversion/README.md)。无新依赖/原生修改，词典许可证随包保留；完整消费者/坐标/替换链仍待完成。
Version 0.0.37 adds the pinned native conversion dictionaries and exclusions. All 62,804 keys, 1,422 explicit cases and 36 pipeline-order cases match; all 1,010 tests pass. Dedicated iOS verifies conversion before title/body rules, TOC, settings synchronization, cold start, disabling and checked reader actions. See [Chinese conversion acceptance](docs/testing/chinese-conversion/README.md). No new dependencies/native changes; data licensing is retained. Full consumer/position/replacement integration remains pending.

0.0.38 修正 SQLite LIKE 作用范围、重要空格、Java 分组替换字符串和正文启用/裁边阶段；1,440 组 DAO、1,600 组 LIKE、1,904 组 JVM 替换及 371 组 Kotlin 裁边对照一致，1,020 项测试通过。独立 iOS 验证实际阅读、命中/失败列表、带范围编辑预览和冷启动，见 [替换语义验收](docs/testing/replace-rule-semantics/README.md)。原有九本书/八条源/规则不变；无新依赖或原生修改。完整正则/超时/脚本/HTML/消费者和真实宿主仍待完成。
Version 0.0.38 aligns SQL LIKE scopes, significant whitespace, Java replacement strings and reader enablement/trimming. All 1,440 DAO, 1,600 LIKE, 1,904 JVM replacement and 371 Kotlin trimming cases match; all 1,020 tests pass. Dedicated iOS verifies reading, hit/failure listing, scoped editor previews and cold start. See [replacement acceptance](docs/testing/replace-rule-semantics/README.md). Original nine books/eight sources/rules are unchanged; no dependencies or native changes. Full regex/deadline/script/HTML/consumer and real-host parity remains pending.

0.0.39 修正缓存 HTML/图片过早编码导致转换及规则不可见的问题，按原版顺序处理后再渲染；2,280 组 getContent 原版对照、12 组临时缓存及 6 组真实缓存对照一致，1,027 项测试通过。独立 iOS 验证 HTML 先转换后保护、图片 URL 替换、关闭样式读旧缓存/刷新抓取分支，以及单页进度不再暴露 AX NaN，见 [正文处理顺序验收](docs/testing/reader-native-content/README.md)。原有数据保留，无新依赖/原生修改；完整布局/坐标/消费者/真机仍待完成。
Version 0.0.39 processes decoded cached HTML/images in native order before render adaptation. All 2,280 native getContent cases, 12 controlled-cache cases and six real-cache cases match; all 1,027 tests pass. Dedicated iOS verifies HTML conversion/protection, image URL replacement, cached-vs-refetched style toggling and a finite single-page AX value. See [reader pipeline acceptance](docs/testing/reader-native-content/README.md). Original data is retained; no dependencies/native changes. Full layout/position/consumer/real-host parity remains pending.

0.0.40 补齐缓存书内搜索的显式提交、净化/正则、全部结果与章节内序号定位；1,738 组原版搜索方法对照一致，209 suites / 1,034 tests 通过。独立 iOS 验证大小写、125 条结果、正则、转换/净化、未缓存跳过及跨章导航，见 [书内搜索验收](docs/testing/content-search/README.md)。九本书/八条源/规则完整保留，无新依赖/原生修改。富文本选区/布局、URL 空格编码、其他正文消费者及真实宿主仍 pending，本地包未发布。
Version 0.0.40 aligns cached content search submission, regex/cleanup choices, unlimited results and occurrence-based navigation. All 1,738 native cases and 1,034 tests pass. Dedicated iOS verifies case sensitivity, 125 hits, regex, conversion/cleanup, uncached skipping and cross-chapter navigation; see [content search acceptance](docs/testing/content-search/README.md). Original records are retained; no dependencies/native changes. Rich layout/selection, URL spaces, other consumers and real-host acceptance remain pending; the local archive is unpublished.

0.0.41 修复 RN 地址实现导致的空格查询/相对链接错误，对齐书源查询与表单编码、响应头字符集优先级及非搜索链接的字面参数；6,696 组原版方法输出一致，211 suites / 1,042 tests 通过。独立 iOS 书源调试验证 GET 重试、GBK 表单/UTF-8 响应及用户真实源搜索/详情/105 项目录/前置页正文，见 [地址与编码验收](docs/testing/source-url/README.md)。原有九本书/八条源/规则完整保留，无新依赖/原生修改。完整字符集检测、协议/消费者、视觉/手势和真实宿主仍待完成，本地包未发布。
Version 0.0.41 fixes spaced queries and relative links under the actual RN URL runtime, source query/form encoding, response-header charset precedence and literal navigation parameters. All 6,696 native reference cases and 1,042 tests pass. Dedicated iOS source debugging verifies GET retries, GBK forms with UTF-8 responses and the real source's search/details/105-entry TOC/front matter. See [URL and encoding acceptance](docs/testing/source-url/README.md). Original records are retained; no dependencies/native changes. Full charset detection, protocol/consumer, visual/gesture and real-host acceptance remain pending; the local archive is unpublished.

已有实现覆盖书架、搜索、书源、阅读、漫画、音视频、订阅、规则、缓存、导出、备份、Web/MCP 与配置。页面存在或测试通过均不代表 1:1 视觉和行为验收完成。
Existing implementation covers the bookshelf, search, sources, reading, manga, media, RSS, rules, caching, export, backup, Web/MCP and preferences. Screen presence or passing tests does not prove 1:1 visual/behavioral parity.

- 真机 worklet 协议修复 / Host worklet ABI（历史报告已移除 / historical report removed）
- 真机 layout 崩溃修复 / Host layout crash fix（历史报告已移除 / historical report removed）
- 旧版续读与文字位置 / Reading position evidence（历史报告已移除 / historical report removed）
- 合并恢复与忽略设置 / Restore merge and ignore settings（历史报告已移除 / historical report removed）
- Web 封面 iOS 验收 / Web cover evidence（历史报告已移除 / historical report removed）
- 媒体备份 iOS 验收 / Backup media evidence（历史报告已移除 / historical report removed）
- 批量换源 iOS 验收 / Batch source change evidence（历史报告已移除 / historical report removed）
- [迁移清单 / Feature checklist](MIGRATION_CHECKLIST.md)
- 源入口全集 / Source entry points（历史报告已移除 / historical report removed）
- 分阶段计划 / Staged plan（历史报告已移除 / historical report removed）
- [明确缺口 / Known gaps](docs/htyf-migration-gaps.md)

系统 TTS、完整 JS 书源沙箱、PDF 阅读及若干系统/后台能力仍有缺口；朗读的页级跟随、逐字定位、按章节计时等也尚未完成。
System TTS, a full source-JS sandbox, PDF reading and some system/background features remain incomplete. Page-following speech, word-level tracking and chapter-count timers also remain open.

React Navigation 负责路由；持久化使用 `src/data/storage.ts` 中唯一的 MMKV 命名空间 `io.legado.htyf.application-storage`。弹层留在应用 React 树内。
React Navigation owns routing. Persistence uses the single MMKV namespace `io.legado.htyf.application-storage` in `src/data/storage.ts`. Overlays stay within the application React tree.

```bash
npm test -- --runInBand
./node_modules/.bin/tsc --noEmit
node scripts/audit-source.mjs --verify
```

本轮保留源项目及开始时已有的用户修改，不创建新成功基线，直到完整验收通过。
This iteration preserves the source project and pre-existing user edits. A new successful migration baseline will only be recorded after complete acceptance.


## 本轮主页面与本地构建 / Home screens and local build

首次启动为空书架；点击书籍直接阅读，长按打开详情，书架操作收进右上角菜单。“我的”页恢复源分区、说明与矢量图标，提供跟随系统/浅色/深色/电子墨水四种主题及真实服务开关。旧版聚合入口保留在“其它设置→更多设置”。
A new installation starts with an empty shelf. Tap a book to read, hold for details, and use the toolbar menu for shelf actions. My follows the source preference sections, summaries and vectors, with four theme modes and working service controls. The previous navigation catalog remains under Other settings → More settings.

当前 HTTP 运行环境一次只能监听一个本机服务。第二项启动会明确报错，保留第一项；双服务同时运行仍未还原。
The current HTTP runtime supports one local listener. Starting the other service reports a conflict and preserves the active service. Simultaneous Web/MCP parity remains open.

- 本地 iOS 包 / Local iOS package: `dist/dist.dgz` (not published)
- 构建与文件哈希 / Build and hashes: .htyf-migration/build-result.json（历史报告已移除 / historical report removed）
- 本轮证据 / Current evidence: .htyf-migration/home-parity-report.md（历史报告已移除 / historical report removed）
- 书架后续证据 / Bookshelf follow-up: .htyf-migration/bookshelf-parity-report.md（历史报告已移除 / historical report removed）
- 默认封面后续证据 / Default-cover follow-up: .htyf-migration/cover-parity-report.md（历史报告已移除 / historical report removed）
- 布局与文件夹证据 / Layout and folders: .htyf-migration/bookshelf-layout-report.md（历史报告已移除 / historical report removed）
- 书单与首次目录加载 / Book lists and first-read catalogues: .htyf-migration/book-list-parity-report.md（历史报告已移除 / historical report removed）
- 独立书架管理（部分）/ Shelf management (partial): .htyf-migration/bookshelf-management-report.md（历史报告已移除 / historical report removed）
- 封面三层与固化/恢复 / Cover layers, persistence and restoration: .htyf-migration/cover-persistence-report.md（历史报告已移除 / historical report removed）
- 书籍更新任务与前台调度 / Book-update tasks and foreground scheduling: .htyf-migration/book-update-tasks-report.md（历史报告已移除 / historical report removed）

书架现接入实时数据订阅，Web 导入后当前页面立即更新；内建分组、分组编辑/归组与六种排序已补齐数据逻辑。专用 iOS 模拟器实测了导入、归组、筛选和冷启动保存；完整布局、管理页及其余状态仍待验收。
The shelf now observes storage changes immediately, including Web imports. Built-in groups, group editing/assignment and six sorting modes have data-level coverage. Live import, assignment, filtering and cold-start persistence were verified on the dedicated iOS simulator; full layout and management parity remain in progress.

默认封面复用原 JPEG，恢复主题文字色、长标题分列和独立作者列。独立 iOS 已显示验证；字体度量、横排及完整设置状态仍待视觉验收。
Default covers now reuse the original JPEG, with theme-colored title columns and a separate author column. The default view was checked on the dedicated iOS device; font metrics, horizontal text and the full preference matrix still need visual acceptance.

书架布局现提供常规/紧凑列表、二至六列网格、标签/文件夹、阅读进度和统计等配置；三列、取消草稿、文件夹进入/返回与冷启动保存已在独立 iOS 验证。其它布局组合和完整管理行为继续验收。
Shelf settings now include regular/compact lists, two-to-six-column grids, tabs/folders, reading progress and summary controls. Three columns, cancellation, folder navigation and cold-start persistence were verified on the dedicated iOS device. The remaining layout matrix and complete management behavior are still being checked.

保留原项目 GPLv3 [LICENSE](LICENSE)。原始帮助、默认主题和图标的复用来源及 SHA-256 记录在 .htyf-migration/asset-mapping.json（历史报告已移除 / historical report removed）；内嵌 marked 12.0.1 保留原版权头。
The source GPLv3 [LICENSE](LICENSE) is retained. Help, default-theme and icon provenance with SHA-256 is recorded in the asset mapping; the bundled marked 12.0.1 copyright header is preserved.

书单现按源协议导出三字段 books.json，按书源顺序精确匹配书名/作者，首次打开再加载目录。独立 iOS 已验证网址导入、两章正文、重启续读及原生文件导出；完整文件导入和失败状态矩阵继续验收。
Book lists now export the source three-field books.json format, import through exact title/author matching in source order, and load catalogues on first opening. URL import, two chapter texts, cold-start continuation and native export were verified on the dedicated iOS simulator; file import and the full error-state matrix still need acceptance.

书架管理现为独立页面，恢复元数据行、筛选、可见选择计数和三种归组逻辑。iOS 已验证进入、全选/筛选恢复及批量归组初始状态；其余批量动作和完整视觉/手势矩阵继续推进。
Shelf management is now a separate screen with metadata rows, filtering, visible selection counts and move/add/remove group operations. Navigation, select-all/filter restoration and the initial batch grouping state were verified on iOS; the remaining batch actions and complete visual/gesture matrix are still in progress.

书架管理→已选书籍操作→生成书籍更新任务，可按五段 Cron 创建声明式目录更新任务；创建不会自动开启全局服务。前台连续调度已在独立 iOS 验证分钟边界自动新增一章，原有阅读位置、分组和其它书籍保持不变。系统通知、任意 JavaScript 和可靠后台执行仍有缺口。
In Shelf management → Selected book actions → Create book-update tasks, enter a five-field Cron schedule to generate a declarative catalogue-refresh task. Creation leaves the global service switch unchanged. A minute-boundary automatic refresh adding one chapter was verified on the dedicated iOS Simulator, preserving reading position, groups and unrelated books. OS notifications, arbitrary JavaScript and reliable background execution remain incomplete.

仅本机调试可运行 `node scripts/book-update-task-fixture.mjs`，从 `http://127.0.0.1:18198/source` 导入测试源及 `/books.json` 书单。服务初始为两章，向 `/__fixture__/advance` 发送 POST 可新增一章；可传 `x-fixture-advance-id` 避免重复推进。此夹具不进入生产包。
For local debugging only, run `node scripts/book-update-task-fixture.mjs`, import its test source from `http://127.0.0.1:18198/source` and book list from `/books.json`. It starts with two chapters; POST to `/__fixture__/advance` adds a chapter. Supply `x-fixture-advance-id` to make retries idempotent. The fixture is excluded from the production bundle.

书架管理现支持“保存网络封面到本地”“恢复网络封面”“恢复书源封面”。独立 iOS 已验证按内容保存、两级恢复、坏图片拒绝、慢下载取消和服务器离线后的冷启动显示；原进度、分组与其它书籍保留。
Shelf management now supports saving network covers locally and restoring either network or source covers. Content-addressed saving, both restore levels, invalid-image rejection, slow-download cancellation and cold-start display with the image server offline were verified on the dedicated iOS Simulator, preserving progress, groups and unrelated books.

封面测试夹具仅用于本机调试：`node scripts/cover-persistence-fixture.mjs`（127.0.0.1:18199）。通过已开启的调试 Web 服务 `/saveBookSource` 与 `/saveBook` 导入 `/source.json` 和 `/book.json` 返回的数据；它不会生成默认书架内容或进入生产包。
The cover fixture is for local debugging only: `node scripts/cover-persistence-fixture.mjs` at 127.0.0.1:18199. Explicitly import the data returned by `/source.json` and `/book.json` through the enabled debug Web service’s `/saveBookSource` and `/saveBook` APIs. It does not seed the default shelf or enter the production bundle.

Web 封面现由本机服务生成 84×112 PNG，遵循固化→自定义→书源并在失败时回退默认图。已在专用 iOS 验证裁切、请求头隔离、三秒超时与离线冷启动；完整 Web 客户端视觉和图片处理矩阵仍待完成。
The local Web service now produces 84×112 PNG covers using persisted, custom and source layers, with default-image fallback. Center cropping, header isolation, three-second timeouts and offline cold starts passed on the dedicated iOS Simulator. Full Web UI and image-processing parity remain pending.

备份恢复现按原版规则合并：保留本机独有记录和未备份类别，支持十项“恢复忽略列表”。独立 iOS 已验证部分备份取消/合并、七本书保留、背景跳过、配置按字段应用及冷启动持久化；完整旧版格式和系统恢复矩阵仍待完成。
Backup restore now merges native-style records, preserving local-only items and absent categories, with ten ignore choices. Partial-backup cancellation/merge, seven-book preservation, skipped backgrounds, field-level preferences and cold-start persistence passed on the dedicated iOS Simulator. Full legacy-format and system restore matrices remain open.

0.0.42 接入原版 HTML 编码声明与默认 ICU 检测器，并以固定 ICU 77.1 纯 JS 映射处理响应字节；3,398 组原方法/解码对照及 18,737 条候选记录通过，214 suites / 1,053 tests 通过。独立 iOS 已验证普通搜索、GBK 详情、ISO-2022-JP 目录和 UTF-16LE 正文阅读，真实源复核返回 1 条结果/105 项目录/119 字符前置页，见 [响应编码验收](docs/testing/source-response-encoding/README.md)。临时数据已清理，正常 ZIP 导出的全部 25 项原有记录保持一致，冷启动通过；完整别名/系统 ICU 版本、布尔备份类型、阅读记录聚合、视觉和真实宿主仍 pending，本地包未发布。
Version 0.0.42 adds native HTML declarations/default ICU recognition and frozen ICU 77.1 byte mappings in pure JavaScript. All 3,398 reference cases, 18,737 candidate records and 1,053 tests pass. Dedicated iOS verifies ordinary search, GBK details, ISO-2022-JP contents and UTF-16LE reading, plus fresh real-source debugging; see [response encoding acceptance](docs/testing/source-response-encoding/README.md). Temporary data is removed, all 25 original exported entries remain identical and cold-start checks pass. Full aliases/OS ICU versions, typed backup, read-record aggregation, visual and physical-host acceptance remain pending; the archive is unpublished.

0.0.43 修复原生 MMKV getter 猜类型导致 false 导出为空串的问题，备份和迁移回滚共享类型读取，未知导入标量使用内部类型索引；214 suites / 1,060 tests 通过。独立 iOS 已验证正常 ZIP 导出、WebDAV 预览/确认、三项实际导出值在改动后恢复及最终冷启动，26 项既有记录全部还原，见 [备份值类型验收](docs/testing/backup-value-types/README.md)。两个旧数字偏好的空串原样保留，没有猜值修复。343 项生产输入、包、worklet、许可证和二维码核对通过；无新依赖/原生改动，本地未发布。完整 XML 配置、未知旧键/损坏历史、故障/视觉/手势/真实宿主矩阵仍 pending。
Version 0.0.43 fixes native MMKV getter-based type guessing that exported false as an empty string. Backup/migration snapshots share typed reading, with an internal type index for unknown imported scalars; 1,060 tests pass. Dedicated iOS verifies normal ZIP export, WebDAV preview/confirmed restore of actually exported values after intervening changes, final cold start and preservation of all 26 original entries. See [backup value type acceptance](docs/testing/backup-value-types/README.md). Two historical numeric empty strings remain unchanged. Frozen inputs, archive, worklets, licenses and QR checks pass; no new dependencies/native changes or publication. Complete XML configuration, unknown/malformed historical data, failure, visual/gesture and physical-host matrices remain pending.
