# 原版阅读记录备份解析 / Native read-record backup parsing

2026-10-30，本地 **0.0.45**。完整 1:1 迁移继续进行；本轮只操作独立 iOS 模拟器，没有构建或运行 Android。
Local **0.0.45**. Overall parity remains incomplete. Device work uses only the dedicated iOS Simulator.

## 反例与修复 / Counterexamples and fix

0.0.44 的通用数组转换会过滤 null/标量项，记录归一化又会把无法解析的计数归零。原版 `fileToListT` 调用 `GSON.fromJsonArray<ReadRecord>(InputStream)`：列表含 null 或任一 Long 字段无效时，整份记录文件读取失败。两个最小反例 `[{},null]`、`[{"readTime":1.25}]` 均在修改前失败，见 [红灯记录](red.log)。
Version 0.0.44 silently filtered invalid array members and normalized invalid counters to zero. Native Gson rejects the entire record file for null members or invalid Long fields. The [red run](red.log) catches both minimal cases before the fix.

`src/core/gsonJson.ts` 提取原有作者解析器为共享的宽松 Gson 词法树，同时保留对象重复字段顺序和紧凑 JsonElement 的覆盖/顺序语义；原有作者对照全部保留。`readRecordImport.ts` 按原版实体构造默认值、String 适配器和 Long 字段读取逐项解码；忽略未知字段，原始空白不 trim。
The shared Gson tree retains number lexemes and ordered duplicate fields while preserving author-codec behavior. Native record decoding uses constructor defaults, String coercion and Long conversion, discards unknown fields and preserves string whitespace.

- 缺失字段使用原版默认值；null 基本数值字段保留前值/默认值，重复字段按流顺序生效，前面的非法值不会被后面的合法值掩盖。
- String 数值/布尔转字符串，数组/对象转紧凑 JSON；显式 null String 保持 null，未擅自转为空串。
- Long 保留精确十进制整数和 Java double 回退语义，包括指数、后缀、十六进制浮点、下溢及 Long.MAX_VALUE 的舍入边界。Gson 2.14 拒绝非 ASCII 数字字符串；有限语料保留这一反例。
- 非法记录文件产生原有导入警告，不导入其相邻有效记录；其他独立有效类别仍可预览。null 设备/书名/作者在合并准备阶段报错，未写入本机存储；回归验证保留原类型和值及私有安装标识。

Missing/null primitive fields, ordered duplicates, compact String coercion, exact integers and Java floating-point fallback follow the frozen source cases. Invalid files are skipped with an import warning; explicit null String fields remain observable and fail restore preparation instead of becoming invented defaults. Other valid categories retain the existing preview flow.

## 原版证据与回归 / Native evidence and regression

[脚本](../../../scripts/read-record-import-reference.py)编译未修改的 `ReadRecord.kt` 和 `GsonExtensions.kt`，直接执行原版 InputStream 泛型列表解析；Room 注解和未调用规则适配器为显式桩。源工程保持只读。Gson **2.14.0**、JDK 构造时钟和源码摘要见 [对照配置](native-comparison.json)。
The harness compiles unchanged entities/Gson helpers and executes the original generic InputStream list parser. Only unused platform boundaries are stubbed; the source checkout is read-only.

**769 组有限原版输入：607 组解码成功、162 组拒绝**，逐项对照字段和值；构造器当前时间以实际调用前后区间归一为 `@now`，目标测试注入 123ms。语料含全部五字段、混合列表、null、缺失、重复、未知字段、数字精度/溢出、宽松语法和嵌套 JSON。见 [固定语料](../../../__tests__/fixtures/readRecordImport.native.json)。
All **769 finite native cases** match: **607 decoded / 162 rejected**. Constructor clock defaults are observed within the call's actual time interval and normalized to `@now`; target tests inject 123ms.

全量 **218 suites / 1,092 tests pass**，TypeScript 与修改文件 ESLint 通过，见 [完整回归](tests.log)。原有阅读记录 **4,717** 组语料仍通过。本轮新增恢复接缝验证：显式 null 字段导致错误时，任何存储 set 均未调用；不是只测解析函数。
All **218 suites / 1,092 tests pass**, plus TypeScript and changed-file ESLint. The previous 4,717 record cases remain green. Restore-seam tests verify zero storage writes for null String failures, including preservation of typed values and private identity.

```sh
python3 scripts/read-record-import-reference.py \
  --source-root /Users/dgz/code/github/legado \
  --kotlin-lib /Users/dgz/.gradle/wrapper/dists/gradle-9.3.1-bin/23ovyewtku6u96viwx3xl3oks/gradle-9.3.1/lib \
  --gson-jar /private/tmp/legado-ios-debug/read-records/gson-2.14.0.jar \
  --output __tests__/fixtures/readRecordImport.native.json
npm test -- --runInBand __tests__/readRecordImport.test.ts __tests__/readRecordNativeParity.test.ts __tests__/legacyBackup.test.ts __tests__/backup.test.ts
```

## 独立 iOS 流程 / Dedicated iOS flow

