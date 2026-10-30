# 原版恢复中途失败 / Native restore interruption

2026-10-30，本地 **0.0.46**。整体 1:1 迁移继续进行。本轮设备操作仅使用独立 iOS 模拟器，没有构建或运行 Android。
Local **0.0.46**. Overall parity remains incomplete. Device work uses only the dedicated iOS Simulator.

## 问题与原版证据 / Problem and native evidence

原版 `Restore.restoreLocked` 用 Mutex 串行化恢复，按源代码顺序写入各类别。阅读记录循环每次调用一个 `@Transaction DAO.insert(record)`；后续记录因 null String 报错时，前面已成功提交的记录和更早类别仍保留，后续类别不执行。0.0.45 把原版 ZIP 交给整体准备/回滚流程，导致这些成功写入也被撤回；错误标题又承诺“原数据已保留”。
Native restore serializes calls and applies categories in source order. Each record has its own DAO transaction: a later null String failure retains earlier committed records/categories and stops later work. Version 0.0.45 incorrectly treated native ZIPs as one prepared restore and promised that original data was preserved.

[红灯记录](red.log)通过真实预览→恢复接缝捕获两类差异：本应变为 4 的早期书源排序仍为 9；本应保留的首条远端计数/作者合并被撤回。没有只对测试模型断言。
The [red run](red.log) reaches the actual preview/restore seam and catches both missing category-prefix and record-prefix commits.

[原版对照脚本](../../../scripts/native-restore-failure-reference.py)编译未修改的实体、Gson 扩展、DAO，执行原样提取的 Restore 记录循环，并在异常后读取保留状态。**84 组有限序列**包含 **72 组失败 / 12 组成功控制**，覆盖 null deviceId/bookName/author、失败位置、本机/外机、更大/更小计数和作者合并，见 [语料](../../../__tests__/fixtures/nativeRestoreFailure.native.json)、[源码/工具/顺序摘要](native-comparison.json)。
The harness compiles unchanged entities, Gson helpers and DAO, executes the unchanged restore loop, and observes state after exceptions. All **84 finite sequences** match: **72 failures / 12 successful controls**.

测试使用 OpenJDK **17.0.18**、现有 Kotlin 测试 JAR 和 Gson **2.14.0**，摘要已记录。Room 注解/Flow 为桩，行存储为内存实现；这些 null String 失败发生在 insertRaw 前。未执行 Room、Android 数据库故障或 Android App，不能把该对照当成完整 Room 事务验证。
The frozen JVM/Kotlin/Gson profile and hashes are recorded. Room annotations/Flow are stubs and row storage is in memory; these null failures occur before insertRaw. This is not a full Room/database-fault or Android-runtime test.

## 修改 / Changes

- 原版 ZIP 的已转换类别使用明确的源顺序；阅读记录逐条提交。仅当前失败写入单元回滚，之前成功单元保留。私有安装标识仍不备份，首次有效记录提交时才保存。
- 媒体激活移至数据/配置之后、自动任务之前；更早记录失败时不激活媒体，清理未使用暂存。任务实际写入仍由现有 MMKV 监听通知前台调度器。
- 恢复调用跨媒体 await 串行排队。书籍 URL→目标 ID 映射跨类别保留，后续书签不会引用旧导入 ID。
- 源中明确捕获的部分类别错误继续后续类别并进入现有应用日志；诊断写入失败不覆盖恢复结果。未知的内部转换类别在写入前明确报错，避免遗漏新映射。
- 原版失败使用“恢复备份出错”标题；有已提交内容时刷新页面数据。自动远程恢复入口也能识别部分提交。原版标题按其硬编码保留中文。
- HTYF JSON/ZIP 继续使用原有整体准备/回滚合同；序列化字段不能把 HTYF 数据伪装为原版恢复策略。原版空记录/任务列表不创建存储行。

Native ZIPs now follow ordered category/record commits, serialized execution, deferred media activation and task ordering. Ownership mapping survives phases. Native errors refresh visible committed data and avoid a false rollback promise. HTYF backups retain their existing atomic-restore contract; native selection comes from archive inspection, not serialized payload fields. Dependencies, storage namespace and native projects are unchanged.

## 回归 / Regression

**219 suites / 1,105 tests pass**，TypeScript 与修改文件 ESLint 通过，见 [完整测试](tests.log)。新增 13 项接缝回归覆盖原版 84 序列、类别顺序、普通 HTYF 整体失败、存储单步写后失败回滚、类型索引/布尔/数字/私有 ID 保留、本机空作者无写入、跨类别书签 ID、非致命类别/诊断故障、媒体失败后的数据保留、媒体所有权/忽略背景、空列表、未知转换类别及恢复排队。
All **219 suites / 1,105 tests pass**, plus TypeScript and changed-file ESLint. New tests cover actual native-preview outcomes, source order, HTYF atomic behavior, failing-unit rollback, typed/private values, identity ownership, nonfatal diagnostics, media ownership/order and serialized restores.

```sh
python3 scripts/native-restore-failure-reference.py \
  --source-root /Users/dgz/code/github/legado \
  --kotlin-lib /Users/dgz/.gradle/wrapper/dists/gradle-9.3.1-bin/23ovyewtku6u96viwx3xl3oks/gradle-9.3.1/lib \
  --gson-jar /private/tmp/legado-ios-debug/read-records/gson-2.14.0.jar \
  --output __tests__/fixtures/nativeRestoreFailure.native.json
npm test -- --runInBand __tests__/nativeRestoreFailure.test.ts __tests__/backup.test.ts __tests__/restoreBackupPreview.test.ts
```

