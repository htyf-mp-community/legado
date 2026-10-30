# 2026-10-29 书源索引语义验收 / Selector index parity

这是完整 1:1 还原目标的一项进展。源工程只读，没有 Android 构建；运行验收仍仅使用独立 Legado HTYF 调试 iPhone 17 Pro / iOS 26.5 模拟器。

## 原版语义与修复

对照源 `app/src/main/java/io/legado/app/model/analyzeRule/AnalyzeByJSoup.kt` 中未改动的 `ElementsSingle`：

- `tag.i.4:1:-1:1` 的冒号分隔单个索引，按指定顺序选择、去重，不能当作区间；`!` 排除后保持剩余节点的原顺序。
- `[start:end:step]` 包含两端；起点可省略为 0，终点可省略为最后一项。支持倒序、负索引、多索引与区间混合、空格、越界端点裁切和同侧越界空结果。
- 负步长按原版列表长度换算，零步长按列表长度处理，超大正步长仅取起点；没有替换为 JavaScript/Python 的切片规则。
- 每个父节点分别应用下一层索引；无前置选择器的索引和 children 索引作用于直接子元素。选择器查询可包含符合条件的当前元素。
- 空列表上原版会报错的区间，以及超过原版 Int 可解析范围的索引，目标继续报告错误，映射为 JavaScript RangeError。没有静默改成成功空结果。

`src/core/sourceRule.ts` 的解析和筛选路径同步实现这些语义；合法数字标签、class/id 和 CSS 属性选择器继续保留。完整规则引擎、任意 JavaScript 和全部显式 CSS 模式差异不属于本项已完成结论。

## 直接运行原版验证

新增核心用例最初 19 项失败，见 [red.log](red.log)。原有 `tag.span[0:1]` 的单项预期按原版修正为两项。

[scripts/legacy-selector-reference.py](../../../scripts/legacy-selector-reference.py) 从源文件逐字抽取 `ElementsSingle`，包装后以本机 Kotlin 编译器和源工程固定的 Jsoup 1.16.2 运行。没有重写一份参考算法或进行 Android 构建。源文件、抽取类和依赖 JAR 的 SHA-256 保存在 [原版输出夹具](../../../__tests__/fixtures/legacySelectorIndex.native.json)。

生成 2,456 组输出，含 303 组预期错误，目标全部匹配。覆盖 0/1/2/6 项列表、正负/省略/越界端点、选择/排除、步长和 Int 溢出。重新生成命令（路径按本机编译器位置调整）：

```bash
python3 scripts/legacy-selector-reference.py \
  --source-root /Users/dgz/code/github/legado \
  --kotlin-lib /Users/dgz/.gradle/wrapper/dists/gradle-9.3.1-bin/23ovyewtku6u96viwx3xl3oks/gradle-9.3.1/lib \
  --jsoup-jar /private/tmp/legado-ios-debug/selector-index/jsoup-1.16.2.jar \
  --output __tests__/fixtures/legacySelectorIndex.native.json
node node_modules/jest/bin/jest.js __tests__/legacySelectorIndex.test.ts --runInBand
```

参考 JAR 来自 Maven Central 的 `org/jsoup/jsoup/1.16.2/jsoup-1.16.2.jar`。生成器只使用传入文件，目标生产依赖不变。最终全量 196 suites / 959 tests、TypeScript 和改动代码 ESLint 通过，见 [tests.log](tests.log) 和 [acceptance.json](acceptance.json)。

## 真实站点 iOS 验收

复制前一轮用户提供集合中的「阅读书屋」，仅给临时副本增加唯一 source URL、名称/排序，并把目录列表规则改成 `#content@.page[2:6:2]`。原书源规则保持不变。通过正常应用 API 添加临时副本，再在 UI 限定搜索《西游记》，在线详情恰好显示第一、三、五回，包含终点第 6 项。

![真实目录步长](range-toc.png)

通过 UI 运行书源调试：搜索 1 条结果、详情成功、目录 3 章、正文 6,991 字符，四阶段均成功。

![四阶段调试](source-debug.png)

没有将测试目录加入书架。通过正常 API 移除临时副本后，原有 9 本书和 8 条书源完整记录逐字段相同。Web/MCP/自动任务恢复关闭；原始公开源仍保留在应用中。清理后通过既有 8097 调试服务冷启动，书架仍有 9 本，原书继续阅读恢复第二回第 2/24 页，见 [冷启动截图](cold-resume.png)。

## 构建与剩余验收

官方 CLI 0.7.9 生成 iOS 0.0.30 包，ZIP 完整性通过。308 个生产输入见 [production-inputs.json](production-inputs.json)；460 个数组闭包、0 个旧格式已编译闭包、两个未调用的库内 Jest 辅助函数和 0 个语法错误见 [worklet-audit.json](worklet-audit.json)。包中没有导入源或临时副本数据。分享 QR 像素解码与最终配置、README 链接一致。

生产包未发布，真实红糖云服宿主/真机验收仍 pending。完整 UI/交互矩阵、JS 沙箱等迁移清单未全部通过，不将本项测试或打包视为全应用 1:1 完成。

The unchanged native Kotlin index class was executed with the source-pinned Jsoup 1.16.2. All 2,456 generated boundaries, including 303 expected errors, match the target. Native ordered indexes, inclusive ranges, exclusion, negative indexes/steps, omitted endpoints, per-parent selection and overflow behavior are covered. All 196 suites / 959 tests, TypeScript and changed-code ESLint pass.

An independent iOS simulator selected chapters one, three and five from the real site using `[2:6:2]`; all four source-debug stages passed, with 6,991 content characters. The temporary source was removed and all nine books/eight original sources were preserved. A subsequent cold start resumed the original book at chapter two, page 2/24. Production 0.0.30 is built and audited; publication and real HTYF-host/device acceptance remain pending. Overall 1:1 parity remains incomplete.
