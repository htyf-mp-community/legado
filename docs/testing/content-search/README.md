# 2026-10-29 书内搜索处理链与 iOS 验收

0.0.40 补齐缓存书内搜索的原版正文处理、显式提交、正则/净化选项、全部结果和章节内序号定位。完整 1:1 目标继续进行。
Version 0.0.40 aligns cached-book search processing, explicit submission, process-scoped regex/cleanup choices, unlimited results and occurrence-based reader navigation. Full application parity remains in progress.

## 原版依据与实现

依据 `SearchContentViewModel.kt` 的原始 `searchChapter`、`searchPosition`、`getResultAndQueryIndex`，以及 `SearchResult.kt`、`SearchContentActivity.kt`、`BookChapter.getDisplayTitle`、`ContentProcessor.getContent` 和原版菜单/布局。原文件哈希与方法哈希见 [native-comparison.json](native-comparison.json)。

搜索只遍历已有非空缓存，不发起章节下载；输入/选项改变不会重搜，提交时按 Kotlin 空白集合裁边。字面匹配区分大小写且不重叠，正则无效时无结果。取消保留已完成章节，新搜索忽略旧任务；每章节原子发布并在扫描中让出执行。去掉原先 100 条截断。正则内 Java 默认 `\s` 的 ASCII 空白映射也经过对照；完整 Java/ICU Pattern 仍未实现。

原版搜索先转换章节实体标题，再调用默认含标题的 `getContent`。目标跟随这个顺序，按当前转换、重分段、标题移除、HTML 保护与规则/段落阶段处理缓存。净化默认关闭；启用后仍受书籍自动净化策略约束。这里不套用阅读器的临时手动覆盖。搜索净化/正则开关仅本进程有效，不增加持久化键。转换前后标题不同导致旧正文重复标题保留时，也保留原版行为。

摘录固定截取前后 20 个 UTF-16 单元；正则摘录右侧用查询表达式长度，不用实际命中长度，不额外添加省略号。摘录高亮按原版从位置 20 找起、失败后回退；短于 20 的正则摘录保持无高亮。Android HtmlCompat 的富文本渲染尚未完整移植。

点击结果将整组结果和当前索引返回阅读器，按章节内命中序号在当前实际显示文本重新查找，而非直接复用可能因净化配置不同而失效的旧偏移。支持上一条/下一条和返回结果列表；关闭导航不会创建持久批注。普通文本 UTF-16 到现有阅读位置桥接已验收，完整富文本/图片坐标、原版文本选区和选中结果的列表滚动恢复仍 pending。

## 自动化证据

先用原测试确认大小写、100 条截断和摘录规则三个差异，见 [red.log](red.log)。运行未修改的 Kotlin 搜索与 getContent 方法，替换 DB/协程等平台边界，生成 1,738 组 / 3,934 条命中记录。涵盖三种繁简模式、净化/书籍开关、标题/正文规则、特殊 HTML、重复标题、空缓存、重分段、Unicode 和 Java ASCII 空白类。位置、序号、摘录、摘录内位置和结果标题全部逐字段一致。

JVM harness 复用 `reader-native-content-reference.py` 的边界实现与固定 0.5 随机值；协程同步执行，不代表 Android 线程/取消或 Rhino/超时等价。UTF-16LE 传输保留摘录边界的未配对代理单元，见测试夹具元数据。

```bash
python3 scripts/content-search-reference.py \
  --source-root /Users/dgz/code/github/legado \
  --kotlin-lib /Users/dgz/.gradle/wrapper/dists/gradle-9.3.1-bin/23ovyewtku6u96viwx3xl3oks/gradle-9.3.1/lib \
  --jar /private/tmp/legado-ios-debug/chinese-conversion/quick-transfer-core-0.2.17.jar \
  --output __tests__/fixtures/contentSearch.native.json
npm test -- --runInBand --silent
./node_modules/.bin/tsc --noEmit
```

