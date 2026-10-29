# 2026-10-28 批量换源 / Batch source change

整体 1:1 还原仍在进行。本阶段仅使用独立 Legado HTYF 调试 iPhone 17 Pro / iOS 26.5，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`；未构建或调试 Android。

## 源规格与实现

只读规格：`BookshelfManageActivity.kt`、`BookshelfManageViewModel.kt`、`SourcePickerDialog.kt`、`WebBook.kt`、`BookInfo.kt`、`Book.kt`、`BookHelp.kt`、`StringUtils.kt` 和 `BookInfoEditActivity.kt`。

- 管理页第六项“批量换源”接入全页“选择书源”，只列启用书源，保持 customOrder 顺序，显示原始分组名。筛选四个字段（名称、URL、分组、备注），保留空格及 SQLite LIKE 的 `%`/`_` 通配与 ASCII 大小写语义。未要求 searchUrl 才显示，也未排除其它书源类型。
- 菜单“换源间隔”范围 0–9999 秒，默认 0，确认后存储。每次任务开始时捕获一次间隔。本地书和同源书跳过，禁止更新的在线书仍执行。
- 只搜索第一页，取书名和作者均完全相等的第一本；候选无目录 URL 才取详情。搜索/详情失败记录日志并继续，不等待；每次目录尝试（包括失败和最后一本）之后等待指定间隔。
- 详情已有名称/作者默认保留，只有非空 canReName 标志才允许替换；字符串 `false` 也属于非空。新目录为空不得提交。
- 换源复制分组、顺序、允许更新、私有封面两层、私有简介/标签、阅读时间与现有逐书阅读配置，清旧源正文缓存并按新书源类型生成原生类型位。名称/作者、URL 冲突模拟 Room REPLACE；允许改名且两唯一键均改变时可保留旧书。
- 每个请求和等待阶段响应取消；新任务取消旧任务，迟到响应不可提交，存储失败停止整批。取消保留已完成项，不伪造完成提示。
- 简介显示与编辑使用 `customIntro || intro`，编辑不覆盖书源简介、不裁剪私有文本；与原书源简介相等时清自定义层。

最小平台适配：选择器和进度/设置弹层都在应用 React 树内，列表虚拟化，安全区与 HTYF 胶囊沿用公共 PageHeader。Android NumberPicker 对应可直接输入及加减的数值控件。MMKV 提交串行合并最新书库，保留期间的阅读/分组修改，防止被删或已切其它源的记录复活；原生捕获实体与目标实时合并不是同一并发机制。目标保留稳定 ID 以延续已有引用，跨目录书签/标注的完整映射矩阵仍未验收。

## 章节匹配 JVM 对照

`chapterMigration.ts` 按只读 BookHelp 的半角化、原始正则（包含扩展 CJK 转义细节）、中文章节号、32 位整数溢出、搜索窗口、UTF-16 Character 集合 Jaccard、最近预估位置择优及末尾索引限制执行。找不到标题/章节号时按旧索引限制范围，不能改成总进度百分比推算。

使用源依赖版本 Apache Commons Text **1.13.1** 的真实 Jaccard 实现运行独立 JDK 17 参考，不启动 Android 工具链。包来源为 Maven Central 官方坐标 `org.apache.commons:commons-text:1.13.1`；jar 只存临时目录，不修改应用依赖。参考脚本从 BookHelp 读取原始正则，记录源文件与 jar SHA。

24 组样本覆盖全角、中文数词、NBSP、扩展字符、重复标题、章节号回退、全目录可选搜索、空目录和整数边界。`__tests__/fixtures/chapterMigrationReference.json` 为对照数据；`chapter-migration-jvm.log` 确认源及输出未变。

```sh
LEGADO_JAVA_BIN=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home/bin/java node scripts/chapter-migration-reference.mjs --commons-jar /private/tmp/legado-ios-debug/commons-text-1.13.1.jar --verify
```

## 独立 iOS 证据

仅通过正常 `/saveBookSources`、`/saveBook` 导入本机 fixture，未直接操作 MMKV。两本验收书原本均 canUpdate=false；原先四本书完整保留。

1. 真实选两本在线验收书和一本本地书。选择页不显示禁用源；中文分组与备注筛选分别成功。`batch-source-picker.png`、`batch-source-delay.png` 保存页面与 2 秒数值设置。
2. 正常源返回错误作者在前、精确作者在后，详情又返回不同书名/作者。实际结果保持精确搜索身份，两本仍成功换源，源 Header 均正确。
3. 甲的旧索引 1“第二章 归途”迁到新索引 4“第五章 归途”；乙的旧索引 5“第六章 旧标题”按章节号迁到新索引 9“第6话 全新标题”。`batch-source-changed.json` 对照 `batch-source-imported.json` 验证全部私有字段、分组、35% 进度和阅读时间保留；四本无关书逐字段完全一致。本地书无网络请求。旧错误位清除，新类型为 8。
4. 服务器两次请求间隔：首本 TOC `13:01:50.875Z`，次本 search `13:01:52.966Z`，约 **2.091 秒**。末项等待另由服务假时钟用例验证，未以截图推断时间。
5. 慢速搜索期间点取消：服务器 `13:02:36.397Z` 记录连接关闭 `finished=false`，未发后续详情/目录；`batch-source-cancelled.json` 与成功换源后六本书完全一致。截图 `batch-source-cancel-progress.png`。
6. 详情实际显示“私人简介a，换源后保留”，编辑页回填私有简介与网络自定义封面。未修改保存后源/私有简介及所有封面层均不变；编辑器原有行为另写保存时间和默认 UTF-8 charset，未声称整个实体无变化。见 `batch-source-detail.png`、`batch-source-editor-saved.json`。
7. 阅读匹配的第 5 章，实际显示新源正文及 URL，见 `batch-source-reader.png`。此操作正常更新阅读时间/进度并预取后续章，故阅读后的快照与换源初始快照不直接作全等比较。

8. 最终完整冷启动后 `batch-source-final-cold.json` 与 `batch-source-final-before-cold.json` 六本逐字段相等，日志无新增 JS 异常。实际重新打开间隔设置仍为 2，见 `batch-source-delay-cold.png`；验收后恢复默认 0，关闭 Web/MCP/定时服务并回到书架。

## 检查与边界

**180 suites / 813 tests** 通过；额外复核请求取消与简介规则 2 suites / 7 tests；tsc、变更运行时代码 ESLint、git diff --check 通过。服务用例覆盖三阶段取消、间隔取消、新任务替代旧请求、混合阶段失败、直接目录、并发导入/进度、删书/另换源和磁盘失败。旧书源集成测试的名称断言按原生“已有搜索名不被详情改名”修正，静态布线检查兼容格式化空白。

本地 iOS 产物 **0.0.17**，详见 build-result.json。原生目录和依赖版本未改；源 2579 文件哈希保持一致，37 项资源映射复核通过。真实宿主扫码/加载/胶囊验收仍待完成，远程配置未部署本轮包。

仍待完成：完整字体/主题/长标题/键盘/物理手势矩阵、外部备份偏好映射、跨源标注、任意 JS 书源与其它全量迁移清单。调试构建更新 app.json 导致 JS 刷新后，旧 native Web listener 一度仍占 1122 且新 JS 报启动失败；只冷启动本应用后正常恢复。热刷新期间 listener 生命周期需另行定位，此处不把冷启动恢复算作已修复。

English: Batch source change now follows the native picker, exact identity search, chapter migration, per-TOC delay, cancellation and private metadata contract. Dedicated iOS fixtures verify two migrations, local-book skipping, a real interrupted request, unchanged unrelated books, editor preservation and reading the matched new chapter. Whole-app parity, host acceptance and the documented lifecycle/feature matrices remain open.
