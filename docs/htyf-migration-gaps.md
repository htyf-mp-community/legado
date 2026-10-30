# HTYF migration gaps

This file records features paused by the project native-modification boundary. `[!]` items remain incomplete until the required module is version-pinned or native work is separately authorized and manually accepted.

## Read-aloud feature parity (2026-10-28)

- Source: `model/ReadAloud.kt`, `service/HttpReadAloudService.kt`, `service/TTSReadAloudService.kt`, `ui/book/read/config/ReadAloudDialog.kt` and `SpeakEngineDialog.kt`.
- Added: HTTP engine CRUD, default/clipboard/file/URL import, JSON export, selection, original `httpTTS.json` backup import, foreground paragraph speech through the pinned TrackPlayer, stop/pause/resume, paragraph/chapter controls, speed and minute timer. Java URL-encoding and the bundled Baidu formula are evaluated as a fixed declarative subset; no arbitrary code is evaluated.
- Still pending: source-equivalent system TTS engine enumeration/speech (no configured TTS native module), full script/login bridge (existing sandbox blocker), book-specific engine overrides, streaming audio, chapter-count sleep timer, word-level highlighting/reader-position tracking, follow-manual-page policy, page-scoped speech, next-chapter predownload and reliable background/headset lifecycle. These remain incomplete even if the foreground flow works.
- Current acceptance platform: dedicated iOS Simulator only, as requested by the user. No Android build/device work is required in this session.
- Verification: HTTP engine/request/paragraph/controller tests; iOS runtime acceptance is pending until the independent simulator build runs. Existing `ios/` and `android/` source remains unchanged.

## Rule JavaScript runtime

- Reason: Legado rules rely on Rhino/JavaScript. The target does not pin QuickJS; a 2026-10-29 read-only audit confirms the current host project pins `react-native-quickjs-sandbox@1.0.1`, but its exposed JSI API evaluates synchronously and provides no interrupt/cancellation, memory-limit or stack-limit controls. The existing package therefore does not yet satisfy the required bounded rule-runtime contract. See `docs/testing/html-text/README.md` for the audited API/source hashes.
- Impact: `@js:`/`<js>` source rules, coverDecodeJs image decryption, subscription pre-request scripts, custom source/auto-task login UI and login checks, source `callBackJs` events (including the audio custom button and copy-play-URL interception), JS dictionary/RSS rules, arbitrary direct-link download URL expressions, and arbitrary auto-task scripts return explicit unsupported errors. The audio player still provides the safe default copy action and labels the custom button unavailable. Standard source/task WebView login and isolated Cookie synchronization remain available, as do declarative non-JS rules and the bundled direct-link fixed-prefix expression. Cover requests with coverDecodeJs fail explicitly before an encrypted image can be installed; `src/core/bookCoverRequest.ts` records the native-runtime integration boundary.
- Tried: pure parsing for CSS, XPath, JSONPath, regex, declarative HTTP tasks, standard WebView login with header/Cookie bridging, the bundled direct-link fixed-prefix expression, and WebView-only page injection. None safely executes the user-supplied login UI/check scripts or provides a sandboxed general rule runtime.
- Native work: expose and verify execution interruption/cancellation and memory/stack limits in the host module, then pin/configure the matching target package and define the Legado host APIs, Cookie/request and login-UI bridges, and compatibility tests. Merely adding the existing 1.0.1 package is insufficient. No `ios/` or `android/` source is changed by this migration.
- Acceptance (current scope: independent iOS simulator): execute representative Legado JS, custom-login and source-callback fixtures deterministically; audio custom-button and copy-play-URL callbacks receive the expected book/chapter/result values; task login checks observe the isolated Cookie state; timeout, memory, network, UI-cancellation and exception paths are verified without exposing unrestricted native APIs.

## Imported PDF reader

- Reason: React Native core, the HTYF JS SDK, and currently pinned modules provide no cross-platform in-tree PDF renderer. `@react-native-documents/viewer` is allowlisted but not pinned and launches platform UI rather than an HTYF reader.
- Impact: PDF export works, but importing and reading an existing PDF inside the bookshelf is unavailable. Unsupported files are skipped with a visible message.
- Tried: WebView is not a consistent Android local-PDF renderer; system URL opening does not preserve an in-app reading/progress flow.
- Native work: pin an approved renderer or provide separately authorized Android PdfRenderer/iOS PDFKit bindings with page events, zoom, memory limits and document access handling.
- Acceptance: open local/content-provider PDFs on both platforms, paginate/zoom, preserve progress, handle encrypted/corrupt files, rotate safely, and remain inside the HTYF page tree.

## OS ebook associations

- Reason: registering EPUB/PDF/MOBI handlers requires Android manifest and iOS document-type changes; no JS or HTYF SDK API can register them at runtime.
- Impact: the in-app picker imports TXT/EPUB and supported MOBI/PalmDOC files, but opening additional ebook MIME types directly from another app is not guaranteed.
- Tried: React Navigation linking handles delivered `file:`/`content:` URLs, but cannot declare OS ownership.
- Native work: separately authorize and add narrowly scoped MIME/UTType declarations, then validate cold/warm start URL delivery.
- Acceptance: supported documents route to `LocalBookImport` on cold and warm launch on both platforms, cancellation is safe, and unrelated links are not claimed.

## Custom reader fonts

- Reason: `expo-font` is allowlisted but not version-pinned in the target; React Native core cannot persistently register arbitrary user font files.
- Impact: built-in system typography works; custom font import and selection are unavailable.
- Tried: `fontFamily` only selects fonts already bundled by the OS/application.
- Native work: pin/configure `expo-font`, copy selected files into app storage, validate font metadata, load/unload safely, and map persisted choices.
- Acceptance: valid TTF/OTF fonts survive restart on Android/iOS, invalid files fail visibly, and reader layout/accessibility remains stable.

## Background download and boot recovery

