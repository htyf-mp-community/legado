# 敏感备份选项 / Sensitive backup options (0.0.51)

原版 `BackupConfig.contentIsEnabled` 默认关闭持久 Cookie 与源变量，用户显式启用后，`Backup.kt` 在查询或写文件前检查本地密码，即使对应表为空也要求非空白密码；两项都开启时先提示 Cookie。本轮对齐默认值、校验时机、空白字符和提示顺序，已保存的分类选择继续保留。启用的空分类也写入独立的加密容器；仅当源变量分类启用时使用 HTYF 备份版本 2。

Native backup defaults both sensitive categories to off. When either is explicitly selected, it requires a nonblank password before reading/writing backup data even if the corresponding table is empty, with cookies taking precedence. Saved user selections remain intact. Selected empty categories also get encrypted containers; source-variable selection uses HTYF backup version 2.

## 验证 / Validation

- [回归测试](../../../__tests__/backupSourceVariables.test.ts)先在旧实现中复现默认选中、空数据未校验及无空分类密文，见 [red.log](red.log)。新增有限案例覆盖独立选项、默认与部分配置、已保存选项、空白字符、密码提示顺序、空容器往返和排除敏感数据。
- [完整测试](tests.log)：221 suites / 1,134 tests 通过；TypeScript 和修改文件 ESLint 通过。加解密自动测试使用 Node crypto，不是 iOS QuickCrypto 成功往返的证据。
- 独立 iPhone 17 Pro / iOS 26.5 模拟器运行 0.0.51；已有两个敏感分类均保持开启，本地密码仍未设置，点击“复制完整备份”后界面提示“备份或恢复持久 Cookie 前，请先设置非空的本地密码。”。没有更改密码或任何备份选项；本次未验证设备上首次安装的默认值或单独选中源变量的界面路径。
- 使用只含公开测试数据、普通条目为 0 的版本 2 ZIP，通过本机 WebDAV 下载并确认恢复，界面显示“恢复失败，原数据已保留 / 备份包含敏感数据，请先设置本地密码”；恢复忽略选项在测试前均关闭，预览已取消。见[脱敏请求记录](restore-requests.json)。这是界面拒绝结果；未做完整存储前后逐项比对。
- 书架显示 10 本、在读 9 本；Web、MCP 和定时任务保持关闭。版本、选项及备份错误来自无障碍状态，恢复错误从模拟器截图观察；截图未留存到仓库。

## 未完成 / Remaining

正确非空密码在 iOS QuickCrypto 的加密和恢复、源变量与 Cookie 独立忽略及其余无密码恢复组合仍待验收。完整原版备份格式、源变量运行时消费者、视觉交互和真实 HTYF 宿主仍未完成；不以这组有限测试推断整体 1:1 完成。此前已导出的明文备份不会被自动加密，旧版客户端无法读取带版本 2 的备份。仅测试和构建 iOS，未构建 Android。

## 构建 / Build

本地 0.0.51 iOS 包为 2,605,682 字节，SHA-256 `12daa20abc7e257e2f3d4976edc8fbb1d5a9097871e6275c634f54697d3400c0`；ZIP 完整性通过，分享二维码解码内容与 README 和包配置一致，见 [package.json](package.json)。构建沿用 FlashList 可选依赖和 Reanimated jestUtils 两项既有警告。首次构建因沙箱阻止 npm 查找 `cross-env` 而停止，随后使用机器上已有缓存工具离线构建成功；没有新增项目依赖。检查时远程配置仍为 0.0.49，本地 0.0.51 未发布。
