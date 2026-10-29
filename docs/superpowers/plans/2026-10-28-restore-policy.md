# Restore Policy Implementation Plan

> 执行：本会话按已授权迁移连续执行，使用 superpowers:executing-plans 与 test-driven-development；不另建工作树、不提交混合用户改动。

**Goal:** 原版按类别合并恢复及十项忽略设置接入现有 HTYF/旧版 ZIP、剪贴板与 WebDAV 恢复链路。
**Architecture:** 纯函数生成所需 MMKV 写入；数据层先验证再事务回滚；独立持久化忽略设置，UI 与媒体激活共用。
**Tech Stack:** 当前锁定 React Native、TypeScript、MMKV、Jest、WKWebView；不改变原生依赖。
**Spec:** ../specs/2026-10-28-restore-policy-design.md

## Global Constraints
- 独立 iOS 模拟器；源只读；目标 ios/android 与原生依赖不变。
- 默认不忽略；缺失类别保留；同标识导入值更新；不能清空整库。
- 十项忽略独立持久化；自动忽略设备路径、设备备份开关与密码。
- 所有确认与设置在应用 React 树内；媒体先暂存、失败清理。

## Review Focus
- 部分/空类别不能删本机独有记录：任务 1。
- 同 URL 不同 id 的书籍及导入标注关联：任务 1。
- 忽略 Cookie 无需解密密码，非法未忽略列表在写前拒绝：任务 1。
- 多字段配置只忽略选定字段，默认封面路径/设备偏好留本机：任务 2。
- 忽略阅读背景的媒体目录不激活；取消/失败仍清理：任务 2。

### Task 1: 合并恢复事务
- 修改 src/data/backup.ts；新增 src/core/restoreBackupEntries.ts。
- 接口 prepareRestoreEntries(previous, incoming, ignore): entries；export BackupValue。
- [x] 给 __tests__/backup.test.ts 添加部分/空列表、匹配 URL、标注、替换型列表、验证/回滚失败测试，运行并确认失败。
- [x] 生成显式类别标识的 upsert 写入；源/规则/注释/分组保留本地独有项；keyboard/highlight.rules 按原版替换；配置对象浅合并。
- [x] 运行目标测试并确认通过。

### Task 2: 忽略与媒体/UI
- 新增 src/data/restorePreferences.ts，十个布尔选项；修改 backup.ts、restoreBackupPreview.ts、legacyBackupArchive.ts、BackupRestore.tsx、i18n.ts。
- [x] 测试配置字段筛选、跳过本地书/Cookie/变量、不解密已忽略敏感数据、忽略 bg 激活和持久化，先失败。
- [x] 接入忽略选项与媒体过滤；确认按钮和说明改为实际合并语义。
- [x] 全套测试、TypeScript、变更代码 ESLint；实际独立 iOS 从部分备份预览/取消/合并，核对旧数据与设置，冷启动。
- [x] 仅在生产代码冻结后构建下一版本，校验输入/ZIP/资源/二维码与源摘要，更新专项报告及全量缺口。

## 执行记录

- Task 1: 五项行为回归先失败；合并实现后通过。Task 2: 三项忽略回归、两项媒体/加密回归及三种原本地书标识先失败，再通过。独立 iOS 实际完成单书部分备份取消/合并、七本数据保留、忽略背景不激活、配置按字段应用和十项选择冷启动持久化。验收后简介/语言与十项开关恢复初始状态。
- Ruling: 持续迁移复用当前 checkout；不提交包含用户既有修改的整体差异，不另建工作树；后续使用最终包输入 SHA 核对运行时代码。
- Ruling: 读取记录的设备维度尚未迁移；目标现有单设备记录保留更大时长，完整原格式恢复继续列缺口，不宣称已完成。
- Final review: 独立只读 reviewer 确认字典实际主键为 name 及 readConfig 必须覆盖 reader.menu.config.v1。两项真实数据测试 RED→GREEN，已修正，全套 188 suites / 896 tests 通过，TypeScript/ESLint 通过。最终包内直接核对两项修复，SHA 见 build-result.json。

- Final: Ruling: reviewer 未检查原始 SQLite/配置 XML/章节位置/设备记录，继续作为全量迁移缺口；Android 图标在用户排除范围，不本轮改动；UI/冷启动由主会话实际验收，磁盘故障只有注入回归证据，不冒充设备实测；HEAD 其它混合更改保留原状态，不以片段审查认定通过。