- Reason: the current FS downloader is foreground-only; approved background downloader/runtime packages are not pinned.
- Impact: queued downloads recover when the app returns, but are not guaranteed to continue after process death or reboot.
- Tried: foreground `downloadFile` with MMKV queue, retry, cancellation and interrupted-state recovery.
- Native work: pin/configure an allowlisted background downloader and platform scheduling, including notification/channel and boot policies.
- Acceptance: large downloads continue through background/process termination as supported, recover after reboot, expose cancellation/progress, and never duplicate or corrupt files.

## Background auto-task scheduling

- Reason: React Native timers and the HTYF JS SDK do not guarantee execution while suspended, after process death or after reboot; no approved background scheduler is version-pinned in the target.
- Impact: enabled Cron tasks now run continuously while foregrounded, with due-task checks on launch/resume. They are not represented as running reliably at their scheduled wall-clock time in the background.
- Tried: persisted five-field Cron schedules, foreground timers, foreground/resume due-task evaluation, first-run grace, deduplication and run logs. A real iOS minute-boundary refresh is recorded in `.htyf-migration/book-update-tasks-report.md`. JavaScript timers cannot survive platform suspension or process termination.
- Native work: pin and configure an allowlisted background scheduler/action runtime with Android/iOS policy-compliant registration, cancellation, power handling and user-visible status.
- Acceptance: representative tasks run once at their due time through background, restart and reboot scenarios supported by each platform; missed-run policy, duplicate prevention, cancellation, battery impact and visible failure logs are verified.

## Automatic-task system notifications

- Source: `model/AutoTaskProtocol.kt` notify actions and refreshToc new-chapter notifications.
- Reason: the pinned HTYF JS SDK 0.2.25 and configured native modules provide no local OS-notification bridge. No replacement native dependency or native project change was introduced.
- Impact: task refresh, new-chapter detection and run logs work, but system notifications are skipped. The protocol returns false/skipped and writes an application log; it never claims delivery or replaces the OS notification with a success toast.
- Tried: checked the installed SDK declarations and pinned dependency set. Bluetooth characteristic notifications and haptics are unrelated capabilities. Payload construction retains source IDs, templates, length limits, priority and minimum new-chapter threshold behind an injectable notification boundary.
- Native work: provide a host-supported, version-pinned local notification API with authorization/status checks, stable identifiers and lifecycle handling. `TODO(htyf-native)` is at `src/services/autoTaskProtocol.ts`.
- Acceptance: on iOS, permitted notifications display the expected title/content and stable replacement ID; denied/unavailable delivery stays skipped, zero new chapters does not notify, and task results remain independent of notification permission. Dedicated Simulator refresh evidence does not establish OS notification delivery.

## Legacy Room/SQLite backup import

- Reason: React Native core and the HTYF JS SDK cannot query Android Room/SQLite files, and no read-only SQLite adapter is currently configured and version-pinned.
- Impact: recognized Legado JSON backup datasets restore transactionally; raw database, WAL and SHM files are skipped with a visible warning instead of being decoded as text.
- Tried: JSON export conversion covers books, groups, bookmarks, highlights, sources and rules; treating SQLite bytes as JSON/text is unsafe and cannot preserve relational data.
- Native work: approve and pin a read-only SQLite adapter, copy the database to an isolated temporary location, validate schema versions and map rows transactionally without executing bundled extensions.
- Acceptance: representative supported schema versions import on Android/iOS, WAL databases are consistent, corrupt/unknown schemas fail visibly, temporary files are removed and existing MMKV data is unchanged until confirmation.

## Floating or picture-in-picture video playback

- Reason: React Native core and the HTYF JS SDK do not expose a cross-platform overlay/PiP lifecycle, and no currently configured allowlisted module provides it.
- Impact: normal video playback, fullscreen, progress, rate, episode switching and downloads remain available, but no system floating window is offered.
- Tried: an in-tree overlay cannot remain visible outside the app; Android overlay services/platform PiP and iOS AVKit lifecycle require native integration.
- Native work: select and pin an approved cross-platform PiP module or separately authorize platform bindings, lifecycle/background declarations and permission UX.
- Acceptance: enter/leave PiP on both platforms, preserve playback/progress, handle controls, background/foreground and rotation, without requesting unrelated overlay permission.

## Stale AsyncStorage native build references

- Reason: runtime code and `package.json` use only the dedicated MMKV store, but `android/build.gradle` still references the removed AsyncStorage local Maven project and `ios/Podfile.lock` still records its old pod. No JavaScript, React Native API or HTYF JS SDK setting can remove those native build records.
- Impact: Android configuration currently fails before compilation with `Project with path ':react-native-async-storage_async-storage' could not be found`; a clean iOS pod install may also retain/fail on the stale lock entry. Runtime code does not use AsyncStorage.
- Tried: verified package dependencies, runtime imports and React Native autolinking inputs; the only active Android reference is the hand-written Gradle repository block, not generated JS configuration.
- Native work: separately authorize removal of the AsyncStorage Maven block from `android/build.gradle`, regenerate CocoaPods state without AsyncStorage, then confirm no native or JS reference remains.
- Acceptance: clean Android `assembleDebug` and iOS Simulator builds pass; repository-wide AsyncStorage scan is empty except migration history/documentation; MMKV namespace remains `io.legado.htyf.application-storage` and persists across restart.

## Remaining native declarations

