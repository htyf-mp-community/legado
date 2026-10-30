# 备份值类型验收 / Backup value type acceptance

2026-10-30，本地 **0.0.43**。完整 1:1 迁移仍未完成。本轮只操作独立 iOS 模拟器，未构建或操作 Android。
Local **0.0.43**. Full migration parity remains incomplete. Device work uses only the dedicated iOS Simulator.

## 问题与根因 / Problem and cause

0.0.42 正常 ZIP 导出中，「删除源文件」未勾选，却导出为 `{type:"string",value:""}`。旧代码依次调用 string/number/boolean getter，把第一个非 undefined 值当成实际类型。安装的 MMKV **4.3.2** 原生桥直接调用底层类型 getter；Jest 模拟器则以 JavaScript typeof 严格区分。错误类型的原生读取可能成功，导致旧测试通过、实际导出丢失类型。
A normal 0.0.42 ZIP export represented an unchecked boolean as an empty string. Backup code guessed types by trying getters in order. The installed native bridge delegates to typed native reads, while the Jest mock strictly checks JavaScript types; this difference hid the bug.

复现命令 / Reproduction:

```sh
npm test -- --runInBand __tests__/backup.test.ts
```

[红灯记录](red.log)明确显示 boolean false 变为 string 空串；[存储契约与源码摘要](storage-contracts.json)记录原版 SharedPreferences 快照、固定依赖 API 和现有标量键。原版 `PreferenceSnapshot.kt` 保留 `preferences.all` 的类型映射；本轮修复目标备份的类型丢失，未据此认定原版 XML 配置恢复已完成。
The [red run](red.log) catches the exact boolean-to-string symptom. [Contracts](storage-contracts.json) identify source snapshots, pinned dependency files and current scalar keys. The source retains typed SharedPreferences values; this fix does not complete native XML configuration migration.

