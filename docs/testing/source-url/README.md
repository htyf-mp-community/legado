# 书源地址与编码验收 / Source URL and encoding acceptance

2026-10-29，本地版本 **0.0.41**。本轮补齐 0.0.40 暴露的带空格在线查询错误；完整 1:1 迁移仍未完成。只调试独立 iOS 模拟器，未执行 Android 构建或设备操作。
Local version **0.0.41** fixes the spaced-query counterexample recorded in 0.0.40. Full migration parity remains incomplete. All device work used the dedicated iOS Simulator.

## 修改与根因 / Changes and cause

实际安装的 RN `URL`/`URLSearchParams` 与 Node 实现不同：绝对地址含空格时可被当作相对路径，原请求路径出现 `/http://127.0.0.1:18211/search`，相对链接也可能错误拼接。新增纯 TypeScript 地址解析器，按原版 `NetworkUtils.getAbsoluteURL` 两种重载区分带请求选项的源基址与已解析的重定向基址；查询/表单编码按 `AnalyzeUrl` 和固定 Hutool 5.8.22 方法实现，不修改全局 URL。
The installed RN URL runtime differs from Node: spaced absolute URLs could become relative paths, and relative links could concatenate incorrectly. Pure TypeScript resolution now follows the two native base-URL contracts, while query/form encoding follows AnalyzeUrl and its pinned Hutool codec. Global URL behavior is unchanged.

搜索之外的详情、目录、章节、发现、RSS 和评论请求使用独立分页入口，保留字面 `searchKey` / `searchPage` 参数；只展开有限页码占位符。封面、正文图片和漫画提取使用对应资源基址规则。为现有 RN/EPUB 文件契约保留 `file:///` 适配。响应显式 charset 头优先于请求 charset，修复 GBK 请求返回 UTF-8 时的乱码；UTF-8 BOM 边界按原版处理。
Navigation requests preserve literal legacy search words; only bounded page placeholders are expanded. Covers, content images and manga use resource-base resolution, with the existing EPUB `file:///` adapter retained. Explicit response-header charset overrides request charset, and UTF-8 BOM handling follows the native boundary.

## 自动核对 / Automated comparison

| 核对 / Check | 结果 / Result |
| --- | --- |
| 原方法 JVM 对照 / Unchanged-method JVM reference | 1,798 string-base + 1,798 resource-base + 3,100 parameter cases = **6,696**, all equal |
| 真 RN URL 回归 / Installed RN URL regression | Spaced Chinese query, relative paths, image/manga/RSS/review extraction, form bytes, response charset and literal navigation words |
| 全量测试 / Full tests | **211 suites / 1,042 tests pass** |
| TypeScript / ESLint | Pass |
| 最终包 / Final archive | ZIP/JS syntax/worklet audit pass; **334** frozen production inputs |

原版方法直接从只读源提取，记录源哈希；参考运行器使用 JVM `java.net.URL` 与原项目固定 Hutool JAR，不执行 Android。语料含随机路径、原始地址拼写、百分号、空字段、孤立代理项和十组 charset 输入。重现脚本：[source-url-reference.py](../../../scripts/source-url-reference.py)。原版 Android handler 与 JVM 的差异仍是明确边界。
Native methods are extracted unchanged from the read-only source and hashed. The reference uses JVM URL and the source-pinned Hutool JAR, without an Android build. Cases cover random paths, raw spelling, percent escapes, empty fields, malformed surrogates and ten charset inputs. Android-vs-JVM handler differences remain an acceptance boundary.

证据 / Evidence: [native comparison](native-comparison.json), [red URL regression](red.log), [red response regression](response-red.log), [red navigation regression](navigation-red.log), [passing tests](tests.log), [production inputs](production-inputs.json), [worklet audit](worklet-audit.json).

## 独立 iOS 实测 / Dedicated iOS checks