- Reason: application identity, privacy manifests, platform capabilities and permission declarations require native project edits. The current template still declares Android `com.apps` and iOS `org.reactjs.native.example...`; JavaScript cannot replace these identifiers or add background modes.
- Impact: the HTYF UI and dedicated MMKV namespace identify Legado correctly, but install/package identity is still the template identity. Foreground audio works, including the persisted media-button segment/chapter policy while the player route is active; reopening adjacent chapters from a terminated/background-only JS runtime and other reliable background-audio behavior cannot be claimed as complete.
- Tried: `app.json` display metadata, the dedicated MMKV ID, React Native runtime permission APIs, TrackPlayer foreground playback and orientation APIs. None changes bundle/application identifiers, Info.plist background modes, manifests, privacy files or entitlements.
- Native work: separately authorize Legado-specific Android namespace/applicationId and iOS bundle identifier/product metadata, then minimally review Info.plist privacy/background modes, privacy manifest, entitlements and Android manifest permissions/services.
- Acceptance: clean Android/iOS installs expose the approved Legado identifiers/name/icon, upgrade and MMKV persistence behavior is documented, foreground/background audio behaves according to declared policy, store/privacy checks pass, and every declaration is exercised without requesting unrelated access.

## RAR and 7z remote-book archives

- Reason: the configured, version-pinned `react-native-nitro-unzip` runtime only extracts ZIP files. React Native, the HTYF JS SDK and the other configured allowlisted modules do not decode RAR or 7z archives.
- Impact: remote TXT/EPUB/MOBI/PalmDOC books and ZIP archives can be imported; RAR/7z entries remain visible but show an explicit unavailable state and cannot be selected.
- Tried: direct ebook import, ZIP extraction with traversal/entry-count/depth/expanded-size limits, and inspection of the configured dependency set. Treating RAR/7z bytes as ZIP or text is unsafe and cannot preserve archive semantics.
- Native work: select and version-pin an allowlisted cross-platform archive runtime with RAR/7z support, then connect it at the existing remote archive boundary without editing the WebDAV browser or import pipeline.
- Acceptance: representative nested RAR and 7z archives import all supported ebooks on Android and iOS; encrypted/corrupt/oversized/path-traversal archives fail visibly; cancellation and temporary-file cleanup are verified.

## Reader header/footer battery values

- Reason: React Native core, the HTYF JS SDK, and the currently configured version-pinned modules expose no battery level API.
- Impact: reader header/footer templates support book, chapter, time, page, total-page, progress and chapter-count placeholders; `{电量}` and `{电量图标}` render explicit `--%`/`▱` degraded placeholders instead of stale or fabricated data.
- Tried: inspected React Native APIs, the HTYF JS SDK and configured modules; status-bar visibility does not expose the system battery value to JavaScript.
- Native work: approve and version-pin a narrowly scoped cross-platform battery provider, then bridge level updates into the existing template value object.
- Acceptance: both platforms update percentage and icon buckets while charging/discharging, handle unavailable permission/service states, stop listeners on reader exit, and leave all non-battery templates unchanged.

## LAN and persistent-background web service

- Reason: the configured Nitro HTTP Server can safely run from JavaScript and recover when the application returns to the foreground, but advertising/listening for other LAN devices and reliable execution while suspended require platform privacy declarations and background-service lifecycle work.
- Impact: the Web service screen provides a token-protected loopback server with the core bookshelf, chapter-list, chapter-content and progress routes. Other devices cannot connect, and the service is not represented as continuously available while the app is suspended or terminated.
- Tried: React Native APIs, the HTYF JS SDK, loopback binding through the already configured `react-native-nitro-http-server`, and its foreground-recovery option. JavaScript cannot add iOS local-network privacy strings, Android foreground-service declarations/notification behavior, wake locks or platform background policy.
- Native work: separately authorize the minimum local-network privacy/manifest declarations, bind to a user-confirmed LAN interface, add authenticated foreground/background lifecycle handling and disclose the reachable address without broad network discovery.
- Acceptance: clean installs on Android and iOS explain/request only required access; a second LAN device reaches authenticated routes; suspend/resume, network changes, screen lock and process termination have explicit tested behavior; stopping the service releases the port and notification; unauthenticated writes are rejected.

## Legacy native-only preference controls

- Reason: the Android preference page includes switches for wake locks/background service behavior and runtime participation in platform text actions. Pure JavaScript, React Native core and the HTYF JS SDK cannot add or remove platform service/intent declarations, and no additional configured allowlisted module provides a truthful cross-platform runtime toggle.
- Impact: the migrated general-settings route provides the JS-backed default page, tab visibility and source/RSS User-Agent settings. Native-only switches are deliberately omitted and the screen explains this instead of persisting values that cannot affect behavior. Existing declared intent/audio behavior is unchanged.
- Tried: React Navigation state, the isolated MMKV preference model, AppState foreground recovery, React Native Linking and the already configured media/runtime modules. These can react after the app is active but cannot change build-time declarations or guarantee suspended/process-death execution.
- Native work: after separate authorization, define the minimum platform declarations and lifecycle handlers, expose a narrowly scoped configured JS API for each supported toggle, and add policy-compliant user feedback. Do not reintroduce Android-only controls on iOS without an equivalent state.
- Acceptance: every displayed switch changes observable behavior on supported Android/iOS versions, persists across restart, accurately reports unsupported/denied states, survives suspend/resume according to documented policy, and disabling it removes the behavior without requiring unrelated permissions.

## Global WebView website-data deletion

- Reason: the configured `react-native-webview` exposes `clearCache` only through a currently mounted WebView ref and provides no cross-platform global API for deleting all cookies, DOM storage, databases and website data. React Native core and the HTYF JS SDK do not expose those stores.
- Impact: the general-settings maintenance section can safely clear all files under the application cache directory and compact the dedicated MMKV store. Each source login can clear its isolated app-managed Cookies. Native WebView website data belonging to unmounted pages cannot be represented as globally deleted, so the original Android “clear WebView data and restart” action is shown as unavailable rather than reporting false success.
- Tried: configured WebView `clearCache(true)` on mounted instances, incognito/cache-disabled login WebViews, per-source MMKV Cookie deletion, app-cache filesystem cleanup and React Native restart APIs. A mounted ref does not cover unmounted/shared native WebView stores, and deleting undocumented private native directories from JS is unsafe and non-portable.
- Native work: expose or configure an approved narrowly scoped cross-platform website-data API that clears the intended HTTP cache, cookies, DOM storage and databases, reports partial failures, closes active WebViews safely and restarts only when required by the platform.
- Acceptance: seed cache/cookies/localStorage/IndexedDB in multiple mounted and unmounted origins, run the action on Android and iOS, verify all selected data is gone after restart while MMKV books/rules and document downloads remain intact, and verify cancellation/failure never claims success.

