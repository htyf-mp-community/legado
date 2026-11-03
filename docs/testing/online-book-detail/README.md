# 在线书籍详情 / Online book details (0.0.54)

原版详情页在书名上方显示封面，在书名下显示字数与分类标签、作者、来源和最新章节；`SearchBook.toBook()` 把分类、字数、最新章节、封面与类型等信息带入书架。目标此前不显示封面及标签，加入书架时也丢失分类、字数和最新章节；只提供下载的书源类型还缺少原版文本类型位。

在线详情现在复用源凭据隔离的封面组件，按 `BaseBook.getKindList()` 的顺序先显示字数，再以逗号和换行拆分、裁剪并显示分类；点击标签会在当前书源搜索。作者、来源和有值的最新章节单独显示。书架转换保留源元数据和原版类型位（文本 8、音频 32、图片 64、下载 136、视频 4）。已有章节预览保留，因此本页尚不是原版详情页的完整视觉与交互复刻。

The online detail now shows a source-aware cover, word-count/category labels, author, source and latest chapter. Label taps search within the current source. Adding a book retains its source metadata and native type flags. The existing chapter preview remains, so this is not full visual or interaction parity.

## 验证 / Validation

- [red.log](red.log) 记录了转换丢失元数据、源类型不匹配及标签逻辑缺失；[定向测试](targeted.log)覆盖转换、标签顺序和空白、书单/目录与封面兼容。
- [组件测试](screen-final.log)通过模拟的加载结果验证标签顺序、点击参数、封面来源和“加入书架”传递的元数据；这是组件级证据，不代表已经在用户模拟器中实际加入书籍。
- [完整回归](tests.log) 225 suites / 1,156 tests 通过；TypeScript 与改动文件 ESLint 通过。React 测试渲染器给出既有弃用提示。

## 范围 / Remaining

完整原版详情页的背景、动画、完整目录交互、换源、分组、简介折叠、标签长按和 Web 文件处理尚未全部迁移。真实 HTYF 宿主、真机和全局 1:1 仍待验收。仅调试 iOS，未构建 Android。

## 构建 / Build

本地 iOS 包 `dist/dist.dgz` 版本 0.0.54，2,607,505 字节，SHA-256 `38b46a889c98ff555f0d481439678cbae68fde1cef9d211f0a9263ea2f02fcea`，ZIP 完整性通过。构建仍有 FlashList 可选依赖与 Reanimated jestUtils 两项既有警告。远程配置为 0.0.49，本地包未发布。

## 独立 iOS 验证 / Dedicated iOS

在专用 iPhone 17 Pro / iOS 26.5 模拟器复用已有「iOS 批量正常验收源」，由仅监听本机的公开测试服务返回书名、作者、`12500` 字和测试分类。搜索并打开在线详情后，界面按顺序显示默认封面、“模拟书”、“1.2万字”、“测试分类”、作者、来源、简介和 1 项目录，见[截图](detail.png)与[请求记录](requests.json)。未点击加入书架；标签搜索与书架转换由组件测试覆盖，未在设备上点击标签或添加测试书；搜索复用了已有关键词。测试服务和本轮调试服务均已停止。
