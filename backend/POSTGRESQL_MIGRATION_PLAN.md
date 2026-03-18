# PostgreSQL 切换工作清单

## 目标

把当前 backend 从单文件 SQLite 切换到 PostgreSQL，同时尽量保持现有 API、Flutter 端调用方式、数据结构和业务行为不变。

这份清单按当前代码现状编写，适用于下面这套后端：

- `src/db.ts` 直接初始化 `better-sqlite3`
- `src/index.ts`、`src/taskManager.ts`、`src/scanner.ts`、`src/scraper.ts`、`src/netease.ts`、`src/qqmusic.ts`、`src/kugou.ts`、`src/kuwo.ts` 里大量直接调用 `db.prepare(...)`
- `docker-compose.yml` 目前只启动业务服务，没有单独的数据库服务

## 先说结论

这次切库不是“改个连接串”。

当前项目和 SQLite 的耦合主要有三层：

1. 连接和迁移逻辑耦合
2. 查询接口耦合
3. 部署方式耦合

目前代码里大约有 100 多处直接使用 `db.prepare(...)` 的查询，所以迁移 PostgreSQL 是一项完整的后端改造，不是小修。

## 推荐方案

推荐目标栈：

- 数据库：PostgreSQL 16+
- Node 驱动：`pg`
- 迁移工具：`node-pg-migrate` 或 `drizzle-kit`
- 连接池：`pg.Pool`

推荐理由：

- 相比继续手写底层协议，`pg` 足够稳定直接
- 你当前大量是原生 SQL，没必要为了切库顺手上重 ORM
- 增量改造时，原生 SQL + 迁移工具最容易对照现有逻辑逐个替换

如果后面还想继续支持多数据库，才值得再引入 `Kysely` 或 `Drizzle` 作为抽象层。

## 需要完成的工作

### 1. 重写数据库接入层

需要修改：

- `src/db.ts`

要做的事：

