# music-tag Flutter 安卓端开发对接分析

## 1. 项目现状概览

- 后端技术栈: `Node.js + Express + SQLite (better-sqlite3)`
- 前端技术栈: `Vue 3 + Vite + Tailwind`
- 核心后端入口: `backend/src/index.ts`
- 当前核心能力:
  - 本地音乐库扫描与入库
  - 音频元数据刮削（网易/QQ/iTunes/LRCLIB）
  - 音频流播放（支持 `Range`）
  - 封面/歌词读取
  - 网易云与 QQ 音乐链接解析、下载、入库
  - 任务管理（扫描/刮削/下载/整理）

## 2. 数据层与领域模型

### 2.1 tracks 表（核心）

路径: `backend/src/db.ts`

主要字段:

- `id TEXT PRIMARY KEY`
- `filepath TEXT UNIQUE`
- `filename TEXT`
- `extension TEXT` (`.mp3/.flac/...`)
- `title/artist/album`
- `bitrate/sample_rate/duration/size`
- `scrape_status` (`0=Pending,1=Success,2=Failed,3=Ignored`)

用于 Flutter 的核心实体建议:

- `Track`
  - `id`
  - `title`
  - `artist`
  - `album`
  - `extension`
  - `duration`
  - `size`
  - `scrapeStatus`
  - `coverUrl`（派生）: `/api/tracks/{id}/cover`
  - `streamUrl`（派生）: `/api/tracks/{id}/stream`

### 2.2 tasks 表（异步任务）

路径: `backend/src/db.ts`, `backend/src/taskManager.ts`

支持任务类型:

- `scan`
- `scrape`
- `download_netease`
- `download_qq`
- `organize`
- `rename`
- `playlist_import`

用于 Flutter 的实体建议:

- `TaskItem`
  - `id`
  - `parentId`
  - `type`
  - `status`
  - `progress`
  - `message`
  - `logs`
  - `createdAt`

### 2.3 users 表（登录认证）

- JWT 登录，`/api/auth/login`
- 其余 `/api/*` 路由默认都要求鉴权
- 媒体流/封面可通过 `?auth=token` 方式传 token（前端已采用）

## 3. 现有 API 能力（Flutter 对接重点）

## 3.1 认证

- `POST /api/auth/login`
- `GET /api/auth/check`

登录响应示例:

```json
{
  "success": true,
  "token": "...",
  "user": { "id": "...", "username": "admin" }
}
```

## 3.2 音乐库与播放

- `GET /api/status`
- `GET /api/tracks?folder=&status=`
- `GET /api/tracks/:id/cover`
- `GET /api/tracks/:id/stream`（支持 Range，适合播放器拖动）
- `GET /api/tracks/:id/lyrics`
- `POST /api/tracks/:id`（编辑标签）
- `GET /api/proxy-image?url=`（规避外链 Referer 限制）

`GET /api/tracks` 返回结构:

```json
{
  "success": true,
  "data": {
    "folders": ["Downloads", "AlbumA"],
    "tracks": [
      {
        "id": "...",
        "title": "...",
        "artist": "...",
        "album": "...",
        "filepath": "...",
        "scrape_status": 1,
        "extension": ".mp3",
        "size": 12345678,
        "duration": 245.3,
        "hasLyrics": false
      }
    ]
  }
}
```

## 3.3 刮削与整理管理

- `POST /api/trigger-scan`
- `POST /api/trigger-scrape`
- `POST /api/reset-scrape-status`
- `POST /api/tracks/organize`
- `POST /api/batch-rename`
- `GET /api/tracks/duplicates`
- `POST /api/tracks/delete`

## 3.4 推荐与歌单（网易云）

- `GET /api/netease/recommend/playlists`
- `GET /api/netease/recommend/songs`
- `GET /api/netease/playlist/:id`
- `POST /api/netease/parse`
- `POST /api/netease/download`

## 3.5 QQ 音乐解析下载

- `POST /api/qq/parse`
- `POST /api/qq/download`

## 3.6 全局任务中心

