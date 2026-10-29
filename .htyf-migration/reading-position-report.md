# 2026-10-29 旧版续读与普通文字字符位置（iOS 部分验收）

只在独立“Legado HTYF 调试”iPhone 17 Pro / iOS 26.5（8338CC2C-E716-4B2B-BC30-CC5C777CB2FD）调试。完整迁移尚未完成；以下范围为旧版 JSON 在线文字书和当前普通文字分页/滚动。

## 数据与布局

旧版 durChapterPos 独立保存，不再作为百分比 progress。即使备份含 durChapterUrl，也保留 pendingCatalog 并加载完整目录；原版章节索引、名称、总数、字符位置在目录水合前单独保留。目录变化沿用原版迁移定位规则，跳过分卷，保留私有字段。

ReaderPositionBridge 连接实际分页切片、段落位置和原生 Text 行测量。坐标使用 UTF-16，计入标题、缩进及非空段落，启用特殊样式时跳过 [newpage]。分页文本保留原始切片偏移，滚动文本移除分页标记，二者经同一原版字符坐标转换。程序恢复事件不会写掉保存位置；滚动进度条由真实行测量 scrollTo，并同步页面指标。

退出/打开其它页面先 flush 并保留字符位置。切章前 flush，迟到旧章节或旧书源 cursor 不得覆盖当前章；同页重排与应用相同远端进度不会把位置清零。未启用 bridge 的混合内容保留已有容量重排回退。独立审查发现的问题均已修正，最终静态复核无新问题。

快速目录请求还暴露 Gorhom 弹层关闭早于真实显示的竞态；BookCatalogueStatus 保持弹层挂载，InTreeSheet 对晚到的打开回调再次关闭。真实 iOS trace 见 `evidence/ios/reading-catalogue-sheet-trace.log`，相关调试日志已移除。

## 独立 iOS 证据

1. 通过正常 WebDAV ZIP 恢复新增测试书，旧版索引 2 / 总数 4，章节名“第三章 原位置”，字符位置 2889。导入后 chapters 为空且待加载目录；证据 `reading-position-imported.json`。
2. 实际请求完整目录得到 5 项（含分卷），正确迁移到索引 3，加载 chapter/3，保留 customIntro/customTag；首次第 10/30 页显示“续读标记019/020”。证据 `reading-position-first-read.json`、`reading-position-native-page.png` 与请求记录。
3. 原生无障碍 progress increment 前进到第 11/30 页“续读标记021/022”；退出重开保留位置 3058，切换滚动后截图仍定位标记021。证据 `reading-position-page-advanced.json`、`reading-position-scroll-restored.png`。
4. 停止 18203 专用书源后，冷启动继续读取缓存第三章并恢复标记021；截图 `reading-position-cold-offline.png` 是页码同步修复前的诊断图，正文位置正确而页码显示1，不能当成页码验收通过。
5. 修复滚动页码同步后，真实 AX increment 从 11/30 到 12/30，正文滚动到“续读标记023”，应用正常 Web API 保存字符位置 3345。证据 `reading-position-scroll-seek.png`、`reading-position-scroll-saved.json`。拖动/scroll 工具报 windowNotFoundAtPosition，物理手势矩阵保持 pending，未据 AX 通过替代。
6. 原七本完整书籍记录逐字段比较一致。通过正常备份预览/合并恢复仅含 reader.preferences 的清理 ZIP，再由应用上传导出验证：原默认 mode=scroll、fontSize=19 及全部阅读偏好恢复；证据 `reading-position-settings-restored.json`。原基线无 reader.preferences 键，恢复为语义相同的真实默认值，新持久化键会保留。

最终重建代码冷启动后页码12/30和正文续读再次核对，见 `reading-position-final-cold.png`；回到八本书架且 Web/MCP/自动任务全关。

证据均位于 `evidence/ios/`；未直接读写运行时 MMKV。最终测试与包版本见 `build-result.json`。随后用户报告的真机书架 layout 崩溃已另行复现并修复，见 `host-layout-crash-report.md`；本地交付包统一为 0.0.23。

## 尚未完成

完整原版配置 XML、多套字体/布局、复杂标题拆分、HTML/图片/装饰高亮行测量、漫画/音视频坐标、本地旧书文件和旧注释章节重绑定仍待实现或验收。分页仍按现有容量模型排版，本次只用实际切片而非页码乘容量保存位置，不能据此宣称原版分页几何 1:1。后台/系统生命周期、物理手势和实际宿主加载也不由本切片替代。
