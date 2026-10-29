# 2026-10-28 书籍更新任务与前台调度（部分完成）

后续封面分层、三项封面动作和离线冷启动已另行实现/验收，见 [cover-persistence-report.md](cover-persistence-report.md)；最新检查为 173 suites / 760 tests。本文保留更新任务阶段的 170/737 与当时包版本记录。

完整 1:1 还原仍在进行。只在独立“Legado HTYF 调试”iPhone 17 Pro / iOS 26.5，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD` 调试。Android Kotlin 仅作只读规格，没有 Android 构建/设备工作。

## 源合同及目标映射

源为 `model/AutoTask.kt`、`AutoTaskProtocol.kt`、`AutoTaskRunner.kt`、`AutoTaskSchedulePolicy`，及 `ui/book/manage/BookshelfManageActivity.kt` 的生成对话框和管理模型。目标保留 `AutoTaskManager/Editor/Debug`，新增 `core/bookUpdateTasks.ts`、`core/autoTaskProtocol.ts`、`services/bookUpdateTasks.ts`、`services/autoTaskProtocol.ts`、`services/autoTaskScheduler.ts`。

书架管理增加第九项已实现批量动作“生成书籍更新任务”。打开时捕获可见选中的非本地、允许更新书籍，默认 Cron 为 `*/30 * * * *`。无符合项不打开输入；无效五段计划显示行内错误并保留对话框，修改后清除错误。确认按原格式生成“更新 {书名}”，不改变全局服务开关。

ID 为 `book_update:` 加 bookUrl MD5 的中间 16 位。脚本为括号包裹的 JSON refreshToc 对象，保留 bookUrl/bookName/bookAuthor/generatedBy、respectCanUpdate=true、notify.enable=true/minCount=1、cache.enable=false。优先复用精确 ID，否则仅复用唯一生成器同名同作者任务；保留启用状态，防止别名抢占其它传入任务的精确 ID。导入保留最新存储的排序、全部运行状态及明确清空的日志，新 ID 依次追加；重复传入 ID 最后一个配置覆盖且保留首次分配的顺序。

任务存储采用同步读取/变换/写入，损坏数据不覆盖；运行结果只更新最新存在的相同 ID，不能用过期快照覆盖并发编辑/新增，不能复活已删除任务。调试执行不持久化运行状态，与源 persist=false 一致。

声明式协议支持对象、数组、actions 容器和大小写不敏感字段。refreshToc 先按 URL 找书，生成任务可回退到第一本同名同作者书籍；尊重 canUpdate。在线目录实际调用已有书源解析器，有 tocUrl 时省略详情。提交重新读取最新书架，保留进度、缓存、并发编辑，期间删书或换源不写入旧响应。新增量按非分卷章节数量差计算；可选缓存只取原目录没有的新章节 URL，串行最多三次、失败继续其它章，取消立即中止。

前台调度使用持久 Cron、五分钟首次宽限、单批执行和 AppState，前台持续定时，到前台补查。忙碌时不重复执行；任务/服务变化重排，关闭服务停止后续派发，卸载清理定时器/监听。正在执行的一条任务可能完成；不声称中断底层请求或可靠后台执行。

通知载荷保留源 ID 哈希、占位符、优先级、200/4000 长度限制和新增量阈值。固定 SDK/原生依赖没有本地系统通知接口，当前写入应用日志并返回 skipped，不伪造投递成功。任意 JS 仍明确不支持，JSON 声明式协议不使用 eval。

## 独立 iOS 实测

1. 创建前任务列表为 0、服务关闭。进入 iOS 分组验收→书架管理，只选 iOS书单验收。打开生成弹窗确认默认 `*/30 * * * *`；输入 invalid 并确认，错误“请输入有效的五段 Cron 计划”出现且弹窗保留，见 `evidence/ios/book-update-task-invalid-cron.png`。
2. 改为 `* * * * *` 并确认。列表为“定时任务 (1)”，任务启用、全局服务关闭，见 `book-update-task-created.png`。
3. 原生导出流程实际生成临时 `exportAutoTask.json`，449 字节，SHA-256 `c457ea5616f609cfc88c9fd2f3581616bbee5b3439ad2ff5823c8b16ebe6534a`，已复制到证据目录。ID 为 `book_update:9f59eeedeeb0a4cd`，与独立 MD5 计算一致，脚本/默认标记符合源。系统“我的 iPhone”保存面板已打开，但 CUA 坐标输入返回 noWindowsAvailable，未完成本次文件目录最终保存；通过冷启动关闭该面板。此项不记为完整原生保存验收。
4. 重新启动后开启唯一测试任务的服务；本机夹具记录 18:38:49、18:39:00 对两章目录的 GET。18:39:03 通过带幂等 ID 的本机 POST 新增第三章。
5. 保持前台，没有点击调试或执行到期任务，18:40:00 自动请求三章目录，界面日志为 `[OK] 2026-10-28 18:40:00 / Elapsed: 214ms / - iOS书单验收: +1`，见 `book-update-task-plus-one.png`、`book-update-fixture.log`。此期间没有任何 chapter/3 正文请求，符合生成器 cache=false。
6. 通过实际 Web `/getBookshelf` 接口采集前后数据，见 `book-update-books-before.json`、`book-update-books-after.json`。目录 2→3，latestChapterTitle 为“第三章 定时更新”。book ID/URL/source、currentChapterIndex=1、progress=1、正文、当前章节、阅读时间和 groupIds=["1"] 不变；另外两本书逐字段不变，第三章无缓存正文。
7. 关闭全局服务，保留任务及书籍。最终冷启动后列表仍为 1、服务关闭，18:40:00 的 +1 日志仍保留，见 `book-update-task-cold-start.png`。Web 接口冷启动快照 `book-update-books-cold-start.json` 与更新后快照完全相等（三本书逐字段保留）。启动日志见 `book-update-final-cold-start.log`，无新增 JS 异常；固定依赖版本及弃用警告仍存在。

本机脚本 `scripts/book-update-task-fixture.mjs` 仅绑定 127.0.0.1:18198，初始两章，POST `/__fixture__/advance` 推进，`x-fixture-advance-id` 防重复；GET `/__fixture__/state` 可查当前章数。夹具没有编入生产包。

## 检查及交付

**170 suites / 737 tests**、tsc --noEmit、ESLint、git diff --check 通过。新增六组测试覆盖生成/复用/原子导入、大小写及类型转换、非分卷新增计数、缓存重试/取消、并发编辑/删除、通知跳过及载荷、前台时钟/恢复/停止/卸载和真实元数据身份。

iOS CLI 生产构建退出 0，当前本地版本 `0.0.15`、276 个输入；ZIP、默认封面及旧/新功能标记检查通过，夹具书名/本机地址均不在包内。实际包大小与 SHA-256 见 `build-result.json`；输入清单为 `build-inputs.json`。原有动态 require/可选 FlashList 警告仍存在。源 2579 文件哈希不变、37 资源映射验证通过，原生依赖版本和 ios/android 目录未改。

完整任务功能保持 pending：导入/编辑/调试/异常/取消/通知和可选缓存的完整 UI 矩阵、本地书籍手动任务的目录重建尚未完成。任意 JS、系统通知及可靠后台调度有明确宿主能力缺口，见 `docs/htyf-migration-gaps.md`。任务阶段尚缺的三项封面动作已在后续补齐，书架管理仍缺批量换源；物理手势/长列表及全量清单继续推进。本地 0.0.15 包未发布；配置的远程地址返回 HTTP 200，但仍是 0.0.14。分享二维码已实际解码，与 README 及当前构建公开配置一致。真实 HTYF 宿主加载、胶囊与扫码待验收，详见 share-verification.json。