- `GET /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/cancel`
- `POST /api/tasks/cleanup`

## 3.7 配置中心

- `GET /api/settings/config`
- `POST /api/settings/config`

当前配置字段:

- `neteaseCookie`
- `qqCookie`

## 4. Flutter 功能映射（对应你的目标）

你提出的目标: 播放列表、播放界面、推荐、收藏、歌单、管理。

### 4.1 已可直接落地（后端已支持）

- 播放界面
  - 音频播放：`/api/tracks/:id/stream`
  - 封面显示：`/api/tracks/:id/cover`
  - 歌词滚动：`/api/tracks/:id/lyrics`
- 播放列表（当前列表）
  - 通过 `/api/tracks` 拉取当前目录/筛选结果并本地构建队列
- 推荐
  - 每日歌曲：`/api/netease/recommend/songs`
  - 推荐歌单：`/api/netease/recommend/playlists`
- 歌单详情
  - `/api/netease/playlist/:id`
- 歌曲管理
  - 编辑标签、重命名、整理、去重、删除
- 下载导入
  - 网易/QQ 链接解析与下载任务

### 4.2 当前后端缺口（需新增）

- 收藏（我喜欢）
  - 目前无 `favorites` 表与接口
- 用户自建歌单（本地业务歌单）
  - 目前无 `playlists` / `playlist_tracks` 表与接口
- 历史播放/最近播放
  - 目前无持久化播放历史接口

## 5. Flutter 端建议架构

## 5.1 技术选型

- 状态管理: `riverpod`（或 `bloc`）
- 网络: `dio`
- 音频播放: `just_audio`
- 后台播放/通知栏: `audio_service` + `just_audio_background`
- 本地缓存: `isar` 或 `hive`
- 图片缓存: `cached_network_image`

## 5.2 目录结构建议

```txt
lib/
  core/
    http/
    auth/
    storage/
    player/
  features/
    auth/
    library/
    player/
    discovery/
    playlist/
    favorites/
    tasks/
    settings/
  shared/
    widgets/
    models/
```

## 5.3 页面规划

- 登录页
- 首页（BottomNavigation）
  - 音乐库
  - 推荐
  - 我的（收藏/歌单）
  - 任务
- 播放器页（迷你播放器 + 全屏）
- 设置页（Cookie、服务端地址、账号）

## 6. 对接细节与注意点

### 6.1 鉴权

- 普通 API：`Authorization: Bearer <token>`
- 音频/封面请求：建议拼接 `?auth=<token>`，避免播放器组件 header 兼容问题

### 6.2 流媒体播放

- 后端已支持 `Range`，拖动进度条可直接使用
- 安卓建议开启前台播放服务，避免息屏被系统杀死

### 6.3 推荐接口依赖 Cookie

- 网易推荐接口没有 Cookie 会返回 400
- Flutter 设置页需引导用户维护 `neteaseCookie`

### 6.4 编码与文本

- 仓库里部分中文出现乱码迹象，Flutter 端需对异常文案兜底显示

## 7. 建议的后端增量（支撑“收藏/歌单”）

建议最小增量 API:

- 收藏
  - `POST /api/favorites/:trackId`
  - `DELETE /api/favorites/:trackId`
  - `GET /api/favorites`
- 自建歌单
  - `POST /api/playlists`
  - `GET /api/playlists`
  - `GET /api/playlists/:id`
  - `POST /api/playlists/:id/tracks`
  - `DELETE /api/playlists/:id/tracks/:trackId`

建议数据库:

- `favorites(user_id, track_id, created_at)`
- `playlists(id, user_id, name, cover, created_at)`
- `playlist_tracks(playlist_id, track_id, sort_order, created_at)`

## 8. 分阶段开发计划（Flutter）

### Phase 1（可快速上线）

- 登录
- 音乐库列表 + 搜索/筛选
- 播放器（播放/暂停/上下首/进度/歌词）
- 推荐页（每日推荐 + 推荐歌单）
- 任务页（查看下载/扫描任务）

### Phase 2（管理增强）

