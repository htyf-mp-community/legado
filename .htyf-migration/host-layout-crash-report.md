# 2026-10-29 真机加载时 layout 空事件崩溃

用户截图：`plugin_legado_v0_0_22.bundle:8414:3415`，`Cannot read property 'layout' of null`，调用栈含 `basicStateReducer / updateReducerImpl / useState`。截图中的真机问题尚未用修复包复测，不能据模拟器或单元测试宣称真机已通过。

## 已复现的原因与修复

`BookshelfContent` 的 FlatList 布局回调在 `setMetrics(value => ...)` 内读取 `event.nativeEvent.layout.height`。状态更新排队后，宿主释放事件会使 nativeEvent 变为 null，React 在 reducer 中执行回调时崩溃。滚动回调的 `contentOffset.y` 存在相同缺陷。

使用真实 BookshelfContent 和 React 状态队列，先提交 contentSize 更新，再发送布局/滚动事件，并在 flush 前清空 nativeEvent。`__tests__/bookshelfContentEvents.test.tsx` 两条测试在修复前分别得到 `Cannot read properties of null (reading 'layout')` 和 `contentOffset` 错误，堆栈落在真实组件和 React reducer；修复后通过，并检查可视高度及连续事件的最新偏移。红/绿日志见 `tests-host-layout-red.log`、`tests-host-layout-green.log`。

修复只将高度和偏移在事件回调内同步提取为数字，延迟 updater 仅捕获数字；保留多个状态字段合并。没有通过可选链吞掉无效更新，也未改原生或依赖。对 src 中 nativeEvent 读取的静态扫描未发现其它延迟嵌套回调读取；独立只读审查通过。

## 交付与边界

- 本地 iOS 包：`dist/dist.dgz`，版本 **0.0.23**，1,612,490 bytes，SHA-256 `8b2b183a1922ccc2888e26b434b82c6cfd00bf46a02e4ab7a64062767b7a2874`。配套配置为 `dist/app.json`。
- 包内两处编译回调均验证为先读取数值、再调用 setMetrics；194 suites / 923 tests、TypeScript、ESLint 通过。
- 304 项生产输入 SHA-256 `014d50f6d23ac08755bd1a1cce34963065f73bdc2fc35c94756c479c12a69ed2`；2,579 个源文件不变，37 项资源映射已核对，其中书架组件因修复刷新目标文件摘要，源渐变与几何不变。
- 独立 iOS 在专用服务预热后冷启动正常进入八本书架并展开书籍列表，截图 `evidence/ios/host-layout-fixed-shelf.png`；这仍是 standalone 调试结果，未替代真机宿主验收。
- 当前公共配置地址仍返回 0.0.14，不能对应截图中的 0.0.22；只读查询结果见 `evidence/ios/host-crash-remote-config.json`。未发布修复包。需将真机实际加载入口换为 0.0.23 的包与匹配配置，再验收启动、书架布局及滚动。
- 独立 iOS 调试仍使用 8097。默认 8081 有其它开发服务；冷启动前必须确认 8097 服务及 bundle 就绪，保留 `-RCT_jsLocation 127.0.0.1:8097`。开发入口错误与本次 layout reducer 崩溃分开记录。

整体 1:1 迁移继续进行；本报告只覆盖已复现的事件生命周期缺陷。
