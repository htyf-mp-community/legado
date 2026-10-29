# 2026-10-28 书架分组与实时数据验证

整体 1:1 还原仍在进行。本轮只在独立 `Legado HTYF 调试` iPhone 17 Pro / iOS 26.5 模拟器验证，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`；没有运行 Android。原 Kotlin/XML 作为只读规格。

后续继续修正了默认封面，最新 155 suites / 663 tests 和本地包信息见 [cover-parity-report.md](cover-parity-report.md)。以下保留分组阶段的证据；旧截图中的纯色封面已在后续替换。

## 已修正的行为

| 源规格 | 目标实现 | 已有证据 |
| --- | --- | --- |
| `AppDatabase` 初始化、`BookGroupDao` 可见条件、`BookDao` 分组查询 | `core/bookshelfGroups`, `data/bookshelf` | 七个内建分组、源默认显示/刷新配置、空分组隐藏、有效自定义组成员及非书架条目过滤；合同测试通过。实际 iOS 显示全部/本地，新建空组先隐藏，归组后立即出现 |
| `BooksFragment` 六种排序及 `BookGroup.getRealBookSort` | 同上、`BookGroupSheets` | 默认继承全局排序；阅读/更新/书名/手动/综合/作者排序；中文校对规则不启用数字自然排序。iOS 实际选择按作者，冷启动后仍保留；多本作者排序由数据测试覆盖 |
| `GroupEditDialog`, `GroupManageDialog`, `GroupSelectDialog` | `BookGroupSheets` | 名称、封面选择、刷新/只更新已读、显示开关、编辑、63 个组上限、多个分组勾选/替换/清空；内建组不可删除。iOS 实际完成新建→排序→归组→筛选→冷启动恢复，嵌套排序弹层关闭后原编辑状态保留 |
| `ItemTouchCallback` 跨行逐项移动 | `moveBookGroup`, `DraggableGroupRow` | 跨多行保持其他分组相对顺序的回归测试通过；iOS 可访问性下移动作已实际改变管理列表与顶部标签顺序。物理长按拖动尚待验收 |
| Room Flow 更新书架 | `useLibrary`, `useBookGroups`, MMKV 订阅 | 保持打开的书架可直接观察 Web 导入/分组写入。快照稳定、无关键不触发、取消订阅和损坏数据恢复测试通过；未引入第二存储命名空间 |
| 目录刷新与阅读时间独立 | `bookshelfRefresh`, `useBookVisit` | 刷新限当前组，遵循只更新已读；空目录标记失败，成功清除失败；阅读时间单独记录。刷新结果按章节身份合并，保留期间新导入、删除、阅读位置和已缓存正文；并发场景测试通过 |
| `Book.type` 位标志与 `BookSource.bookSourceType` 不同 | `bookKinds`, `legacyBackup`, `legacyJson` | 保留原类型位，映射音频/漫画/视频等来源类型；本地/失败/非书架标志独立；备份 Long 分组 ID 与掩码通过 BigInt 保留，避免 32 位截断与浮点舍入。音频和视频阅读入口按类型分流；媒体 UI 链仍待端到端验收 |

Web 上传、保存进度、导入及单书保存使用提交时的最新书架，避免异步请求带回旧数组后丢失其他书。目录刷新额外按章节身份合并；其他页面的完整 Book 对象写回尚未全部转换成字段级合并，不能推导为所有异步写入均无冲突。

## 独立 iOS 实测

1. 书架保持打开，[导入前](evidence/ios/live-bookshelf-before.png)有 `ios-parity-fixture`。
2. 本机 Web 端点导入两章 TXT，HTTP 200，见 `evidence/ios/live-web-import.txt`。不重启、不切换页面，新书立即出现在[导入后书架](evidence/ios/live-bookshelf-after.png)，旧书保留。
3. 管理分组→添加 `iOS 分组验收`→排序“按作者”→确认；空组未出现在顶部。
4. 书架管理→选择新书→加入分组→勾选验收组→确认；顶部标签立即出现，切换后只显示新书。
5. 终止并冷启动同一设备应用，选中分组和书籍归属仍保留；通过标签的分组编辑动作打开，[排序仍为按作者](evidence/ios/group-sort-persisted.png)。
6. 分组管理调用“下移分组 全部”，[本地移到全部之前](evidence/ios/group-order-moved.png)，顶部同步；截图也核对了原生 Switch 在行内垂直居中。物理拖动和完整 VoiceOver 验收仍待补充，热更新/重排后调试工具偶有旧控件角色及动作标签，不能把该工具结果视为完整可访问性通过。

这些测试书籍和验收组仅由正常接口/UI 创建于专用调试设备；生产包不包含 fixture 字符串，生产首次安装仍为空书架。

## 检查与本地包

- 单元测试：153 suites / 655 tests passed，`unit-tests-bookshelf.log`。
- TypeScript、相关模块 ESLint、`git diff --check` 通过，见 `typecheck-bookshelf.log`、`lint-bookshelf.log`、`lint-bookshelf-final.log`。
- 源项目 2,579 文件哈希保持一致，`source-verify-bookshelf.log`；目标原生 `ios/`、`android/` 未改动。
- 33 条资源映射的源与目标 SHA-256 全部匹配，`asset-verify-bookshelf.log`。
- iOS HTYF 包重新构建成功，`dist/dist.dgz`；ZIP 完整性、244 个构建输入及 SHA-256 见 `build-result.json`、`build-inputs.json`。未发布，真实宿主加载/扫码添加仍待验收。已有 Reanimated 动态 require / 可选 FlashList 缺失警告仍在，构建退出码 0。

## 当前边界与后续

书架默认封面、列表变体/多列布局、更新角标、源完整独立书架管理页、菜单标签及分离的书单导入/导出入口仍有差异；封面选取、删除、物理拖动、刷新手势、大字体/旋转需继续实际 UI 验证。内建组名称的首次安装语言及管理说明双语还需逐项对照。

旧 Android 备份的分组长整数和类型标志已保留，但书籍仍可能只有占位章节，原目录/正文和原章节内位置尚未完整恢复；下载类型的入口也未完成。不能以本轮分组通过认定完整备份或全部阅读类型已还原。

系统 TTS、原生 JS 沙箱、后台服务、双 HTTP 监听器及其余功能继续见 `MIGRATION_CHECKLIST.md` 和 `docs/htyf-migration-gaps.md`。没有创建成功迁移 `source-state.json`，目标保持进行中。
