# 2026-10-29 特殊 HTML 原文处理顺序与 iOS 验收

本轮修正特殊 HTML / 图片过早编码后无法参与繁简转换及正文规则的问题，并修复单页进度条在 iOS 辅助功能中显示 NaN。完整 1:1 目标仍在进行。
This iteration restores native text-processing order for cached HTML/images and fixes the single-page iOS accessibility progress value. Full application parity remains in progress.

## 原版依据和改动

原版 `ContentProcessor.getContent` 的顺序为去重复标题、重分段、繁简转换、特殊 HTML 保护、正文裁边/规则、恢复 HTML、最终段落。`BookContent` 在抓取时读取 adaptSpecialStyle；`TextChapterLayout` 则在最终段落以 `<usehtml>` 开头时渲染该段 HTML。

目标此前先把 HTML / 图片编码为 URI JSON 标记，再转换整个正文，导致转换和图片规则只能看见编码内容。新的 `readerNativeContent` 从现有缓存标记还原原文，送入上述处理链；最终段落结束后再创建渲染标记。缓存记录不被这一读取路径重写；普通解码后的 `<b>` 字面文本不再次解析。兼容已有 sourceFormatted 标记附加的 LF，以及旧图片 click 元数据；旧 EPUB ruby/heading/link 标记的全量原文还原仍待完成。

HTML 保护使用原版区分大小写的 `<usehtml>.*?</usehtml>`、确切占位文字、仅删除 LF、顺序全局字面恢复。保留原版占位文字与正文碰撞、规则修改占位文字后无法恢复等行为。繁简转换在保护前执行，因此 HTML 内文字先转换，随后免于正文替换。图片地址在转换/替换阶段保持原文，之后按原版双引号 src 图像模式适配。

关闭 adaptSpecialStyle 后读旧缓存，原版不重新格式化其 HTML：标签作为普通文本进入替换/排版。只有关闭状态下重新抓取章节时，抓取器才清理标签。目标现在按这两个分支处理，替换了原先关闭时立即把旧 HTML 再解析的行为。特殊样式开关与全局模式仍通过已有 reader preferences 存储。

单页进度的范围为 0…0。所用 React Native Fabric `RCTViewComponentView.mm` 对没有显式 text 的辅助功能范围计算 `now / (max - min)`，产生 NaN。目标为该零范围显式提供 `0%`，保留禁用状态；一般范围维持已有数值语义。没有修改 React Native 或原生目录。

## 可重跑的原版对照

[red.log](red.log) 保存原有编码阻挡图片转换/替换及零范围缺少 text 的失败用例。新的 [JVM 脚本](../../../scripts/reader-native-content-reference.py) 将原版 `getContent` 方法文本原样复制到临时边界 stub 类，方法 SHA-256 为 `4bdddcd65758dbd0a6d5243c527a3beedbc32436d455dc84d8b5b60061a3dd30`；调用完整原版 ContentHelp、ChineseUtils 和固定 quick-transfer-core 0.2.17 JAR。原始文件与 JAR 摘要保存在 [对照 fixture](../../../__tests__/fixtures/readerNativeContent.native.json)。

边界适配明确包括：数据库/日志/toast 为 stub；预填 nr 文件 cache 以跳过去重复标题（该阶段另有原版对照）；Android 8 分支关闭；超时正则服务用同一 Matcher appendReplacement/appendTail 同步循环替代，语料不含脚本；临时 ContentHelp 的 Math.random 固定 0.5。getContent 内部 HTML、裁边、规则及最终段落代码不修改。这些对照不证明 Android 全栈、超时/取消或完整 Java Pattern/ICU 等价。

2,280 组原版输出及命中 ID 与目标逐字符串相等，覆盖三种转换模式、样式开关、重分段、自动/关闭/空手动规则、LF/CR/Unicode、大小写/嵌套/未闭合 HTML、占位符碰撞/修改/连锁恢复、规则生成 HTML、图片原始地址及规则失败继续。缓存桥接另验证原文往返、相邻 HTML、解码后的字面标签和旧图片 click 保留。

```bash
python3 scripts/reader-native-content-reference.py \
  --source-root /Users/dgz/code/github/legado \
  --kotlin-lib /Users/dgz/.gradle/wrapper/dists/gradle-9.3.1-bin/23ovyewtku6u96viwx3xl3oks/gradle-9.3.1/lib \
  --jar /private/tmp/legado-ios-debug/chinese-conversion/quick-transfer-core-0.2.17.jar \
  --output __tests__/fixtures/readerNativeContent.native.json
npm test -- --runInBand --silent
./node_modules/.bin/tsc --noEmit
```

