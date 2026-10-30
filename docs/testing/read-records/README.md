# 阅读记录验收 / Read-record acceptance

2026-10-30，本地 **0.0.44**。完整 1:1 迁移仍未完成。本轮设备操作仅使用独立 iOS 模拟器，没有构建或操作 Android。
Local **0.0.44**. Full migration parity remains incomplete. Device work uses only the dedicated iOS Simulator.

## 修复范围 / Changes

旧实现以 bookId 记录、搜索和删除，不能复现原版按精确书名聚合的行为。[初始红灯](red.log)捕获了反例：同名书两个设备各读 1/2 秒，搜索其中一个作者应显示合计 3 秒，旧实现只有 2 秒。
The previous bookId model filtered individual rows before aggregation. The [red run](red.log) catches the native counterexample: searching one author of a shared title must retain all devices' combined duration.

- 原始记录使用 deviceId + 原样书名作为身份；显示先按书名汇总时长、取最大最后阅读时间，再执行 SQLite LIKE 搜索。保留 `%`、`_` 和 ASCII 大小写语义，不擅自 trim。
- 作者使用原版 U+001E `authors:` 编码与 U+001F 聚合分隔符；合并、显示、书源结果“读过”判断共享同一作者集合规则。
- 名称/时长/最近阅读排序、名称删除、清空确认和“开启记录”菜单与原版连接。排序为本机设置，不进入备份；记录开关进入设置备份。
- 保留原版刷新行为：页头总时长只在创建页面时读取；排序和删除刷新全部列表，保留搜索框文字。逐字搜索重新读取记录。
- 行点击按精确书名找书架首本书，并直接进入相应阅读器；找不到时带书名进入搜索。bookId 只保留为旧版续读提示。空最后阅读时间不显示日期；时长沿用原版中文单位。
- 增加原版 `readRecord.json` 导入及有符号 Long 精度保留；恢复遵循本机取较大计数、外机替换、作者合并规则。源读取器的空 deviceId 默认值保持不变；目标宿主无 Android ID 接口，恢复使用不备份的每安装私有标识作为最小适配。
- 页面使用虚拟列表、搜索提示图标、原版排序/关闭矢量、无卡片行和实测内容高度的树内菜单。菜单按实际胶囊矩形避让，未改全局导航布局。

The implementation now groups by exact title before filtering, shares native author-set semantics, preserves signed Long counters, supports native record backups and restores, opens readers by title, and connects the native menus and refresh behavior. A private per-install identity adapts restore-device comparison; reader-created rows retain the source's empty device ID. No dependencies or native projects changed.

## 原版对照与回归 / Native comparison and regression

**217 suites / 1,085 tests pass**，TypeScript 与修改文件 ESLint 通过，见 [完整回归](tests.log)。[对照脚本](../../../scripts/read-records-reference.py)编译未修改的原版 ReadRecord/ReadRecordShow/ReadRecordBook、ReadRecordIndex、GsonExtensions 和 DAO，执行原版 DAO.insert、Restore 记录循环及原样提取的时长/名称比较函数。Room/Flow 等未调用边界为显式桩；没有编译 Android App。
All **217 suites / 1,085 tests pass**, plus TypeScript and changed-file ESLint. The JVM harness executes unchanged source entities, author/index code, DAO insertion and restore logic; unused platform boundaries are explicit stubs. No Android application is built.

共 **4,717 个有限样例**：作者解析 33、显示 1,089、合并 1,089、记录索引 1,050、恢复 180、时长 16、日期 220、比较 676、SQL 边界 4、数据库查询/删除 360。见 [固定语料](../../../__tests__/fixtures/readRecords.native.json)、[源码/依赖摘要与 SQL](native-comparison.json)。Gson 固定 2.14.0、ICU4J 77.1；SQL 在 SQLite 3.53.3 执行。
The frozen corpus has **4,717 cases** covering author parsing/display/merge/index, restore, duration/date, comparison and actual SQL aggregation/deletion. Source and test-only dependency hashes are recorded. JDK/ICU/SQLite profiles are explicit rather than universal Android-runtime claims.

