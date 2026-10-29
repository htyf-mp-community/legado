# 2026-10-28 Web 封面 iOS 部分验收

整体 1:1 迁移仍在进行。仅使用独立“Legado HTYF 调试”iPhone 17 Pro / iOS 26.5（`8338CC2C-E716-4B2B-BC30-CC5C777CB2FD`）。未构建或调试 Android，未改目标原生目录或依赖版本。

## 源合同与实现

源 `api/controller/BookController.kt#getCover` 通过 ImageLoader 以 84×112、centerCrop 和 3 秒等待取得位图；失败使用默认封面，`HttpServerBitmap` 输出 PNG。书籍封面优先级继续遵循固化→自定义→书源。

目标新增 `services/webBookCover.ts`：`/cover?id=...` 自动选择三层封面；兼容 `path` 和书籍 URL 参数。仅允许读取已登记为书籍封面的本地文件，不将此接口开放为任意文件读取。HTTP(S)、base64 图片、本地固化文件经真实解码生成 84×112 PNG；失败再取当前主题默认图和原版内嵌 JPEG。请求返回 no-store，切换固化层后同一 `/cover?id=...` 能立即更新。

使用已有锁定版本的 WKWebView canvas 完成居中裁切，不新增原生依赖。处理器在应用 React 树内、不提供交互或辅助功能表面；只传入图片字节，静态页面 CSP 禁止网络和外部资源，不注入源凭据。图片加载最多 4 项并行，canvas 串行；每项 3 秒期限包括排队时间，取消后释放容量。相同资源合并请求，成功结果最多缓存 128 项/1 小时，本地键包含文件大小和修改时间。

书源封面复用对应源声明式请求头/Cookie；跨 origin 自定义封面不带书源凭据。显式 URL 选项头单独解析；Web 访问令牌不会转发给图片源。图片仅接收位图格式，字节上限 25 MiB。实际 RN fetch 的大响应可能等待完整 body 才返回，本轮过大慢响应由 3 秒期限终止，未将其描述为提前收到头即终止的证明。

Web 客户端统一通过 `/cover?id=...` 加载封面。静态首页在认证之前返回，使启用令牌的用户仍能打开登录表单；书架/封面 API 继续要求有效令牌。修复原模板字符串吃掉正则转义而导致整页 SyntaxError 的问题，测试执行实际发出的页面脚本。浏览器底部横向 ScrollView 原先占据约一半高度，现固定为内容高度，WebView 使用余下空间。

## 自动验证

- 187 suites / 879 tests 全通过：`tests-web-cover-full.log`；TypeScript 和变更运行时代码 ESLint 通过。
- 队列等待超过单项期限的测试先失败，再修正实现：`tests-web-cover-deadline-red.log`。
- 覆盖去重/缓存、4 项加载与串行渲染、不可取消的晚返回、替换处理器、排队超时、图片格式/尺寸、主题变化后的默认图、本地路径边界、源头/Cookie 隔离、公开静态页和受保护 API。

## 实际 iOS 验证

本机专用夹具 `scripts/web-cover-fixture.mjs`（18202）通过正常书源/书籍 API 导入，不写 MMKV 文件，不成为默认内容或生产包资源。

- 14 项真实 HTTP 响应见 `evidence/ios/web-cover-http-matrix.json`。无令牌静态页 200；无令牌书架/封面均 401。
- 自定义图为红色 RGBA(211,43,55,255)，源图为蓝色(24,91,190,255)，显式选项图为绿色(22,150,70,255)；均实际 PNG 84×112。120×60 横图和 120×320 竖图裁切后均只剩中央蓝色，见 `web-cover-pixels.json`。
- 无封面、HTML 冒充图片、损坏 data URI、未登记本地路径均返回同一默认 PNG。慢图 3.025 秒、过大慢响应 3.009 秒回退，服务端确认两条连接未完成即关闭。
- 源图收到源头、自定义跨来源图未收到源头、选项图收到自己的头；全部图片请求未收到 Web 令牌，见 `web-cover-fixture-requests.json`。
- 同一个书籍 ID 从自定义红图切换为已有固化蓝图，接口立即返回蓝图。正常 `/saveBook` 仅改变该夹具的 `persistedCoverUrl`，七本书其它字段完全相同，见 `web-cover-layer-before/after.json`。
- 关闭 18202 图片源，终止并冷启动专用应用后，接口仍返回固化蓝图 522 bytes，七本完整记录与重启前逐项相等，见 `web-cover-cold-result.json`、`web-cover-cold-books.json`。内置浏览器真实显示默认封面和三本蓝色固化封面，见 `web-cover-browser-offline-cold.png`。冷启动日志未检出 JS 异常。
- 验收后恢复图片夹具，Web/MCP/定时任务均关闭，恢复原来的空 Web 令牌配置，停留在七本书的“全部”书架。全记录最终再次比对通过，见 `web-cover-final-books.json`。

## 本地包与剩余范围

本地 iOS 0.0.19 `dist/dist.dgz`：1,607,565 bytes，SHA-256 `e7ea74477852edf78a08cad07e33bc3ac411b678c947df6abf4bc3ea511cc584`。299 个生产输入、37 项原资源映射、原始 JPEG 内嵌和 ZIP 完整性已核对。夹具书名、端口、令牌及脚本均未进入生产 bundle。二维码已离线解码，与当前包公开配置及 README 一致。未发布，真实宿主扫码/加载仍待验收。

此项只完成封面链路，未认定完整 Vue Web 客户端视觉和交互已还原。`getImg` 的宽度/漫画处理、全部图片格式和大图/内存/并发设备矩阵、默认封面文字布局/字体、JS 图片解密、完整浏览器触摸/辅助功能矩阵仍待完成。CUA 坐标滑动遇到窗口定位错误，未将其记为手势通过。构建热刷新残留 native HTTP listener 的既有问题仍未修复，最终验收使用真正应用冷启动。
