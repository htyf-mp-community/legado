# 2026-10-28 备份媒体文件 / Backup media files

整体 1:1 还原仍未完成。本阶段仅使用独立 Legado HTYF 调试 iPhone 17 Pro / iOS 26.5，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`；Android 代码仅为只读规格。

## 原版合同与目标实现

只读规格：`help/storage/BackupConfig.kt`、`Backup.kt`、`BackupMedia.kt`、`Restore.kt`、`help/book/BookCoverPersistence.kt`，以及 `values-zh/strings.xml` 的备份分类。原版包含 11 个内容分类，三项媒体分类为“书籍固化封面、其他封面文件、阅读背景”，默认启用。

- 目标补齐这三项开关及旧偏好的缺省值。固化封面按原生规则识别：绝对路径、直接父目录 covers、32 位十六进制文件名加 `.cover`；子目录中同名文件属于其他封面。
- 原版覆盖 covers 目录中的全部所选类别文件，包括未被书架引用的文件；背景只包含阅读配置所引用的应用背景。本地导出和 WebDAV ZIP 共用这套选择逻辑。关闭固化类别时，备份 JSON 同时去掉书籍 persistedCoverUrl；实际应用书架不被改动。
- 目标 ZIP 保留 `backup-htyf.json`，添加 covers/bg 文件和版本 1 的媒体索引，记录原路径→包内路径、大小及 SHA-256。源/自定义网络 URL 保持独立，跨设备恢复只重映射本地媒体引用。
- 目标原有图片选择器保存于 Documents，旧版导入媒体保存于独立子目录；故归集这些应用目录中的封面，并把已导入固化图按实际内容 MD5 汇合。阅读背景只跟随应用 Documents 内的引用，不读取外部路径。这是 iOS 目录结构的最小适配，未改动原生目录或依赖。
- ZIP 先完整暂存，确认前不创建正式媒体根目录、不写 MMKV。校验文件是否存在、大小和 SHA-256，拒绝未登记的媒体。确认后复制到新、独立的 Documents/LegadoRestoredMedia 根，再调用原有存储恢复；复制/存储失败清理新文件。旧目录不被覆盖或删除。
- 预览更换、取消、返回/卸载清理暂存；正在提交的恢复有唯一所有者，重复确认不能再执行。提交成功后预览清理不会删掉已启用文件。界面立即重新读取恢复后的配置，避免开关仍显示恢复前的值。
- 旧 HTYF JSON 备份继续支持。WebDAV 上传改为真正的二进制 ZIP PUT，处理仅保留最新或日期/设备名文件；下载列表支持原版 `backup.zip`，自动识别 HTYF ZIP 或原版 Android JSON ZIP。旧 JSON 仍可下载；有目录列表时“下载”选择最新记录。
- 原版备份中的自定义/固化封面及分组图只对本地 covers 路径重映射；同名的 HTTPS 图片不被错误替换。缺失文件清除无效覆盖或复用当前 covers 内的同名文件。源简介和私人简介分开恢复。

HTYF 快照格式是独立的协议扩展。剪贴板仍为数据 JSON，文件随 ZIP/WebDAV 保存；界面明确说明这一差别，未把剪贴板当作跨设备图片备份。

## 实际运行时发现并修复

独立 iOS 首轮请求出现 `/legado/legado/…zip`。读取当前固定版本 RN 的 `Libraries/Blob/URL.js` 后确认，其相对 URL 构造会直接拼接目录，其 pathname 也只解析 HTTP，`file://` 返回 `/`。

WebDAV href 现在先解析绝对、协议相对、根相对或目录相对地址，再规范化点路径并检查目录；文件 URI 单独解码。`scripts/test-support/rnUrl.js` 从已安装的固定 RN 源码去除 Flow 类型，实际执行该 URL 实现做回归，不使用手写近似替身。3 个用例验证运行时触发条件、本地路径、五种 DAV href 和目录逃逸。

服务 fixture 最初允许多余中间路径，因此能返回重复目录请求；发现后改成精确目录匹配，核实旧进程退出再启动。后续记录均为严格路由。失败消息也在当前应用内的备份列表显示，避免 toast 被面板遮住而无法看到原因。

## 独立 iOS 证据

仅通过实际备份 UI 操作和正常 `/getBookshelf` 读接口验证；容器文件检查只读，未直接编辑 MMKV。

