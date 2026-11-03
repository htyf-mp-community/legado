# HTYF 书源运行变量备份 / Source-variable backup (0.0.50)

此前 HTYF 备份将 `legacy.runtime-source-cache.v1` 写入普通明文 `entries`。本轮把该项移到独立的 `encryptedSourceVariables`，使用已有的本地密码加密；有源变量的备份使用版本 2，避免旧客户端忽略新字段后错误地报告恢复成功。无源变量的备份继续使用版本 1，版本 1 的历史明文备份仍可读取。**旧版本无法读取版本 2；以前已经导出的明文备份不会被自动加密。** Cookie 与源变量分别加密，因此恢复忽略选项各自独立，敏感数据解密与验证在普通条目写入前执行。

The previous HTYF backup stored the runtime source cache in plaintext. This change encrypts it separately using the local password, and marks backups containing it as version 2 so older clients reject them instead of silently dropping the field. Version 1 backups remain readable. Existing exported plaintext backups are not retroactively encrypted. Cookie and variable ignore settings remain independent; sensitive validation precedes ordinary writes.

## 自动验证 / Automated checks

- [源变量测试](../../../__tests__/backupSourceVariables.test.ts)覆盖无密码拒绝、明文不泄露、两个忽略选项、旧版兼容、损坏/非法条目和恢复前失败；测试中以 Node 原生 crypto 模拟 RN 模块的真实 AES 运算，不是 iOS QuickCrypto 设备验收。
- 先复现了[明文及无密码问题](red.log)和[版本 2 缺少加密字段问题](missing-container-red.log)，修复后[完整回归](tests-final.log)为 221 suites / 1,128 tests 通过，定向测试、TypeScript 和改动文件 ESLint 均通过。
- iOS 本地包 `dist/dist.dgz` 为 2,605,500 字节，SHA-256 `6d792fe92771c9235ccad8e44c3f285da22d82d7bcb1ef8595b8880a4c373a70`；包校验及二维码解码与 README、构建配置一致，见 [package.json](package.json)。构建有 FlashList 可选依赖和 Reanimated jestUtils 的既有两项警告。

## 独立 iOS 验证 / Dedicated iOS

在专用 iPhone 17 Pro / iOS 26.5 模拟器上运行 0.0.50，检查[关于](about.png)与[备份设置](backup-settings.png)；书架显示 10 本、在读 9 本，Web、MCP 和定时任务开关均关闭。通过仅监听 `127.0.0.1` 的公开测试 WebDAV 返回一个含版本 2 密文、无普通条目的 ZIP；设备正常下载并显示“确认恢复备份？”和“0 项数据”，见[预览](preview.png)及不含凭据的[请求记录](requests.json)。该预览已取消；未修改本地密码或忽略选项，临时服务已停止。由于确认按钮被调试警告遮挡，未取得实际无密码恢复拦截的可见结果。

Version 2 reaches the normal restore preview on the dedicated simulator. The preview was cancelled; password and ignore settings were not changed. The missing-password restore result could not be observed because the debug warning obscured the confirmation button.

## 边界 / Remaining work

- 正确密码下的 iOS QuickCrypto 加密、解密和实际恢复，以及忽略开关设备矩阵仍待验收；0.0.51 已补测加密源变量无密码恢复被拒，见[敏感选项验收](../backup-sensitive-options/README.md)；Node 测试不能替代它们。
- 原版开启源变量备份选项时即使没有缓存也要求密码；0.0.50 仅在存在源变量键时要求密码。此差异在 0.0.51 修复，见[敏感选项验收](../backup-sensitive-options/README.md)。
- 源变量运行时消费者、完整备份/恢复、全应用视觉与交互以及真实 HTYF 宿主仍未完成。未进行 Android 构建或测试。
- 本地 0.0.50 包尚未发布；检查时远程配置为 0.0.49、配置和包 URL 均返回 HTTP 200，见 [remote.json](remote.json)。远程包不是本地包的验收证据。
