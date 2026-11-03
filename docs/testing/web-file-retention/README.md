# iOS 文件源保留修复 / iOS file-source retention (0.0.56)

0.0.55 将网络文件移动到应用文档目录后，EPUB/MOBI 导入器再次调用 `keepLocalCopy`。当前 iOS 实现的 `FileOperations.swift` 使用 `FileManager.moveItem`：文件被从文档目录移到缓存目录，再被导入器清理；书籍记录中的文件地址因此失效。0.0.55 验收中关于这两种文件已保留的结论不成立。

现在本地 `file://` 文件先用原生 `copyFile` 复制到独立缓存文件供解析，解析结束只清理缓存副本。EPUB/MOBI 原文件保留，MOBI 记录也保存 `localUri`。内容提供器 URI 仍走原有选择器接口。文件型书源调试在详情成功后报告下载链接数量，跳过不适用的目录和正文步骤。

## 验证

- [失败复现](red.log)：内存文件系统按当前 iOS 选择器的真实移动语义模拟，EPUB 和 MOBI 的下载、实际导入器、清理后文件保留检查均失败；修复后通过。
- [调试流程失败复现](debug-red.log)和[最终定向测试](target-final.log)：验证文件源只请求搜索与详情、报告链接并跳过目录，普通书源仍正常执行。
- 完整回归 [tests.log](tests.log) 为 229 suites / 1168 tests；[类型检查](typecheck.log)和[ESLint](lint.log)通过。最后的测试文件类型调整后，相关测试重新通过。
- 独立 iPhone 17 Pro / iOS 26.5 调试容器运行专用 [测试界面](device-harness.tsx)，通过仅绑定 127.0.0.1 的[测试服务](fixture.mjs)下载实际合成的 EPUB 和 MOBI；两个格式都读取正文、检查文件存在、再次导入并比对原文件字节，通过结果见[截图](ios-result.png)及[请求记录](requests.json)。文件由 [生成脚本](generate-fixtures.py)生成，使用公开测试内容，不涉及真实站点账户。
- 测试仅执行核心导入函数，没有通过详情页按钮加入书架；测试文件和 EPUB 解包资源留在专用模拟器应用容器中。测试结束恢复了 `index.js` 原内容和[正常书架界面](restored.png)，未修改或删除模拟器已有书架数据。调试服务均已停止。

## 限制

上述设备验证是本地模拟器的原生文件操作测试，不等于真实 HTYF 宿主或手机验证；文件源详情 UI、ZIP 实机导入及其他格式仍待完成。原版全量交互和 1:1 迁移尚未完成；不涉及 Android。

本地 iOS 包 `dist/dist.dgz` 为 0.0.56，2,609,705 字节，SHA-256 `f88909ebd5562e4a26401dc57f476921f2c406b9fd490b7b1efd7baa5d8a2b4e`，ZIP 检查通过；二维码与本地配置一致。远程包未发布，仍不能用于本轮手机验收。
