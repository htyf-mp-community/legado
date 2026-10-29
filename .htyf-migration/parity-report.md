# 2026-10-28 进度与验收证据 / Progress and parity evidence

**迁移仍未完成。** 本轮按用户要求只使用独立 iOS 模拟器，不进行 Android 构建/设备调试。源 Android Kotlin、布局和资源作为还原规格，尚未完成全部页面的视觉与行为对照。

后续已补充主页面、真实 TXT 导入/恢复、根节点弹层、书架实时订阅/分组、默认封面、布局/文件夹、书单、独立管理页及书籍更新任务；当前检查为 185 suites / 860 tests。最新媒体 ZIP/WebDAV 备份、恢复与离线验收见 [backup-media-report.md](backup-media-report.md)，批量换源/章节匹配/取消与简介分层证据见 [batch-source-change-report.md](batch-source-change-report.md)，封面分层/固化/恢复证据见 [cover-persistence-report.md](cover-persistence-report.md)，自动调度证据见 [book-update-tasks-report.md](book-update-tasks-report.md)，其它分项见 [bookshelf-management-report.md](bookshelf-management-report.md)、[book-list-parity-report.md](book-list-parity-report.md)、[bookshelf-layout-report.md](bookshelf-layout-report.md)、[cover-parity-report.md](cover-parity-report.md)、[bookshelf-parity-report.md](bookshelf-parity-report.md) 与 [home-parity-report.md](home-parity-report.md)，以下保留朗读阶段的原始验收记录。

## 输入、隔离与环境

- 源路径：`/Users/dgz/code/github/legado`；源 commit：`3046111c1718e7b67c2ad468e54edf295ec05820`（`master`）。
- 目标：`/Users/dgz/code/github/legado/HTYF`，与已有 `htyf` 为同一目录；保留独立目标仓库及开始时已有用户修改。
- 复用现有 direct RN `app` 模板。原始 CLI 初始化命令与模板版本没有记录，不能追认；未重新初始化。
- 全量审计 2,579 个源文件、59 个 Activity、16 个服务/接收器/Provider、724 个资源文件。入口细项保持未验收，见 `source-entrypoints.md`。
- 源哈希复查通过：`0fbbd40401f5ce48a93f4aebfca2d8a27ff720640f130201c1c7dc765af4a301`。目标 `ios/`、`android/` 未改动。
- 独立模拟器：`Legado HTYF 调试`，iPhone 17 Pro / iOS 26.5，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`。
- 原生构建副本和 DerivedData：`/private/tmp/legado-ios-debug`；应用 ID 沿用模板 `org.reactjs.native.example.apps`。
- Repack 服务：`http://127.0.0.1:8097`。本地语音测试夹具：`http://127.0.0.1:8098/engines`，只使用 macOS 内置语音，不属于生产运行时。

## 本轮映射与结果

| 项目 | 源证据 | 目标与实测 | 结果 |
| --- | --- | --- | --- |
| 独立 iOS 启动 | 当前目标原生模板 | 118 Pods 安装；Xcode Debug 构建成功；安装/启动；书架→我的→设置→详情→阅读可操作 | pass：此启动链；全功能仍 pending |
| HTTP 引擎数据 | `entities/HttpTTS.kt`, `DefaultData.kt` | 字段/ID/默认源无损保留，停顿 0–10,000 ms，默认源初始化与恢复语义有单元测试 | pass：数据合同 |
| 引擎管理 | `SpeakEngineDialog`, `HttpTtsEditDialog` | 新增/编辑/删除/默认/剪贴板/文件/URL 导入、JSON 导出；模拟器 URL 导入与选择保留实测通过 | pass：已列实测路径；其他按钮端到端 pending |
| HTTP 请求 | `AnalyzeUrl`, `HttpReadAloudService` | GET/POST、JSON 转义、Java URLEncoder、速度变量原始值 +5、固定数字表达式、Cookie 命名空间、Content-Type 验证 | pass：合同测试与本机 HTTP 实测；完整 JS blocked |
| 前台朗读 | `ReadAloudDialog`, `HttpReadAloudService` | 实测导入本机引擎→开始→暂停→继续→第 2/2 段→“本章朗读完成”；手动切段/停止与缓存重播亦已操作 | pass：上述前台用例；完整朗读功能 pending |
| iOS 音频适配 | 源音频字节语义 | 首次实测 `.audio` 被 AVURLAsset 以 -11828 拒绝；核对为有效 RIFF/WAVE 后按实际格式保存 `.wav` 等后缀，复测完成两段 | pass：最小平台适配 |
| 弹层可访问性 | 源 Dialog 按钮分别可操作 | Gorhom 内容容器不再将子按钮分组为单一 slider；iOS AX 可逐项读取和操作按钮，末项可见 | pass：本轮引擎菜单与朗读面板 |
| 原生备份 TTS 数据 | `help/storage/Restore.kt` 的 `httpTTS.json` | 转换进入独立 MMKV，异常条目报告且保留其他有效数据；旧“禁止 TTS”测试由实际备份合同测试替换 | pass：转换测试 |
| 资源复用 | `httpTTS.json`, `ic_read_aloud.xml` | 原始默认引擎数据与 24 点矢量路径；转换/哈希见 `asset-mapping.json` | pass：这两个资源；完整资源集 pending |
| 预览/分享 | 当前公开 HTYF 配置与官方 CLI `engines: 2.0.0` 协议 | 双语 README、真实二维码；Vision 解码和 README URL 一致；既有线上配置与资源包均 HTTP 200 | pass：链接/二维码；本轮代码未发布、宿主扫码 pending |

## 验证命令

