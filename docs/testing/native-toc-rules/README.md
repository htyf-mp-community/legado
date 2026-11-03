# 目录规则与章节身份 / Native TOC ordering and chapter identity

对照原版 `BookChapterList.kt` 和 `BookChapter.kt`，补齐目录规则 `-` / `+` 前缀、普通和倒序模式下的去重方向、书籍反转目录状态、单链接连续翻页与首屏多个目录链接的并发抓取。多链接结果保持原链接顺序；单页失败时取消其余并发请求。空目录明确报错。分卷/VIP/购买状态按原版 `isTrue` 解析，无链接分卷使用标题和页内序号生成身份；可选字数从更新时间规则中提取。

原版按规则输出的**原始章节 URL**去重，目标仍使用解析后的绝对地址发请求，同时保留原始 URL 作为身份。两个不同原始地址若解析为相同绝对地址，书架会给它们各自稳定的章节 ID。阅读器、书架刷新、缓存、目录恢复和 Web 刷新复用原始身份及旧记录兼容匹配，避免合并章节缓存；反转目录状态也传递给相关刷新入口。

## 对照与自动验证

运行 [Kotlin 对照生成器](../../../scripts/toc-order-reference.py)，从未修改的原版文件提取排序/去重代码以及章节 URL 的 `equals`/`hashCode`，以轻量 Book/BookChapter 类型在 JVM 中执行；为隔离 Android 协程，仅去掉该片段中的一次 `ensureActive()`。长度 1～5、三个可能 URL、两种源方向与两种书籍反转状态共 **1,452 组**，均与目标逐项相同。完整有限语料为 [nativeTocOrder.json](../../../__tests__/fixtures/nativeTocOrder.json)，其 SHA-256 为 `8e1a56b686335c3f1e540e7692333a28b05e15059a326cc56c1b7832275ebb45`。原版文件 SHA-256 分别为 `69158e22bfe73e0a585b49d84f44c3164fe4526dba9f547f5ffb3eade58fe253`、`270974eef0f026143327534963ff06fa0a4621c0ecbf95b5fd9fc57665c99434`。

[目录测试](../../../__tests__/nativeTocRules.test.ts)还覆盖多页、并发失败取消、原始链接与绝对地址、空目录、重定向、分卷和标志；[身份测试](../../../__tests__/chapterIdentityMapping.test.ts)覆盖碰撞、旧缓存迁移、阅读器/书架/缓存刷新及并发书籍更新。对旧测试中与原版不符的重复链接和独立 `wordCount` 规则预期，按原版源代码修正。全量 **234 suites / 1,202 tests**、TypeScript、改动文件 ESLint 和 `git diff --check` 通过。

## 独立 iOS 验证

在专用 iPhone 17 Pro / iOS 26.5 模拟器中通过正常界面导入本机[三页目录测试源](fixture.mjs)。源列表为倒序，第二章在两页重复，第三页为无链接分卷。详情展示[第一卷、第一章、第二章原版、第三章](multipage-detail.png)，阅读器[将第一卷显示为分组并打开第一章](reader-toc.png)；终止并重新打开调试应用后，[目录和第一章恢复](cold-resume.png)。[请求记录](requests.json)包含三页目录和阅读正文请求；后续章节请求包含应用原有预下载行为。

本轮真实书源回归使用用户集合中未修改的“📂阅读书屋”，《西游记》仍显示[105 章目录](real-source.png)。原始集合中 831 条含目录列表，26 条列表以 `+` 或 `-` 开头；这些是静态统计，其他规则和站点可用性并未全部验证。测试源和一本“多页目录验收书”保留在独立调试应用中，未直接访问或改写存储文件。

本轮没有验收物理手势、每种目录规则语法、书籍反转控件的 iOS 操作、复杂 HTML 解析副作用或任意 JS 目录脚本；`formatJs`、`preUpdateJs` 等仍受现有 JavaScript 运行时缺口约束。目录语义的有限 JVM 对照不代表完整应用已 1:1。待确认的 0.0.58 包没有修改，SHA-256 仍为 `447e1bcc053aac61234f39618897589b707f36f43f6c4e867abf711486ac91fc`；此轮开发代码尚未打包或发布，也未在真实宿主或物理手机验收。

Native chapter ordering and URL equality match 1,452 extracted Kotlin cases. The dedicated iOS simulator verifies multi-page ordering, volume display and cold restoration, plus the unchanged real source's 105-item directory. Complete source-rule, host and physical-device parity remain open.