## Reader keep-awake timeout

- Reason: React Native core and the HTYF JS SDK do not provide a scoped keep-screen-awake API. `@sayem314/react-native-keep-awake` and `expo-keep-awake` are allowlisted but neither is version-pinned/configured in this target. The configured orientation and volume modules cannot change idle-timer policy.
- Impact: the shared reader-settings route supports typography, themes, paging, orientation, header/footer, manga behavior and hardware volume-key paging. The reader follows the normal platform screen timeout and does not expose an ineffective “keep screen on” option.
- Tried: React Native AppState/StatusBar, timers, the HTYF JS SDK, configured `react-native-volume-manager` and `react-native-orientation-locker`. JavaScript activity and orientation do not safely acquire/release the platform idle-timer lock.
- Native work: version-pin and configure one allowlisted keep-awake module, scope activation to a focused reader, support the Android timeout choices where feasible, and always release the lock on blur, background, error and unmount.
- Acceptance: on Android and iOS, focused reading stays awake only for the selected policy; navigating away, backgrounding or disabling immediately restores normal timeout; repeated mounts do not leak locks and battery impact is disclosed.

## Reader whole-paragraph long-press selection

- Reason: React Native core `Text` provides normal native long-press selection through `selectable`, but it exposes no cross-platform API for setting the system selection start/end range. The HTYF JS SDK and configured allowlisted modules do not add that API.
- Impact: the Android-compatible “long press to select text” preference is implemented and defaults on. Users can select and adjust text with the platform handles. The separate Android option that automatically expands the initial selection to the entire paragraph is unavailable; text containing geometry-based highlight decorations retains its decoration and may not expose a continuous native selection range.
- Attempted approaches: evaluated `Text.selectable`, press/long-press responders, clipboard APIs, nested `Text`, and the configured enriched HTML/Markdown renderers. Responders can identify a paragraph but cannot move the platform selection handles, while replacing native selection with an app overlay would lose standard accessibility and text actions.
- Native work: expose a narrowly scoped cross-platform selectable-text component or selection-range command that supports paragraph boundaries, standard copy/share actions, accessibility, bidirectional text, nested highlight spans and selection-handle movement without a full-window overlay.
- Current fallback: normal React Native text selection is controlled by the persisted reader preference; no ineffective whole-paragraph switch is shown.
- Manual acceptance: on Android and iOS, enable whole-paragraph mode, long-press the middle of a multi-line paragraph, verify the exact paragraph (and no adjacent text) is initially selected, then adjust both handles and execute standard text actions with TalkBack/VoiceOver enabled.
- JS integration: `src/index.tsx` contains `TODO(htyf-native)` at the paragraph reader boundary.

## Theme preset platform-only visual fields

- Reason: Android `ThemeConfig` includes `transparentNavBar` and bitmap `backgroundImgBlur`. React Native core cannot control the Android system navigation-bar transparency or reproduce Android bitmap blur consistently, and the HTYF JS SDK/configured cross-platform appearance layer exposes neither capability.
- Impact: theme preset names, day/night mode, four colors and local/remote background image paths import, save, apply, delete and share normally. The two platform-only fields remain losslessly stored/exported but are visibly identified as not applied.
- Tried: root opacity/transparent backgrounds, StatusBar, edge-to-edge layout, CSS-style image props and configured React Native image rendering. These do not control the system navigation bar or supply equivalent bounded bitmap blur on both platforms.
- Native work: expose an approved cross-platform navigation-bar appearance API and a version-pinned blur/image pipeline, then apply the imported fields without moving dialogs or navigation outside the HTYF tree.
- Current fallback: no fake visual change; the theme-list sheet explains the limitation while retaining the original JSON fields.
- Acceptance: import representative day/night Android themes with transparent navigation bars and blur 0/10/100; verify matching visuals, rotation/safe-area behavior, background image performance and restoration on Android/iOS, and confirm re-export is lossless.
- JS integration: `src/screens/AppearanceSettings.tsx` contains `TODO(htyf-native)` beside the compatibility note.

## Application font scale, wallpaper colors and status-bar transparency

- Reason: Android Legado overrides `Configuration.fontScale`, reads system wallpaper colors and toggles platform status-bar window flags. React Native core exposes the system font multiplier and `StatusBar` presentation, but it cannot override the application `Configuration`, subscribe to Android wallpaper color changes, or provide an equivalent iOS wallpaper palette. The HTYF JS SDK and configured modules expose none of these capabilities.
- Impact: system accessibility font scaling, manual day/night theme colors, safe-area layout and the template's existing edge-to-edge status-bar behavior remain active. A separate 0.8–1.6 application font override, wallpaper-follow/auto-update switches and runtime transparent-status-bar toggle are not shown as working controls. The independently compatible 0–32 toolbar elevation setting is implemented in JavaScript for shared headers and the root bottom bar.
- Attempted approaches: evaluated `PixelRatio.getFontScale()`, `Text.allowFontScaling`/`maxFontSizeMultiplier`, React Native `StatusBar`, transparent root views, the HTYF capsule API and configured image-color modules. They can observe or bound system scaling and style app content, but cannot reproduce Android configuration override/window flags or access the user's wallpaper palette cross-platform.
- Native work: expose approved, narrowly scoped APIs for application font-scale override and status-bar window appearance, plus a privacy-reviewed cross-platform dynamic-color provider with lifecycle change events and an explicit unsupported iOS state where wallpaper access is unavailable.
- Current fallback: the appearance route explains the unavailable system fields, keeps system font accessibility behavior and manual colors, and does not persist ineffective switches.
- Manual acceptance: choose font scales 0.8/1.0/1.6 and verify every screen, capsule header and overlay relayouts without clipping; toggle status-bar transparency through rotation/light-dark changes; enable wallpaper following and verify palette updates, restart persistence, privacy disclosure and an accurate unsupported state on platforms without wallpaper access.
- JS integration: `src/screens/AppearanceSettings.tsx` contains `TODO(htyf-native)` beside the safe fallback note.

