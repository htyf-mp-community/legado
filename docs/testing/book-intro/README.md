# 书籍简介折叠 / Book introduction expansion

原版 `BookIntroCollapse.COLLAPSED_LINES` 为 4，超过四行时显示“展开”，展开后显示“收起”；不溢出时不显示按钮。在线详情和书架详情现共用此行为，保留各自原有字体和文本来源。文本测量层对无障碍隐藏，宽度变化后重新判断，简介改变时重置展开状态。

独立 iOS 模拟器中的临时调试应用验证四行[折叠](collapsed.png)、[展开](expanded.png)、切换短简介后按钮消失和[窄宽度换行](narrow.png)，入口为 [ios-probe.txt](ios-probe.txt)。自动测试覆盖按钮状态、内容更换、宽度变化和隐藏测量层；相关 4 套 9 项通过，TypeScript 和 lint 通过。模拟器验证的是共用组件，尚未在真实 HTYF 宿主或物理手机验证详情页面；原版富文本简介、缩进、完整页面布局和视觉差异仍未全部还原。