## 独立 iOS 验证 / Dedicated iOS acceptance

设备 **Legado HTYF 调试**，iPhone 17 Pro，iOS **26.5**，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`；RN **0.86.2**、存储 `io.legado.htyf.application-storage`，见 [关于](about.png)。仅通过正常 ZIP 导出、WebDAV 下载、预览和确认合并读写应用数据；没有直接访问 MMKV 文件。
All application data operations use normal ZIP export and WebDAV preview/confirmed merge, without reading or editing MMKV files.

测试前 **27 个导出条目**与 0.0.45 最终导出一致。临时 ZIP 只改已有代理验收书源的 customOrder 和已有远端计时行，另含一条坏记录、一条不应写入的后续记录及后续 servers 类别；不包含用户真实书源或凭据。[夹具服务](../../../scripts/native-restore-failure-fixture.mjs)仅绑定回环地址，见 [预览](restore-preview.png)、[安全请求记录](requests.json)。
The baseline equals the previous 27-entry final export. The disposable ZIP modifies only an existing agent-created source/counter, then includes an invalid record and later work that must not run. The loopback fixture never serves private full exports or credentials.

| 阶段 / Stage | 书源排序 / Source order | 远端计数 / Remote ms | 聚合显示 / Display |
| --- | --- | --- | --- |
| 测试前 / Before | 9999 | 1000 | 12秒 |
| 第二条记录报错后 / After failing record | 1234 | 2000 | 13秒 |
| 冷启动后 / After cold start | 已提交值保留 / Commits retained | 2000 | 13秒 |
| 正常恢复原值后 / Reset via native ZIP | 9999 | 1000 | 12秒 |

实际错误标题为“恢复备份出错”，未再承诺原数据全部不变，见 [错误提示](restore-error.png)。导出核对只有两个键发生预期改动：早期书源与首条记录保留，坏记录、后续记录和 `legacy.servers.v1` 均不存在，其余 **25 项完全相同**，见 [中途状态](partial-values.json)、[保留计时](committed-record.png)。冷启动再次进入页面仍为 13 秒；为捕获短暂提示，重新确认同一输入复现同一错误。
The actual error uses the native neutral title. Exported state proves only the two expected keys changed; invalid/later rows and the later servers category are absent, with the other **25 entries equal**. The committed duration survives cold start. The same input is retried to capture the transient Toast.

随后下载两项原值备份并确认恢复，聚合回到 12 秒，见 [恢复原值](restored-record.png)。最终正常导出的 **27 项类型和值逐项完全相同**，包含 **10 本书 / 9 条源 / 0 条规则 / 16 条原始记录**，见 [最终数据保留](preservation.json)。本轮没有新增持久条目，真实“阅读书屋”源保留。
Resetting the two fixture values returns the display to 12 seconds. All **27 exported entries** are exactly restored, including **10 books / 9 sources / 0 rules / 16 raw records**. No persistent entry is added and the real source is retained.

这些数量包含上轮仍待用户确认清理的 **3 组临时记录、一书一源**；本轮没有尝试删除或绕过自动审批。三份正常导出缓存 ZIP 保留，完整导出只在本机临时目录。18201 已停止；Web/MCP/定时任务关闭，8097 源码服务保留。
Counts include the previous temporary data still awaiting explicit cleanup consent. No deletion retry or approval bypass occurs. Three generated cached exports remain private; fixture 18201 is stopped and Web/MCP/tasks stay off.

## 构建与边界 / Archive and boundaries

[本地 iOS 资源包](../../../dist/dist.dgz) **2,603,655 bytes**，SHA-256 `65ae852c1267d4396b35121caa5c1573ef2866300567dea65a66c6320b6f2a9a`。[349 项生产输入](production-inputs.json)冻结；ZIP/语法/许可证/夹具排除及 **460 个数组 worklet 闭包 / 零异常赋值**通过，见 [包核对](package.json)、[闭包](worklet-audit.json)、[最终核对](final-verification.json)。
The local archive passes frozen-input, ZIP, syntax, license, fixture-exclusion and worklet checks.

README 二维码像素、保存 URL、链接和最终构建配置一致，见 [二维码核对](qr-verification.json)。远程配置/包只读返回 **200/200**，配置仍 **0.0.34**；**0.0.46 未发布，真机 HTYF 宿主加载待验收**，见 [远程状态](remote-availability.json)。
QR pixels, URL, README and final configuration agree. Remote endpoints return **200/200** at metadata version **0.0.34**. **0.0.46 is unpublished; physical HTYF-host loading is pending.**

本轮关闭阅读记录失败时已提交部分被撤回的已证反例，并对齐当前已转换类别的时序；不等于所有原版备份行为完成。仍待实现/验证：加密 Cookie/运行变量的完整前置失败语义、致命恢复错误的完整 AppLog 记录、全部原版实体/字段/类别的 Room 约束与批事务、键盘表清空后插入失败、媒体逐文件部分失败、原版 XML/多套配置、取消/进程中断/持续存储故障、巨量记录性能、辅助功能动作标签与全量视觉/手势/真机矩阵，以及上轮清理。内存行存储和注入 setter 故障不替代真实 Room/低空间证据。
This closes the demonstrated record-prefix rollback mismatch and orders currently converted categories. Complete crypto preflight, fatal restore logging, entity/schema/batch failures, keyboard clear-then-insert failures, per-file media faults, XML/configuration, cancellation/process/repeated-storage faults, large imports, accessibility/visual/gesture/physical-host matrices and previous cleanup remain open. In-memory/injected faults do not establish real Room or low-space behavior.
