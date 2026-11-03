# 恢复的登录请求头 / Restored login headers (0.0.52)

原版 `BaseSource.getLoginHeader()` 读取 `loginHeader_<source key>` 缓存，`AnalyzeUrl` 默认将其合并到请求头。目标此前已恢复这些缓存行，但发出书源请求时没有消费它们，导致恢复后依赖登录请求头的书源不能正常使用。本轮在请求构造时读取对应源的有效缓存，保留原版 `deadline == 0 || deadline > now` 边界和请求参数后覆盖的顺序；备份恢复格式不变。

Restored native login-header cache rows are now consumed by source requests. Entries are scoped to the exact source key and obey native expiration; URL-option headers take precedence. The backup format remains unchanged.

原版 RSS 列表、正文和封面规则搜索明确使用 `hasLoginHeader = false`，这些路径继续排除登录头；图片加载走原版 `AnalyzeUrl` 默认逻辑。诊断记录对来自登录状态的请求头按名称大小写不敏感地遮盖，包含普通自定义名称。该保证限于请求头字段，不能据此认为服务器响应或其他日志中不存在敏感内容。

Native RSS list/content and cover-rule search explicitly exclude login headers, while image loading uses the default. Request diagnostics redact header names originating in restored login state, regardless of case, including arbitrary custom names. This applies to request-header fields only.

## 验证 / Validation

- [测试](../../../__tests__/restoredLoginHeaders.test.ts)先复现已恢复请求头未被消费的问题，见 [red.log](red.log)；新接入后又用 [exclusion-red.log](exclusion-red.log) 复现 RSS 和封面搜索误带头部，再修正至 [exclusion-green.log](exclusion-green.log)。
- 自动用例覆盖 HTYF 加密备份→恢复→请求构造、源隔离、过期边界、空值、损坏值、请求覆盖、成功及失败日志脱敏，以及 RSS / 封面搜索排除。使用公开虚构值和 Node crypto mock，不接触真实登录信息。
- 使用本机 Gson 2.14.0 和原版 `StringJsonDeserializer` 的同等逻辑对照了字符串、数字、布尔、数组、对象、重复键和空值等有限样例；这不是全部 Gson/HTTP 边界的证明。
- [完整回归](tests-retry.log)通过 222 suites / 1,142 tests，TypeScript 与修改文件 ESLint 通过。并行运行构建时一次测试进程以 139 退出；构建结束后独立重跑通过。
- 独立 iOS 模拟器运行 0.0.52，在用户提供的「阅读书屋」执行《西游记》调试：搜索 1 条、详情成功但作者显示未知、目录 105 项、首个正文项 119 字符，见[截图](real-source.png)。这验证普通真实源未回归，不代表受保护站点或已恢复登录头已在设备上验证。

## 范围 / Limits

任意书源 JavaScript、登录 UI 的脚本桥、`source.getVariable()` / `source.put()` 等运行时消费者、旧设备加密的 `userInfo_` 解密及完整 CookieStore 域匹配仍待实现或验收。无效/过期缓存被忽略；当前不发送 JSON null 的请求头值，未声称复刻原版异常行为。当前实现每次构造请求读取缓存快照；极大缓存性能及完整并发更新行为尚未验证。

没有把模拟器现有源或登录状态改成测试数据。正确密码的设备端加密备份往返、恢复登录头后对实际受保护站点的请求、真实 HTYF 宿主与全应用 1:1 验收仍待完成。仅调试 iOS；不构建 Android。

## 构建 / Build

本地 iOS `dist/dist.dgz` 版本 0.0.52，2,606,404 字节，SHA-256 `ad4f91843a1873ca0006d4fd3ffdfcedbb8609726d28ba62c816314090ee9430`。ZIP 完整性通过，构建保留 FlashList 可选依赖和 Reanimated jestUtils 两项既有警告。远程配置检查为 0.0.49，本地包尚未发布。
