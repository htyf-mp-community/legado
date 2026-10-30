# 2026-10-29 重复标题与真实书源回归

本轮对齐原版重复标题移除和逐章开关，使用独立 Legado HTYF 调试 iPhone 17 Pro / iOS 26.5，未调试 Android。完整 1:1 目标仍在进行。
This iteration aligns native duplicate-title matching and per-chapter retention in the dedicated iOS Simulator. Full application parity remains in progress.

## 原版规格与实现

原版 `ContentProcessor.sameTitleLineMatcher` 默认尝试移除正文开头的同名标题，允许书名/标点前缀；只有标题中的 ASCII 空白可变，替换后的显示标题作为字面回退，`null` 哨兵和 `.nr` 排除保持正文不变。菜单选中状态表示实际移除了标题，而非独立的用户偏好。`BookHelp` 用 `%05d-${MD5(title).substring(8,24)}.nr` 记录逐章保留。

目标原先删除“第/章”等字符后比较，错误地把真实首段“十二”当成“第十二章”，也漏掉 `【书名】` 前缀，并把默认行为做成了手动启用。本轮使用 `src/core/chapterTitle.ts` / `chapterTitlePolicy.ts` 对齐上述边界，修正替换规则上下文为书名和书源 origin，本地来源适配为原版 `loc_book`。逐章排除存入同一个 MMKV 的 Book 元数据，不改原始正文；换源保留该字段。

最后对照还发现 Java 默认 `\s` 与 JavaScript Unicode `\s` 的区别，新增 38 组原版案例，先捕获失败，再使用明确 ASCII 字符类修正，避免把全角空格等当成可变标题空格。失败日志为 [whitespace-red.log](whitespace-red.log)，最初两个缺陷见 [red.log](red.log)。

`scripts/chapter-title-reference.py` 在 JVM 执行源文件中未改动的匹配函数、escapeRegex 和原版常量，并显式提供显示标题以隔离完整替换链；键值用 JDK MD5 和原版格式表达式计算。六个源文件哈希记录在 [native fixture](../../../__tests__/fixtures/chapterTitle.native.json)。共 1,203 组、695 组移除；内容、removed 标志和键值全部一致。这不是完整 ContentProcessor 的运行验收。

```bash
python3 scripts/chapter-title-reference.py \
  --source-root /Users/dgz/code/github/legado \
  --kotlin-lib /Users/dgz/.gradle/wrapper/dists/gradle-9.3.1-bin/23ovyewtku6u96viwx3xl3oks/gradle-9.3.1/lib \
  --output __tests__/fixtures/chapterTitle.native.json
npm test -- --runInBand --silent
./node_modules/.bin/tsc --noEmit
```

## 独立 iOS 验收

使用 `scripts/chapter-title-fixture.mjs` 的本机 18206 临时源，走正常源导入、搜索、详情、加书和阅读流程：

- 初次阅读自动移除 `【iOS 标题验收】第一章 标题匹配`，保留首段，开关为 1，[默认画面](default-removed.png)。
- 关闭后恢复完整标题，开关为 0；生成唯一排除键 `00000-c09d060914483afb.nr`，[保留画面](kept-title.png)。
- 冷启动 PID 52016 后仍保留标题和开关 0，[冷启动画面](cold-kept-title.png)。再次启用恢复自动移除，最终排除列表为空。
- 下一章标题为“第十二章”，实际首段“十二”保留；尝试启用后开关仍为 0，无障碍树显示“未找到可移除的重复标题”，[正文画面](no-match-body.png)。面板截图 [开关画面](no-match-message.png) 只证明开关状态，提示文本在当时可见区域之外，不将它作为提示像素证据。
- 初次、关闭、重新启用后的原始缓存逐字符串相同；第二章原文仍以 `十二\n` 开头。原始数据仅存于临时调试目录。

无匹配后应用画面保持正常，但 CUA 一度只能读取 Simulator 外层控件；坐标操作也返回工具窗口错误，冷启动 PID 75752 后恢复正常控件操作。这不证明平台无障碍树完整性已经通过。开发热刷新留下旧 Web native listener 的问题也仍未修复，本轮通过冷启动恢复后使用正常接口核对数据。

ASCII 边界最终修正只收紧非 ASCII 匹配，以上本机中文正常标题路径仍在 1,203 组回归覆盖内；最终构建后另行冷启动检查真实源和书架。未声称对修改后重新执行了所有旧 UI 操作。

## 用户真实书源

用户链接的 836 条快照及原始单源导入证据见 [1321 真实书源验收](../real-source-1321/README.md)。保留「📂阅读书屋」原始规则，当前模拟器实时调试《西游记》返回搜索 1 本、详情成功、目录 105 项、首个非卷项目正文 119 字符，[实时结果](real-source-debug.png)。这里是前置页，不是再次请求两章长正文；详情作者仍显示未知，未将其标为完整元数据通过。

此外通过正常 API 获取已缓存的第二回（索引 3），隔离标题匹配，原版与目标均不移除，7,152 UTF-16 单元完全相同；摘要见 [real-comparison.json](real-comparison.json)。这不是本轮新请求的网络正文。此前两章加载、续读及 0.0.33 原源正文链已有对应目录的独立证据。

## 校验、交付与边界

202 suites / 998 tests、TypeScript 和改动代码 ESLint 通过，[测试日志](tests.log)。使用已有固定 QuickCrypto，不新增依赖、不改原生目录、不改原版源代码。原有九本书、八条书源完整记录逐字段一致，[preservation.json](preservation.json)；临时书/源经正常 API 移除，18206 服务已停止，Web/MCP/定时任务恢复关闭。真实阅读书屋源和《西游记》保留。

本轮开始发现本地配置/成品已由外部更新到 0.0.34，保留其临时快照，后续使用 0.0.35。最终包、320 项构建输入及 worklet 协议审核见 [package.json](package.json)、[production-inputs.json](production-inputs.json)、[worklet-audit.json](worklet-audit.json)。二维码像素已解码并匹配最终配置；远程实际为 0.0.34，未上传本轮包，宿主/真机验收 pending。

旧版真实 `.nr` 文件备份导入、完整 ContentProcessor 转换/重分段/替换顺序与失效矩阵、Unicode/locale 边缘、简介/EPUB/富文本/媒体、物理手势和真实宿主加载仍待完成。结构化结果为 [acceptance.json](acceptance.json)，最终静态复核为 [final-verification.json](final-verification.json)。
