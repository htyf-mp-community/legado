# Legado → HTYF 1:1 迁移清单

目标：保留当前 Android 源项目的全部可观察行为与视觉状态。现有实现不等于通过验收。

旧 `.htyf-migration` 报告已移除，历史说明不作为当前证据；本轮记录位于 `docs/testing/`，未重建旧报告。

2026-10-28 用户指定：只使用独立 iOS 模拟器调试，不进行 Android 构建或设备验收。源 Kotlin/布局仍为还原规格。

- 源：`/Users/dgz/code/github/legado`，Kotlin/Android，`app/src/main/AndroidManifest.xml` 为入口证据。
- 目标：`/Users/dgz/code/github/legado/HTYF`。当前文件系统上 `HTYF` 与已有 `htyf` 为同一个目录，复用已有独立 Git 仓库，不重新初始化。
- 模板：direct React Native `app`。已有初始化命令/模板版本未记录，不能追认；保留现有配置和用户未提交修改。
- 源哈希与入口全集：`.htyf-migration/source-audit.json`、`.htyf-migration/source-entrypoints.md`。
- 当前审计不是成功迁移基线；没有 `source-state.json`。待逐项通过后再建立该基线。
- 标记：`[ ]` 待实现或验收；`[!]` 已确认平台阻塞；`[x]` 只用于有当前证据的通过项。