209 suites / 1,034 tests、类型检查及改动文件 lint 通过，[tests.log](tests.log)。另有挂载组件测试验证显式提交、选项不触发提交、旧请求取消/结果隔离、未提交输入不改变返回查询及卸载取消；异步核心测试验证 125 条、空缓存跳过、取消保留完成章节。

## 独立 iOS 验收

专用 Legado HTYF 调试 / iPhone 17 Pro / iOS 26.5，仅 iOS。通过正常 API 导入 18211 回环临时源/一条作用域规则，经 UI 搜索、详情、加书、阅读；未直接写 MMKV。输入带空格时发现现有 URL 构造产生 `/http://127.0.0.1:18211/search` 并返回 404，改用无空格查询“验收”后源搜索/详情/6 章目录/正文通过。该 URL 编码反例尚未修复，不能把此控制查询当作全 URL 兼容验收。

1. 输入 `abc` 不自动搜索，提交后只命中小写 1 条；`甲` 返回全部 125 条。更改正则选项后仍保留 125 条，提交 `(?i)abc` 得 3 条，[正则画面](regex.png)。
2. `定位词` 在缓存前两章返回 4 条。点击第一章第二条，保存位置 5092，显示第 16/16 页和“定位词第二次”，[画面](position-second.png)；下一条跨到第二章，保存位置 21。返回列表仍是原 4 条。调整导航按钮宽度后复验第一条位置 2621，导航完整显示“定位词 1/4”，[画面](navigation.png)。
3. 繁转简开启后，净化关闭搜索“净化词”为 0；开启选项不重搜，重新提交后为 3。结果标题为“第一章 头发”，摘录为净化后的“第一章 净化词”及正文，[画面](converted-replaced.png)。
4. 第六章缓存为空，即使标题含查询也返回 0。整个流程日志没有 `/chapter/6` 请求。前三章是阅读器正常预取缓存；搜索没有补抓未缓存章。
5. 繁简恢复关闭；特殊样式未改、保持开启，字号 19/行距 34。冷启动进程 65938 的关于页显示 0.0.40、正确 storage、iOS 26.5 / RN 0.86.2。调试菜单显式设置 127.0.0.1:8097，未改其他任务的默认 8081 服务。模拟器窗口多任务切换/AX 延迟需重新绑定；只有更新状态及截图确认后计入通过。

[acceptance.json](acceptance.json) 记录边界。临时书/源/规则均经正常 API 清理，[preservation.json](preservation.json) 确认原九本书、八条源及原规则完整记录逐字段不变，真实「阅读书屋」与《西游记-吴承恩》保留；临时查询历史移除，仅保留原“西游记”。18211 停止，Web/MCP/定时任务关闭。最终冷启动状态见 [final-verification.json](final-verification.json)。

## 包与剩余范围

0.0.40 本地 iOS 包、332 项冻结输入及 SHA 见 [package.json](package.json)、[production-inputs.json](production-inputs.json)。ZIP、许可证、无夹具数据、460 处 worklet 数组闭包/零意外赋值/零语法错误通过，[worklet-audit.json](worklet-audit.json)。二维码像素与 URL/README/dist 配置一致，无新依赖或原生目录修改。远程仅只读检查 HTTP 200/200，仍为 0.0.34，[remote-availability.json](remote-availability.json)；本轮未发布，真实宿主/手机验收 pending。

本轮明确未完成：完整 Java/ICU 正则、单次复杂正则的有界中断、全部 HTML/图片/选区布局与结果列表滚动恢复；朗读标题仍传 raw chapter.title，批量导出尚未统一到原版关闭正文转换/重分段的 getContent 处理，Web getBookContent 仍读原缓存；带空格查询的 URL 编码、全局配置/XML、脚本/异常/失效、EPUB/多页 base、手势/视觉/真机矩阵继续待完成。目标未缩减为本搜索切片。

The dedicated iOS checks above cover cached plain-text search and ordinal navigation only. Rich snippets/selection/layout, bounded Java/ICU execution, URL-space handling and remaining read-aloud/export/Web consumers are still pending. Existing user records are retained; the local archive is unpublished and real-host acceptance remains pending.