- 移除 `better-sqlite3` 初始化
- 改成 `pg.Pool`
- 新增环境变量：
  - `DB_HOST`
  - `DB_PORT`
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASSWORD`
  - 可选 `DB_SSL`
- 保留统一导出的数据库访问接口
- 增加事务辅助函数
- 增加启动时连接检查

建议结果：

- `db.ts` 只负责：
  - 建立连接池
  - 导出 `query(...)`
  - 导出 `withTransaction(...)`
  - 运行 migration

不建议继续把建表、补列、索引、兼容迁移都塞在启动文件里。

### 2. 引入版本化 migration

当前 SQLite 迁移方式是：

- 启动时 `CREATE TABLE IF NOT EXISTS`
- 再 `ALTER TABLE ... ADD COLUMN`
- 再按列存在情况补索引

这套方式在 SQLite 还能凑合，但切到 PostgreSQL 后不建议继续这样做。

要做的事：

- 建 `migrations/` 目录
- 用 migration 工具创建初始基线
- 把当前表结构写成第一版 migration
- 后续所有 schema 变化都走 migration 文件

需要覆盖的表：

- `tracks`
- `users`
- `tasks`
- `favorites`
- `playlists`
- `playlist_tracks`
- `play_history`
- `user_preferences`

需要覆盖的索引：

- `idx_tracks_filepath`
- `idx_tracks_status`
- `idx_tracks_year`
- `idx_users_username`
- `idx_tasks_parent`
- `idx_tasks_status_priority`
- `idx_play_history_track`
- `idx_play_history_time`
- `idx_play_history_user_played_at`
- `idx_play_history_user_track_latest`
- `idx_favorites_user_created`
- `idx_playlists_user_updated`
- `idx_playlist_tracks_playlist_sort`
- `idx_user_preferences_updated`

### 3. 重写所有查询调用

当前代码里大量使用：

- `db.prepare(...).get(...)`
- `db.prepare(...).all(...)`
- `db.prepare(...).run(...)`

PostgreSQL 里要统一改成：

- `const { rows } = await pool.query(sql, params)`

重点影响文件：

- `src/index.ts`
- `src/taskManager.ts`
- `src/scanner.ts`
- `src/scraper.ts`
- `src/netease.ts`
- `src/qqmusic.ts`
- `src/kugou.ts`
- `src/kuwo.ts`

语法差异要处理：

- SQLite 占位符 `?` 要改成 PostgreSQL 的 `$1`, `$2`, `$3`
- `.get()` 要改成 `rows[0]`
- `.all()` 要改成 `rows`
- `.run()` 要改成 `query(...)`，并根据 `rowCount` 判断影响行数
- 自增主键 `AUTOINCREMENT` 改成 `BIGSERIAL` 或 `GENERATED`
- `PRAGMA` 相关逻辑全部删除

### 4. 重新设计少量字段类型

推荐在切库时一起规范这几个字段：

- `tracks.year`
  - 现在是 `TEXT`
  - 建议改成 `INTEGER` 或保留 `TEXT`
  - 如果数据来源不稳定，保留 `TEXT` 更保守
- 各表 `created_at` / `updated_at`
  - 建议统一改为 `TIMESTAMPTZ`
- `tasks.logs` / `payload` / `result`
  - 如果内容是结构化 JSON，建议改成 `JSONB`
- `user_preferences.preference_value`
  - 建议改成 `JSONB`

最稳的策略：

- 第一阶段先保持字段语义不变，只把 SQLite 类型映射成最接近的 PostgreSQL 类型
- 第二阶段再做类型优化

### 5. 补事务边界

SQLite 单机模式下，有些写操作即使不显式事务也不太容易出大事。

切到 PostgreSQL 后，下面这些操作建议明确加事务：

- 创建歌单并批量插入歌曲
- 导入备份数据
- 删除歌单及其关联数据
- 扫描或批量刮削时的状态更新
- 播放历史和统计相关联更新

建议做法：

- 在 `db.ts` 提供 `withTransaction(async client => { ... })`
- 所有多步写入统一收口

### 6. 重做 Docker 和部署

当前 `docker-compose.yml` 只有业务服务。

要改的事：

- 增加 `postgres` 服务
- 增加数据库持久化 volume
- 把 backend 的环境变量改成 PostgreSQL 连接配置
- backend 启动前先等待数据库就绪

建议的 Compose 结构：

- `music-tag-backend`
- `postgres`
- 可选 `pgadmin`

需要补的配置：

- 初始化数据库名、用户、密码
- 数据卷路径
- 数据库 healthcheck
- 业务服务依赖数据库服务启动

### 7. 写数据迁移脚本

这是切库最关键的一块。

建议新增脚本：

- `scripts/export-sqlite.ts`
- `scripts/import-postgres.ts`
- `scripts/verify-migration.ts`

迁移顺序建议：

1. `users`
2. `tracks`
3. `tasks`
4. `favorites`
5. `playlists`
6. `playlist_tracks`
7. `play_history`
8. `user_preferences`

迁移时要校验：

- 每张表总行数是否一致
- 主键是否完整
- 收藏数量、歌单数量、最近播放数量是否一致
- 每个歌单内歌曲顺序是否一致
- `cover`、`sort_order`、`priority`、`year` 是否保留

### 8. 调整备份和恢复策略

SQLite 时代：

- 直接备份 `.db` 文件就行

切 PostgreSQL 后需要改成：

- `pg_dump`
- `pg_restore`
- 定时备份
- 备份保留策略

建议至少补：

- 手工备份脚本
- Docker 环境下的自动备份说明
- 恢复演练流程

### 9. 做回归测试

当前 backend 几乎没有自动化测试，所以切库后至少要补一轮接口回归。

最少要验的接口：

- 登录
- 曲库列表
- 修改歌曲信息
- 扫描与刮削
- 下载任务
- 收藏
- 歌单创建、加歌、删歌、重排
- 最近播放
- 播放统计
- 偏好同步
- 数据导入导出

建议补的测试层级：

- `db` 层 smoke test
- 关键 API 集成测试
- 一轮 Flutter 真机联调

## 代码改造拆分建议

### 阶段 1：先做抽象，不换库

目标：

- 不改业务行为
- 先把数据库访问从路由里抽出来

要做的事：

- 新增 repository 层
- 把 `index.ts` 里直接 SQL 逐步下沉
- 让 `db.ts` 暴露统一访问接口

这一阶段完成后，再切 PostgreSQL，风险会小很多。

### 阶段 2：接入 PostgreSQL 并双跑验证

目标：

- SQLite 仍可作为老数据源
- PostgreSQL 作为新目标库

要做的事：

- 新建 PostgreSQL schema
- 编写导入脚本
- 在测试环境验证所有接口

### 阶段 3：正式切换

目标：

- 生产或主环境仅使用 PostgreSQL

要做的事：

- 停写旧库
- 导出 SQLite
- 导入 PostgreSQL
- 运行校验脚本
- 切换服务环境变量
- 联调 Flutter
- 保留 SQLite 备份以便回滚

## 风险点

### 高风险

- 直接改 100 多处 SQL，容易漏
- 歌单顺序和历史数据迁移容易出偏差
- 旧数据里空值、脏值在 PostgreSQL 上更容易触发约束错误
- Docker 部署从单服务变双服务，运维复杂度会上来

### 中风险

- JSON 和时间字段类型变化导致接口返回格式轻微变化
- `INSERT ... ON CONFLICT`、分页、排序在不同 SQL 方言下行为细节不一致

### 低风险

- 大多数简单查询迁移本身不难
- 你当前数据量不算大，导入速度大概率不会成为主要问题

## 预计工作量

如果目标是“能跑”，不追求太优雅：

- 2 到 4 天

如果目标是“切完以后后端结构也更稳”：

- 4 到 7 天

如果要连自动化测试、数据迁移工具、Docker 化部署一起做完整：

- 约 1 到 2 周

## 建议的执行顺序

1. 先抽数据库访问层
2. 再上 migration 工具
3. 再补 PostgreSQL 连接和 schema
4. 再做 SQLite -> PostgreSQL 导入脚本
5. 再做接口回归测试
6. 最后再切生产或主环境

## 不切库时也值得先做的事

即使短期不换 PostgreSQL，下面这些工作也值得先做：

- 把 `db.ts` 的启动式迁移改成版本化 migration
- 把直接 SQL 从路由层抽走
- 补最基础的后端集成测试
- 给导入导出和歌单操作补事务

这些工作以后无论继续用 SQLite，还是改 PostgreSQL，都会直接受益。

## 验收标准

迁移完成后，至少满足：

- backend 可以在 PostgreSQL 上独立启动
- Flutter 无需改接口路径即可正常使用
- 收藏、歌单、最近播放、播放统计、偏好同步全部可用
- 旧 SQLite 数据可完整导入
- Docker Compose 能一键拉起 backend + PostgreSQL
- 有明确备份、恢复、回滚流程