| 阶段 | 源功能与证据（相对源根目录） | 现有目标映射（相对目标根目录） | 状态与出口条件 |
| --- | --- | --- | --- |
| 1 | `ui/main`：书架、发现、订阅、我的、默认页面、底栏 | `src/index.tsx`, `BookshelfView`, `MineScreen`, `Explore`, `Rss` | [ ] 同数据、视口、主题逐屏截图与导航验收 |
| 1 | `ui/book/manage`, `BookGroup`：分组、排序、刷新、管理 | `data/bookshelf`, `core/bookshelfRefresh`, `BookshelfManage`, `BookshelfTransfer` | [ ] 分组排序/批量操作与重启状态对照 |
| 2 | `ui/book/search`, `ui/book/explore`, `ui/book/info` | `BookSearch`, `Explore`, `OnlineBookDetail`, `BookEditor` | [ ] 搜索分页/错误/取消/换源/详情验收 |
| 2 | `ui/book/source`、`model/analyzeRule`：规则、导入、编辑、调试、校验 | `SourceManager`, `SourceEditor`, `SourceDebug`, `core/sourceRule` | [ ] 声明式规则回归；[!] JS 沙箱缺失，见 gaps |
| 2 | `ui/login`, `BaseSource`：登录、Cookie、验证码、回调 | `SourceLogin`, `Browser`, `data/sourceCookies` | [ ] 标准登录验收；[!] JS 登录/回调未接入 |
| 3 | `ui/book/read`, `ui/book/toc`：排版、翻页、目录、书签、高亮、选区、菜单 | `src/index.tsx`, `core/reader*`, `AnnotationManager` | [ ] 逐状态视觉/操作/进度对照；[!] 原生选区扩展/菜单、字体、电量、常亮 |
| 3 | `model/ReadAloud`, `service/*ReadAloudService`, `ui/book/read/config/*Tts*` | 缺失，新增 `HttpTtsManager`, `ReadAloudSheet`, `core/httpTts` | [ ] HTTP 引擎管理/朗读/暂停/段落/章节/速度/计时；[!] 系统 TTS、JS 引擎与后台生命周期 |
| 3 | `ui/book/manga`：漫画、双页、滚动、缓存 | `MangaImage`, `core/manga*`, `readerSpread` | [ ] 原图、切页、横竖屏、失败和缓存验收 |
| 3 | `ui/book/audio`, `ui/video`：音视频、字幕、弹幕、下载、遥控 | `AudioPlayer`, `VideoBookPlayer`, `VideoPlayer`, `playbackService` | [ ] 播放状态/集数/进度/遥控验收；[!] 后台音频/PiP |
| 4 | `ui/book/import`, `model/localBook`：TXT/EPUB/MOBI/PDF、本地与远程 | `LocalBookImport`, `RemoteBooks`, `core/*Book` | [ ] 编码、目录、图片、进度；[!] PDF 阅读、RAR/7z |
| 4 | `ui/book/cache`、导出/下载服务 | `BookCache`, `BulkBookCache`, `BookExport`, `DownloadManager` | [ ] 缓存/导出/取消/失败/恢复；[!] 进程终止后的后台下载 |
| 4 | `ui/rss`：分类、列表、正文、收藏、分组、规则订阅 | `Rss`, `RssReader`, `RssSourceManager`, `RuleSubscriptions` | [ ] 分页、已读、收藏、导入导出和文章格式验收 |
| 4 | `ui/replace`, `ui/dict`, `ui/highlight`, `ui/book/toc/rule` | 对应 `*RuleManager`, `ReplaceRuleEditor` | [ ] 作用范围、优先级、编辑、导入、预览对照 |
| 5 | `ui/autoTask`、Cron 与脚本 | `AutoTaskManager/Editor/Debug`, `core/cronSchedule`, `services/autoTaskScheduler` | [ ] 声明式前台任务/完整协议矩阵；iOS 生成任务和分钟边界自动更新已有证据；[!] JS、可靠后台调度、系统通知 |
| 5 | `help/storage`, `AppWebDav`：备份恢复、加密、配置、媒体、进度同步 | `BackupRestore`, `data/legacyBackup`, `remoteBackup` | [ ] 每类备份数据事务回归；[!] Room/SQLite 原文件 |
| 5 | `service/WebService`, `service/McpService`、Web 前端 | `data/localWebService`, `data/mcpService`, `LocalWebService` | [ ] 各端点合同与鉴权；[!] 双服务独立监听器、LAN/常驻后台、JS 工具 |
| 5 | `ui/config`：外观/封面/启动/底栏图集/其他设置 | `AppearanceSettings`, `CoverSettings`, `WelcomeSettings`, `BottomBarSkins`, `GeneralSettings` | [ ] 源偏好键逐项核验；[!] 系统外观/DNS/Cronet/堆诊断等 gaps |
| 5 | `ui/qrcode`, `ui/association`, `ui/file`, `ui/browser`, `ui/code` | `QrImport`, `AddBookByUrl`, `AppFileManager`, `Browser`, `KeyboardAssists` | [ ] 所有入口和数据类型覆盖；[!] OS 文件关联/JS 单文件书源 |
| 5 | `ui/about`, `ReadRecordActivity`、帮助、日志 | `About`, `ReadRecords`, `AppHelp`, `ReaderHelp`, `AppLogs` | [ ] 文案、帮助资源、统计与日志行为对照 |
| 6 | `assets/`, `res/` 全资源图与许可 | `source-audit.json` 资源哈希、目标资源映射待补 | [ ] 资源逐项复用/转换与许可证据 |
| 6 | Android 系统入口、服务、权限 | 原生差异详见 `docs/htyf-migration-gaps.md` | [!] 宿主原生能力；目标原生目录保持不变 |
| 6 | 构建、预览、分享、扫码添加 | `app.json`, `README.md`, `docs/assets/htyf-share-qr.png` | [ ] iOS 包已构建并检查 ZIP/哈希；二维码已解码；远程新包/宿主加载与扫码仍 pending |

所有底层入口、Dialog 和实体还需对照入口全集逐一确认，不能仅凭此分组表宣布完成。

2026-10-28 主页面与 iOS 实测细项见 .htyf-migration/home-parity-report.md（历史报告已移除 / historical report removed）。局部通过不改变本表的全量出口条件。

书架分组、排序与即时导入的后续证据见 .htyf-migration/bookshelf-parity-report.md（历史报告已移除 / historical report removed）。冷启动归组/排序实测通过；完整书架管理页、布局、导入导出和旧备份章节恢复仍未全量验收。

默认封面的原图、竖排列布局和该阶段 155 suites / 663 tests 证据见 .htyf-migration/cover-parity-report.md（历史报告已移除 / historical report removed）；字体度量、横排与完整偏好矩阵保持待验收。

布局/文件夹、进度/统计及该阶段 158 suites / 677 tests 证据见 .htyf-migration/bookshelf-layout-report.md（历史报告已移除 / historical report removed）。三列、取消、文件夹导航和冷启动通过；完整视觉矩阵、滑动/滚动恢复、请求去重策略和管理页仍待完成，不改变上表全量状态。