- 曲目信息编辑
- 重命名/整理/去重入口
- 下载器（网易/QQ 链接解析）

### Phase 3（你的核心差异功能）

- 收藏体系
- 自建歌单体系
- 最近播放与播放统计

## 9. 开发优先结论

- 这个项目非常适合作为 Flutter 安卓端的数据后端，播放、推荐、下载、任务已经比较完整。
- 真正缺的是“用户维度”的内容组织能力（收藏/自建歌单/历史）。
- 建议你先做 Flutter 客户端 Phase 1，验证播放与推荐闭环，再补后端收藏/歌单接口进入 Phase 3。

---

## 附录: 关键源码位置

- `backend/src/index.ts`（API 主入口）
- `backend/src/db.ts`（表结构）
- `backend/src/scanner.ts`（扫描入库）
- `backend/src/scraper.ts`（刮削元数据与歌词）
- `backend/src/netease.ts`（网易推荐/解析/下载）
- `backend/src/qqmusic.ts`（QQ 解析/下载）
- `frontend/src/App.vue`（页面结构参考）
- `frontend/src/components/MusicPlayer.vue`（播放页交互参考）
- `frontend/src/components/DiscoveryView.vue`（推荐页参考）

---

## 10. 补充：对接细节查漏补缺（基于实际源码核查）

### 10.1 媒体流鉴权：`?auth=token` 实际上 **后端未实现**

> ⚠️ 注意：文档前文提到可用 `?auth=<token>` 方式传令牌，但当前 `backend/src/index.ts` 实际上并 **未** 对查询参数 `auth` 做任何解析。所有 `/api/*` 路由均通过 `Authorization: Bearer <token>` header 鉴权。

**Flutter 端正确做法**：使用 `just_audio` 的自定义 header 支持：

```dart
final audioSource = AudioSource.uri(
  Uri.parse('$baseUrl/api/tracks/$id/stream'),
  headers: {'Authorization': 'Bearer $token'},
);
```

`CachedNetworkImage` 同理需传 headers，否则 403。

---

### 10.2 `hasLyrics` 字段不稳定，需 null-safe 处理

`/api/tracks` 返回体中的 `hasLyrics` 字段，在 `index.ts` 中有如下注释：

```typescript
// (Optional: skip expensive fs checks for large lists if needed)
```

该字段实际上可能**不稳定或被跳过**，Flutter 端 `Track` 模型解析时务必：

```dart
bool hasLyrics = json['hasLyrics'] as bool? ?? false;
```

---

### 10.3 遗漏接口：在线元数据搜索

```http
GET /api/search-metadata?q=<关键词>&source=<netease|itunes|qq>
```

**返回示例**：

```json
{
  "success": true,
  "results": [
    { "title": "...", "artist": "...", "album": "...", "coverUrl": "..." }
  ]
}
```

**用途**：在编辑曲目标签页，可调用此接口联网搜索正确封面/艺术家/专辑信息并一键应用（对应 Web 版 `TrackDetail.vue` 的双栏对比搜索面板），Phase 2 应纳入此功能。

---

### 10.4 外链封面必须走 `/api/proxy-image` 代理

推荐接口（`/api/netease/recommend/playlists`、`/api/netease/recommend/songs`）返回的 `coverUrl` 指向网易云/QQ CDN（如 `p1.music.126.net/...`），这类地址有严格的 **Referer 防盗链**校验，Flutter 端直接加载会返回 403。

**正确做法**：在线封面统一走服务器代理：

```dart
String proxyCover(String rawUrl) =>
  '$baseUrl/api/proxy-image?url=${Uri.encodeComponent(rawUrl)}';
```

本地库封面（`/api/tracks/:id/cover`）则不需要代理，直接请求即可。

---

### 10.5 Android 必要权限与 `audio_service` 配置

`android/app/src/main/AndroidManifest.xml` 需增加：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />

<!-- audio_service 要求 -->
<service android:name="com.ryanheise.audioservice.AudioServiceBackgroundTask"
  android:foregroundServiceType="mediaPlayback"
  android:exported="true">
  <intent-filter>
    <action android:name="android.media.browse.MediaBrowserService" />
  </intent-filter>