## Reader text-selection action menu

- Reason: Android Legado intercepts `ActionMode` and owns the selected-text range so it can partition and reorder Replace, Copy, Bookmark, Highlight, Dictionary, Search, Browser, Share and PROCESS_TEXT actions. React Native core `Text.selectable` exposes neither the selected string/range nor the native action-menu model, and the HTYF JS SDK/configured modules provide no equivalent API.
- Impact: normal adjustable system selection and its standard platform actions remain available. The Android “Customize selection menu” entry is shown as unavailable in reader settings; custom bar/More ordering and Legado-specific actions cannot be represented truthfully.
- Attempted approaches: evaluated `Text.selectable`, responder/long-press handlers, Clipboard, custom tree-internal action sheets, enriched text renderers and accessibility actions. A custom sheet cannot operate on the native selected range, while replacing native selection would regress selection handles, bidirectional text, accessibility and platform PROCESS_TEXT behavior.
- Native work: provide an approved selectable-text component or narrowly scoped selection/action-menu bridge that reports the selected range/text, preserves native handles and accessibility, exposes available PROCESS_TEXT actions, and accepts a normalized ordered bar/More configuration on Android with a documented iOS equivalent or fallback.
- Current fallback: reader settings visibly explain that the system selection menu is used; no inert configuration is persisted.
- Manual acceptance: select text spanning nested highlight/link runs on Android and iOS; verify configured built-in actions receive the exact range, bar/More order persists across restart, PROCESS_TEXT actions remain reachable, handles and TalkBack/VoiceOver still work, and unsupported platform actions degrade visibly.
- JS integration: `src/screens/ReaderSettings.tsx` contains `TODO(htyf-native)` beside the unavailable configuration state.

## MCP source execution tools

- Reason: Android's `eval_js` and JavaScript-dependent portions of `debug_source` / `check_source` execute book-source JavaScript through Rhino. No pure TypeScript, React Native API, HTYF JS SDK, or configured allowlisted native module provides an equivalently sandboxed, cancellable runtime.
- Impact: declarative sources are now checked and debugged normally, including bounded batch progress and per-source results. Sources that reach an arbitrary JavaScript rule are reported as unsupported; only `eval_js` remains entirely unavailable.
- Attempted approaches: evaluated plain JavaScript `eval`, React Native APIs, HTYF JS SDK, and the target's configured modules. Plain `eval` is not isolated or safely cancellable and therefore is not an acceptable substitute.
- Native work: version-pin and security-review a cross-platform sandbox such as `react-native-quickjs-sandbox`, expose bounded execution/cancellation, and wire the existing source rule bridge without editing native projects ad hoc.
- Manual acceptance: connect an MCP Streamable HTTP client to `/mcp`; verify safe declarative `debug_source` and `check_source` succeed, JavaScript-dependent sources return an explicit unsupported result, then validate cancellation, timeout, network isolation and malicious-script cases before enabling `eval_js` or JS rules.
- JS integration: `src/data/mcpService.ts` contains `TODO(htyf-native)` at each safe fallback.

## Custom DNS/Hosts and Cronet transport

- Reason: React Native `fetch`, the HTYF JS SDK, and the currently configured Nitro HTTP server do not expose per-request DNS resolution, TLS SNI routing, or a Cronet client. Rewriting HTTPS URLs to an IP breaks certificate/SNI validation and setting a `Host` header is not an equivalent safe implementation.
- Impact: requests use the platform React Native HTTP stack and system DNS. The Android `customHosts` editor and Cronet switch are intentionally omitted instead of exposing non-functional controls.
- Attempted approaches: evaluated URL-to-IP rewriting, request `Host` headers, React Native networking APIs, HTYF JS SDK, and configured native modules. None preserve HTTPS hostname verification, redirects, cookies, WebSockets, and source isolation.
- Native work: version-pin an allowlisted networking module that supports custom DNS and Cronet-equivalent transport on both platforms, then expose a JS request adapter without editing `ios/` or `android/` ad hoc.
- Manual acceptance: verify HTTP/HTTPS custom-host routing with valid SNI, redirects, CookieJar, cancellation, timeout, uploads, downloads and WebView/source-login identity on Android and iOS.
- JS integration: `src/screens/GeneralSettings.tsx` contains `TODO(htyf-native)` at the omitted controls.

## Native heap dump and global image-cache tuning

- Reason: JavaScript, React Native APIs, the HTYF JS SDK, and configured modules cannot create Android heap dumps or resize the platform image decoder/cache globally.
- Impact: bounded application and HTTP logs remain available; image caching uses the configured RN image/filesystem paths. Heap-dump recording, Android bitmap-cache sizing and renderer anti-alias toggles are unavailable.
- Attempted approaches: evaluated MMKV diagnostics, filesystem APIs, RN `Image`, and configured modules. These can record JS data or manage application-owned files but cannot control the VM heap or native decoder cache.
- Native work: provide reviewed platform diagnostic/image-cache APIs with storage limits, consent and privacy handling.
- Manual acceptance: confirm opt-in heap capture, export/cleanup, memory limits and image-cache size behavior on physical Android devices, plus a documented iOS fallback.
- JS integration: `src/screens/GeneralSettings.tsx` contains `TODO(htyf-native)` next to diagnostic settings.

## Independent Web and MCP listeners

