# HTYF 模板更新 / Template update

2026-11-03：增量同步官方 [HTYF CLI app 模板](https://github.com/htyf-mp-community/htyf-cli/tree/8c6fc84077470bee05af97d6cf04682a0977c210/packages/cli/_apps_temp_)，提交 `8c6fc84077470bee05af97d6cf04682a0977c210`（`fix: align template React test renderer`）。该提交已通过 GitHub `main` 的远程引用和独立临时克隆核对。

Incrementally synchronized the official app template at the revision above, verified against GitHub's `main` reference and a separate temporary clone.

| 依赖 / Dependency | 原版本 / Before | 更新 / After |
| --- | --- | --- |
| React Native | 0.86.2 | 0.88.1 |
| React / react-test-renderer | 19.2.3 / 19.2.0 | 19.3.1 / 19.3.1 |
| HTYF CLI | 0.5.8 | 0.7.14 |
| HTYF JS SDK | 0.2.25 | 0.2.28 |
| HTYF RN SDK | * | 0.0.3 |
| Re.Pack | 5.3.0 | 5.4.0 |
| Reanimated / Worklets | 4.5.3 / 0.11.3 | 4.7.1 / 0.13.1 |
| Node.js 最低版本 / minimum | 20 | 22.13.0 |

模板已有的依赖按相同版本固定，同时保留 Legado 业务所需的额外依赖和脚本。没有引入模板的 AsyncStorage；持久化继续使用现有独立 MMKV 命名空间。Webpack 合入 `createRequire` 依赖定位和 `getResolveOptions(platform)`，保留宿主兼容转换、模块别名、许可证和打包设置。Worklets 回归测试改为验证新版独立运行时的数组闭包协议。

Existing dependencies shared with the template use its exact versions. Legado's additional dependencies and scripts remain. Persistence retains the dedicated MMKV namespace. Webpack adopts dependency resolution through `createRequire` and platform-aware Re.Pack resolution while preserving host compatibility, aliases, license notices and packaging. The Worklets regression test checks the updated standalone runtime's array-closure protocol.

实际编译还要求开启 Re.Pack 的 `enablePackageExports`，以解析 RN 0.88 的 asset-utils、renderer 和 setup-env 导出入口；新增集成测试直接检查项目 Webpack 配置的解析结果。补齐 CLI 调用所需的 `cross-env@10.1.0` 开发依赖，以及 RN SDK 声明的 `@sayem314/react-native-keep-awake@2.0.0` peer 依赖。阅读器的 ScrollView/TextInput ref 改用 RN 新版公开实例类型，FlatList 空组件缺省值改为 `undefined`，不改变交互。

The production build also requires Re.Pack's `enablePackageExports` for RN 0.88's asset utilities, renderer and setup entry points; an integration test exercises the actual Webpack resolver. Added the CLI's missing `cross-env@10.1.0` development dependency and the RN SDK's declared `@sayem314/react-native-keep-awake@2.0.0` peer dependency. Reader refs use the new public RN instance types, and the FlatList empty-component default uses `undefined`, preserving behavior.

应用标识 `plugin_legado`、本地版本 `0.0.65`、业务功能、书源和数据格式不变。本轮没有修改原始 Legado 工程，也没有修改 `ios/`、`android/` 原生源码。独立 App 必须重新安装 Pods 并重新编译，旧 Worklets 0.11.3 二进制不能运行新 bundle。Android 原生工程尚未同步模板的 compileSdk 37 / Kotlin 2.3.0；独立 iOS/Android 和物理手机验收仍待完成。

The app identity, local version, reader features, sources and data formats remain unchanged. Original Legado files and native source trees remain unchanged. Standalone apps require refreshed Pods and a native rebuild; old Worklets 0.11.3 binaries cannot run the new bundle. Android's native project still needs the template's compileSdk 37 / Kotlin 2.3.0 update. Standalone native builds and physical-device acceptance remain pending.

## 验证 / Validation

- 依赖：安装完成；npm 与 Yarn 锁文件、实际安装的 81 项直接依赖一致。Yarn 的传递依赖、npm alias 和跨平台可选依赖引用均已核对。
  Dependencies: installation completed; both lockfiles match all 81 installed direct dependencies. Yarn's transitive, aliased and platform-optional selectors were checked.
- 类型与 lint：`tsc --noEmit`、`npm run lint` 和最终改动文件的 lint 通过。
  Type checking and lint: `tsc --noEmit`, full lint and follow-up lint of the final changed files pass.
- 测试：完整执行 313 套件 / 1,873 项；312 套件通过，唯一失败为新版 Worklets 的开发/生产环境断言。修正测试环境后，包含新增解析测试及宿主、阅读器和书内搜索的 5 套件 / 20 项复测全部通过。
  Tests: the full 313-suite / 1,873-test run passed 312 suites; the sole failure was the updated Worklets test's development/production environment. After correcting the test environment, all five affected/new suites (20 tests), covering resolution, host compatibility and reader/search, pass.
- iOS 小程序：`node node_modules/@htyf-mp/cli/src/index.mjs build --non-interactive --project "$PWD" --platform ios` 编译通过；归档内存在非空 `plugin_legado_v0_0_65.bundle`，配置与 manifest 的 RN、React、SDK、Worklets 版本均与本地安装一致。两项依赖警告为未使用的可选 FlashList 和 Reanimated jestUtils 动态 require；另有 Re.Pack 命令入口与 Webpack assets API 弃用提示。
  iOS mini-app: the CLI production build passes. The archive contains the non-empty application bundle; app metadata and manifest versions match the installed RN, React, SDK and Worklets packages. Two dependency warnings concern unused optional FlashList and Reanimated jestUtils dynamic require; Re.Pack command and Webpack assets APIs also emit deprecation notices.
- 产物：`dist/dist.dgz`，3,139,272 bytes，SHA-256 `cdb9c84f72659017084b7b525b400a1b6dd14e76d68c709dfdf304d0310b9252`。
  Artifact: `dist/dist.dgz`, with the size and SHA-256 above.
- 分享：README、`docs/assets/htyf-share-url.txt` 和二维码均为 `plugin_legado / 0.0.65`；二维码已实际解码比对。线上配置和包地址可访问，配置仍为 `0.0.64`，未部署此次升级。
  Sharing: README, share URL and decoded QR agree on `plugin_legado / 0.0.65`. Remote metadata and package URLs are reachable, but remote metadata remains at `0.0.64`; this update is unpublished.

CLI 0.7.14 在一次编译失败时仍返回成功并打出仅含元数据的空包，因此本轮验收同时核对编译日志、归档 bundle 与 manifest，不能仅凭 CLI 退出码认定成功。独立原生 App、升级后宿主扫码/加载和物理手机验收仍 pending；本轮未上传或发布。

CLI 0.7.14 returned success and packaged only metadata after a failed compilation. Acceptance therefore checks compilation logs, archive bundle contents and manifest versions as well as the exit code. Standalone native apps, host scan/load after this upgrade and physical devices remain pending. No artifacts were uploaded or published.
