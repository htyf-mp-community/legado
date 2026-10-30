# 2026-10-29 替换作用范围、分组字符串与独立 iOS 验收

本轮修正替换规则的作用范围、匹配内容空格、Java 分组替换字符串及正文规则的启用/裁边阶段。完整 1:1 目标仍在进行。
This iteration aligns replacement scopes, significant pattern whitespace, Java replacement strings and reader enablement/line trimming. Full application parity remains in progress.

## 原版依据与实现

原版依据为 ReplaceRuleDao、ReplaceRule、ContentProcessor、RegexExtensions、BookChapter 和 ReadBook；路径和 SHA-256 随 [原版对照数据](../../../__tests__/fixtures/replaceRules.native.json) 保存。源项目未修改。

- 作用范围执行原版的 `scope LIKE '%' || :name || '%'` / origin 判断，保留默认 SQLite 的 ASCII 大小写折叠、`%` / `_` 通配、补充平面码点与 NUL 截断。排除范围的 null 与空字符串保持区别。书源目标按原版忽略书籍包含/排除范围。
- 当前格式和旧格式的 pattern 不再 trim；scope/excludeScope 也保留原始空格与空字符串。名称/分组、缺省顺序和整个旧 JSON/非法字段矩阵不因本轮而宣称完成。
- 正则替换字符串使用 Matcher 语法：整体 `$0`、按现有分组数贪心读取的 `$10` / `$123`、`${name}`、未参与分组为空串和反斜杠转义。Java 无效的 `$&` / `$$` 等不再按 JS 语法替换。只在实际匹配时检查替换字符串；单条规则失败保留该条之前的输入，再继续后面的规则。每条把标题变空白的规则仍回滚到旧标题。
- 使用既有 `compileSourceRegex` 处理支持的前置 i/m/s 标志和 Java `$` 锚点。这里修正的是替换字符串，未实现完整 Java Pattern 引擎。原版超时、取消和 Rhino `@js:` 替换仍未完成。实际命中的正则脚本返回明确 unsupported issue；普通非正则的 `@js:` 字符串仍按字面替换。
- `runReplaceRules` 一次返回结果、改变过正文的规则和失败项；阅读器正文与生效列表共用这一结果。编辑预览忽略书籍作用范围，并显示错误；正文失败说明显示在生效列表。标题、书源、导出等其他调用者的完整错误反馈矩阵仍待核对。
- 按原版区分自动启用、空手动覆写、仅标题手动覆写和临时双指预览。自动启用时即使没有正文规则也运行 Kotlin lines/trim 阶段；关闭、手动仅标题和 literal `null` 跳过它。已有手动模式在双指预览时始终关闭。未据此补完原版 AppConfig 全局手动开关和 XML 恢复。
- 修正批量导出的本地书 scope origin 为已有统一 `loc_book` 上下文，阅读器向前章节末页估算也使用当前启用策略和正确 origin。完整导出和位置计算链仍 pending。

