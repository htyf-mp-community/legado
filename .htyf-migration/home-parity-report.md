# 2026-10-28 主页面还原与 iOS 验证

**整体迁移仍在进行，不能宣布 1:1 完成。** 本轮仅在独立 `Legado HTYF 调试` iOS 26.5 / iPhone 17 Pro 模拟器验证，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`。源 Kotlin/XML/资源仅作为规格读取，未调试 Android。

后续已补充书架分组、六种排序与 Web 导入即时同步，当前检查为 153 suites / 655 tests；最新证据见 [bookshelf-parity-report.md](bookshelf-parity-report.md)。以下保留主页面阶段的原始记录，其中当时尚未证明的即时同步已在后续单独实测。

## 源映射与实际变化

| 源规格 | 目标实现 | 当前证据及边界 |
| --- | --- | --- |
| 首次安装的空书架、`bookshelf_empty` | `data/library.ts`, `BookshelfView` | 新安装不注入示例书；原持久数据保留；损坏数据不会被空数组覆盖，首页提供重试/备份恢复；数据合同测试通过 |
| `pref_main.xml`, `view_preference.xml`, `view_preference_category.xml` | `screens/MineScreen.tsx` | 恢复源顺序、分类、说明、24 点图标、16/14 字体和真实服务开关；未保留原迁移版介绍卡片；旧入口保留在其它设置→更多设置 |
| `main_my.xml`, `help/md/appHelp.md` | `screens/AppHelp.tsx`, `assets/sourceHelp.ts` | 我的右上角为帮助；原 Markdown、marked 12.0.1、CSS 复用；iOS 内渲染已实测。文档原有 Android 路径尚待逐条补充平台适配说明 |
| `ThemeConfig` 默认日/夜值与四个默认主题 | `appPreferences`, `theme/appColors`, `defaultThemes` | 新默认为棕/红/灰背景，夜间为蓝灰/深橙/深灰；已有自定义颜色不覆盖；四个源预设仅在集合不存在时初始化 |
| 系统/日间/夜间/电子墨水主题模式 | `AppTheme`, `MineScreen`, `AppearanceSettings`, `readerPreferences` | iOS 实测电子墨水、深色、恢复跟随系统；电子墨水状态在重载后保留；阅读使用独立电子墨水颜色和动画，保留普通阅读配置，独立配置合同测试通过 |
| `main_bookshelf.xml`, `fragment_bookshelf1`, `item_bookshelf_list` | `BookshelfView`, `SourceIcon`, root navigation | 操作收进右上角菜单；分组为第二行标签；点击书籍直接阅读，长按详情；列表封面 66×90、16 点书名、作者/最近/最新行；下拉刷新接入。当前仍有分组/排序/默认封面/网格/更新角标等差异，不能认定书架全量通过 |
| 源 Dialog 覆盖主界面 | `InTreeSheet`, app-owned `BottomSheetModalProvider` | 验证时发现原本只遮内容区，改为小程序根节点内 Gorhom host；显式 in-tree View 容器隔离背景可访问性，遮罩覆盖底栏。修复未展示就 dismiss 导致首次不渲染；冷启动首次打开、关闭重开、进入 URL 添加页均实测；无 RN Modal/FullWindowOverlay |
| `WebService`, `McpService` 实际状态 | `services/localServerRuntime.ts` + 原端点模块 | iOS 实测 Web 200、MCP initialize 200；发现固定版本 HTTP 库的全局单监听器，现拒绝第二服务并保持第一项可用。并发/失败/停止回归测试通过；**双服务同时运行仍是原生阻塞** |
| Web 本地书籍上传 | `data/localWebService.ts` | iOS 实测缺失 `x-upload-filename` 时原生库不给 binaryBody，误报 413；浏览器上传补齐该库标记头与 CORS。实际上传两章 UTF-8 TXT 返回 200，重启后书架保留，点击直接进入第一章 |

本次手动上传的 `ios-parity-fixture` 仅在专用调试设备内，是由正常导入接口创建的测试数据；生产首次安装仍为空。Web 导入后当前书架内存状态的即时同步没有在本轮证明，当前证据仅覆盖导入→冷启动恢复→阅读。

## 原生实测与截图

- 原始源分区：[mine-source-layout.png](evidence/ios/mine-source-layout.png)；深色：[mine-dark.png](evidence/ios/mine-dark.png)；电子墨水及服务冲突：[mine-eink-conflict.png](evidence/ios/mine-eink-conflict.png)。
- 根节点菜单：[bookshelf-overflow-root.png](evidence/ios/bookshelf-overflow-root.png)。首次打开、关闭重开、菜单→URL 添加页实际操作通过；背景书架/底栏不再出现在面板可访问性树中。
- 原版帮助：[source-help.png](evidence/ios/source-help.png)。
- 导入恢复：[bookshelf-imported.png](evidence/ios/bookshelf-imported.png)；直接阅读：[imported-reader.png](evidence/ios/imported-reader.png)；请求见 `evidence/ios/web-local-import.txt`。
- 实际导入书籍：第一章两段→自动进入第二章→第二章第 2/2 段→“本章朗读完成”，朗读引擎为本机 WAV 测试服务；[imported-book-read-aloud-complete.png](evidence/ios/imported-book-read-aloud-complete.png)。新的根节点弹层内全部控制和末项可访问。
- Web 冲突后仍正常响应：`evidence/ios/web-survives-mcp-conflict.txt`；关闭 Web 后 MCP 正常响应：`evidence/ios/mcp-after-stop-web.txt`。
- 部分早期截图带 RN 开发警告横幅；已在独立调试入口只过滤固定依赖触发的 InteractionManager 弃用横幅，其余警告和错误保留，生产不受此设置影响。依赖警告仍需后续升级验证。

## 本轮验证

- `npm test -- --runInBand`：150 suites / 627 tests passed，见 `unit-tests-home.log`。
- `tsc --noEmit`：通过，见 `typecheck-home.log`。
- 本轮模块与共享入口 ESLint：通过，见 `lint-home.log`、`lint-final-home.log`；`git diff --check` 通过。
- `node scripts/audit-source.mjs --verify`：2,579 源文件一致，见 `source-verify-home.log`；目标原生 `ios/`、`android/` 没有改动。
- iOS HTYF 构建成功：`dist/dist.dgz`，见 `production-build-isolated.log`、`build-result.json`。ZIP 完整性与 SHA-256 已核对；本地包未发布，宿主加载/扫码添加没有验收。

当前工作区 CLI 0.7.9 的非交互入口已核对；其直接运行有 Execa 5/9 冲突及缺少预期 `.bin/react-native`。仅在 `/private/tmp/legado-htyf-cli-tools` 按安装包目录复制工具，补齐纯 JS Execa 9.6.0、cross-env 7.0.3，复用目标的已锁依赖与 RN CLI；通过带 `--prefix` 的离线 npx 启动。没有修改源 CLI、目标原生依赖版本或原生源码。可运行命令记录在 `tooling-setup.json`。

生产打包仍有 Reanimated jestUtils 动态 require 和未使用的可选 FlashList 缺失这两项警告；退出码为 0。当前使用的是 Gorhom 协调滚动视图，未增加原生模块来消除可选依赖警告。

## 下一步与未通过项

继续核对书架的默认封面、内建分组/排序/网格、书架数据实时同步、详情和阅读菜单；重新验证批量删除/分组、滚动末项、嵌套弹层、键盘、大字体、旋转与实际宿主胶囊。长按详情、下拉刷新、电子墨水阅读的全部 UI 配置并未在本轮端到端证明。原版系统 TTS、完整 JS 沙箱、后台/权限、其余页面和完整资源清单仍按 `MIGRATION_CHECKLIST.md` 保持未完成。

未创建成功迁移 `source-state.json`，未推送/发布本轮代码。