1. 使用 `scripts/backup-media-fixture.mjs` 的本机 WebDAV，公开 fixture 凭据。自动备份、启动检查与退出阅读进度同步在手动验收时关闭。
2. 实际上传 ZIP **5,976 bytes**，服务收到 `PUT /legado/backup-htyf.zip`、`Content-Type: application/zip`。Python 标准 ZIP 校验通过，内含 6 本书和红/蓝两张固化封面（361/360 bytes），每个文件大小及 SHA-256 都与索引一致；本地/WebDAV 密码字段未导出。见 `evidence/ios/backup-media-original.zip` 和对应 metadata。
3. `scripts/backup-media-prepare.py` 仅在临时服务器副本中把路径改成不存在的 `/previous-device/Documents`，另加分组封面与阅读背景，保留六本书的其它字段。预览时 4 个媒体文件只在 Caches，正式目录为 0；取消后暂存清空、6 本书完全不变。见 `backup-media-preview.png`、`backup-media-preview-files.json`、`backup-media-cancelled.json`。
4. 在 ZIP CRC 正常但图片 SHA 不匹配的副本中，iOS 列表明确显示“备份媒体校验失败”；无书架写入、无媒体目标目录、无残留缓存。严格服务器收到正确的单层目录 GET。见 `backup-media-broken-error.png`、`backup-media-broken-rejected.json`。
5. 原版 ZIP 的 `bookshelf.json` 与 covers/ 被实际识别并暂存，随后取消；没有用这个精简的单本预览去替换现有六本书。见 `backup-media-native-preview.png`。完整原版备份恢复矩阵仍不据此宣称通过。
6. 正式恢复跨设备副本：4 个文件写入新目录，3 本有固化封面的书重映射路径；六本书除 persistedCoverUrl 外逐字段一致，正文、阅读位置/时间、分组、私人简介和网络两层封面均保留。所有暂存文件清理。见 `backup-media-portable-restored.json`、`backup-media-portable-files.json`。
7. 重新上传恢复后的数据，ZIP 正确保留 2 个去重固化封面、分组图和阅读背景。分组及阅读背景路径均指向当前设备的正式目录，空格编码正确，且背景文件再次被收集。见 `backup-media-reexported.zip` 与 metadata。
8. 在 UI 关闭固化类别并再次上传，ZIP 只保留其他封面与背景，6 本书的固化字段和相应 2 个文件被排除；应用里的 6 本书仍与恢复后快照完全一致。见 `backup-media-persisted-excluded.zip`、`backup-media-category-unchanged.json`。
9. 使用原始完整备份恢复验收前分组图、阅读背景及分类设置；当前界面三个媒体开关立即显示启用。六本书仍只有本地封面路径变化，文件实际存在，见 `backup-media-final-before-cold.json`。

10. 最终再次上传后，20 项快照中的 19 项非书架配置逐项与原始备份完全相同；未被引用的旧背景不再导出，未引用的其他封面按原版仍保留。关闭封面及 WebDAV 两个实际进程并确认端口不可达后冷启动，三张恢复后的蓝色封面可见，六本书完整记录与冷启动前全等，无新增 JS 异常。见 `backup-media-final.zip`、`backup-media-final-metadata.json`、`backup-media-final-offline.png`、`backup-media-offline-ports.json`、`backup-media-final-cold.json` 和 `.log`。验收结束后恢复两个测试服务器；应用 Web/MCP/定时服务关闭。

## 验证与剩余范围

**185 suites / 860 tests**、tsc --noEmit、变更运行时代码 ESLint、git diff --check 通过。测试涵盖分类、未引用封面、引用背景、去重、文件变化/缺失/摘要失败、媒体索引路径、旧格式与网络 URL、复制/存储失败、重复确认、文件提供方取消、二进制 PUT/认证/失败清理、旧 JSON 回退、原版 ZIP 和真实 RN URL 回归。

本地 iOS 包版本 **0.0.18**；构建信息见 build-result.json。源 2579 文件和 37 资源映射复核不变；原生目录与依赖版本不变，包未发布。

仍待迁移/验收：原版按类别合并与忽略配置的完整恢复策略（HTYF 完整快照当前是替换型恢复）、原版章节索引/字符位置的完整跨源恢复、Room/SQLite 原始数据适配、壁纸/本地书籍原文件及其它未列入阅读背景的媒体、文件提供方保存和大型/低空间/中断恢复 UI 矩阵、全量主题/手势与真实宿主验收。Web 页面显示固化封面的独立缺口仍未在本阶段处理。开发 JS 整体刷新留下 native Web listener 的既有问题仍开放，此阶段通过关闭服务和专用应用冷启动隔离。

English: ZIP and WebDAV backups now transport selected persistent covers, other cover files and reading backgrounds with digest validation and staged, rollback-safe activation. Dedicated iOS verifies real binary upload, cross-device path mapping, cancellation, corrupt-media rejection, re-export, category exclusion and preserved book data. The full migration and the broader legacy restore/system/UI matrices remain incomplete.

## 0.0.20 后续恢复策略

上述 0.0.18 的替换型恢复与 Web 封面缺口属于历史阶段。当前 JSON 类别恢复已改为原版 upsert 并增加十项忽略，独立 iOS 验证部分单书备份保留七本数据、取消/忽略背景、字段级设置和冷启动；见 [restore-policy-report.md](restore-policy-report.md)。Web 固化封面后续见 [web-cover-report.md](web-cover-report.md)。原版 XML/多套阅读布局、章节位置、设备记录与系统文件矩阵仍未完成。