207 suites / 1,027 tests、类型检查和改动文件 lint 通过，见 [tests.log](tests.log)。本轮测试不是完整渲染布局、图片参数/点击、跨章节坐标或全部消费者矩阵。

真实「阅读书屋」既有 7,152 UTF-16 单元缓存，在三种转换 × 两种样式下与原版后半链一致；只保存 [摘要](real-comparison.json)，没有新请求真实站或提交正文。iOS 临时书第一次抓取的缓存另有 12 组转换/重分段/样式顺序对照，[摘要和命中 ID](controlled-comparison.json)。

## 独立 iOS 验收

专用 Legado HTYF 调试 / iPhone 17 Pro / iOS 26.5，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`，只调试 iOS。18210 loopback 临时书源和四条仅限该源的规则通过正常 API 导入，再经 UI 限源搜索、详情、加书、阅读：

1. 初始转换关闭，特殊样式开启。切到繁转简后，普通正文显示“已净化正文。外部。”；HTML 居中显示“头发与发展”“保护广告”。HTML 内文字已转换但免于正文规则，[画面](t2s-html.png)。字面 `<甲乙>` 保留。图片请求从 `/chapter/頭髮.png` 变为 `/chapter/图片.png`，验证图片 URL 先转换再替换；夹具是 1px 图片，该请求证据不等于图片尺寸/点击全矩阵验收。
2. 关闭特殊样式，正常 API 确认旧章节缓存不变。冷启动 PID 10731 后，旧 `<usehtml>...` 标签作为字面正文显示，规则进入其内容，得到“已净化正文”“保护”，见 [旧缓存关闭画面](cached-off.png)。禁用的单页进度 AX 值为 `0%`，不再是 NaN。
3. UI 刷新当前章节，提示已刷新。新正文不再含标签，显示“已净化正文”“保护”，[画面](refreshed-off.png)。正常 API 确认当前临时章节缓存更新、无 HTML 标记，但缓存中仍是未转换/未替换的“頭髮與發展”“保護廣告”；另一缓存章节不变，[cache-transition.json](cache-transition.json)。
4. 下一章普通短文为第 1/1 页，辅助功能值仍为 `0%`，[画面](single-page.png)。未将这一检查当成全页码/进度坐标迁移验收。
5. 特殊样式恢复 1；清理前后经冷启动和设置页再确认。繁简模式恢复 0，最终全局设置和冷启动检查见 [acceptance.json](acceptance.json)。

原有九本书、八条源、原规则完整记录与基线逐字段一致，[preservation.json](preservation.json)；真实「阅读书屋」和《西游记-吴承恩》保留。临时书/源/四条规则经正常 API 清理，18210 服务停止，Web/MCP/任务关闭。没有直接写 MMKV 或编辑模拟器存储。

多任务同时使用 Simulator 时，控件通道出现 -3811、noWindowsAvailable、窗口被切换和观察超时，重新选择专用窗口后继续；中断后检查确认 8097/18210 均已停止才恢复。恢复服务后有开发 warning 横幅，本轮没有把它当作视觉通过证据，也未据此声称真机崩溃修复已获验证。

## 成品和剩余范围

本地 0.0.39 iOS 包与 331 项冻结生产输入见 [package.json](package.json)、[production-inputs.json](production-inputs.json)。ZIP、许可证、无夹具数据、460 处 worklet 数组闭包、零意外对象赋值及语法审核通过，[worklet-audit.json](worklet-audit.json)。二维码像素与分享 URL / dist 配置匹配。没有增加 npm 依赖或修改原生目录。

远程配置/包只读检查 HTTP 200/200，远程仍为 0.0.34，[remote-availability.json](remote-availability.json)。本轮未发布，真实宿主/手机仍 pending。

完整 Java Pattern/ICU、超时/取消/Rhino、全部异常/失效联动、原版全局手动开关/XML、旧 EPUB 语义标记/多页重定向 base URL、完整图片参数/点击、HTML 渲染与分页/标注坐标、所有朗读/搜索/导出消费者、开发 warning 原因及全视觉/手势/真机矩阵仍待完成。完整目标没有缩减为这条正文链，见 [final-verification.json](final-verification.json)。
