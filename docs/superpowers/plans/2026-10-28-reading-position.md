# Reading Position Implementation Plan

> 本会话按已授权迁移内联连续实施；test-driven-development 与最终只读审查。

**Goal:** 旧版目录加载后继续原章节，并贯通普通文字分页/滚动的字符位置。
**Architecture:** Book 保存 pendingReadingPosition/readingPosition；纯 UTF-16 映射与分页范围；应用树内无 UI 位置协调组件连接阅读器真实布局事件。
**Tech Stack:** 现有 RN/TypeScript/Jest，不新增依赖或原生改动。
**Spec:** ../specs/2026-10-28-reading-position-design.md

## Global Constraints
- 源只读，独立 iOS；目标原生目录和锁定依赖不变。
- 字符位置独立保存，progress 保持 0..1；旧备份格式继续可读。
- 不在目录/正文或布局未就绪时写掉恢复位置。

## Review Focus
- 恢复带 durChapterUrl 的占位记录也必须加载全目录。
- 分卷/目录变化用原版迁移定位，私有字段和并发编辑保留。
- UTF-16 emoji、换行、缩进、特殊分页与重排不能用容量近似偏移。
- 程序恢复滚动与首个空布局事件不能覆盖书籍位置。
- 延迟写入/卸载/切章不能把旧位置写到另一章。

### Task 1: 数据和目录
- [x] 修改 legacyBackup/types/bookCatalogue，真实转换/水合测试先失败，再通过；首次读取保留 native position。
### Task 2: 位置与布局
- [x] 添加纯字符位置映射和分页范围 API；回归实际文本范围、emoji/换行/缩进。
- [x] 添加 ReaderPositionBridge，真实 React 生命周期测试先失败再通过；接入分页/滚动布局、章节切换和落盘。
### Task 3: iOS 验收
- [ ] 旧版 ZIP 正常恢复→完整目录→原章节/文字位置，分页与滚动/退出/冷启动；检查无关数据保留。
- [ ] 独立只读审查、全套检查、冻结运行时代码后构建新本地包；校验源、资源、包输入、二维码并更新报告。

实施记录：数据/分页/测量滚动与审查修复已实现；实际目录→原章节位置、退出重开、滚动 AX 定位、离线冷读、原设置及七本书保留证据见 reading-position-report.md。Task 3 的完整物理手势及真实宿主矩阵仍保持未完成。用户随后真机崩溃另行修复，最终本地包为 0.0.23。
