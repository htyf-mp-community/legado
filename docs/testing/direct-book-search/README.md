# 搜索直达详情 / Search redirecting to a detail page

原版 `BookList.analyzeBookList` 对搜索响应最终地址完整匹配 `bookUrlPattern`，匹配时用详情规则解析；列表为空且地址模式为空时，搜索和发现都回退到详情规则，列表存在但名称为空时不回退。原版 `infoHtml` 和同地址 `tocHtml` 是瞬时数据，可复用已下载页面。此前目标始终按列表规则解析，搜索跳转到详情页时返回空结果。

[实现](../../../src/core/webBook.ts)增加上述判定和只随结果对象存活的响应缓存，详情及同地址目录避免重复请求；不同目录地址和后续目录页仍各自请求。`bookUrlPattern` 的正则转换与原版 Java Pattern 仍有未覆盖的语法差异，不能据此认为全部原版正则兼容。完整正文复用、登录脚本和所有异常路径未在本轮验收。

[测试](../../../__tests__/directBookSearch.test.ts)先复现两项失败，再覆盖跳转、精确地址匹配、空列表回退、非空列表边界、分页、独立目录、列表同地址复用和 JSON 响应。最终全量 232 suites / 1,190 tests、TypeScript、改动文件 ESLint 和 `git diff --check` 通过。

## iOS 验证

在独立 iPhone 17 Pro / iOS 26.5 模拟器中，通过正常书源管理界面导入本机 [测试源](fixture.mjs)。搜索 `跳转验收书`，服务以 HTTP 302 跳转到详情页；搜索显示书名和作者，打开结果显示[两章目录](redirect-detail.png)。[请求记录](requests.json)只有 `/source.json`、`/search`、`/book/1`：详情和同地址目录没有再次访问 `/book/1`。测试源保留在独立调试应用中，没有添加测试书到书架。

本轮也重新打开用户集合中的原样“📂盗墓笔记”：发现页仍为 11 本，第一本详情仍为 75 章；作者仍受该源规则影响而显示书名。用户集合中有 158 条设置了 `bookUrlPattern`，但静态计数不代表这些源均可用。尝试只读访问其中“📂爱书包”的搜索地址，在 12 秒内连接超时；本机重定向测试不等于该真实站点或物理手机通过。

本轮未修改待确认的 0.0.58 成品包，也未发布；新逻辑尚未进入该包。完整迁移目标仍未完成。

Search redirects and empty-list detail fallback now follow the evidenced native control flow, with transient reuse of the detail response. A loopback 302 fixture confirms the UI and request count in the dedicated iOS simulator; an unchanged real source remains usable for discovery and contents. This is not physical-device or complete rule-engine acceptance.