</service>
```

不配置前台 Service，息屏后播放会在约 1 分钟内被系统强制终止。

---

### 10.6 音频格式与 `just_audio` 兼容性

后端 Scanner 支持的格式：`.mp3 / .flac / .m4a / .wav / .ogg`

| 格式 | just_audio Android 支持 | 稳定性 |
| --- | --- | --- |
| `.mp3` | ✅ 内置支持 | 最高 |
| `.m4a` (AAC) | ✅ 内置支持 | 高 |
| `.flac` | ⚠️ 依赖设备系统解码器 | 中，旧设备可能失败 |
| `.wav` | ✅ 内置支持 | 高 |
| `.ogg` | ✅ 内置支持 | 高 |

**建议**：播放 FLAC 时，如遇解码错误，可展示 Toast 提示并优雅降级（跳过该曲目继续播放队列下一首）。

---

### 10.7 网易云 Cookie 获取指引（需在 App 内说明）

`/api/netease/recommend/*` 接口在 Cookie 缺失时直接返回 `400`，Flutter 设置页需向用户提供清晰引导：

> **获取方式（PC 浏览器）**：
>
> 1. 打开 Chrome，访问 `https://music.163.com` 并登录
> 2. 按 F12 → Network → 任意请求 → 复制 `Cookie` 请求头完整内容
> 3. 粘贴到 App 设置 → 网易云 Cookie 输入框，保存即可

UI 上建议用多行 `TextField` + 隐藏/显示 toggle，并本地用 `flutter_secure_storage` 加密存储（不要用 SharedPreferences 存 Cookie 明文）。

---

### 10.8 任务进度轮询策略

后端**没有 WebSocket**，任务进度需前端主动轮询 `GET /api/tasks/:id`。

**建议实现**：

```dart
Stream<TaskItem> pollTask(String taskId) async* {
  while (true) {
    final task = await api.getTask(taskId);
    yield task;
    if (['completed', 'failed', 'cancelled'].contains(task.status)) break;
    await Future.delayed(const Duration(seconds: 2));
  }
}
```

- 建议轮询间隔：**2 秒**（下载任务）/ **1 秒**（扫描任务，进度变化较快）
- 页面离开时务必取消轮询，避免内存泄漏（`StreamSubscription.cancel()`）

---

### 10.9 封面图片缓存 Key 策略

`/api/tracks/:id/cover` 后端是**实时从磁盘读取音频文件内嵌封面**，未设置 HTTP Cache header。Flutter 端大量使用 `CachedNetworkImage` 时务必：

1. 使用 `track.id`（而非 `track.filepath`）作为缓存 Key，路径变更时不失效
2. 依赖 `cached_network_image` 的磁盘缓存，避免反复回源
3. 列表中封面建议压缩为 `80x80` 缩略图（后续可考虑在后端增加 `?size=small` 参数支持）

```dart
CachedNetworkImage(
  imageUrl: '$baseUrl/api/tracks/${track.id}/cover',
  httpHeaders: {'Authorization': 'Bearer $token'},
  cacheKey: 'cover_${track.id}',
  placeholder: (_, __) => const AlbumPlaceholderWidget(),
  errorWidget: (_, __, ___) => const AlbumPlaceholderWidget(),
)
```

---

### 10.10 JWT Token 有效期与安全存储

- **有效期**：后端 `index.ts` 中配置为 `expiresIn: '7d'`（7天）
- **401 自动处理**：`dio` Interceptor 拦截 401 响应，清除本地 token 并跳转到登录页
- **安全存储**：使用 `flutter_secure_storage`，切勿用 `SharedPreferences` 存储 token 明文

```dart
// dio interceptor 示例
on DioException catch (e) {
  if (e.response?.statusCode == 401) {
    await secureStorage.delete(key: 'jwt_token');
    router.go('/login');
  }
}
```

- 启动时读取本地 Token → 调用 `GET /api/auth/check` 验证是否有效 → 有效则直接进主界面，失效则走登录流程
