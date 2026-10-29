# 2026-10-28 封面三层与批量保存/恢复（部分验收）

整体 1:1 迁移尚未完成。仅在独立“Legado HTYF 调试”iPhone 17 Pro / iOS 26.5、UDID `8338CC2C-E716-4B2B-BC30-CC5C777CB2FD` 验证。Android 源码只读，不进行 Android 构建或设备调试。

## 源合同与目标映射

源规格为 `data/entities/Book.kt`、`data/dao/BookDao.kt`、`help/book/BookCoverPersistence.kt`、`help/glide/OkHttpStreamFetcher.kt`，以及 `ui/book/manage/BookshelfManageViewModel.kt`、`BookshelfManageActivity.kt`、`ui/book/info/edit/BookInfoEditActivity.kt`。中文文案来自 values-zh/strings.xml。

目标 Book 分别保存 `coverUrl`（书源）、`customCoverUrl`（自定义）和 `persistedCoverUrl`（固化）。显示优先级为固化→自定义→书源；编辑和网络固化只看自定义→书源，不把本地固化路径填进网络编辑框。`core/bookCover.ts` 统一选择、编辑、旧路径归类和提交比较。书架、文件夹预览、详情、搜索结果及音频 artwork 接入分层选择；默认图和文字布局保留。

自定义封面只有与书源相同网络 origin 才复用书源 header/Cookie，严格区分 scheme 与显式端口，匹配源 NetworkUtils 的 authority 比较。原书源封面仍可使用其 CDN 地址及书源凭据；固化本地图片不带网络凭据。`core/bookCoverRequest.ts` 复用声明式 URL/header 解析；封面解密 JS 明确不支持，不会把加密字节当作成功图片。

管理页新增“保存网络封面到本地”“恢复网络封面”“恢复书源封面”，当前有实现的批量动作由 9/13 增至 12/13。后两项保留各自确认文案和取消。保存显示当前项/总数及取消，所有弹层仍在应用 React 树内。

`services/bookCoverPersistence.ts` 串行执行，启动任何封面操作会取消并等待前一操作。捕获选中书籍 URL；排队期间换成另一 URL 的书籍跳过。每项实际开始时重读最新书籍，网络候选忽略固化层。下载使用原 HTTP(S) URL 和源请求头，遵守仅 Wi-Fi 偏好，真实解码下载文件后再固化。文件按内容 MD5 存为 Documents/covers/<32hex>.cover，复用同内容文件，先复制 .part 再移动；临时下载及中间文件在成功、失败和取消后清理。

提交同时比较 ID/URL、origin、书源/自定义/固化三层，保留期间发生的阅读、分组和其它无关编辑；删书不复活，换源或封面改变时旧结果跳过。恢复网络只清固化引用，恢复书源清两层引用，均不删除可能被其它书共用的内容文件。恢复比较相应最新字段，成功计数按实际更新。下载取消会调用原生 stopDownload；解码等待也可取消，不会因旧回调不返回而锁住后续操作。已完成项可保留，与源逐项提交一致。

BookEditor 未改网络地址时保留固化；真正改地址才清除固化，若地址等于书源地址则清自定义层。源切换和迟到的阅读/元数据写入保留最新覆盖层，不将旧书源封面写回新书源。旧版备份和完整书架 JSON 分别保留三层；仅将绝对 covers/<32hex>.cover 的旧 customCoverUrl 保守归为固化，文件映射分别重定位，未知路径不猜测。

## 独立 iOS 证据

夹具 `scripts/cover-persistence-fixture.mjs` 只监听 127.0.0.1:18199，通过正常 Web `/saveBookSource`、`/saveBook` 显式导入一本文本夹具；原三本书逐字段保留，见 cover-books-before-import.json、cover-books-initial.json。生产包不包含夹具名称、地址或图片字节。