原生三字段书单、精确搜索与首次目录加载的 162 suites / 695 tests 及独立 iOS 实测见 .htyf-migration/book-list-parity-report.md（历史报告已移除 / historical report removed）。网址导入、两章阅读、冷启动及原生导出通过；文件导入完整 UI、异常矩阵、管理页与旧备份仍待验收，不改变全量状态。

独立管理页与选择/归组的初步实测见 .htyf-migration/bookshelf-management-report.md（历史报告已移除 / historical report removed）。当前 13 项批量操作均有实现；批量换源两本章节迁移、真实取消及私有字段保留见 .htyf-migration/batch-source-change-report.md（历史报告已移除 / historical report removed），完整手势/异常 UI 仍待补齐；全量管理页状态保持未通过。

生成书籍更新任务、声明式 refreshToc 与前台连续调度的 170 suites / 737 tests 及 iOS 分钟边界 +1 章证据见 .htyf-migration/book-update-tasks-report.md（历史报告已移除 / historical report removed）。书籍进度、分组和其它书籍保持不变。任意 JS、系统通知和可靠后台调度有明确宿主能力缺口；本地书籍任务重建目录及完整错误/取消/缓存 UI 矩阵仍待实现或验收。

封面三层、保存/两级恢复及独立 iOS 坏图片/取消/离线冷启动证据见 .htyf-migration/cover-persistence-report.md（历史报告已移除 / historical report removed）。最新检查 188 suites / 896 tests；媒体 ZIP/WebDAV 的跨设备路径、文件校验/暂存/取消/恢复及离线冷启动见 .htyf-migration/backup-media-report.md（历史报告已移除 / historical report removed）。Web 固化封面生成、裁切、凭据隔离和离线冷启动证据见 .htyf-migration/web-cover-report.md（历史报告已移除 / historical report removed）；已实现 JSON 类别的合并与十项忽略设置证据见 .htyf-migration/restore-policy-report.md（历史报告已移除 / historical report removed）；完整 Web UI、图片格式、视觉/编辑、旧版配置解析/章节位置/系统恢复矩阵仍 pending，不改变本表全量出口。


0.0.23 的旧版在线文字续读与普通文字位置证据见 .htyf-migration/reading-position-report.md（历史报告已移除 / historical report removed）；物理手势和完整富文本/媒体坐标矩阵仍 pending。真机 0.0.22 layout 空事件崩溃的可复现回归与修复包见 .htyf-migration/host-layout-crash-report.md（历史报告已移除 / historical report removed），新包真实宿主复测待完成。当前 194 suites / 923 tests；全量出口不变。


0.0.30 的书源旧式索引语义与原版 Kotlin 2,456 组输出直接对照、真实网站目录步长/四阶段调试和 196 suites / 959 tests 证据见 [索引规则验收](docs/testing/selector-index/README.md)。此前真实源和元数据证据见 [真实书源验收](docs/testing/real-source-1321/README.md)、[元数据验收](docs/testing/source-metadata/README.md)。本项不代表整个规则引擎、JS 沙箱、显式 CSS 模式或完整视觉/交互矩阵已经完成；全量出口保持待验收。


0.0.31 的可见/直接文本、属性列表和标准组合规则与原版完整分析类 103 组输出对照、独立 iOS 可控正文/真实源回归和 197 suites / 967 tests 证据见 [HTML 文本验收](docs/testing/html-text/README.md)。QuickJS 缺口已依据本机宿主仓库 1.0.1 的真实接口更新；完整 html/all 序列化、CSS/HTML5/XML/混合语法及全量 UI/交互仍待完成，保持全量出口未通过。


0.0.32 的集合 html/all 与序列化、共享文档副作用、109 组原版与真实 9,281 单元章节结果严格对照、独立 iOS 真实源回归和 198 suites / 975 tests 见 [HTML 序列化验收](docs/testing/html-serialization/README.md)。新增 parse5 7.3.0 / 适配器 7.1.0 为纯 JS 依赖，原有版本和原生目录不变。显式 CSS/混合语法、完整 XML/HTML5 边缘合同、正文净化/阅读段落/视觉及 JS 沙箱等全量出口仍待实现或验收。


