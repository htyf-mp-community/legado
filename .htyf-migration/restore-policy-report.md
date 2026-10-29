# 2026-10-28 合并恢复与十项忽略设置（iOS 部分验收）

整体 1:1 迁移继续进行。仅在独立 Legado HTYF 调试 iPhone 17 Pro / iOS 26.5（8338CC2C-E716-4B2B-BC30-CC5C777CB2FD）调试；源只读，目标原生目录及依赖版本不变。

## 原版合同与目标实现

对照源 `help/storage/Restore.kt`、`BackupConfig.kt`、各实体与 DAO：恢复普通数据库表使用 upsert，保留本机独有项；缺失类别不清空，空普通列表也不清空。键盘辅助和高亮规则是原版整表替换例外，主题预设文件仍按备份替换。目标 `core/restoreBackupEntries.ts` 先计算/验证全部写入，`data/backup.ts` 不再先清空 MMKV；写入异常仍回滚原状态。旧版 JSON 转换、HTYF ZIP、剪贴板、WebDAV 和启动检查共用此入口。

显式映射书籍、分组、标注、书源/RSS、规则、任务、HTTP TTS、原版变量缓存/服务器和目标阅读记录的标识。字典规则使用真实的 name 主键。书籍按 ID 或 bookUrl 对应；同 URL 的旧版 ID 不覆盖目标稳定 ID，导入标注的 bookId 随之重映射。完整旧章节位置/标注章节点映射仍为独立缺口。

`data/restorePreferences.ts` 在唯一 MMKV 中保存原版十项“恢复忽略列表”，默认全关：阅读界面、主题模式、主题配置、封面设置、书架布局、订阅显示、线程数、本地书籍、Cookie、书源变量。忽略列表本身不进入备份，也不会被导入覆盖。阅读忽略同时保护阅读菜单配置，且不将 bg/ 暂存文件激活到 Documents；封面仍可按原版恢复。本地书判断复用已有分类器，包含 loc_book、local、WebDAV 和原版 type 256。

配置按字段应用：例如忽略主题模式仍允许恢复语言；忽略书架布局只保护布局字段。原版自动忽略的默认封面文件路径、备份设备名/自动备份/本地书自动恢复开关和本地密码保留本机。备份分类选择与运行时间戳属于设备备份配置，也保留本机。忽略 Cookie 时不解密其加密条目；旧版 ZIP 同样在读取/解密前跳过被忽略文件。文件仍先隔离暂存、失败清理，未修改原文件。

确认说明改为实际合并语义。全部设置与确认使用应用树内 InTreeSheet，未使用原生全屏 Modal。设计和执行记录见 `docs/superpowers/specs/2026-10-28-restore-policy-design.md` 和对应计划。

## 自动检查及独立审查

- 188 suites / 896 tests 全通过；TypeScript、变更运行时代码 ESLint、git diff --check 通过。
- `tests-restore-merge-red.log`：部分/空类别、URL 身份与验证回归先失败。
- `tests-restore-ignore-red.log`、`tests-restore-media-red.log`、`tests-restore-local-kind-red.log`：配置、敏感数据、本地书和背景回归先失败。
- 独立只读 reviewer 找出字典主键误用 id 和阅读菜单忽略遗漏；以真实字典结构/空导入及菜单数据复现为两个失败测试，再修正。见 `tests-restore-review-red.log` / `tests-restore-review-green.log`。该审查未发现其它具体问题，也未替代 iOS 验收。
- 现有存储写入失败、媒体复制失败和重复确认等事务回归继续通过。没有用测试 Mock 的成功替代实际 iOS 合并证据。

## 实际独立 iOS 证据

复用本机 18201 WebDAV 夹具。`scripts/restore-policy-prepare.py` 从应用正常上传的七本书备份派生只含一本书的六条目 ZIP，另附一个背景文件；不直接写 MMKV，不默认植入书架，不进入生产 bundle。

1. 正常上传基线：`evidence/ios/restore-policy-baseline.json` / `.zip`。UI 中十项默认关闭，逐一开启后保存。
2. 预览部分 ZIP 时只有一个背景暂存文件、正式目录为零；取消后暂存删除。随后应用正常导出，七本书和其它应用条目保持原值（日志、备份时间戳会自然变化）。见 `restore-policy-preview-files.json`、`restore-policy-cancelled.json`。
3. 再次确认“合并并恢复”：一条同 URL、不同 ID 的书籍更新私人简介，本机原 ID 保留；另外六本书完整记录完全不变。原有书源、分组、引擎、任务和其它类别保留。被忽略的 reader 配置、Cookie、变量未新增，背景未复制到 Documents，暂存已清理。见 `restore-policy-merged.json` 和 `restore-policy-commit-staged.json`。
4. 主题模式被保留为 system，未忽略的语言从 system 恢复为 zh-CN，证明按字段应用。设备名仍 HTYF，自动备份和远端本地书自动恢复仍关闭。
5. 真正终止并冷启动应用：七本书与合并后的其它条目逐项相同，十项忽略选择仍全开，见 `restore-policy-cold.json`、`restore-policy-ignore-cold.png`。当前运行日志未检出 JS 异常。
6. 通过正常备份恢复原简介和语言，UI 逐项把十个测试开关恢复为关闭，再正常导出；七本书和其它条目与验收前基线相同（除自然变化的日志、备份时间戳）。见 `restore-policy-final.json`。测试敏感条目和 reader 配置没有进入本机状态。

## 范围限制

该片段补齐已实现目标 JSON 类别的恢复合并/忽略策略，不代表全量备份恢复已通过。原版配置 XML 解析、完整 readConfig 多套布局/选择、设备维度 readRecord 归并、旧章节索引/字符位置/标注映射、原始 Room/SQLite、本地书籍原文件、壁纸、文件提供方、大文件/低空间/中断矩阵仍待完成。目标单设备阅读记录暂取较大累计时长；它不替代原版按 deviceId 区分的完整迁移。忽略阅读时 HTYF ZIP 的媒体索引仍会先校验，损坏而被忽略的媒体矩阵未验收。

本轮包未发布，真实 HTYF 宿主扫码/加载与全量视觉/交互仍未验收。构建热刷新残留 native HTTP listener 的旧问题仍开放；本轮服务均关闭，并用真正应用冷启动验证。

## 最终本地构建

iOS **0.0.20**：1,609,871 bytes；SHA-256 `60672feb6a4af634dd18753c9a1b855cdc0286ebb2a41a090e7d52369d55b879`。301 个生产输入与 37 项资源映射核对，原版 JPEG 完整内嵌，ZIP 完整性通过；生产 bundle 已直接核对字典 name 主键与 reader.menu 忽略列表两项修复，并确认夹具名称/端口/数据未进入包。二维码离线解码与 README/公开配置一致。源 2579 文件摘要不变。包未发布，远程配置仍 0.0.14。

最终重建后的代码再次冷启动：书架七本、十项忽略全关、Web/MCP/定时任务关闭，未检出 JS 异常；生产输入 301 项均与包生成时一致，见 `restore-policy-final-audit.json` 与 `restore-policy-final-cold-errors.log`。最终保留 8097 开发服务和 18201 WebDAV 夹具；其它历史测试端口未自动重启。