- 自定义网络图为红色，书源图为蓝色。初始红色原生显示见 `evidence/ios/cover-custom-network.png`。custom.png 使用 localhost、书源 origin 使用 127.0.0.1，实际请求日志始终 sourceHeader=false；恢复后的 source.png 为 true，服务器会拒绝错误凭据状态，见 cover-persistence-fixture.log。
- 在管理页只选该书，实际点击保存，生成 361 字节红色 PNG，MD5 `a77e965967ebf53f86642bbf20c22e8b`；文件名吻合。cover-books-persisted.json 对比初始状态只有 persistedCoverUrl 增加，另外三本书、进度 0.35、正文和分组 ["1"] 不变。
- 打开恢复网络并取消，完整书架相等，见 cover-books-restore-cancelled.json。再次确认恢复网络，只清固化引用，自定义/书源和共享文件保留，见 cover-books-network-restored.json。重新保存复用同一内容地址，书架回到完全相同的固化快照。
- 确认恢复书源，固化和自定义两层均清除，蓝色书源图实际显示；见 cover-restore-source-confirm.png、cover-source-network.png、cover-books-source-restored.json。其余字段及原共享文件保留。
- 再次保存书源图，生成 360 字节 PNG，MD5 `c36355d7cec679b68d548ef3d18a2db8`。通过正常 Web 导入准备“已有固化图 + 坏自定义 URL”场景，实际从管理页保存。HTTP 200、Content-Type image/png 但正文为 HTML，原生解码拒绝，保存前后完整书架相等，无 .part 或临时下载，见 cover-books-invalid-prepared/result.json。
- 以相同方式准备 slow.png。实际进度和取消按钮见 cover-saving-progress.png；点击取消后服务器记录 `/slow.png closed finished=false`，完整书架与准备状态相等、旧固化图保留、临时文件清理，见 cover-books-slow-prepared/cancelled.json。异常场景准备使用正常业务 API；没有直接修改 MMKV。
- 通过正常 API 清除仅用于慢下载的自定义 URL，恢复到书源固化快照。编辑器实际显示 `http://127.0.0.1:18199/source.png`，没有固化路径，见 cover-editor-network-value.png。未完成本次未改地址保存的 UI 证据；该保存逻辑目前由纯函数回归验证。
- 故意停止本轮已核对身份的夹具进程并确认端口无人监听，再冷启动 App。蓝色固化图仍显示，见 cover-persisted-offline-cold-start.png、cover-offline-gate.json。Web 接口冷启动快照 cover-books-cold-start.json 与最终快照 cover-books-final.json 完全相等（四本书逐字段保留）。之后恢复同一夹具服务。最终冷启动日志 cover-persistence-final-cold-start.log 无新增 JS 异常；固定依赖版本/弃用警告仍存在。全局任务、Web、MCP 均关闭，App 留在书架。

## 检查与边界

**173 suites / 760 tests**、TypeScript、相关 ESLint、git diff --check 通过。三组新增回归及已有组件/导入测试覆盖分层、编辑、凭据隔离、JSON 往返、并发写入/删书/换源、解码/HTTP/空文件/写入失败、去重、两层恢复、下载与解码期间取消。

iOS CLI `--version 0.0.16 --platform ios` 构建退出 0；最新字节数、SHA-256、280 个输入和包内标记检查见 build-result.json、build-inputs.json。源 2579 文件哈希保持不变，37 资源映射验证通过；渐变目标组件只替换两处封面绑定，逆替换后 SHA-256 与上一阶段完全相同，渐变几何未变。原生依赖与 ios/android 目录未改。包未发布，分享二维码已实际解码并与 README/本地构建配置核对，远程配置仍为 0.0.14，真实宿主/胶囊/扫码仍待验收。

仍待补齐：完整封面设置/横排/字体/主题/长标题视觉矩阵、编辑/本地自选图片完整 UI、批量多项与快速取消重开矩阵、跨设备备份时固化图片文件收集与恢复、Web 页面/图片端点的本地固化封面展示。封面解密 JS 受既有沙箱阻塞。管理页尚缺批量换源；其余全量清单继续推进，不因此认定完整 1:1 已通过。

后续：批量换源已实现并有独立 iOS 证据，见 [batch-source-change-report.md](batch-source-change-report.md)。媒体 ZIP/WebDAV 的跨设备归集/恢复、分类排除、文件校验、取消与完全离线冷启动已补齐当前验收，见 [backup-media-report.md](backup-media-report.md)。Web 固化图片展示及其它完整矩阵仍开放。

## Web 封面后续证据

0.0.19 已在独立 iOS 验证三层封面通过 Web 接口生成真实 84×112 PNG，包括居中裁切、源请求头隔离、三秒失败回退、固化层切换及离线冷启动。详见 [web-cover-report.md](web-cover-report.md)。这是封面子链路验收，完整 Web UI、格式、字体和手势仍 pending。
