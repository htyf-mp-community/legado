# 书源列表规则与发现回退 / Book-list prefixes and explore fallback

2026-11-01 在用户指定的独立 iPhone 17 Pro / iOS 26.5 模拟器验证，源 Kotlin 工程保持只读。

原版 `BookList.analyzeBookList` 在解析搜索或发现列表前依次移除开头的 `-`、`+`，`-` 表示在按书籍 URL 去重后倒序；发现规则的 `bookList` 为空白时，使用完整的搜索规则。此前目标将前缀交给选择器，且始终使用发现规则，因而对应结果为空。[实现](../../../src/core/webBook.ts)按这个顺序处理；[回归测试](../../../__tests__/bookListRuleParity.test.ts)覆盖正序、倒序、组合前缀、重复 URL、空白发现规则、显式发现规则及真实集合中的 CSS 前缀。修复前这些针对性用例有 3 项失败，修复后 5 项全部通过。

用户提供的 1321 集合本次下载仍为 836 条、9,302,369 字节，SHA-256 `761f4a91086a40a0c22bb50702fe7152ee3854ca55286292e26101a4e2ca7390`。其中 2 条搜索列表以 `+` 开头；204 条启用了发现并拥有发现地址的源，其发现列表为空白而搜索列表非空。这只是静态规则统计，不能推断全部书源可用或不含其他不支持的规则。

## 真实站点

从该集合原样导入单条“📂盗墓笔记”，没有修改源规则。发现列表为空的旧进程重启后加载新代码，实际发现页显示 11 本，包括《盗墓笔记1：七星鲁王》《沙海》和《藏海花》，见[截图](real-explore.png)。打开第一本，详情显示 75 章，见[详情截图](real-detail.png)。该源自身作者规则得到书名，详情因此显示不正确的作者；未擅自改写源规则。网络页面会变化，本机另行取得的主页响应为 42,091 字节、SHA-256 `03c357e2052e45390450467c0ff5051131b63a70b3ffa848b0a565885f9fdf23`，但此哈希不作为模拟器实际响应的证据。

该真实书源保留在独立调试应用中，书架未新增测试书；未直接读取或修改存储文件。此项仅覆盖列表和详情，不代表该源完整正文、所有 204 条源、物理手机或完整发现功能已验收。

## 检查与交付边界

全量 231 suites / 1,182 tests 通过；TypeScript、改动文件 ESLint 和 `git diff --check` 通过。没有新增依赖或原生工程修改。本次使用独立模拟器的开发构建，尚未在真实宿主加载新改动。待用户确认的 0.0.58 成品包保持原样，`dist/dist.dgz` SHA-256 仍为 `447e1bcc053aac61234f39618897589b707f36f43f6c4e867abf711486ac91fc`；上述新改动不包含在该待确认包中，也没有发布。

Search/explore list direction flags and the native explore-to-search fallback are implemented and covered by regression tests. An unchanged source from the supplied collection shows 11 real books in the dedicated iOS simulator and opens a 75-chapter detail page. This is not a claim of full source compatibility or physical-device acceptance.
