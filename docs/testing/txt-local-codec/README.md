# iOS TXT 解码验证

2026-11-03：补齐 UTF-7、UTF-7-IMAP、CESU-8、UTF-16 自动字节序及 base64、hex、binary 的剩余路径，并保留年份后缀别名的原有行为。`iconv-lite` 已从小程序直接运行时依赖移至开发依赖，仅用于生成与测试对照；运行时代码不再导入它。自动测试覆盖 415 个已知名称及其年份后缀，另对随机和损坏输入与旧版本进行差分。专用 iOS 模拟器的临时副本通过 11 组函数样本，包括年份后缀；尚未验证系统文件选择器、真实宿主或物理手机。

本次在独立临时目录构建 iOS 小程序，ZIP 完整性通过；Webpack 模块清单共 2826 项，包含新编码模块及 JS 解释器等标记，未发现 `iconv-lite` 模块。该包未发布。`js-interpreter` 和 `re2js` 仍不属于宿主直接依赖，整体依赖约束尚未满足。

2026-11-02：专用 `Legado HTYF 调试` iPhone 17 Pro / iOS 26.5 模拟器，从 `/private/tmp/legado-txt-harness.30kbHb` 中的临时项目副本加载调试应用。副本在入口调用 `decodeTxtBase64`，仅在开发日志输出样本总数和失败名称；未修改正式入口、原生工程或发布包。日志显示：

```text
HTYF_TXT_CODEC_CHECK {"total":6,"failures":[]}
```

六组样本包括 UTF-8 连续 BOM、UTF-16LE/BE 的连续 BOM 与未配对代理字符、GBK 损坏字节、GB18030 特殊四字节及截断前缀、Big5 组合字符和补充平面字符。自动测试对 GBK、GB18030、Big5 的全部单字节和双字节输入，以及 GB18030 的 1,587,600 个四字节地址进行旧编码器对照；还覆盖每种旧字符集 20,000 组混合字节。全量回归通过 258 套、1385 项。

本次只在模拟器执行解码函数，未完成系统文件选择器和 TXT 导入的完整界面验证，也未验证真实 HTYF 宿主、远程站点或物理手机。其他字符集仍回退到 `iconv-lite`；该项目与 `js-interpreter`、`re2js` 仍未满足仅使用宿主依赖的要求。转换数据由 `scripts/generate-txt-legacy-decode-data.cjs` 根据 iconv-lite 0.7.3 生成，许可见 `docs/licenses/source-charset-NOTICE.txt`。

2026-11-03：增加 CP936、CP950 及其别名的 TXT 解码，并将原先回退到 iconv 的常见 UTF、Big5、GBK 和 GB18030 响应别名接入小程序内解码。原有 ICU 直接处理的名称保持其既有路径；回退别名保留旧解码器的 BOM、异常字节与 UTF-16 码元语义。自动测试覆盖 CP936、CP950 的全部单、双字节，以及各 20,000 组混合字节，另对响应别名和响应头做差分；全量回归通过 259 套、1414 项。

专用 iOS 模拟器从 `/private/tmp/legado-alias-harness.PtDybB` 临时副本执行 9 组 TXT、响应内容和响应头样本，日志为 `HTYF_ALIAS_CODEC_CHECK {"total":9,"failures":[]}`。这是独立调试应用内的函数验证，未覆盖系统文件选择器、真实 HTYF 宿主或远程网站。其他编码仍依赖 `iconv-lite`，完整宿主依赖约束仍未满足。

2026-11-03：原 iconv-lite 0.7.3 的 80 套单字节映射和 347 个名称/别名改为小程序内数据，供 TXT 解码、原先回退到 iconv 的响应解码及书源 URL 编码使用；原有 ICU 直接处理的响应编码保留原路径。自动测试对每套映射的全部 256 字节和基本多文种平面字符进行对照，全量回归通过 260 套、1417 项。专用 iOS 模拟器从 `/private/tmp/legado-sbcs-harness.BphMrh` 临时副本执行 TXT、响应、响应头及 JavaScript 编码共 8 组样本，日志为 `HTYF_SBCS_CODEC_CHECK {"total":8,"failures":[]}`。这不代表系统文件选择器、真实 HTYF 宿主、远程网站或所有 Android 字符集实现均已验证；其他编码及脚本运行时依赖仍待迁移。

2026-11-03：Shift_JIS、EUC-JP、EUC-KR/CP949 及其旧编码器别名接入小程序内编码和 TXT 解码；原来回退到 iconv 的对应响应别名也使用本地解码，已经走 ICU 的响应名称继续走原路径。自动测试覆盖全部单、双字节、EUC-JP 的全部 `8F` 三字节组合，以及三种编码的基本多文种平面字符和各 10,000 组混合字符串；全量回归通过 261 套、1443 项。专用 iOS 模拟器从 `/private/tmp/legado-east-harness.m136sM` 临时副本执行 11 组 TXT、响应、响应头和 JavaScript 编码样本，日志为 `HTYF_EAST_ASIAN_CHECK {"total":11,"failures":[]}`。该验证对照此前 iconv-lite 0.7.3，未覆盖系统文件选择器、真实 HTYF 宿主或所有 Android 字符集版本；其他依赖仍待迁移。

2026-11-03：书源 URL 编码增加 CP950、GB2312、GBK/GB18030/Big5 的其余别名和年份后缀，分别保留旧编码器对欧元、特殊字符和缓冲区的行为。CP950 与 Big5 不共享相同映射；GBK、CP936 的直接名称仍保留既有 Java 欧元处理，其余别名保留此前原编码器行为。自动测试覆盖基本多文种平面及各 10,000 组混合字符串，全量回归通过 262 套、1459 项。专用 iOS 模拟器从 `/private/tmp/legado-legacy-alias-harness.TOawlh` 临时副本执行 13 组 JavaScript 编码和 TXT 导出字节样本，日志为 `HTYF_LEGACY_ALIAS_CHECK {"total":13,"failures":[]}`。尚未验证真实 HTYF 宿主、远程站点或系统导出界面。

2026-11-03：UTF-32/UCS-4 自动、LE 和 BE 名称的 TXT 解码及书源 URL 编码改用小程序内实现；此前回退到 iconv 的响应别名也改用本地处理，已有 ICU 直接处理的响应名称保持原路径。自动测试覆盖 BOM、字节序判断、截断、无效码点、孤立代理字符和随机数据；全量回归通过 263 套、1477 项。专用 iOS 模拟器从 `/private/tmp/legado-utf32-harness.hkQged` 临时副本执行 12 组 TXT 解码和 JavaScript 编码样本，日志为 `HTYF_UTF32_CODEC_CHECK {"total":12,"failures":[]}`。未验证真实 HTYF 宿主、远程站点或系统文件选择器；其他编码及脚本运行时仍有非宿主依赖。
