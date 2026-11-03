# 书源元数据格式 / Native book metadata formatting (0.0.53)

目标此前直接显示书源提取的书名、作者和字数，并用换行连接分类；原版 `BookList` 和 `BookInfo` 则分别调用 `BookHelp.formatBookName`、`formatBookAuthor`、`StringUtils.wordCountFormat`，分类以逗号连接。现将这些规则应用于搜索、发现和详情；原有非空书名/作者的覆盖条件不变。

The target now applies native book-name, author, word-count and category formatting to search, explore and details, while retaining existing name/author overwrite rules.

## 对照与自动验证 / Reference and automated checks

- 参考只读源码 `BookHelp.kt` SHA-256 `88f0bb07076e5b99d023610e85a130f0ce07f3a0a4269d3afeb155df1b942ba3`、`AppPattern.kt` `2f8bf8ea556feb59ff9cbe22db028d6eebc96e6255969d6199a08cbdd15f97fa` 和 `StringUtils.kt` `cbff908efad61e25163862e2b5ee90281a381f22afd4f3eea6adfcd48b988676`。原版采用 Java 正则默认 ASCII 空白、字符值不大于 U+0020 的首尾裁剪，以及 Int / Float / Double / DecimalFormat 的顺序；目标逐项实现这些边界。
- [BookMetadataOracle.java](BookMetadataOracle.java) 是脱离 Android 的 JVM 等价转写，不是直接运行原版 Android 类；使用 Gson 2.14.0 输出固定种子样例。640 书名、1,000 作者和 4,627 字数字符串，共 6,267 组结果与目标匹配，包含补零、Int 溢出、Float 精度和 HALF_EVEN 四舍五入边界。测试数据见 [fixture](../../../__tests__/fixtures/nativeBookMetadata.json)。字数对照采用 `Locale.CHINA`，其他系统区域的小数符号尚未验证。
- 搜索和详情各有一个先失败的回归用例，见 [red.log](red.log)。[完整回归](tests.log) 223 suites / 1,146 tests 通过，TypeScript 和改动文件 ESLint 通过。

## 真实书源与范围 / Real-source boundary

「阅读书屋」原始规则中的 `.author@a@text` 与当前网站使用的作者字段不匹配，搜索规则也未提供作者。原版同样按规则取值，本轮不从书名猜测或擅自修改源；详情仍显示未知作者。此观察不代表所有 836 条源都已验收。

本轮不包含任意 JavaScript 规则、完整 metadata 解析/回退、全部 locale 格式、设备中断和真实 HTYF 宿主验收；整体 1:1 仍未完成。仅调试 iOS，未构建 Android。

## 构建 / Build

本地 0.0.53 iOS 包 `dist/dist.dgz` 为 2,607,064 字节，SHA-256 `27bd7e0fe8e2fbda747654b647651deb4a5e79da86ea9128c3ab9cb65a69b725`；ZIP 完整性通过，构建仍有 FlashList 可选依赖与 Reanimated jestUtils 两项既有警告。远程配置当前为 0.0.49，本地包尚未发布。

## 独立 iOS 验证 / Dedicated iOS

独立 iPhone 17 Pro / iOS 26.5 模拟器运行 0.0.53，复用已有的「iOS 批量正常验收源」，使用[本机临时服务](fixture.mjs)返回 `模拟书 作者：测试作者`、`作者：测试作者 著` 和 `12500`。复用已有的“西游记”搜索历史，搜索结果与[在线详情](online-detail.png)均显示“模拟书 / 测试作者”；详情载入 1 项目录，未加入书架。请求路径见 [requests.json](requests.json)。0.0.53 详情页当时没有展示分类和字数；0.0.54 已补齐并在设备验证，见[在线详情验收](../online-book-detail/README.md)。书架仍显示 10 本、在读 9 本，源列表 9 条；这些数量本身不能证明所有原数据逐项不变。测试服务与调试服务已停止。
