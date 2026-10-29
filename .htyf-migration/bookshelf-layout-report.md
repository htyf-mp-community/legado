# 2026-10-28 书架布局与显示状态

整体 1:1 还原仍在进行。继续只在独立 `Legado HTYF 调试` iPhone 17 Pro / iOS 26.5 验证，UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`。源 Kotlin/XML 为只读规格，没有 Android 构建或设备调试。

## 源到目标映射

| 源规格 | 目标实现 | 现有证据 |
| --- | --- | --- |
| `BaseBookshelfFragment.configBookshelf`, `dialog_bookshelf_config.xml`, `AppConfig` 默认值 | `data/bookshelfPreferences`, `BookshelfLayoutSheet`, `useBookshelfPreferences` | 恢复确认/取消草稿、标签/文件夹、两种列表、二至六列网格、六种全局排序、网格书名显示/隐藏/叠加、间距、进度三档和六项显示开关；默认值/旧 grid 迁移/损坏原文保留/稳定订阅测试通过；iOS 实际确认和取消均通过 |
| `item_bookshelf_list`, `item_bookshelf_list2`, `item_bookshelf_grid*` 与 `BooksFragment` ItemDecoration | `BookshelfContent` | 使用 RN FlatList；常规 66 点、紧凑 48 点封面、两/三行元数据、指定列数、书名位置及源叠加渐变；源间距和首尾额外 24 为物理像素，按 PixelRatio 转成逻辑单位。三列、未读标志及已读书进度在 iOS 截图可见；其余布局组合尚需实际 UI 对照 |
| `BookshelfReadProgressMode`, `Book.readProgress`, `getUnreadChapterNum`, `BadgeView` | `bookshelfDisplay`, `BookshelfContent`, `useBookVisit` | 进度按章节索引，首次未开始隐藏，单章开始后为 100%，模拟阅读按解锁目录计算；标准 2 点/增强 4 点；未读数和新增章节高亮分离，打开阅读清除新增高亮。边界和模拟阅读合同测试通过；默认未读与 100% 进度 iOS 可见 |
| `BookDao.lastReadBookOnShelf/readingCount`, `view_bookshelf_header` | `BookshelfHeader` | 全书架统计排除非书架条目；继续阅读优先已开始书籍，再按阅读时间；不随当前分组缩小统计。iOS 显示共 2 本、在读 1 本，并指向已读的 fixture |
| `BookshelfFragment2`, `BookshelfGroupItem`, `GroupCoverView` | `BookshelfView` 文件夹模式、`GroupCover` | 根目录展示可见分组，最多四个排序后的封面或独立自选封面；进入分组、标题和返回根目录；数据筛选与四项预览测试通过，iOS 实际进入自定义组和返回通过 |
| `TocUpdateRequests`, 各 adapter 运行状态、底栏等待数量 | `bookshelfRefreshRuntime`, `useBookshelfRefresh`, `bookshelfRefresh`, 根 TabBar | 队列状态区分等待/运行，合并显示数量，运行书籍显示指示器；刷新每本完成就提交，慢书不会阻止快书出现结果，失败后清理状态；全局与手动刷新均接入。并发状态和逐书提交测试通过，真实 iOS 网络刷新等待徽标仍待实测 |

全局排序只影响继承默认的分组，保留各组独立排序。书架的最近/最新行改为源 adapter 实际写入的章节名称，保留图标，不再添加迁移版额外前缀。原版继续阅读箭头和书名叠加渐变有资源映射；没有增加原生模块或更改原生版本。

保留两处源当前行为：文件夹 adapter 的作者排序选项回退到阅读时间；根目录直接书籍查询在没有正数自定义分组时，受源 SQL `sum(groupId)` 的 NULL 条件影响为空。代码和测试明确这些差异，未把未经请求的源行为修正混入还原。

刷新还补充了源切换保护：等待目录时若书籍 URL/书源已变化，旧结果不会覆盖新书源的目录。正常结果继续保留并发导入、删除、元数据和阅读位置；写入使用应用现有单一 MMKV 命名空间。

## 实际独立 iOS 操作

1. 书架菜单→书架布局，初始列表/标签/标准进度、显示未读开启，其余显示项关闭，与源默认值对应。
2. 选择三列并开启最近阅读、数量统计，确认→全部组。[三列网格及统计](evidence/ios/bookshelf-grid3-statistics.png)中两本书占前两列，未读 1 的灰色徽标、已读书红色进度、全局统计和继续阅读均可见。
3. 再打开布局，改为六列→取消→重新打开；三列仍为勾选状态，六列未勾选，已确认取消不写入草稿。
4. 分组样式→文件夹→确认，实际出现三个分组；进入 `iOS 分组验收`，标题变为书架(iOS 分组验收)，只显示其一本书；返回恢复[文件夹根目录](evidence/ios/bookshelf-folder-grid.png)。
5. 终止进程并冷启动，仍显示[文件夹三列、统计与继续阅读](evidence/ios/bookshelf-layout-cold-start.png)。新增日志片段没有错误或警告，`evidence/ios/layout-cold-start-log.txt`。

测试书籍/分组仅存在专用调试设备。生产包不含 fixture 字符串，首次安装仍为空书架。截图证明上述特定状态，未以单个截图接受全矩阵。

## 验证与本地包

- `npm test -- --runInBand`：158 suites / 677 tests passed，`unit-tests-layout.log`。新增偏好、显示计算、文件夹预览/根筛选、刷新队列与逐书提交等场景；修正测试环境不支持动态 import 的测试写法后全部通过。
- TypeScript、相关实现与测试 ESLint、`git diff --check` 通过，`typecheck-layout.log`、`lint-layout.log`。
- 源 2,579 文件哈希保持一致，`source-verify-layout.log`；目标原生目录无改动。
- 36 条源/目标资源映射 SHA-256 已核对，`asset-verify-layout.log`；新增原箭头与叠加渐变映射，已有矢量集合目标哈希随箭头补入更新。
- iOS HTYF 构建成功，`dist/dist.dgz`；255 个构建输入、ZIP 完整性和包 SHA-256 见 `build-inputs.json`、`build-result.json`。原 JPEG 内嵌字节一致、fixture 不在包内。包未发布，宿主加载/扫码仍 pending。

## 继续验收与未完成项

紧凑/二至六列完整矩阵、网格书名隐藏与叠加、最大间距、增强/隐藏进度、长作者/标题、横竖屏、大字体、深色和实际宿主胶囊仍需逐项 UI 对照。快速滚动条已经接入拖动与可访问性调整，但尚未在长书架实测；原生手感、显示动画也未认定一致。

横向分组滑动、每组独立滚动位置恢复、周期更新时间刷新及源完整书架管理页仍待补；刷新网络请求去重/后续请求策略尚未完整迁移，当前状态显示的唯一计数不代表已完成原生请求调度策略。Web 刷新端点与主书架队列的统一也需继续核验。

书单导入导出分离入口、旧备份目录/章节内位置恢复、封面横排字体度量、全量资源及系统 TTS/JS 沙箱/后台服务等原生缺口保持未完成。没有创建成功迁移 `source-state.json`，目标继续保持 active。
