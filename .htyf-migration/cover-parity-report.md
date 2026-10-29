# 2026-10-28 默认封面后续还原

本文件保留默认封面阶段的原始检查。当前独立封面三层、固化/恢复及 iOS 离线冷启动证据见 [cover-persistence-report.md](cover-persistence-report.md)，最新检查为 173 suites / 760 tests。默认文字字体度量和完整视觉矩阵仍未通过。

本轮继续只在独立 `Legado HTYF 调试` iPhone 17 Pro / iOS 26.5 验证。整体迁移保持进行中。

## 源规格与修正

- `model/BookCover.kt`、`ui/widget/image/CoverImageView.kt` 的默认图始终来自 `image_cover_default.jpg` 或日/夜独立自选图片。原迁移版无图时使用棕色块，本轮直接复用原 JPEG，原样 SHA-256 记录在 `asset-mapping.json`。
- 统一默认封面开启后，已有书籍封面也使用默认背景；加载中或失败时显示默认图与文字，成功后显示书籍图片。失败的旧 URL 不会阻止新 URL 加载；自选默认图失败时退回原图。图片状态组件回归覆盖这些场景。
- 名称/作者按源 `AppPattern.bdRegex` 只去掉 Unicode 标点，保留内部空格、数学符号和 emoji；全部标点名称可以为空，不再重新放回标点。
- 竖排按名称长度选择宽度 1/7 或 1/9 字号，并按源列偏移、最后单字间距与列底部对齐算法排布；作者单独在右侧，宽度 1/10 字号，长作者截到高度限制。字符以 Unicode 码点拆分，长标题不再硬截六字。
- 默认文字使用主题强调色，描边使用页面背景色；关闭名称时同时隐藏作者。日/夜开关各自独立，夜间未自选默认图时使用原图。封面保持宽高 3:4；分组编辑预览按源只显示背景图片，不绘制分组名称。
- 新 `useCoverPreferences` 观察同一 MMKV 命名空间的偏好变化，避免返回仍挂载的书架时保留旧封面配置。旧记录缺少作者时规范为空字符串，按作者排序/封面显示可用。

## 实际 iOS 证据与边界

[默认封面截图](evidence/ios/default-cover-source.png)可见原背景、完整的 `iosliveimport` 两列标题和独立作者列，书架分组/筛选保留。原英文竖排属于源支持的模式，修正重点是背景、比例、字体大小和完整分列，而非强制英文横排。

此截图证明默认竖排在独立模拟器中可用，不代表全部封面状态已达到像素一致。当前垂直布局使用 Android 默认字体的估计高度比 `1.171875`，iOS 实际字体轮廓/度量尚未与源参考图逐像素核验；横排使用 RN 四行布局、缩小字号与作者缩放，描边仍为近似阴影，不能认定与 Android StaticLayout 完全相同。原生字体加载、横排/大字号、Wi-Fi 限制、自选背景及偏好设置页的实际 UI 操作还需继续验收。

开发时改变 Hook 结构触发过一次 Fast Refresh 的旧状态错误；最终使用终止进程后的冷启动检查。[最终冷启动截图](evidence/ios/default-cover-cold-start.png)正常，新增日志片段没有错误或警告，见 `evidence/ios/cover-cold-start-log.txt`。保留开发日志，不通过屏蔽错误来宣称完成。

## 当前检查与本地交付

- 155 suites / 663 tests passed，`unit-tests-cover.log`。包含标题 Unicode/分列/底部对齐、最后单字间距、作者裁剪、标点，以及图片加载/失败/切换/强制默认/夜间背景回归。
- TypeScript、相关模块 ESLint、`git diff --check` 通过，`typecheck-cover.log`、`lint-cover.log`。
- 2,579 源文件哈希保持一致；目标原生目录无改动，`source-verify-cover.log`。
- 34 条资源映射 SHA-256 全部匹配；生产包内嵌的 JPEG Base64 与源字节完全对应，`asset-verify-cover.log`、`build-result.json`。
- iOS HTYF 包构建成功，247 个构建输入已记录，`build-inputs.json`。ZIP 完整，包未发布，宿主加载和扫码验收仍未通过。

书架分组和实时导入证据仍见 [bookshelf-parity-report.md](bookshelf-parity-report.md)。完整管理页、布局、旧备份章节恢复和原生平台缺口继续列为未完成；没有建立成功迁移基线。
