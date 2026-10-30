# 2026-10-29 原版完整重分段算法验收

本轮将目标简化的重分段实现替换为 `ContentHelp.kt` 全算法移植，独立 iOS 模拟器验证通过。全应用 1:1 目标保持进行中。
This iteration ports the complete native ContentHelp algorithm and verifies it in the dedicated iOS Simulator. Full application parity remains in progress.

## 源与目标

原版 `app/src/main/java/io/legado/app/help/book/ContentHelp.kt` SHA-256 为 `3130fbf6bf4cbcba1ec6e0d8994f9fb7621334779897c80c2eca3c1302e547b0`。该文件只依赖 JDK/Kotlin，可以独立执行，不需要构建 Android。

目标 `src/core/contentReSegment.ts` 移植完整的 reSegment、makeDict、findNewLines、forceSplit、reduceLength、splitQuote 和三个 seek 函数，保留 UTF-16 索引、Java ASCII 空白、标点/引号常量、引用列举与词典验证、模式修正、对话模式、随机概率公式、随机调用顺序和原有遍历/替换顺序。`txtEncoding.reSegmentText` 保留原调用接口，生产默认使用 Math.random。

旧实现会删除任意位置恰好等于章节名的段落，只实现少量引号/断行修复，还将随机长段切分替换为确定行为。最小用例 `正文。\n第一章` 在目标旧实现丢失第二段，失败日志见 [red.log](red.log)。根因已由原版函数和红测试直接确认，所以本轮按完整源函数移植和差分定位，没有另行猜测网络或原生问题。

阅读器以 useMemo 缓存本章的重分段结果，书籍/章节身份、正文/章节名/重分段状态改变时重算；菜单重绘沿用已有结果。原版 ContentProcessor 对 literal `null` 跳过重分段，目标此处同样跳过。完整 ContentProcessor 的其它阶段和缓存失效矩阵并未据此认定通过。

## 原版差分与随机输入

`scripts/resegment-reference.py` 将完整源文件复制到临时 JVM 工程，只将唯一的 `Math.random()` 调用替换为可计数的循环随机输入带；原始源文件和算法其余语句不变。目标函数在测试中接收同一随机输入，生产保留原版随机行为。

[原版 fixture](../../../__tests__/fixtures/resegment.native.json) 包含 1,220 组，四种随机输入为 `[0]`、`[0.5]`、`[0.999999]`、`[0.1, 0.9, 0.3, 0.7]`；220 组实际消耗随机输入。覆盖断行、标题、混合引号、引用列表、重复引用词、说话提示、对话模式、长段、控制/Unicode 空白、emoji 和固定生成的混合文本。所有输出和随机调用次数严格相等；原版在本组无异常。测试不以一个固定输出冒充原版随机语义，也不据此宣称完整 Unicode 版本矩阵已覆盖。

```bash
python3 scripts/resegment-reference.py \
  --source-root /Users/dgz/code/github/legado \
  --kotlin-lib /Users/dgz/.gradle/wrapper/dists/gradle-9.3.1-bin/23ovyewtku6u96viwx3xl3oks/gradle-9.3.1/lib \
  --output __tests__/fixtures/resegment.native.json
npm test -- --runInBand --silent
./node_modules/.bin/tsc --noEmit
```

全部 203 suites / 1,001 tests、TypeScript 与改动代码 ESLint 通过，[测试日志](tests.log)。没有新增依赖或修改目标原生目录。

## 真实缓存与独立 iOS

真实「阅读书屋」已缓存的第二回 7,152 UTF-16 单元，用相同四种随机输入在完整原版和目标执行：输出长度分别为 7,247 / 7,231 / 7,226 / 7,237，随机调用次数为 23 / 36 / 41 / 29，逐字符串严格相等。仅保存摘要 [real-comparison.json](real-comparison.json)，原始正文留在临时目录。这是隔离重分段对照，本轮没有重新请求真实网站正文，也未改变真实书的设置或进度。

在专用 Legado HTYF 调试 iPhone 17 Pro / iOS 26.5（8338CC2C-E716-4B2B-BC30-CC5C777CB2FD）通过正常源接口导入 18207 临时源，再经 UI 搜索、详情、加入书架和阅读：

- 开启“重新整理全部章节段落”后，错误断行合并，“你好！”与“欢迎。”分开，后续同名段落保留，NBSP 不被误删。23 个正文 AX 节点逐字符串符合完整原版结果，[启用画面](enabled.png)。
- 关闭后恢复两个原始断行；再次开启后恢复完整处理。开关 true→false→true，存储的两章内容始终相等。源提取已按既有 HtmlFormatter 添加逐行缩进，因此以存储缓存相互比较，不错误地要求它与网络原始 JSON 字段相等。
- 第二章触发真正的随机长段切分，一次结果为 45 段。连续两次打开/关闭高级菜单后全部 45 个正文 AX 节点严格相等，确认这些菜单重绘没有改变已生成的段落。
- 返回第一章，冷启动 PID 39134 后继续阅读，仍应用重分段；全部 23 个正文 AX 节点与重启前及原版相等，[冷启动画面](cold-resume.png)。此验收游标为 0，不将其作为新的非零位置恢复或物理手势证据；随机章节重启后重新抽样的视觉位置矩阵仍待验收。

原始九本书、八条书源完整记录逐字段不变，[preservation.json](preservation.json)。临时书/源经正常 API 删除，18207 进程已结束，Web/MCP/定时任务均恢复关闭；Repack 8097 保留运行。

## 成品与未完成边界

本地 0.0.36 iOS 包和 321 项生产输入见 [package.json](package.json)、[production-inputs.json](production-inputs.json)。ZIP 完整、许可证保留、临时源未入包，460 处编译 worklet 保持数组闭包协议，[worklet-audit.json](worklet-audit.json)。二维码由最终配置生成，系统 Vision 解码像素与最终配置、保存的 URL 和 README 链接一致。远程配置仍为 0.0.34；本轮未上传，真实宿主/手机加载验收 pending。

仍需完成繁简转换（原版 quick-transfer-core 0.2.17 和自定义排除字典）、完整标题/正文替换顺序与命中记录、特殊 HTML 保护/恢复、ContentProcessor 失效和联动矩阵、Unicode/locale 极端输入、完整 UI/物理手势与其它迁移清单。菜单项的原版勾选视觉/无障碍状态尚未补齐：原版 ReadBookActivity 的 menu_re_segment 使用 isChecked，目标当前上层操作仍为普通按钮。完整原版算法移植不等于全应用或整个正文处理链已经完成。结构化记录见 [acceptance.json](acceptance.json)、[final-verification.json](final-verification.json)。