- Evidence (iOS, 2026-10-28): starting MCP while Web was active closed port 1122 while both logical status objects still reported running. The pinned `react-native-nitro-http-server@1.9.2` JavaScript wrapper shares one hybrid object; `cpp/HybridHttpServer.cpp` uses global `g_serverContext`/`g_serverPort`, and the shipped C API has one `start_server`/`stop_server` pair.
- Current behavior: a serialized application-owned coordinator prevents a second logical listener from replacing the active one. It reports a visible conflict and never stops the other service when an inactive service is stopped. Web remains HTTP 200 after the conflict; stopping Web allows MCP initialization at port 1236. Unit tests cover concurrent starts and startup failures.
- Parity status: blocked for simultaneous listeners. This guard is not equivalent to the source's two independent services. An approved host runtime supporting independent listener IDs/ports is still required; existing native source/dependency pins remain unchanged.
- Acceptance (requested iOS scope): authenticated Web and MCP operate concurrently on their configured ports, each can stop/restart without affecting the other, and foreground recovery keeps handler/port ownership correct.

批量换源现已实现并在独立 iOS 验证两本章节迁移、2 秒间隔、真实取消与私有字段保留；见 ../.htyf-migration/batch-source-change-report.md。完整主题/字体/手势、备份偏好和标注映射矩阵仍待验收。构建触发 JS 刷新时旧 native Web listener 的生命周期问题已记录，冷启动可恢复但尚未修复。

媒体备份跟进：HTYF ZIP/WebDAV 已携带所选固化封面、其他封面及阅读背景，独立 iOS 验证跨设备路径、摘要失败拒绝、确认前暂存/取消、恢复、分类排除及完全离线冷启动；见 ../.htyf-migration/backup-media-report.md。HTYF 当前已改为类别合并并支持十项恢复忽略；原版配置 XML/多套阅读布局、设备阅读记录、旧版章节位置、文件提供方/大文件/低空间/中断矩阵和完整 Web 图片/页面矩阵仍待完成，未据媒体子链路认定全量备份恢复通过。

Web 封面跟进：原生规格 84×112 centerCrop PNG、失败默认图、三层封面以及请求凭据隔离已实现，独立 iOS 验证坏图、三秒取消、同 ID 切换固化层和断源冷启动。详情见 ../.htyf-migration/web-cover-report.md。完整 Vue Web UI、getImg 宽度/漫画处理、图片格式/大图/内存、默认封面文字及触摸/AX 矩阵仍 pending；热刷新 native listener 问题未修复。

恢复策略跟进：已实现目标 JSON 类别的 upsert、替换型规则例外、十项忽略、设备配置保护、忽略背景不激活和事务回滚。实际 iOS 以单书部分备份验证七本记录保留、预览取消、主题/语言字段隔离及冷启动选择持久化；见 ../.htyf-migration/restore-policy-report.md。原版配置解析、章节/标注/设备记录和系统失败矩阵仍有缺口。


续读跟进：旧版 JSON 在线文字书已保留原章节/字符位置并加载完整目录；普通文字分页切片、UTF-16 与真实行测量滚动定位有独立 iOS 证据，见 ../.htyf-migration/reading-position-report.md。XML/多套阅读布局、复杂富文本/媒体/旧注释坐标、物理手势与后台矩阵仍未完成。用户真机 0.0.22 layout 空事件缺陷已本地复现并修复为 0.0.23，见 ../.htyf-migration/host-layout-crash-report.md；新包真机加载仍待复测。


正文格式跟进 / Content formatting follow-up (0.0.33): `src/core/htmlFormatter.ts` now matches 639 native formatting, HTML4 entity, image-URL, final-paragraph and dollar-anchor cases. Actual online extraction and source-wide replacement use the native cleanup order. Independent iOS verifies separate single-newline paragraphs, literal tags, and measured scroll-reader restoration at UTF-16 cursor 352. See [acceptance](testing/content-format/README.md). Complete ContentProcessor title removal/resegmentation/conversion/replacement behavior, intro/EPUB/rich-media/image-request-option rendering, Java regex/URL handler edge cases, physical gestures and real HTYF-host acceptance remain pending.

重复标题跟进 / Duplicate-title follow-up (0.0.35): `chapterTitle.ts` now matches 1,203 native matcher/removal-flag cases; `chapterTitlePolicy.ts` matches native index/title-MD5 `.nr` identities. Removal is automatic, exclusions are per chapter, and UI state reflects an actual match. Independent iOS verifies retain/restart/re-enable and unmatched content, with raw cache unchanged; see [acceptance](testing/chapter-title/README.md). The target stores these logical filename identities in the existing MMKV Book data, without creating filesystem `.nr` files. Importing those files from legacy backups remains pending. Complete ContentProcessor conversion/resegmentation/replacement order and invalidation, Unicode/locale edge matrices, intro/EPUB/rich-media rendering and full host/visual/gesture acceptance remain open. The older 0.0.33 paragraph above is historical scope, not a claim that title matching remains wholly unimplemented.

重分段跟进 / Resegmentation follow-up (0.0.36): `contentReSegment.ts` ports the complete ContentHelp algorithm, retaining probabilistic splitting and UTF-16 indexing. All 1,220 fixed-random-input native outputs/call counts and four cached real-chapter comparisons match. Independent iOS verifies per-book toggles, 23 native paragraphs, 45 random paragraphs stable across two menu redraws, and setting persistence across cold start; see [acceptance](testing/resegment/README.md). General Chinese conversion remains unimplemented: the source uses quick-transfer-core 0.2.17 and a custom T2S exclusion list, and the target has no equivalent preference/converter yet. Complete replacement/special-HTML/invalidation integration, random reflow position behavior, Unicode/locale edges and whole-application visual/gesture/host acceptance remain pending.