日期使用 JDK17 Gregorian、10 个时区和 Long 边界对照，包含洛杉矶 Long.MAX_VALUE 夏令时边界溢出的反例；作者语料包括宽松 Gson、数字词法、无效编码和 Kotlin 空白。数据库排序固定 localized en_US / ICU4J 简中比较；GROUP_CONCAT 原始作者顺序受查询计划影响。完整 Gson 反序列化、所有日历/系统 ICU/时区版本不在本轮结论内。
Dates cover a frozen JDK17 Gregorian/10-zone profile including a Long.MAX_VALUE transition-overflow counterexample. Author cases cover lenient Gson, numeric lexemes, malformed payloads and Kotlin whitespace. Full deserialization and all calendar/system ICU/time-zone profiles remain open.

## 独立 iOS 验收 / Dedicated iOS acceptance

设备 **Legado HTYF 调试**，iPhone 17 Pro，iOS **26.5**，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`；RN **0.86.2**，存储 `io.legado.htyf.application-storage`。源码服务 `127.0.0.1:8097`。所有数据核对通过正常 ZIP 导出，没有直接读取或修改 MMKV 文件。
All application data is verified through normal ZIP exports; no MMKV files are read or edited.

通过已有 WebDAV 设置下载三文件原版 ZIP（bookshelf.json / readRecord.json / bookSource.json），预览取消后重新下载、合并恢复。临时 ZIP 含六条记录、四个显示分组、一书一源；基线检查确认名称/源地址不冲突。见 [预览](restore-preview.png)、[复现服务](../../../scripts/read-records-fixture.mjs)、[安全请求记录](requests.json)。
The normal WebDAV flow previews and imports a native-format ZIP containing six disposable records, one book and one source, without baseline collisions. Cancellation is exercised before a second download and confirmed merge; it is not claimed as an entire-store cancellation comparison.

| 操作 / Action | 实际结果 / Observed result |
| --- | --- |
| 作者搜索“乙” / Author search | 三设备同名记录显示 6 秒，作者“乙、作者甲、甲” / All three devices contribute 6 seconds |
| `iOS 记录%验收` / SQL `%` | 四个分组 / Four groups |
| `iOS 记录__验收` / SQL `_` | 对照、计时、聚合三个分组 / Three groups |
| 时长排序 / Duration sort | 搜索文字保留，列表恢复全部；冷启动仍选中 / Query text retained, full list refreshed, choice survives cold start |
| 最近阅读排序 / Recent sort | 菜单选中正确；最终恢复名称排序 / Selected state correct; final setting restored to name |
| 聚合记录删除 / Group deletion | 取消保留；确认后该书名三个设备记录全部移除 / Cancel preserves, confirm removes all three device rows |
| 总时长 / Total duration | 删除后仍 1小时39分钟38秒；重进变为 1小时39分钟32秒 / Native stale-until-recreation behavior |
| 清空 / Clear all | 确认页后取消，未清空原有记录 / Confirmation cancelled; original records retained |
| 关闭记录 / Recording off | 冷启动保持关闭；正常进入/退出正文不新增本机行 / Survives cold start; actual reading adds no own row |
| 开启记录 / Recording on | 新增空 deviceId 本机 11,535ms，远端 1,000ms 不变 / Separate own counter; foreign counter unchanged |
| 无 bookId 行点击 / Activation without bookId | 按书名直接打开阅读器，正常请求目录及正文 / Direct reader, successful TOC/content requests |

见 [作者搜索](grouped-author-search.png)、[排序菜单](sort-menu.png)、[直接阅读](direct-reader.png)、[实际导出计数](recording-values.json)、[版本诊断](about.png)。计时数值是本次实际读数，不是固定时钟承诺。重排时 CUA 展平的辅助动作标签偶有陈旧；只在当前书名与实际确认页完全匹配后执行删除。完整 VoiceOver/实体手势矩阵仍待单独验证。
Evidence includes screenshots and actual exported counter values. Timing is an observation, not an exact-clock guarantee. Flattened accessibility action labels were occasionally stale after reordering; deletion used exact matching names and verified confirmation text. Full VoiceOver and physical-gesture coverage remains pending.

## 数据保留与待确认清理 / Preservation and pending cleanup

[最终正常导出核对](preservation.json)确认原有 **9 本书、8 条源、0 条规则、12 条阅读记录**逐项相同；其余原有条目也相同，真实 **📂阅读书屋**源保留。新增导出设置只有 `reading.record-enabled.v1 = "true"`；本机排序和私有安装标识不导出。
The original **9 books / 8 sources / 0 rules / 12 records** remain equal, as do all other original entries. The real source is retained. The only new exported setting is recording enabled; sort and installation identity are excluded.

**清理未完成**：聚合组已在验收中删除，另三组临时记录（对照/空作者/计时）、书籍“iOS 记录计时验收”和源“iOS 阅读记录验收（临时）”仍保留。自动审批两次拦截应用内删除，即使已核实为本代理生成、基线不存在并有 ZIP 可重导入，仍要求用户在操作时确认。已发出限定范围确认请求，未绕过拦截。当前 **10 本书 / 9 条源 / 16 条原始记录**，不能称已恢复到测试前数量；续读入口暂指向计时验收书。
**Cleanup is incomplete**: three temporary groups, the timer book and its source remain after automatic approval review required explicit user confirmation for in-app deletion. A scoped request is pending; the rejection was not bypassed. Current counts are **10 books / 9 sources / 16 raw records**, and continuation points at the timer fixture. These are not pre-test totals.

临时 18201 服务已停止；Web/MCP/自动任务保持关闭。完整备份和可重导入夹具仅留本机临时目录；应用缓存 ZIP 暂保留，不删除用户备份。
Fixture port 18201 is stopped; Web/MCP/tasks stay off. Full exports and the reimportable fixture remain private in local temporary storage. App-generated cached ZIPs are retained pending cleanup.

## 资源包与边界 / Archive and boundaries

[本地 iOS 包](../../../dist/dist.dgz) **2,600,810 bytes**，SHA-256 `95bb8517ecbc2f00dbb5a89dcd82f1794c91c4e0abb66db7631ecc760ceffeee`。[346 项生产输入](production-inputs.json)冻结；ZIP、JavaScript 语法、许可证、夹具排除和 **460 个数组 worklet 闭包 / 零异常赋值**通过，见 [包核对](package.json)、[闭包核对](worklet-audit.json)。
The local archive passes frozen-input, ZIP, syntax, license, fixture-exclusion and worklet checks.

README 二维码像素、保存 URL、README 链接及构建配置相同，见 [二维码](qr-verification.json)。远程配置/包只读返回 **200/200**，配置仍 **0.0.34**；**本地 0.0.44 未发布，真机 HTYF 宿主加载待验收**，见 [远程状态](remote-availability.json)。
QR pixels, saved URL, README link and built configuration agree. Remote endpoints return **200/200**, still version **0.0.34**. **0.0.44 is unpublished; physical HTYF-host archive loading remains pending.**

未完成范围包括：上述清理确认、完整损坏/空值旧备份与 Gson 数据类反序列化、Android ID 宿主映射、多语言/字序/日历版本、完整计时生命周期与音频/漫画/后台模式、巨量列表/键盘/大字体/旋转/胶囊视觉、VoiceOver/物理手势、原版 XML/多套配置、全量导出/同步和真机矩阵。当前有限对照和模拟器源码运行不代表整体 1:1 已完成。
Remaining scope includes cleanup consent, malformed native backups/full Gson data-class decoding, host identity mapping, locale/calendar profiles, all timing lifecycles and media/background modes, large-list and full layout/accessibility matrices, native XML/multiple configurations, complete sync/export behavior and physical hosts. Finite comparisons and source-based Simulator debugging do not complete the overall goal.
