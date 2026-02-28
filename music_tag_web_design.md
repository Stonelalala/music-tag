# 自动刮削音乐标签生成器 (Music Tag Auto-Scraper) - 项目系统设计与部署指南

本项目是一个致力于解决个人 NAS 痛点的本地音乐管理与**自动化刮削**工具。参考开源项目 `xhongc/music-tag-web` 的核心理念，我们将**自主开发**一套更加轻量、极致贴合 NAS 自动化工作流的系统。

## 1. 核心需求与设计目标

- **自动化目录监听/读取**：挂载本地音乐库后，系统能够自动发现新的音乐文件（如 mp3, flac 等）。
- **定时刮削引擎 (Scheduled Scraper)**：无需人工干预，系统在后台定时自动通过音乐指纹或文件名，从上游数据源（如 NetEase, QQ Music, MusicBrainz, LRCLIB 等）拉取缺失的**专辑封面**、**歌词 (LRC)** 和**艺术家信息**。
- **元数据回写**：将拉取到的精确元数据（包括内嵌歌词与封面图）安全地写入（覆写）到源音频文件的 ID3 等标签标头中。
- **可视化 Web 后台**：提供直观的界面，用于查看刮削进度、修改刮削规则以及对匹配有误的音乐进行手动校准。
- **NAS 友好部署**：极简的 Docker 容器化设计，处理好 PGID/PUID 权限问题，防止刮削后导致 NAS 宿主机文件权限错乱。

---

## 2. 系统技术架构设计

为保障全栈的类型安全与开发效率，采用统一的 TypeScript 技术栈：

### 后端 (Backend: Node.js + Express)

* **任务调度层 (Scheduler)**: 使用 `node-cron` 或 `bullmq`，建立定时任务队列（如每晚凌晨 2 点准时扫描并补全未完善的音乐标签）。
- **音频处理引擎**:
  - 读取：`music-metadata`（解析并提取现有元数据，判别是否需要刮削）。
  - 写入：`node-id3` / `flac-metadata`（负责将拉取到的媒体资源封装回写）。
- **数据源爬虫层 (APIs)**: 整合多个外部公开 API 作为匹配服务。
- **本地状态库**: 采用轻量嵌入式数据库 **SQLite**，仅用于记录文件的“哈希值、最后扫描时间、刮削状态（成功/失败/忽略）”，避免每次全盘重复访问上游接口。

### 前端 (Frontend: Vue 3 + Vite)

* 应用 `Tailwind CSS` 进行现代化布局。
- 主要页面包含：**看板 (Dashboard)**（展示库大小、成功率）、**音乐列表**、**刮削日志** 和 **调度配置页**。

---

## 3. Docker Compose 部署规划

为了在您的 NAS（如群晖、威联通等）上平滑运行，规划中的应用将打包为单一容器 `auto-music-tagger`。

新建 `docker-compose.yml` 内容如下：

```yaml
version: '3.8'

services:
  auto-music-tagger:
    build: . # 本地开发或构建使用
    image: custom-auto-music-tagger:latest
    container_name: music-tagger-web
    restart: unless-stopped
    ports:
      - "8002:8002" # Web 界面及 API 端口
    volumes:
      # 高级权限挂载你的 NAS 音乐库，关键：必须为 rw (读写) 才能回写封面和歌词
      - /path/to/your/nas/music:/app/media:rw
      
      # 挂载 SQLite 数据库及定时器配置信息，保证容器重建数据不丢失
      - ./config:/app/config:rw
    environment:
      # 修复 NAS 经典的文件所有者错乱问题
      - PUID=1000  # 执行 `id` 获取您 NAS 登录账号的 UID
      - PGID=1000  # 执行 `id` 获取您 NAS 登录账号的 GID
      - TZ=Asia/Shanghai
      - CRON_SCHEDULE="0 2 * * *"  # 环境变量注入定时刮削频率（默认每天凌晨2点）
```

---

## 4. 后续开发拆解任务 (Roadmap)

我们接下来将逐步把代码写出来，任务主要分为 4 个阶段：

- [ ] **Phase 1: 基础工程与本地数据库调度**
  - [ ] 搭建 Express 后台，初始化 SQLite 结构，记录扫描的已知文件路径及 `ScrapeStatus`（刮削状态）。
  - [ ] 实现针对 `/app/media` 的基础深层目录遍历工具函数。
- [ ] **Phase 2: 核心刮削与写入引擎**
  - [ ] 接入一个开放的第三方音乐接口 API 试水（主要拿 Cover 和 Lyrics）。
  - [ ] 完成“读取现有 ID3 -> 匹配缺漏 -> 请求 API -> 写入源系统文件” 的闭环测试脚本。
- [ ] **Phase 3: 定时策略支持**
  - [ ] 引入 `node-cron` 并配置规则，结合 SQLite 的游标实现增量式（Incremental）抓取，遇到 API Rate limit 时懂得自动延时与退避。
- [ ] **Phase 4: 全局操作 UI**
  - [ ] 搭建 Vue 3 后台列表与修改面板，对接后端接口，让您能浏览器上一览刮削进度和结果。

*这份 MD 文件旨在明确我们接下来的自主研发目标与系统标准。如果没有遗漏，我们可以即刻开展 Phase 1 的后端与 SQLite 的开发！*