- `npm ci --legacy-peer-deps --ignore-scripts`：锁定目标依赖安装成功；执行已有方向锁 postinstall 补丁。
- 增加纯 JS 开发依赖 `ajv@8.20.0`，修正 `ajv-keywords@5` 错误解析到 AJV 6 导致的调试服务启动失败；未改变既有原生依赖版本。
- `npm test -- --runInBand`：147 suites / 611 tests passed，见 `unit-tests.log`。
- `tsc --noEmit`：通过，见 `typecheck.log`。
- 新增模块及共享弹层 ESLint：通过，见 `lint.log`；共享文件检查另见 `shared-lint.log`。
- `react-native start --port 8097 --host 127.0.0.1 --no-interactive`：Repack iOS 编译成功，当前服务运行中。
- 临时工程 `pod update React-Core-prebuilt --no-repo-update`：成功。初始锁快照的预编译 Pod 描述不一致，仅在临时副本重新解析。
- `xcodebuild ... -scheme apps -configuration Debug -sdk iphonesimulator -destination id=8338CC2C-E716-4B2B-BC30-CC5C777CB2FD -jobs 4 CODE_SIGNING_ALLOWED=NO IPHONEOS_DEPLOYMENT_TARGET=16.4 ... build`：`BUILD SUCCEEDED`，摘要在 `evidence/ios/native-build-result.txt`。
- `node scripts/ios-simulator.mjs --skip-build`：安装/启动成功，连接专用 Repack；脚本保留可重复调试入口。
- `node scripts/audit-source.mjs --verify`：2,579 文件一致。

使用的既有能力包括 React Navigation、独立 MMKV、Gorhom BottomSheet、TrackPlayer、React Native FS、Quick Crypto/Base64、SVG、Slider、SafeArea 与现有手势库；未增加原生模块或修改原生工程源码。

实测截图：[整章朗读完成](evidence/ios/read-aloud-complete.png)、[独立模拟器书架](evidence/ios/bookshelf.png)。

## 尚未证明的部分

1. 系统 TTS、完整脚本/登录沙箱、书籍独立引擎、逐字定位、页级跟随、按章节计时、流式播放、下一章预下载及后台/耳机生命周期仍不完整，见 `docs/htyf-migration-gaps.md`。
2. 主页面已开始按源 XML 还原，但默认封面、内建分组/排序、详情和其他设置仍有差异；不能声称 1:1 视觉验收通过。独立模拟器首次引擎导入后一度出现内容表面刷新延迟，旋转后列表恢复；后续需在无 HMR 条件下复查，不能以 AX 控件存在代替视觉证明。
3. 其余页面、源规则、异常/离线、权限及全部资源均按完整清单保持 pending，不能用 611 个单元测试替代全应用验收。
4. Repack 开发编译有 Reanimated jestUtils 的动态 require、未使用的可选 BottomSheetFlashList 缺少 FlashList 警告；当前流程使用 BottomSheetScrollView，可正常运行，生产打包仍需验证。
5. 后续已在临时安装目录修正 CLI 工具环境并生成当前 iOS `dist/dist.dgz`，ZIP 与哈希见 `build-result.json`；仍未发布，真实宿主加载/扫码添加待验收。
6. README 分享入口仍对应已有远程 0.0.14；宿主 App 的扫码添加/打开本轮代码未验收。

没有建立新的成功迁移 `source-state.json`；目标保持进行中。

最新书单与首次目录证据：[book-list-parity-report.md](book-list-parity-report.md)。整体还原仍在进行。

独立书架管理的部分实现、8/13 批量动作及 iOS 选择证据见 [bookshelf-management-report.md](bookshelf-management-report.md)；剩余动作和全量验收继续进行。

## 0.0.19 后续状态（先前数字为历史阶段记录）

独立 iOS 已验证 Web 封面真实 PNG 84×112、居中裁切、三层优先级、源头/Cookie 隔离、坏图/三秒超时回退和断源冷启动，七本书完整记录保留；见 [web-cover-report.md](web-cover-report.md)。书架管理现已实现 13 项动作，批量换源与媒体备份证据见各专项报告。当前自动检查 187 suites / 879 tests，TypeScript/变更代码 ESLint 通过；本地 iOS 0.0.19 ZIP 与 299 个生产输入已核对。README/二维码使用本地 0.0.19 配置，远程部署和宿主验收是独立未完成项。完整迁移未完成，不建立成功基线。

## 0.0.20 恢复策略跟进

支持目标 JSON 类别的原版合并恢复与十项忽略设置，修复部分备份清库行为。独立 iOS 完成单书更新而保留七本完整记录、预览取消、跳过背景与敏感数据、字段配置和冷启动持久化；详见 [restore-policy-report.md](restore-policy-report.md)。独立审查发现的字典 name 主键和阅读菜单忽略遗漏已以真实结构回归修正。当前 188 suites / 896 tests；完整迁移与旧版/系统恢复矩阵仍未完成。


## 0.0.23 续读与真机布局崩溃跟进

旧版在线文字书完整目录迁移、UTF-16 位置、普通文字分页与真实行测量滚动定位、退出保存及离线续读的部分证据见 [reading-position-report.md](reading-position-report.md)。实际 AX 滚动进度条前进和原七本完整记录保留已核对，物理拖动与复杂排版矩阵仍待验收。

用户报告 0.0.22 真机加载时 layout 空值崩溃；真实 React 状态队列稳定复现书架布局/滚动回调延迟读取已回收事件的缺陷，最小修复及独立审查见 [host-layout-crash-report.md](host-layout-crash-report.md)。当前 194 suites / 923 tests、TypeScript、ESLint 通过，iOS 0.0.23 本地包已验证 304 生产输入与编译代码。真机 0.0.23 加载、远程发布及全应用 1:1 验收保持 pending，未建立成功迁移基线。
