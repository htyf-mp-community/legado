# 换源和目录刷新位置 / Reading position after source and TOC changes

原版 `Book.migrateTo` 根据章节标题/序号匹配新源章节后，将旧 `durChapterPos` 复制给新书；原版 `ReadBook.onChapterListUpdated` 保持当前章节序号，并在目录缩短时限制到有效范围。此前目标换源只保留章节序号而丢失字符位置，且从阅读器换源后，新目录插入章节时界面仍沿用旧索引；目录刷新又会把当前分页强制设为首页。

[换源实现](../../../src/core/onlineLibrary.ts)将属于当前章节的字符位置关联到匹配后的新章节，避免把其他章节的陈旧位置带过去；批量换源使用执行时最新的阅读位置。[目录刷新](../../../src/core/readerRefresh.ts)保持原版章节序号，缩短时钳制并将当前字符位置关联到刷新后的章节。[阅读器](../../../src/index.tsx)在同一本书的来源或书籍地址改变时同步章节索引，并让新的来源重建文字位置桥接；已有文字桥接时刷新目录不再强制跳到首页。

测试覆盖换源字符位置、陈旧位置、批量换源的并发更新、目录插入和缩短、相同网络地址的章节身份，以及阅读器在来源变化与普通数据更新时的索引行为。全量 **235 suites / 1,207 tests**、TypeScript、改动代码 ESLint 和 `git diff --check` 通过。

## 独立 iOS 验证

在专用 iPhone 17 Pro / iOS 26.5 模拟器中通过正常界面导入本机 [A/B 测试源](fixture.mjs)，添加“换源位置验收书”。两个源正文相同，B 源在目录开头多一章。A 源打开第二章并使用无障碍翻页控件前进到[第 2/9 页](before-switch.png)，可见正文从第 008 段开始；更换到 B 源后，第二章从目录第 2 项变为第 3 项，仍显示[第 2/9 页及相同正文](after-switch.png)。

初次操作“更新在线目录”曾在界面上跳回第 1/9 页；修复并重新加载后，重复操作仍保持[第二章第 2/9 页](after-refresh.png)。终止并重新打开调试应用后，继续阅读仍为[B 源第二章第 2/9 页](cold-resume.png)。[本机请求记录](requests.json)只记录测试服务路径，包含目录加载和正文预下载；换源候选查询也触发了其他已启用测试源，部分离线源显示失败。

两条测试源和一本测试书保留在独立调试应用中；没有直接读取或修改其存储文件。此验证使用分页文字和相同正文的本机源，不能推断不同正文长度、滚动/富文本/漫画、物理手势、目录请求期间继续操作的并发时序、真实书源或物理手机均已通过。书架及其他数据未做清理或覆盖。

待确认的 0.0.58 包没有修改，`dist/dist.dgz` SHA-256 仍为 `447e1bcc053aac61234f39618897589b707f36f43f6c4e867abf711486ac91fc`；本轮代码尚未打包、发布或在真实宿主验收，完整迁移目标仍开放。

The native character offset now follows the matched chapter across a source switch. Dedicated iOS testing verifies the same visible text and page after switching to a source with an extra chapter, after TOC refresh, and after a cold restart. Broader reading modes and physical-host acceptance remain open.