SQLite 和 Matcher 的公开定义可分别查阅 [SQLite LIKE](https://www.sqlite.org/lang_expr.html#like) 与 [JDK Matcher.appendReplacement](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/regex/Matcher.html#appendReplacement(java.lang.StringBuffer,java.lang.String))。本轮结论以以下执行对照为准。

## 可重跑的对照

最初三项红用例分别复现空格 pattern 被丢弃、范围匹配失败和替换字符串结果错误，见 [red.log](red.log)。

`scripts/replace-rule-reference.py` 直接从原版 DAO 提取三条完整查询，在 SQLite 3.53.3 执行 1,440 组启用/目标/范围案例，另执行 1,600 组默认 LIKE 对照。临时 JVM harness 使用 JDK 17.0.18 的 Matcher.appendReplacement/appendTail 循环和 Kotlin lines/trim/isBlank，产生 1,904 组替换/标题案例及 371 组 Unicode 裁边案例；其中 672 组原版替换异常应保持该条输入。目标与所有预期输出或失败状态一致。

这是原版 SQL 和相同 JVM API/表达式的有限语料对照，不是运行完整 Android Room/RegexExtensions/Rhino/协程，也不证明 Android ICU 与当前 JS 正则的全部语言语义相等。语料覆盖不同分组数、命名/可选分组、无匹配时无效字符串、零长度 ASCII 匹配、emoji 实际匹配、前置标志、终止换行锚点、BOM/NBSP/控制符等；补充平面零长度推进、全部 Java 字符类/标志/环视和极长模式仍待完成。

```bash
python3 scripts/replace-rule-reference.py \
  --source-root /Users/dgz/code/github/legado \
  --kotlin-lib /Users/dgz/.gradle/wrapper/dists/gradle-9.3.1-bin/23ovyewtku6u96viwx3xl3oks/gradle-9.3.1/lib \
  --output __tests__/fixtures/replaceRules.native.json
npm test -- --runInBand --silent
./node_modules/.bin/tsc --noEmit
```

206 suites / 1,020 tests、类型检查和改动文件 lint 通过，见 [tests.log](tests.log)。另外覆盖顺序命中、失败后继续、未匹配脚本、非正则脚本字面量、手动/自动/预览矩阵、空正文规则及 null 内容。最终为手动 IDs 的 null 导入值增加默认回退，避免新策略访问 null；纯函数测试覆盖，未借此声称完整非法导入矩阵完成。

## 独立 iOS 验收

使用独立 Legado HTYF 调试 / iPhone 17 Pro / iOS 26.5，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`。18209 一次性 loopback 书源及六条规则通过正常 API 导入，经 UI 限定书源搜索、详情、加书和阅读：

1. 书名 `iOS_a%`，规则 scope 为大写 `HTTP://127.0.0.1:18209` 或 `prefix IOS😀abc suffix`，实际触发 ASCII 折叠与书名通配。
2. 标题显示 `分组替换 · 第一章`；NBSP 裁边后 `(?m)^(甲)(乙)$` 得到 `组<甲乙/甲0/乙>`，另有 `$1/甲`、`间【空格】隔`、`尾部继续`，见 [阅读画面](reader.png)。最后一行证明 `$&` 失败后下一条仍处理正文。
3. [生效列表](effective-rules.png) 只列四条改变正文的规则，失败项显示说明，标题专用规则不列入；编辑入口打开对应规则。
4. [编辑预览](editor-preview.png) 保留大写 scope，输入 `甲乙` 得到分组结果；临时输入 `$&` 显示 Illegal group reference，临时输入 `@js:result` 显示当前宿主缺少可中断环境。未保存后返回，存储 replacement 全部仍等于导入值。
5. 冷启动 PID 17352 后继续阅读，标题及四行正文仍相同，[冷启动画面](cold-reader.png)。原始缓存 31 个 UTF-16 单元在冷启动前后相等。

最终代码只比上述正文实测多出手动 IDs 的 null 兼容分支；全量测试和最终生产包重新生成，最终冷启动确认清理后的九本书及服务关闭。双指物理手势和批量导出本轮只有逻辑/全量回归，未宣称做了 iOS 手势或文件出口专项验收。

原有九本书、八条源、原规则完整记录逐字段及摘要相等，见 [preservation.json](preservation.json)。真实「阅读书屋」与《西游记-吴承恩》保留；本轮没有重新请求真实站正文。临时书/源/六条规则经正常接口清理，18209 进程终止，Web/MCP/定时任务恢复关闭，书架回到九本书。

控件观察曾出现 ScreenCaptureKit -3811，重新绑定 Simulator 后恢复。单页章节的禁用进度 slider 在 AX 暴露 NaN，画面仍为第 1/1 页；已记录为后续进度控件问题，没有把它归为本轮通过项。

## 成品与未完成范围

本地 0.0.38 iOS 成品、330 项输入、ZIP/许可证/fixture 排除和 bundle 摘要见 [package.json](package.json)、[production-inputs.json](production-inputs.json)、[worklet-audit.json](worklet-audit.json)。最终 460 处数组闭包、零意外对象赋值和 bundle 语法审核通过；二维码像素、分享 URL 与 dist/app.json 一致。CLI 首次只规范化了 app.json 末尾换行，已在冻结最终输入后重建；没有变更依赖或原生目录。

远程配置/包只读检查 HTTP 200/200，远程仍为 0.0.34，[remote-availability.json](remote-availability.json)。本轮未发布，真实宿主/手机仍 pending，不能用远程地址验收本地 0.0.38。

完整 Java 正则/超时/取消、Rhino 上下文、特殊 HTML 保护/转换/失效顺序、原版全局手动配置、默认顺序及全部导入字段、转换后的坐标/标注/搜索/朗读/导出消费者、单页 slider AX NaN 和全视觉/手势/真实宿主矩阵仍待完成。完整目标没有缩减为本报告范围，见 [acceptance.json](acceptance.json)、[final-verification.json](final-verification.json)。