固定版本证据以本地安装源码摘要为准；[官方接口源码](https://github.com/margelo/react-native-mmkv/blob/main/packages/react-native-mmkv/src/specs/MMKV.nitro.ts)用于 API 背景，main 分支不替代固定版本证据。
Pinned local file hashes are authoritative. The linked official interface is background documentation, not a replacement for the installed version.

## 修改 / Changes

- `src/data/storageValues.ts` 按现有读写契约选择 getter，覆盖 **7 个固定标量键和动态分组排序前缀**；保留 false、true、0、数字、空串和 JSON 原串。没有升级依赖、替换存储空间或修改原生工程。
- 未知导入的数字/布尔键通过内部 `storage.value-types.v1` 保留类型；索引不进入用户备份，备份不能覆盖该内部键。后续新增应用标量键须同步声明类型。
- `backup.ts` 和 `migrations.ts` 共享读取逻辑。恢复写入或迁移失败时，恢复原有逻辑值及原类型索引；不把 false/数字转成字符串，也不在回滚时新增索引。
- 两个现有声明数字键目前在数字 getter 中为 undefined、字符串 getter 中为空串。已保留原串，不丢键、不猜历史数字，也不自动改写存储。来源尚未查明；已丢失的历史值不能仅凭空串恢复。

The shared reader selects getters from all existing scalar contracts. Unknown imported scalar types use a private persistent index, excluded from backups. Backup restore and migration rollback preserve typed values and the original index. Two historical numeric preferences currently read as empty strings; they remain unchanged rather than being dropped or assigned guessed numbers. No dependencies or native projects changed.

## 回归 / Regression

**214 suites / 1,060 tests pass**，TypeScript 与修改文件 ESLint 通过，见 [完整测试](tests.log)。新增覆盖原生 false 反例、全部声明键与动态前缀、空串/字面 false/JSON、未知导入类型在适配器重建后再次导出、内部索引覆盖拒绝、旧数字空串保留、索引写入失败回滚和迁移失败的标量/索引恢复。
All **214 suites / 1,060 tests pass**, plus TypeScript and changed-file ESLint. New coverage includes the native false counterexample, every declared scalar contract, literal strings, imported types after adapter recreation, internal-index rejection, legacy empty strings and backup/migration rollback.

未知键类型索引的重建/错误分支以回归测试验证；本轮实际 iOS 往返使用已有声明键。没有把单元测试当成所有宿主/故障状态的设备证据。
Unknown-key index recreation/error branches are regression-tested; the actual iOS round trip uses existing declared keys. This does not establish every host or failure state.

## 独立 iOS 往返 / Dedicated iOS round trip

设备 **Legado HTYF 调试**，iPhone 17 Pro，iOS **26.5**，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`。RN **0.86.2**、存储 `io.legado.htyf.application-storage`，独立源码服务 `127.0.0.1:8097`。

所有读写通过应用正常 ZIP 导出及 WebDAV 下载→预览→合并恢复，没有直接访问 MMKV 文件。临时回环服务只提供三键部分备份，凭据/完整导出不进入报告或请求日志。
All application data operations use normal ZIP export and WebDAV download/preview/confirmed restore. No MMKV files are read or edited. The disposable loopback fixture serves only a three-key partial backup; reports exclude credentials and full exports.

| 阶段 / Stage | 删除源文件 / Delete original | 换源间隔 / Delay | 书架排序 / Sort |
| --- | --- | --- | --- |
| 测试前 / Before | boolean false | string 空串 / empty | string 空串 / empty |
| 类型测试导出 / Typed export | boolean true | number 7 | number 4 |
| 临时改动后导出 / Changed export | boolean false | number 2 | number 1 |
| 使用实际导出恢复后 / Restored exported values | boolean true | number 7 | number 4 |
| 还原测试前数据 / Final original values | boolean false | string 空串 / empty | string 空串 / empty |

实际导出子集恢复后，类型和值与先前导出逐项相同，且区别于临时改动值，见 [类型值证据](typed-values.json)、[正常确认页](restore-preview.png)、[安全请求记录](requests.json)、[复现服务](../../../scripts/backup-value-types-fixture.mjs)。预览取消后重新下载，再确认恢复。未用取消操作单独证明全部 MMKV 不变。
Restoring a subset of the actual export reproduces its exact types and values, distinct from the intervening changed values. A preview was cancelled and downloaded again before confirmation; cancellation alone is not claimed to prove an entire-store comparison.

最终正常导出的 **26 项记录全部与测试前一致**；其中 **9 本书、8 条源、0 条规则、12 条阅读记录**摘要相同，见 [数据保留核对](preservation.json)。三项测试偏好已还原，六个本轮生成的缓存 ZIP 经内容核对后清理，临时 18201 服务关闭。完整原始导出仅保留在本机临时目录，未进入仓库。
All **26 exported entries** equal the pre-test baseline, including **9 books, 8 sources, 0 rules and 12 reading records**. Test preferences are restored; only six verified task-generated cache ZIPs were removed. Fixture port 18201 is stopped. Full exports remain private in local temporary storage.

最终冷启动显示 **0.0.43**、原续读书籍和 **9 本 / 在读 8 本**；Web、MCP、定时任务全部关闭，见 [版本诊断](about.png)、[最终书架](final-shelf.png)、[验收状态](acceptance.json)。
Final cold start retains version, original continuation and shelf counts, with Web/MCP/tasks off.

## 构建与边界 / Archive and boundaries

[本地 iOS 资源包](../../../dist/dist.dgz)：**2,593,050 bytes**，SHA-256 `b94a4879eafeb93da1c03b0df312c75467da5720500faee2547740a5e5601692`。**343** 项生产输入冻结后未变；ZIP、JavaScript 语法、许可证、测试内容排除、**460** 个 worklet 数组闭包/零异常赋值通过。
The local iOS archive passes frozen-input, ZIP, syntax, license, fixture-exclusion and worklet checks. See [package](package.json), [inputs](production-inputs.json), [worklets](worklet-audit.json), [final verification](final-verification.json).

README 分享二维码已像素解码，与保存 URL、README 链接及构建配置一致，见 [二维码核对](qr-verification.json)。远程配置/包只读返回 **200/200**，远程版本仍 **0.0.34**；**本地 0.0.43 未发布，真机 HTYF 宿主加载待验收**，见 [远程状态](remote-availability.json)。
The README QR pixels match its URL, README link and final built configuration. Remote endpoints return **200/200**, metadata remains **0.0.34**. **0.0.43 is unpublished; physical HTYF-host loading remains pending.**

完整原版 XML/多套配置、历史损坏值的可恢复性、未知旧键无类型索引时的歧义、二进制存储值、低空间/连续写失败/进程中断、全量视觉/手势与真机矩阵仍未完成；本轮异常回滚是一次写失败的可复现验证，不是跨进程原子事务承诺。阅读记录按书名聚合/删除及其他总迁移缺口继续 pending。
Remaining work includes full native XML/multiple configurations, recoverability of historical malformed values, unindexed old unknown keys, binary storage values, low-space/repeated-failure/process-interruption behavior, full visual/gesture/physical-host matrices and native read-record aggregation/deletion. Exception rollback tests do not establish crash-atomic transactions. The full goal is unchanged.