设备 **Legado HTYF 调试**，iPhone 17 Pro，iOS **26.5**，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`；RN **0.86.2**，存储 `io.legado.htyf.application-storage`。冷启动显示 **0.0.45**，见 [关于](about.png)。已有 WebDAV 参数保持不变；[临时回环夹具](../../../scripts/read-record-import-fixture.mjs)只服务四种单文件测试 ZIP，不提供用户完整导出。
Cold start runs **0.0.45** in the dedicated device. Existing WebDAV configuration is reused; the disposable loopback fixture serves only staged native-format test ZIPs, never private exports.

| 阶段 / Stage | 实际结果 / Observed result |
| --- | --- |
| null 数组项 / Null member | 下载检查失败，明确提示无空项对象数组；未进入合并预览 / File rejected before merge preview |
| 小数计数 / Fractional counter | 明确提示 readTime 不是有效 Long；未归零导入 / Rejected with field error |
| null 作者 / Null author | 原版格式解析成功；确认合并提示“恢复失败，原数据已保留”，确认页仍在，可取消 / Parse succeeds; merge reports failure and retains confirmation |
| 合法重复字段 / Valid duplicate | 注释/单引号/未引号键、`readTime:'1e3',readTime:null`、指数 lastRead 和未知 bookId，预览后合并返回正常备份页 / Lenient duplicate/null primitive fields merge successfully |

合法阶段指向已存在的临时远端计时行，解码后应仍为 1,000ms，不新增行；未知 bookId 应丢弃。见 [null 项错误](null-item-error.png)、[小数错误](fraction-error.png)、[null 作者失败后的确认页](null-author-confirmation-retained.png)、[安全请求记录](requests.json)。null 作者错误 Toast 已通过 CUA 截图观察，其临时提示未保存在该确认页图片中；modal AX 树只暴露确认内容。
The valid case targets an existing fixture counter and must retain 1,000ms without adding a row. Unknown bookId is discarded. The null-author failure Toast was observed in a CUA screenshot; the durable image captures the retained confirmation after that transient Toast, not the Toast itself.

前后均正常导出完整 ZIP，仅读取应用生成的备份文件，**没有直接访问 MMKV**。最终 **27 个导出条目逐项完全相同**，包含 **10 本 / 9 源 / 0 规则 / 16 条原始记录**，见 [数据核对](preservation.json)。基线也与 0.0.44 最终导出一致；上轮原有 9 本/8 源/12 记录保留结论仍成立，真实“阅读书屋”源保留。
Normal full ZIP exports before and after are exactly equal across **27 entries**, including **10 books / 9 sources / 0 rules / 16 raw records**. No MMKV files are accessed. The baseline equals the previous 0.0.44 final export, retaining the original data and real source.

上轮 **3 组临时记录、一书一源**仍等待用户清理确认，本轮未再次尝试删除或绕过自动审批；当前数量包含这些临时数据。三份本轮正常导出的缓存 ZIP 保留，完整数据只在本机临时目录。18201 服务已停止；Web/MCP/定时任务关闭，源码调试 8097 保持运行。
The previous temporary groups/book/source still await cleanup consent; no deletion retry or approval bypass occurs in this iteration. Three generated cached export ZIPs are retained; complete exports remain private. Fixture 18201 is stopped, Web/MCP/tasks off, Repack 8097 running.

## 构建与未完成范围 / Build and remaining scope

[本地 iOS 包](../../../dist/dist.dgz) **2,601,784 bytes**，SHA-256 `e81ff926a30a3057395b0c025c5a2bb046c40f58d80d86b08146b64e368a54e4`。[348 项生产输入](production-inputs.json)冻结，ZIP/语法/许可证/夹具排除通过，**460 个数组 worklet 闭包、零异常赋值**，见 [包](package.json)、[闭包](worklet-audit.json)、[最终核对](final-verification.json)。依赖、锁文件及原生工程未改。
The local archive passes frozen-input, ZIP, syntax, license, fixture-exclusion and worklet checks. Dependencies and native projects are unchanged.

分享二维码已像素解码，与 URL、README 链接及实际构建配置一致，见 [二维码核对](qr-verification.json)。远程配置/包返回 **200/200**，配置仍 **0.0.34**；**0.0.45 未发布，真机 HTYF 宿主加载待验收**，见 [远程状态](remote-availability.json)。
QR pixels and configuration agree. Remote endpoints return **200/200** at metadata version **0.0.34**. **0.0.45 is unpublished; physical HTYF-host loading remains pending.**

本轮证明有限 Gson 解析与目标恢复接缝，没有运行 Room/Android。HTYF 仍先准备全部合并内容再写入；原版恢复中途失败时可能已有其他类别或前序记录写入，其逐步失败/部分写入一致性仍未实现或验证。完整 Gson/超深超长输入、编码损坏、所有旧数据类别、原版 XML/多配置、计时生命周期/媒体、全量视觉/辅助功能/实体手势、真机以及上轮清理均保持 pending，不能认定整体备份或 1:1 迁移完成。
This proves finite decoding and the target restore seam, without Room/Android execution. HTYF still prepares all merged entries before writing; native mid-restore failure can leave earlier writes, and that partial-write parity remains unimplemented/unverified. Full Gson/deep/large/malformed encodings, all legacy categories/configuration, timing/media, visual/accessibility/gesture/physical-host matrices and previous cleanup remain open.
