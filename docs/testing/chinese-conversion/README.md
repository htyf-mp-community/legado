# 2026-10-29 繁简转换、标题顺序与 iOS 验收

本轮接入原版固定词典和排除词，补齐阅读正文、标题、目录和设置/生效规则入口，并校正菜单勾选状态。完整 1:1 目标仍在进行。
This iteration adds the pinned native Chinese-conversion data, reader/title/TOC ordering, settings/effective-rule entries and checked reader actions. Full application parity remains in progress.

## 原版依据和许可证

原项目固定 `com.github.liuyueyi.quick-chinese-transfer:quick-transfer-core:0.2.17`。从其官方 JitPack 地址取得构件；[官方仓库](https://github.com/liuyueyi/quick-chinese-transfer) 的 0.2.17 标签为 `810e881ce722e7919ad00f283551e897bf7aad77`。JAR SHA-256 为 `184bc394eca5a87320a1a2eb0b9e0ceb42b1295c21cd17efb4c5e6e73274bce0`。

构件的 `tc/s2t.txt`（1,034,690 字节）与 `tc/t2s.txt`（133,113 字节）均与该标签源码逐字节相等，摘要分别为 `b43d95dfaa76e266aecbe392ee5f08023b1832474e597feaaf0945ca0eb13f8b`、`49fa0a27f53095cacbee9668d41cd05b9ce1a74d09931666faa04ebbacc7b2f0`。目标 JSON 重编码保留原字/词对、覆盖顺序、UTF-16 长度和匹配上限；不是替换成另一套转换词库。S2T 含 2,827 个字符和 49,999 个词条，T2S 含 3,904 个字符和 6,074 个词条，共 62,804 个键。

原版 `utils/ChineseUtils.kt` 的 112 项 T2S 排除列表随数据一并提取；按 BasicDictionary.remove 处理单字符删除和多字符原样匹配，保留原有 maxLen（S2T 16 / T2S 20），不因排除项而扩大它。原版匹配优先选最长 UTF-16 词前缀，失败后按字符映射，包含 BMP 到补充平面的映射。

上游根 pom.xml 声明 Apache 2.0，源码标注作者 luhuiguo / YiHui。完整 [许可证](../../licenses/quick-transfer-Apache-2.0.txt) 和 [来源/修改声明](../../licenses/quick-transfer-NOTICE.txt) 随成品 banner 保留。没有增加 npm 依赖或改动原生目录；JAR 与源码下载留在临时验证目录，不作为运行时依赖。

## 实现和原版对照

- `src/core/chineseConversion.ts` 按原版边界实现最长前缀与字符回退；关闭时不创建词典 Map，使用时才加载固定 JSON 表。
- `readerText.prepareReaderText` 保留“去重复标题之后 → 重分段 → 繁简转换 → 特殊 HTML/替换”的前半顺序，跳过 literal `null`。原有随机重分段结果按书/章节/正文/模式缓存，菜单重绘沿用已有结果。
- 章节显示先删 CR/LF、再转换、再执行标题规则；每条把标题变成空白的规则保留旧标题。去重复标题的回退仍使用未转换的显示标题。目录关闭标题净化时仍转换文字。
- 原版全局模式映射为现有 MMKV `reader.preferences.v1.chineseConverterType` 的 0/1/2；不新建存储命名空间。无效目标存储值归 0，不将此声明为已完成原版非法配置或 XML 恢复矩阵。
- 快捷排版、完整排版和独立阅读设置共用“简/繁”选择器；列表中的繁简转换支持修改/停用。原版只列正文实际命中规则，转换项位于末尾，目标不再混入仅改标题的规则。重分段、同名标题、ruby/标题标签动作提供实际 checked 状态。
- 独立设置页返回阅读器时重新读取全局偏好，修正导航保持阅读页挂载时旧设置未刷新的问题。

最初红用例确认旧偏好规范化直接丢弃模式 2，见 [red.log](red.log)。`scripts/chinese-conversion-reference.py` 在 JVM 调用未改动的原版 Kotlin ChineseUtils 包装层和真实 JAR，生成 1,422 组明确输入/输出；另以 491 个 NUL 分隔块验证全部 62,804 个键，比较输入/输出 SHA-256 与 UTF-16 长度。NUL 不存在于任何词典键，不会拼出跨键词条。

另有 36 组完整原版 ContentHelp → ChineseUtils 顺序对照；只在临时 ContentHelp 副本把唯一随机调用固定为 0.5，原始文件不变。所有结果一致。固定表和源摘要见 [native fixture](../../../__tests__/fixtures/chineseConversion.native.json)。

```bash
python3 scripts/chinese-conversion-reference.py \
  --source-root /Users/dgz/code/github/legado \
  --kotlin-lib /Users/dgz/.gradle/wrapper/dists/gradle-9.3.1-bin/23ovyewtku6u96viwx3xl3oks/gradle-9.3.1/lib \
  --jar /private/tmp/legado-ios-debug/chinese-conversion/quick-transfer-core-0.2.17.jar \
  --asset-output src/data/chineseConversionData.json \
  --fixture-output __tests__/fixtures/chineseConversion.native.json
npm test -- --runInBand --silent
./node_modules/.bin/tsc --noEmit
```

205 suites / 1,010 tests、TypeScript 与改动代码 ESLint 通过，[日志](tests.log)。选择器测试覆盖当前选项、选择后关闭与取消不改模式，偏好测试走现有存储接口验证往返。

真实「阅读书屋」缓存的第二回 7,152 UTF-16 单元在关闭/T2S/S2T 下与原版逐字符串相等，输出长度分别为 7,152 / 7,153 / 7,152；[摘要](real-comparison.json) 不含原文。该项不是本轮新请求的网络正文。Node 首次加载/转换耗时只作本机诊断，不作为 iOS 性能或后台预加载等价证据。

## 独立 iOS 实测

专用 Legado HTYF 调试 iPhone 17 Pro / iOS 26.5，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`。以 18208 临时源和两个仅限定该源的规则，经正常 API 导入，再经 UI 搜索、详情、加书和阅读：

1. 初始快捷入口显示“关闭”；改为繁体转简体后，标题先转换再命中规则显示“第一章 净化后标题”，正文先转换再命中规则显示“已转换正文。”。排除项“鳳梨機車介面規則純文字檔案”保持原样，emoji/NBSP 保留，[画面](t2s-rules.png)。
2. 目录净化开关关闭后显示“第一章 头发与发展”，仍执行转换；重新开启后显示净化标题，并恢复原开关状态。
3. 菜单重分段 checked 状态 0→1→0，正文原始缓存不改。同名标题 checked 为实际移除结果。最终 [生效列表](effective-rules.png) 只含正文规则和末尾转换项，标题专用规则不列入。
4. 冷启动 PID 18565 后继续阅读，繁转简和两条规则仍生效，[冷启动画面](cold-t2s.png)。
5. 经高级菜单进入独立阅读设置，当前模式为繁转简；切为简转繁，返回保留挂载的阅读器后立即刷新。第二章显示“第二章 頭髮與發展”和“皇后的頭髮與乾燥的麪條”“「髮型與發表。」”，与原版固定词典一致，[简转繁画面](s2t.png)；目录标题同步转换。
6. 从生效列表停用后，标题/正文恢复简体原文，列表恢复空态，快捷选择器值为“关闭”；最终冷启动后再检查关闭状态。

控件工具偶发 ScreenCaptureKit -3811 或系统 File 菜单旧快照，重新绑定 Simulator 后恢复；没有据此误报应用崩溃或通过物理手势矩阵。

九本书、八条源和原替换规则完整记录逐字段一致，[preservation.json](preservation.json)。两章存储缓存与初次加载后逐字符串相等。临时书、源、两条规则经正常 API 清理，18208 服务已停止，Web/MCP/定时任务恢复关闭；全局转换恢复 0。新模式字段随现有目标偏好保存，不声称旧偏好 JSON 字节完全不变。

## 成品和剩余范围

本地 0.0.37 iOS 包、327 项生产输入及最终审核见 [package.json](package.json)、[production-inputs.json](production-inputs.json)、[worklet-audit.json](worklet-audit.json)。ZIP、词典/许可证、460 处编译 worklet 数组闭包与二维码像素核对通过。远程本次 HTTP 200/200，返回配置为 0.0.34；本轮未发布，真实宿主/手机验收仍 pending。

完整替换的 Java 正则/超时/取消、特殊 HTML 保护与失效联动、转换后标注/位置坐标、全书搜索/朗读标题/导出等完整消费者矩阵、原版 AppConfig XML 恢复/配置备份、异步预加载/卸载与内存生命周期、极端 Unicode/非法配置和全视觉/手势/宿主矩阵仍待完成。朗读正文已收到阅读器处理后的 displayContent，但未把这一数据路径当作音频/标题/后台联动验收。结构化记录见 [acceptance.json](acceptance.json)、[final-verification.json](final-verification.json)。
