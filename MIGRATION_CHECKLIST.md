# Legado → HTYF 1:1 迁移清单

目标：保留当前 Android 源项目的全部可观察行为与视觉状态。现有实现不等于通过验收。

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

2026-10-28 主页面与 iOS 实测细项见 [.htyf-migration/home-parity-report.md](.htyf-migration/home-parity-report.md)。局部通过不改变本表的全量出口条件。

书架分组、排序与即时导入的后续证据见 [.htyf-migration/bookshelf-parity-report.md](.htyf-migration/bookshelf-parity-report.md)。冷启动归组/排序实测通过；完整书架管理页、布局、导入导出和旧备份章节恢复仍未全量验收。

默认封面的原图、竖排列布局和该阶段 155 suites / 663 tests 证据见 [.htyf-migration/cover-parity-report.md](.htyf-migration/cover-parity-report.md)；字体度量、横排与完整偏好矩阵保持待验收。

布局/文件夹、进度/统计及该阶段 158 suites / 677 tests 证据见 [.htyf-migration/bookshelf-layout-report.md](.htyf-migration/bookshelf-layout-report.md)。三列、取消、文件夹导航和冷启动通过；完整视觉矩阵、滑动/滚动恢复、请求去重策略和管理页仍待完成，不改变上表全量状态。

原生三字段书单、精确搜索与首次目录加载的 162 suites / 695 tests 及独立 iOS 实测见 [.htyf-migration/book-list-parity-report.md](.htyf-migration/book-list-parity-report.md)。网址导入、两章阅读、冷启动及原生导出通过；文件导入完整 UI、异常矩阵、管理页与旧备份仍待验收，不改变全量状态。

独立管理页与选择/归组的初步实测见 [.htyf-migration/bookshelf-management-report.md](.htyf-migration/bookshelf-management-report.md)。当前 13 项批量操作均有实现；批量换源两本章节迁移、真实取消及私有字段保留见 [.htyf-migration/batch-source-change-report.md](.htyf-migration/batch-source-change-report.md)，完整手势/异常 UI 仍待补齐；全量管理页状态保持未通过。

生成书籍更新任务、声明式 refreshToc 与前台连续调度的 170 suites / 737 tests 及 iOS 分钟边界 +1 章证据见 [.htyf-migration/book-update-tasks-report.md](.htyf-migration/book-update-tasks-report.md)。书籍进度、分组和其它书籍保持不变。任意 JS、系统通知和可靠后台调度有明确宿主能力缺口；本地书籍任务重建目录及完整错误/取消/缓存 UI 矩阵仍待实现或验收。

封面三层、保存/两级恢复及独立 iOS 坏图片/取消/离线冷启动证据见 [.htyf-migration/cover-persistence-report.md](.htyf-migration/cover-persistence-report.md)。最新检查 188 suites / 896 tests；媒体 ZIP/WebDAV 的跨设备路径、文件校验/暂存/取消/恢复及离线冷启动见 [.htyf-migration/backup-media-report.md](.htyf-migration/backup-media-report.md)。Web 固化封面生成、裁切、凭据隔离和离线冷启动证据见 [.htyf-migration/web-cover-report.md](.htyf-migration/web-cover-report.md)；已实现 JSON 类别的合并与十项忽略设置证据见 [.htyf-migration/restore-policy-report.md](.htyf-migration/restore-policy-report.md)；完整 Web UI、图片格式、视觉/编辑、旧版配置解析/章节位置/系统恢复矩阵仍 pending，不改变本表全量出口。


0.0.23 的旧版在线文字续读与普通文字位置证据见 [.htyf-migration/reading-position-report.md](.htyf-migration/reading-position-report.md)；物理手势和完整富文本/媒体坐标矩阵仍 pending。真机 0.0.22 layout 空事件崩溃的可复现回归与修复包见 [.htyf-migration/host-layout-crash-report.md](.htyf-migration/host-layout-crash-report.md)，新包真实宿主复测待完成。当前 194 suites / 923 tests；全量出口不变。
