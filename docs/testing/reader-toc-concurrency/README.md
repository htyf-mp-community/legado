# 阅读时更新目录的并发保护 / Concurrent TOC refresh while reading

原版 `ReadBook` 在异步加载前记录阅读位置版本，旧请求完成时不会覆盖较新的阅读操作。目标此前的在线目录更新捕获请求开始时的书籍，完成后直接设置旧章节索引；用户在等待时翻页、切章或启动新更新，旧结果可能覆盖当前状态。

[位置桥接](../../../src/components/ReaderPositionBridge.tsx)现在可读取尚未到期持久化的可见字符游标；[目录刷新](../../../src/core/readerRefresh.ts)在网络返回后基于最新书籍、章节和缓存合并。来源、书籍地址、目录地址、目录方向或书籍类型改变时，旧结果和旧错误都被丢弃。[阅读器](../../../src/index.tsx)仅允许最后一次目录请求提交；换源或卸载使旧请求失效，并在提交前取得当前游标。

自动测试覆盖未持久化游标、延迟返回后的最新章节/内容/位置、上述五种身份变化，以及换源后旧网络错误不再覆盖现状。全量 **235 suites / 1,215 tests**、TypeScript、改动代码 ESLint 和 `git diff --check` 通过。

## 独立 iOS 验证

使用上轮已有的“换源位置验收书”和只监听本机的 [A/B 测试源](../source-switch-position/fixture.mjs)，令 B 源的一次目录响应延迟 12 秒：

1. 在第二章第 2/9 页启动更新，等待期间翻到第 3/9 页。更新显示完成后仍为[第二章第 3/9 页](after-page-turn.png)。
2. 再次启动慢速更新，在等待期间切到第一章。更新完成后仍为[第一章第 1/9 页](after-chapter-change.png)；冷启动后仍恢复[第一章](cold-resume.png)。[本机请求路径](page-and-chapter-requests.json)记录了两次延迟触发、目录请求和切章正文请求。
3. 连续启动两次更新，让第一次延迟返回带“旧结果”字样的目录，第二次立即返回正常目录。服务端[事件时间](overlapping-events.json)显示新请求先完成、旧请求约 3.3 秒后完成；[最终目录](overlapping-final.png)仍是正常的“前言、第一章、第二章”。对应[请求路径](overlapping-requests.json)。

测试使用 iOS 分页文字和本机源；真实书源、滚动/漫画、物理手势、应用切后台以及请求期间修改同一书源规则等情况没有在本轮验收。没有新增测试书或书源；原有测试书被正常切到 B 源第一章并保留。未直接读取或改写应用存储。

待确认的 0.0.58 成品包未改，`dist/dist.dgz` SHA-256 仍为 `447e1bcc053aac61234f39618897589b707f36f43f6c4e867abf711486ac91fc`；此轮代码尚未打包、发布或在真实宿主/物理手机验收。完整 1:1 目标仍开放。

The current cursor and chapter are rebased onto a completed TOC request, and stale or superseded results are ignored. Dedicated iOS testing covers page turns, chapter changes, out-of-order requests and cold restoration using a controlled local source; other reading modes and physical-host testing remain open.
