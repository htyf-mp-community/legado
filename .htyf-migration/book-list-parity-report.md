# 2026-10-28 书单与首次读取目录

整体 1:1 还原仍未完成。本阶段只在独立 Legado HTYF 调试 iPhone 17 Pro / iOS 26.5 验证，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`。Android Kotlin/XML 为只读规格，没有 Android 构建或设备调试。

## 源到目标映射

| 源规格 | 目标行为 |
| --- | --- |
| BookshelfViewModel.kt / exportBookshelf | core/bookList、bookListFile、BookshelfView：当前分组可见书籍导出 UTF-8 books.json，仅 name、author、intro，优先自定义简介；不含目录、正文、地址、阅读进度或分组。iOS 从源 URI 推导名称，故临时文件也命名为 books.json，保存/取消/失败后清理。 |
| importBookshelf / importBookshelfByJson | BookListImportSheet、services/bookList：网址/JSON/原生文件选择；按书名作者跳过已入库书籍，当前正数自定义分组归组；后台异步处理，无搜索结果逐本提示并记日志，结束提示成功。 |
| model/webBook/WebBook.kt 精确搜索 | 按启用书源 customOrder 顺序严格匹配书名和作者；单源失败仍尝试下一源；限制并发，同批重复跳过，提交前重读最新书架防止覆盖其它导入。 |
| model/ReadBook.kt 首次详情/目录准备 | bookCatalogue、useBookCatalogue、BookCatalogueStatus：首次打开才加载详情/目录，已知目录地址跳过详情；应用树内弹层支持加载/取消/错误重试。Reader/Audio/Video 共用流程，音视频播放另行验收。 |
| 目录、正文与进度持续变化 | bookUpdate 及 Root/四个书籍页面的快照绑定：只合并本次变更字段，正文缓存按章节身份合并，迟到结果保留新跳章、目录和其它编辑；换源后丢弃旧源的迟到章节。待加载书单保持空目录。 |

原目标完整书架 JSON 兼容备份保留在“其它设置 → 更多设置 → 书架数据备份”。BookshelfTransfer 与原生书单协议不同，旧备份章节索引/字符位置恢复仍待修正。

## 独立 iOS 实测

验收源仅在 /private/tmp/legado-ios-debug/booklist-fixture.mjs、127.0.0.1:18198 运行，通过应用已有 /saveBookSource 接口导入。验收数据未成为默认书架或生产 bundle 内容。

1. 在“iOS 分组验收”输入书单网址。先请求 /books.json、/search；跳过同名不同作者候选，入库精确作者“验收作者”。简介来自书源，分组为 1，此时没有详情/目录请求。
2. 首次点击后请求 /book、/toc、/chapter/1，预下载第二章。第一章正文和下一章的第二章正文实际显示。
3. 冷启动后继续阅读直接返回第二章、100%；自定义分组仍有原书和导入书共两本，全书架三本；冷启动没有再次请求验收源章节。
4. 原生保存默认名称 books.json。操作接口曾返回 noWindowsAvailable，随后以真实文件和应用“导出成功”路径反馈确认成功。文件 223 字节，SHA-256 `ac72aad2a73975cc8fea310351e2a85076a4e6ccedc0ec9606528d257b08369a`，解析后仅当前分组两本书的三字段列表。

证据位于 evidence/ios/：book-list-first-read.png、book-list-cold-start-second-chapter.png、book-list-cold-start-group.png、book-list-export-filename.png、book-list-export-verified.json、book-list-fixture.log、book-list-before-reading.json。

初始入库 JSON 记录来自空目录修正前，曾被旧规范化逻辑补成一条空章节。后续已修正，library.test.ts 验证待加载书单目录保持为空。

## 验证与剩余工作

全量 **162 suites / 695 tests**、tsc --noEmit、ESLint、git diff --check 通过。测试覆盖精确匹配/顺序/并发重复/部分失败、网址循环、目录取消/空目录、并发字段/章节合并、UTF-8 文件内容和名称、取消清理、安全域导入副本读取失败清理。源审计 2579 文件和 36 资源映射哈希保持一致。

本地 iOS 包和 265 构建输入哈希见 build-result.json、build-inputs.json。ZIP、业务标记、原封面内嵌及不含验收字符串均已检查；包未发布，实际宿主加载与扫码仍 pending。

文件选择器已显示导出的 books.json，但从文件选择到重复跳过的完整 UI 证据仍待补。无匹配源提示、文件取消/读取失败、目录取消/重试和音视频首次读取的 UI 矩阵待验收。完整书架管理页、旧备份、其它页面视觉/行为和宿主能力仍按总清单继续推进。
