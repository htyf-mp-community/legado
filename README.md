# Legado HTYF

将 Legado 阅读器还原为 HTYF React Native 小程序，迁移和逐项验收仍在进行。
A React Native HTYF migration of Legado. Feature and visual parity acceptance is still in progress.

## 预览、分享与使用 / Preview, Share and Use

**当前调试 / Current preview:** 使用独立的“Legado HTYF 调试”iPhone 17 Pro 模拟器（iOS 26.5）。本轮只调试 iOS。
Use the dedicated “Legado HTYF 调试” iPhone 17 Pro Simulator (iOS 26.5). This iteration targets iOS only.

**[配置分享入口 / Configured share entry](https://mp.dagouzhi.com/share?data=%7B%22type%22%3A%22app%22%2C%22entry%22%3A%22.%2Fsrc%2Findex.tsx%22%2C%22version%22%3A%220.0.25%22%2C%22name%22%3A%22Legado%22%2C%22appid%22%3A%22plugin_legado%22%2C%22rotate%22%3A%22auto%22%2C%22appUrlConfig%22%3A%22https%3A%2F%2Fraw.githubusercontent.com%2Fhtyf-mp-community%2Fdemo%2Fmain%2Fv2%2Fplugin_legado%2Flatest%2Fapp.json%22%2C%22zipUrl%22%3A%22https%3A%2F%2Fraw.githubusercontent.com%2Fhtyf-mp-community%2Fdemo%2Fmain%2Fv2%2Fplugin_legado%2Flatest%2Fdist.dgz%22%2C%22projectname%22%3A%22%E5%B0%8F%E7%A8%8B%E5%BA%8F%22%2C%22engines%22%3A%222.0.0%22%7D)**：该链接使用当前本地 `plugin_legado` / `0.0.25` 配置。本轮代码尚未部署，不能用它验证新增功能；App 扫码添加尚待验收。
This link uses the current local `plugin_legado` / `0.0.25` configuration. The current changes have not been deployed; App scan/add acceptance remains pending.
远程配置与包地址当前返回 HTTP 200，但配置版本仍为 0.0.14；不能作为本轮 0.0.25 的验收证据。
The configured remote URLs currently return HTTP 200, but the remote configuration is still version 0.0.14. It does not verify this local 0.0.25 build.

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

已有实现覆盖书架、搜索、书源、阅读、漫画、音视频、订阅、规则、缓存、导出、备份、Web/MCP 与配置。页面存在或测试通过均不代表 1:1 视觉和行为验收完成。
Existing implementation covers the bookshelf, search, sources, reading, manga, media, RSS, rules, caching, export, backup, Web/MCP and preferences. Screen presence or passing tests does not prove 1:1 visual/behavioral parity.

- [真机 worklet 协议修复 / Host worklet ABI](.htyf-migration/host-worklet-crash-report.md)
- [真机 layout 崩溃修复 / Host layout crash fix](.htyf-migration/host-layout-crash-report.md)
- [旧版续读与文字位置 / Reading position evidence](.htyf-migration/reading-position-report.md)
- [合并恢复与忽略设置 / Restore merge and ignore settings](.htyf-migration/restore-policy-report.md)
- [Web 封面 iOS 验收 / Web cover evidence](.htyf-migration/web-cover-report.md)
- [媒体备份 iOS 验收 / Backup media evidence](.htyf-migration/backup-media-report.md)
- [批量换源 iOS 验收 / Batch source change evidence](.htyf-migration/batch-source-change-report.md)
- [迁移清单 / Feature checklist](MIGRATION_CHECKLIST.md)
- [源入口全集 / Source entry points](.htyf-migration/source-entrypoints.md)
- [分阶段计划 / Staged plan](.htyf-migration/migration-plan.md)
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
- 构建与文件哈希 / Build and hashes: [.htyf-migration/build-result.json](.htyf-migration/build-result.json)
- 本轮证据 / Current evidence: [.htyf-migration/home-parity-report.md](.htyf-migration/home-parity-report.md)
- 书架后续证据 / Bookshelf follow-up: [.htyf-migration/bookshelf-parity-report.md](.htyf-migration/bookshelf-parity-report.md)
- 默认封面后续证据 / Default-cover follow-up: [.htyf-migration/cover-parity-report.md](.htyf-migration/cover-parity-report.md)
- 布局与文件夹证据 / Layout and folders: [.htyf-migration/bookshelf-layout-report.md](.htyf-migration/bookshelf-layout-report.md)
- 书单与首次目录加载 / Book lists and first-read catalogues: [.htyf-migration/book-list-parity-report.md](.htyf-migration/book-list-parity-report.md)
- 独立书架管理（部分）/ Shelf management (partial): [.htyf-migration/bookshelf-management-report.md](.htyf-migration/bookshelf-management-report.md)
- 封面三层与固化/恢复 / Cover layers, persistence and restoration: [.htyf-migration/cover-persistence-report.md](.htyf-migration/cover-persistence-report.md)
- 书籍更新任务与前台调度 / Book-update tasks and foreground scheduling: [.htyf-migration/book-update-tasks-report.md](.htyf-migration/book-update-tasks-report.md)

书架现接入实时数据订阅，Web 导入后当前页面立即更新；内建分组、分组编辑/归组与六种排序已补齐数据逻辑。专用 iOS 模拟器实测了导入、归组、筛选和冷启动保存；完整布局、管理页及其余状态仍待验收。
The shelf now observes storage changes immediately, including Web imports. Built-in groups, group editing/assignment and six sorting modes have data-level coverage. Live import, assignment, filtering and cold-start persistence were verified on the dedicated iOS simulator; full layout and management parity remain in progress.

默认封面复用原 JPEG，恢复主题文字色、长标题分列和独立作者列。独立 iOS 已显示验证；字体度量、横排及完整设置状态仍待视觉验收。
Default covers now reuse the original JPEG, with theme-colored title columns and a separate author column. The default view was checked on the dedicated iOS device; font metrics, horizontal text and the full preference matrix still need visual acceptance.

书架布局现提供常规/紧凑列表、二至六列网格、标签/文件夹、阅读进度和统计等配置；三列、取消草稿、文件夹进入/返回与冷启动保存已在独立 iOS 验证。其它布局组合和完整管理行为继续验收。
Shelf settings now include regular/compact lists, two-to-six-column grids, tabs/folders, reading progress and summary controls. Three columns, cancellation, folder navigation and cold-start persistence were verified on the dedicated iOS device. The remaining layout matrix and complete management behavior are still being checked.

保留原项目 GPLv3 [LICENSE](LICENSE)。原始帮助、默认主题和图标的复用来源及 SHA-256 记录在 [.htyf-migration/asset-mapping.json](.htyf-migration/asset-mapping.json)；内嵌 marked 12.0.1 保留原版权头。
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