繁简转换跟进 / Chinese conversion follow-up (0.0.37): the pinned 0.2.17 S2T/T2S dictionaries and native 112-entry exclusion list now power reader text, display titles and TOC titles. All 62,804 dictionary keys, 1,422 explicit inputs and 36 resegmentation/conversion pipeline cases match the original wrapper/JAR. Independent iOS verifies settings, post-conversion title/content rules, TOC cleanup toggling, mode persistence across cold start, standalone-settings return synchronization and disabling; see [acceptance](testing/chinese-conversion/README.md). Native checked action state and body-only effective-rule listing are also aligned. No npm/native dependency was added; Apache 2.0 attribution/license accompanies the data and production banner. The older 0.0.36 paragraph describes that release's scope. Complete Java-regex timeout/cancellation and HTML/invalidation integration, converted position/annotation/consumer matrices, original AppConfig XML restore, asynchronous dictionary preload/unload lifecycle, extreme Unicode/invalid preferences and full visual/gesture/host acceptance remain pending.

替换语义跟进 / Replacement follow-up (0.0.38): default SQLite LIKE scope matching, significant pattern/scope whitespace, Java Matcher replacement strings and reader enablement/Kotlin line trimming now match 5,315 finite reference cases. The reader consumes output, changed-rule hits and issues from one body pass. Dedicated iOS verifies scoped/wildcard matching, replacement groups/escaping, failure continuation, hit/error listing, scoped editor previews and cold start; see [acceptance](testing/replace-rule-semantics/README.md). This does not complete Java Pattern language/ICU parity, deadlines/cancellation/Rhino, special HTML/conversion/invalidation order, original global manual configuration, all normalization/default-order/import fields, other consumer error feedback or coordinate/export/audio matrices. A disabled single-page progress slider exposes AX NaN and remains pending. Existing nine books/eight sources/rules remain identical; no dependency/native changes. Remote config is 0.0.34; local 0.0.38 was not published.

正文处理顺序跟进 / Reader pipeline follow-up (0.0.39): cached HTML/images are decoded before native content processing and adapted only after final paragraphs. Exact getContent HTML placeholders, LF-only flattening, collision/ordered restoration and fetch-time adaptation preference are aligned across 2,280 native cases, 12 controlled cache cases and six real-cache cases. Dedicated iOS verifies conversion inside protected HTML, image URL rules, cached literal markup when disabled, fetch-time cleanup on refresh and finite single-page AX progress; see [acceptance](testing/reader-native-content/README.md). Original nine books/eight sources/rules remain unchanged. Full Java/ICU regex, deadlines/Rhino/error/invalidation, original config/XML, legacy EPUB semantic markers/multi-page bases, image options/clicks, layout/position/consumer matrices, development warnings and real-host acceptance remain pending. No dependency/native changes; local 0.0.39 remains unpublished.


书内搜索跟进 / Content search follow-up (0.0.40): native cached-content processing, explicit submission, process-only regex/cleanup defaults, no 100-result cap, UTF-16 excerpts and occurrence-ordinal navigation are aligned across 1,738 native cases. Dedicated iOS verifies 125 hits, case/regex, conversion/cleanup, uncached skipping and cross-chapter navigation; see [acceptance](testing/content-search/README.md). Original records are retained, with no dependency/native changes. Remaining: Android HtmlCompat-rich snippets, native text selection/full image/layout positions, restoration of selected-result list scroll, full Java/ICU and bounded interruption, raw read-aloud title, export/Web content consumers, and an observed unescaped-space URL counterexample (`/http://127.0.0.1:18211/search`). This control fixture succeeds with the no-space query; URL handling is not yet fixed. Local 0.0.40 is unpublished and the full goal remains incomplete.

地址与编码跟进 / URL and encoding follow-up (0.0.41): the 0.0.40 spaced-query counterexample is fixed under the installed RN URL runtime. Source vs parsed-resource base contracts, relative paths, native query/form bytes, literal navigation words and explicit response-header charset precedence match 6,696 finite JVM/Hutool cases and device network traces. Dedicated iOS SourceDebug passes spaced GET/retry, GBK form/UTF-8 response and fresh real-source search/details/105-entry TOC/front matter; see [acceptance](testing/source-url/README.md). Normal search/add/read, the fixture's second chapter and image rendering are not accepted in this slice. ZIP-exported original nine books/eight sources/rules are unchanged; temporary sources are removed and Web/MCP/tasks remain off after cold start. No dependency/native changes; local 0.0.41 is unpublished. Remaining: native headerless HTML-meta/ICU4J CharsetDetector, complete Charset/Android protocol-handler and custom body/header/wire semantics, other runtime URL consumers, arbitrary bounded Rhino, rich selection/image/layout/positions, read-aloud/export/Web content, original config/XML and full visual/gesture/physical-host matrices. Historical 0.0.40 notes describe that release; this follow-up closes only the evidenced URL/encoding subset, not full parity.

响应编码跟进 / Response encoding follow-up (0.0.42): HTML head/meta and source-bundled default ICU4J detection now match 3,398 native cases / 18,737 candidate records. Decoding matches a frozen ICU 77.1 profile with Java U+FFFD replacement semantics; 214 suites / 1,053 tests pass. Dedicated iOS verifies normal search/add/read across GB18030, GBK, ISO-2022-JP and conflicting-header UTF-16LE, then fresh real-source search/details/105 TOC entries/119-character front matter. See [acceptance](testing/source-response-encoding/README.md). All 25 existing normal-ZIP-export entries remain unchanged; temporary data is removed and cold start/services-off pass. No dependency/native changes; archive unpublished. Remaining encoding scope includes complete Java Charset aliases, other OS ICU/runtime mappings, extreme/deep HTML, error/cancellation and full request-wire/consumer behavior. Source-based debugging does not establish physical HTYF archive loading.

阅读记录与备份观察 / Read-record and backup observations (0.0.42): named iOS accessibility deletion now invokes each row's existing confirmation and preserves unrelated records. It does not change the target bookId data model. The native ReadRecordActivity aggregates by book name and its DAO deletes by name; complete grouping/statistics/deletion parity remains pending. A newly materialized `bookshelf.manage.delete-original.v1` preference was unchecked in UI but exported as `{type: "string", value: ""}` by the existing getter sequence. Existing entries are identical before/after; this proves preservation of those exported entries, not boolean type round trips. Verify and correct typed getters/restore under the actual host before accepting complete backup fidelity.