设备 / Device: **Legado HTYF 调试**, iPhone 17 Pro, iOS 26.5, RN 0.86.2, UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`。最终冷启动 PID **66630**，关于页为 **0.0.41**，存储标识 `io.legado.htyf.application-storage`。

通过应用内“书源调试”真实执行搜索→详情→目录→正文，未借助 Node 替代设备网络。GET 输入 `iOS 地址验收`：查询正确编码，两次故意 404 后重试成功；相对目录及带空格中文章节地址成功，字面 `literal=searchKey` 保留。POST 输入 `iOS 表单验收`：设备发送的 body 与原版输出严格相等，UTF-8 响应正确显示。
The in-app SourceDebug flow executes search → details → TOC → content through the iOS network runtime. GET preserves the spaced Chinese query through two intentional 404s and retry; relative chapter links and literal parameters survive. POST sends exactly the native reference body and correctly decodes a UTF-8 response:

```text
q=iOS+%B1%ED%B5%A5%D1%E9%CA%D5&literal=%2520&raw=%2B
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
```

两条临时源均显示 search 1 / toc 2 / content 182。见 [GET screenshot](get-debug.png)、[POST screenshot](post-debug.png) 和 [loopback request trace](requests.json)。本轮未通过普通搜索页完成添加/阅读新书，未实测第二章货币参数或图片渲染；这些不列为 UI 通过项。
Both temporary sources show search 1 / TOC 2 / content 182. Normal search/add/read, the fixture's second chapter and image rendering were not accepted in this iteration.

用户提供的 [1321.json](https://www.yckceo.com/yuedu/shuyuans/json/id/1321.json) 对应 **📂阅读书屋 / https://www.vikbook.com/**，保留在源列表。当前代码重新联网调试《西游记》：搜索 **1** 条、详情 **西游记-吴承恩 / 未知作者**、目录 **105** 项、首个前置页正文 **119** 字符；见 [真实源截图 / real-source screenshot](real-source-debug.png)。该结果不等于本轮重新阅读整章小说。
The user's real source remains imported. A fresh current-code request passes all four stages for 西游记: one search result, matching details, 105 TOC entries and 119 characters of front matter. This is not a claim of a fresh full-novel-chapter reader check.

自动审批拒绝同时开启持久 Web/MCP 服务，理由为扩大本地访问面；未重试该操作。改用现有书源调试 UI 和正常 ZIP 备份导出完成验证。临时源已通过管理 UI 删除，未新增临时书籍。正常导出记录与测试前逐条比较：**9 本书、8 条源、0 条规则完全相等**，未直接读取/修改 MMKV。为核对生成的临时 ZIP 已精确清理，原有备份未删除。
Automatic review rejected enabling both persistent Web/MCP services because it expands local access. That action was not retried. Existing SourceDebug UI and normal ZIP export provided the verification. Both temporary sources were removed through source management; no temporary books were added. Exported records exactly match the baseline: **9 books, 8 sources, 0 rules**. MMKV files were neither read nor edited; only the specifically generated temporary ZIP was cleaned up.

最终冷启动确认 Web/MCP/定时任务关闭，1122/1236/18212 无监听；仅本任务 127.0.0.1:8097 调试服务保留。书架仍为九本，续读《西游记-吴承恩》。见 [preservation](preservation.json)、[acceptance](acceptance.json)、[final shelf](final-shelf.png)。
Cold-start checks confirm Web/MCP/tasks are off, ports 1122/1236/18212 are closed, and the dedicated loopback debugger remains on 8097. The original shelf and continue-reading book are retained.

## 包与剩余范围 / Archive and remaining scope

[本地 iOS 包 / Local iOS archive](../../../dist/dist.dgz)：2,226,338 bytes，SHA-256 `39b6ecfbeb1b9ec9697fa1438486fefb4f6133d7848e385a5b1e943d28f07877`。由官方 CLI 0.7.9 构建，未新增 npm 依赖、未修改原生目录。二维码像素解码、保存 URL、README 与 dist 配置一致。
The local iOS archive was built with official CLI 0.7.9. No npm dependencies or native directories changed. QR decoding, saved URL, README and dist metadata agree.

本地包**未发布**。配置远程地址只读 HTTP 200/200，仍是 **0.0.34**；独立源码调试与构建审核不能代替真机 HTYF 宿主加载包。见 [package](package.json)、[remote availability](remote-availability.json)、[final verification](final-verification.json)。
The archive is **unpublished**. Remote metadata/package URLs return 200/200 but still reference **0.0.34**. Source-based iOS debugging and archive audits do not replace physical HTYF-host loading.

继续待完成：无响应 charset 头时原版 HTML meta/ICU4J 自动检测；完整 Java Charset/协议 handler、原始自定义 body/Content-Type 和 HTTP wire 规范化；其他 URL 消费者、任意 Rhino/有界取消、富文本选区/图片布局/坐标、朗读/导出/Web 正文链、全量视觉/手势和真机宿主。当前有限语料通过不代表完整字符集或全应用 1:1。
Remaining: native HTML-meta/ICU4J headerless detection; full Charset/protocol/custom-body/header/wire semantics; other URL consumers; bounded Rhino/cancellation; rich selection/image/layout/position behavior; read-aloud/export/Web content; full visual/gesture and physical-host acceptance. Finite reference success does not establish full parity.