0.0.33 的原版 HtmlFormatter、HTML4 单次解码、图片地址与段落/正则锚点 639 组对照、真实章节格式化 7,636 与原源全文替换后 7,510 单元严格一致、200 suites / 990 tests、独立 iOS 字面标签/逐段缩进及游标 352 的冷启动恢复见 [正文格式验收](docs/testing/content-format/README.md)。本轮无新依赖和原生修改。原有九本书、八条书源完整记录保持不变；完整 ContentProcessor、简介/EPUB、富文本/媒体/图片参数、Java 正则/URL 边缘、物理手势与真实宿主验收继续 pending，不改变全量出口。

0.0.35 的重复标题默认移除、书名/标点前缀、ASCII 空白边界、替换后标题回退与原版 `.nr` 标识对照共 1,203 组，202 suites / 998 tests 通过；独立 iOS 验证逐章开关、冷启动保留、重新启用及无匹配提示/正文保留，见 [重复标题验收](docs/testing/chapter-title/README.md)。真实源实时搜索/详情/105 项目录/前置页正文通过；缓存的真实第二回 7,152 单元孤立匹配结果与原版严格一致。原有九本书、八条书源完整记录不变。本轮复用固定 QuickCrypto，无新依赖或原生修改；原版实体 `.nr` 文件备份导入、完整 ContentProcessor/规则/视觉矩阵与真实宿主仍 pending，全量出口不变。

0.0.36 完整移植 ContentHelp 重分段算法及随机长段切分，1,220 组原版输出/随机调用次数一致；真实缓存第二回四组随机输入逐字符串一致，203 suites / 1,001 tests 通过。独立 iOS 验证开关往返、23 段原版一致、45 段随机结果在两次菜单重绘中稳定和冷启动设置保留，见 [重分段验收](docs/testing/resegment/README.md)。321 项构建输入、worklet 协议、二维码核对通过，原有九本书/八条源记录不变；无新依赖或原生修改。繁简转换、完整替换/特殊 HTML/失效联动、随机段落跨重启位置和全视觉/手势/宿主验收继续 pending，未缩减全量出口。

0.0.37 接入原版 quick-transfer-core 0.2.17 词典及 112 项排除列表，全部 62,804 个键、1,422 组明确案例和 36 组重分段→转换顺序与原版一致，205 suites / 1,010 tests 通过。独立 iOS 验证快捷/独立设置、转换后标题/正文规则、目录净化开关、冷启动、停用恢复及菜单勾选，见 [繁简转换验收](docs/testing/chinese-conversion/README.md)。九本书/八条源/原规则完整记录不变，临时数据清理；327 项构建输入、许可证、worklet、二维码通过，无新依赖或原生修改。完整替换/HTML/失效、转换坐标及各消费者、原版配置备份、异步词典生命周期、全视觉/手势/宿主矩阵继续 pending。

0.0.38 对齐替换的 SQL LIKE 范围、pattern/范围空格、Java 分组字符串、正文裁边/启用与顺序命中，原版有限语料 5,315 组一致；206 suites / 1,020 tests 通过。独立 iOS 阅读/命中/失败说明/编辑预览/冷启动通过，九本书/八条源/原规则不变，见 [替换语义验收](docs/testing/replace-rule-semantics/README.md)。330 项生产输入、worklet/许可证/二维码校验通过，无新依赖/原生修改；完整 Java Pattern、超时/取消/Rhino、HTML/失效顺序、全局手动配置/完整导入、消费者/坐标、单页 slider AX NaN 和真实宿主矩阵继续 pending。

0.0.39 将现有 HTML/图片缓存还原后送入原版顺序，再在最终段落后渲染；2,280 组原版 getContent、12 组临时缓存及 6 组真实缓存对照一致，207 suites / 1,027 tests 通过。独立 iOS 验证 HTML 转换/保护、图片原文规则、旧缓存关闭与刷新抓取分支、单页 AX NaN 修复，见 [正文处理顺序验收](docs/testing/reader-native-content/README.md)。九本书/八条源/原规则完整保留。331 项输入、worklet/许可证/二维码校验通过，无新依赖/原生修改；完整正则/超时/脚本/失效、全局配置、EPUB/多页 base、布局/坐标/消费者、开发 warning 与真机矩阵继续 pending。