备份类型跟进 / Backup value types follow-up (0.0.43): the observed false→empty-string export is fixed using declared getters for all current scalar keys and a private persistent type index for unknown imported scalars. Backup and migration rollback now share typed snapshots and preserve the original index. All 214 suites / 1,060 tests pass. Dedicated iOS confirms normal ZIP exports and WebDAV restore of three actually exported typed values after changing them; all 26 pre-test entries are restored, with 9 books/8 sources/0 rules/12 records unchanged. See [acceptance](testing/backup-value-types/README.md). The older 0.0.42 note describes its observed defect; it no longer means all boolean backup support is missing. Two historical numeric keys currently expose only empty strings and remain unchanged, without inferred numbers. Unknown old unindexed values, complete unknown-index device/error matrices, binary values, native XML/multiple configurations, low-space/repeated-write-failure/process interruption and full physical-host/visual/gesture acceptance remain open. Exception rollback is not a crash-atomic transaction. No dependency/native changes; archive unpublished.

阅读记录跟进 / Read records (0.0.44): the historical bookId-only gap is closed for the evidenced title/device identity, grouped SQL search/stats, native author codec/index, deletion/activation, sorting/recording settings and valid native readRecord.json backup subset. 4,717 finite unchanged-source JVM/SQLite cases and 217 suites / 1,085 tests pass; dedicated iOS verifies normal native ZIP restore, author/SQL wildcards, persisted controls and real off/on reader counters. See [acceptance](testing/read-records/README.md). Original data is unchanged; cleanup of three temporary groups/one timer book/one source is awaiting explicit user confirmation after automatic deletion approval rejection. Do not call the current 10-book/9-source/16-record state the baseline. Remaining: host Android ID mapping (private per-install adaptation used), malformed/null Gson record decoding, complete locale/ICU/calendar profiles, all reader/audio/manga/background timing lifecycles, full large-list/keyboard/font/rotation/capsule/VoiceOver/gesture/physical-host matrices and global XML/config/sync/export parity. Some flattened accessibility action labels were stale after reorder; deletion matched both current row and confirmation. Archive 0.0.44 is unpublished; source Simulator evidence does not prove physical archive loading.

原版记录备份解析 / Native record import (0.0.45): null list members and invalid Longs now reject the entire record file rather than being filtered/zeroed. Shared Gson token parsing preserves lexical numbers and ordered duplicate fields; native constructor defaults, nullable String coercion, Long double fallback and unknown-field discard match 769 finite unchanged-source cases. 218 suites / 1,092 tests, TypeScript and changed-file lint pass. Dedicated iOS confirms null/fraction rejection, explicit null-author restore failure and a valid lenient duplicate-field restore; all 27 normal-ZIP-exported entries are unchanged. Previous temporary data cleanup still awaits explicit consent; no deletion retry. Source/InputStream decoding is verified without Android/Room execution. Native partial writes after a mid-restore failure, full Gson/large/deep/encoding/category/configuration matrices and physical-host/global parity remain pending. Local 0.0.45 is unpublished; dependencies/native projects unchanged. See [acceptance](testing/read-record-import/README.md).

原版恢复中途失败 / Native restore interruption (0.0.46): native ZIP previews now follow source category order and per-record commits, retain successful prefixes on later failure, defer media until after data/preferences and auto tasks until after media, serialize concurrent restores and carry book ownership IDs across phases. HTYF backups retain their existing atomic contract. Native errors refresh committed state and use the neutral source title. All 84 finite unchanged-source sequences (72 failures / 12 controls), 219 suites / 1,105 tests, TypeScript and changed-file lint pass. Dedicated iOS proves earlier source order 1234 / remote counter 2000ms survive a later null-author error and cold start, while invalid/later records/servers are absent; restoring original fixture values returns all 27 entries exactly to baseline. See [acceptance](testing/native-restore-failure/README.md). Prior cleanup still awaits explicit consent; no deletion retry. Crypto preflight, all native schema/batch constraints, keyboard clear failures, media per-file faults, full XML/configuration, cancellation/process/repeated storage faults, huge imports, accessibility/global visual/gesture and physical-host matrices remain pending. No Android build, dependency or native-project changes; local 0.0.46 unpublished. The 0.0.45 partial-write gap is closed only for this evidenced subset, not the entire native restore pipeline.


敏感备份预校验 / Native sensitive-backup preflight (0.0.47): cookie and source-variable files now undergo fatal ordered validation before ordinary conversion/restoration, with current-local-password defaults, strict fields/exact nonnegative Longs/latest cache keys and no materialized empty rows. All 349 strict-parser cases, 336 native BackupAES/Hutool envelopes, 220 suites / 1,118 tests, TypeScript and changed-file lint pass. After transient CUA binding failures recovered, dedicated iOS verifies password-required rejection for cookies/plaintext caches, ordinary source-only preview/cancel and .47 UI identity; all 27 normal-exported typed entries remain equal before/after, matching the .46 final baseline. Final cold start renders 10 books/9 in reading; Web/MCP/tasks remain off and fixture server is stopped. Correct-password decryption and ignore-switch device matrices remain pending. All UI inputs used CUA; no deletion retry. Local .47 is unpublished; remote remains .34. Jsoup MIT notice is now included in the bundle banner after artifact inspection found its prior omission. No dependency/native/source-repository changes. CookieStore domain/session/merge/raw pipe rows, runtime consumers, exhaustive JSON/password/charset profiles, XML/config/DAO/logging/interruption/storage/large-input and whole-app/physical-host matrices remain open. See [preflight report](testing/native-restore-preflight/README.md). This is finite preflight progress, not complete backup/global parity.