0.0.40 对齐缓存书内搜索正文链、显式提交/进程选项、无限结果、UTF-16 摘录与章节内序号导航；1,738 组原版方法对照、209 suites / 1,034 tests 通过。独立 iOS 验证大小写、125 条、正则、转换净化、缓存限定和跨章定位，见 [书内搜索验收](docs/testing/content-search/README.md)。九本书/八条源/原规则完整保留，332 项输入和最终包审核通过。富文本选区/布局、结果列表滚动恢复、完整正则/有界中断、URL 空格、朗读/导出/Web 等消费者与真实宿主仍 pending；全量目标保持未完成。

0.0.41 修复 0.0.40 空格查询反例与 RN 相对地址行为，对齐原版两种 base 重载、查询/表单编码、响应头 charset 优先级及导航字面参数；6,696 组原版 JVM/Hutool 输出一致，211 suites / 1,042 tests 通过。独立 iOS 应用内书源调试验证带空格 GET/404 重试、相对目录/章节、GBK 表单/UTF-8 响应与用户真实源 1 条结果/105 项目录/119 字符前置页，见 [地址与编码验收](docs/testing/source-url/README.md)。普通搜索添加阅读、第二章货币参数及图片渲染未列为本轮 UI 通过项。正常 ZIP 导出核对九本书/八条源/原规则不变，临时源已清理，冷启动版本/关闭服务通过；334 项生产输入与最终包审核通过，无新依赖/原生修改。HTML meta/ICU4J 无头检测、完整 Charset/协议/body/header/wire、其他 URL 消费者、脚本有界中断、全视觉/手势/宿主矩阵仍 pending，全量目标未完成，本地包未发布。

0.0.42 对齐原版 HTML head/meta、默认 ICU4J 检测候选与固定 ICU 77.1 字节解码，3,398 组/18,737 条候选一致，214 suites / 1,053 tests 通过。独立 iOS 普通搜索→GBK 详情→ISO-2022-JP 目录→添加→UTF-16LE 正文通过，真实源再次返回 1 条结果/105 项目录/119 字符前置页，见 [响应编码验收](docs/testing/source-response-encoding/README.md)。正常 ZIP 导出的全部 25 项既有记录相同（9 本书/8 条源/0 条规则/12 条阅读记录），临时数据清理、冷启动和关闭服务通过；342 项生产输入与最终包审核通过，无新依赖/原生修改。仅补充阅读记录现有删除动作的 iOS 辅助功能入口，原版按书名聚合/删除语义仍待实现；新增布尔偏好导出为空串的类型问题已单列，不能追认布尔往返。完整 Charset/别名/其他 ICU 版本、极端 HTML/异常/取消、协议/wire/其他消费者、脚本和全视觉/手势/真实宿主仍 pending，全量目标未完成，本地包未发布。

0.0.43 修复原生 MMKV 类型猜测与备份/迁移回滚的标量类型损失，覆盖 7 个固定标量键与分组排序前缀，未知导入类型持久保留且不暴露内部索引；214 suites / 1,060 tests 通过。独立 iOS 正常 ZIP 导出→三键部分恢复→改变→从实际导出恢复→还原基线通过，26 项既有记录（9 本书/8 条源/0 条规则/12 条阅读记录）全部相同，最终冷启动/关闭服务通过，见 [备份值类型验收](docs/testing/backup-value-types/README.md)。两个已只能读为空串的旧数字偏好原样保留，不追认原数字恢复。343 项生产输入与最终包/二维码审核通过，无新依赖/原生改动；未知类型索引的完整设备矩阵、旧版 XML/多套配置、历史损坏恢复、连续故障/中断、阅读记录聚合和全视觉/手势/真实宿主仍 pending，完整目标未完成，本地包未发布。

阅读记录跟进 / Read records (0.0.44): exact device/title raw identity, title aggregation before SQL LIKE, native author codec/index, Long counters/date profile, name-based deletion/reader activation, native refresh quirks and menus are implemented. 4,717 finite source JVM/SQLite cases and 217 suites / 1,085 tests pass. Dedicated iOS verifies native ZIP import, author/wildcard searches, persisted sort/recording, cancellation/group deletion and real off/on reading counters. Original 9 books/8 sources/0 rules/12 records are unchanged. Three temporary record groups, one timer book and one source remain because automatic approval requires explicit deletion confirmation; cleanup is pending. See [acceptance](docs/testing/read-records/README.md). Per-install restore identity adapts unavailable Android ID; full malformed backup, ICU/calendar/locale, media/background timing, accessibility/layout/gesture and physical-host matrices remain pending. Local 0.0.44 is unpublished; no dependency/native changes. The earlier bookId-model pending note describes the historical release, not the current implemented subset. Full goal is still open.

原版记录备份解析 / Native record import (0.0.45): null list members and invalid Longs now reject the entire record file rather than being filtered/zeroed. Shared Gson token parsing preserves lexical numbers and ordered duplicate fields; native constructor defaults, nullable String coercion, Long double fallback and unknown-field discard match 769 finite unchanged-source cases. 218 suites / 1,092 tests, TypeScript and changed-file lint pass. Dedicated iOS confirms null/fraction rejection, explicit null-author restore failure and a valid lenient duplicate-field restore; all 27 normal-ZIP-exported entries are unchanged. Previous temporary data cleanup still awaits explicit consent; no deletion retry. Source/InputStream decoding is verified without Android/Room execution. Native partial writes after a mid-restore failure, full Gson/large/deep/encoding/category/configuration matrices and physical-host/global parity remain pending. Local 0.0.45 is unpublished; dependencies/native projects unchanged. See [acceptance](docs/testing/read-record-import/README.md).

原版恢复中途失败 / Native restore interruption (0.0.46): native ZIP previews now follow source category order and per-record commits, retain successful prefixes on later failure, defer media until after data/preferences and auto tasks until after media, serialize concurrent restores and carry book ownership IDs across phases. HTYF backups retain their existing atomic contract. Native errors refresh committed state and use the neutral source title. All 84 finite unchanged-source sequences (72 failures / 12 controls), 219 suites / 1,105 tests, TypeScript and changed-file lint pass. Dedicated iOS proves earlier source order 1234 / remote counter 2000ms survive a later null-author error and cold start, while invalid/later records/servers are absent; restoring original fixture values returns all 27 entries exactly to baseline. See [acceptance](docs/testing/native-restore-failure/README.md). Prior cleanup still awaits explicit consent; no deletion retry. Crypto preflight, all native schema/batch constraints, keyboard clear failures, media per-file faults, full XML/configuration, cancellation/process/repeated storage faults, huge imports, accessibility/global visual/gesture and physical-host matrices remain pending. No Android build, dependency or native-project changes; local 0.0.46 unpublished. The 0.0.45 partial-write gap is closed only for this evidenced subset, not the entire native restore pipeline.


敏感备份预校验 / Native sensitive-backup preflight (0.0.47): cookie and source-variable files now undergo fatal ordered validation before ordinary conversion/restoration, with current-local-password defaults, strict fields/exact nonnegative Longs/latest cache keys and no materialized empty rows. All 349 strict-parser cases, 336 native BackupAES/Hutool envelopes, 220 suites / 1,118 tests, TypeScript and changed-file lint pass. After transient CUA binding failures recovered, dedicated iOS verifies password-required rejection for cookies/plaintext caches, ordinary source-only preview/cancel and .47 UI identity; all 27 normal-exported typed entries remain equal before/after, matching the .46 final baseline. Final cold start renders 10 books/9 in reading; Web/MCP/tasks remain off and fixture server is stopped. Correct-password decryption and ignore-switch device matrices remain pending. All UI inputs used CUA; no deletion retry. Local .47 is unpublished; remote remains .34. Jsoup MIT notice is now included in the bundle banner after artifact inspection found its prior omission. No dependency/native/source-repository changes. CookieStore domain/session/merge/raw pipe rows, runtime consumers, exhaustive JSON/password/charset profiles, XML/config/DAO/logging/interruption/storage/large-input and whole-app/physical-host matrices remain open. See [preflight report](docs/testing/native-restore-preflight/README.md). This is finite preflight progress, not complete backup/global parity.
