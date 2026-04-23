# 每日交易复盘 + 执行约束系统

这个系统的目标不是预测行情，而是帮助你稳定执行交易纪律，控制情绪，减少冲动交易。

## 使用方式

1. 每天晚上 21:00 按提醒完成一次复盘。
2. 先阅读 `rules/execution-constraints.md`，确认当日是否违反硬规则。
3. 运行 `scripts/new_review.sh` 生成当天复盘文件。
4. 在 `reviews/` 目录填写当天记录。

## 文件结构

- `rules/execution-constraints.md`：执行约束与违规处罚规则
- `templates/daily-review-template.md`：固定复盘模板
- `scripts/new_review.sh`：按日期生成复盘文件
- `scripts/start_web.sh`：启动浏览器版本地服务
- `index.html` / `styles.css` / `app.js`：浏览器版复盘系统
- `quick.html` / `quick.js`：3 分钟极速复盘页
- `manifest.webmanifest` / `service-worker.js`：PWA 安装与离线缓存
- `vercel.json`：Vercel 静态托管配置
- `.github/workflows/deploy-pages.yml`：GitHub Pages 自动部署工作流
- `.gitignore` / `.nojekyll`：静态站发布与本地数据保护
- `icons/`：主屏幕与桌面安装图标
- `reviews/`：每日复盘记录

## 核心原则

- 先控制自己，再处理行情。
- 先看是否符合规则，再决定是否出手。
- 只复盘可执行行为，不复盘“如果当时预测对了会怎样”。

## 浏览器运行

在当前目录运行：

```bash
bash /Users/joyning/Documents/Codex/2026-04-22-1-9-9-2-1-2/scripts/start_web.sh
```

然后在浏览器打开：

```text
http://127.0.0.1:4173
```

浏览器版支持：

- 按日期保存复盘到本地浏览器存储
- 自动计算平均分和次日处罚
- 按账户规模自动换算单笔上限、止损风险、止盈锁定利润
- 手机端 `极简模式`，会收起非核心区块并保留底部快捷操作
- 内置土狗分仓档位表，会按账户规模动态换算 `2% / 3% / 5% / 10%`
- 支持安装为 PWA，可加到手机主屏幕或桌面
- 额外提供 `quick.html` 的 3 分钟极速复盘页
- 导出 Markdown 复盘记录
- 页面保持打开时的 09:00 浏览器提醒

## 公开部署

当前项目已经整理成静态站可部署版，不需要你额外写后端。

### Vercel

1. 把当前目录推到一个 GitHub 仓库
2. 在 Vercel 中选择 `Add New Project`
3. 导入该仓库
4. Framework Preset 选择 `Other`
5. 不需要 Build Command，也不需要 Output Directory
6. 点击部署

部署后会直接发布 `index.html`，`quick.html`、PWA 和离线缓存也会一起可用。

### GitHub Pages

1. 把当前目录推到 GitHub 仓库的 `main` 分支
2. 仓库里已经带有 `.github/workflows/deploy-pages.yml`
3. 进入 GitHub 仓库的 `Settings -> Pages`
4. Source 选择 `GitHub Actions`
5. 之后每次 push 到 `main` 都会自动发布

### 数据说明

- 这是纯前端应用
- 每个用户的复盘数据默认保存在各自浏览器本地
- 不会自动同步，也不会上传到服务器
- 如果你以后要做账号登录、跨设备同步，再增加后端和数据库

## 安卓 APK

现在仓库里已经补好了原生安卓工程，目录在 [android/app](./android/app)。

### 方案

- 用 `WebView` 离线加载当前网页资源，不依赖外部服务器
- 保留现有复盘页面和 `quick.html` 极速页
- 在安卓里补了原生 `09:00` 提醒通知
- 开机、时区变化、App 更新后会自动重新挂提醒
- 在 APK 里会自动识别“当前是安卓 App”，不再显示 PWA 安装提示

### 同步网页资源到安卓工程

每次你改了 `index.html`、`app.js`、`styles.css`、图标或 `quick.html` 之后，先运行：

```bash
bash /Users/joyning/Documents/Codex/2026-04-22-1-9-9-2-1-2/scripts/sync_android_assets.sh
```

它会做两件事：

- 把网页资源同步到 `android/app/src/main/assets/web/`
- 用现有 `icons/icon-512.png` 生成安卓启动图标

### 本地打 APK

这台机器如果以后装好了 `Java 17` 和 `Android SDK`，就可以在项目根目录执行：

```bash
cd /Users/joyning/Documents/Codex/2026-04-22-1-9-9-2-1-2/android
./gradlew assembleDebug
```

打包产物默认在：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### GitHub 自动打 APK

仓库里也加了 [android-apk.yml](./.github/workflows/android-apk.yml)。

- 只要把项目推到 GitHub
- 进入 `Actions -> Build Android APK`
- 运行后就能在 Artifact 里下载 `debug APK`

这条路适合你本机没配 Android 环境的时候先拿到安装包。

### 不要把本地复盘发上去

仓库里已经加了 `.gitignore`，会默认忽略 `reviews/*.md`，避免把你的个人复盘文件误传公开仓库。

## `1000u` 账户执行换算

如果当前总资金是 `1000u`，按系统硬规则直接换算为：

- 单笔最大仓位：`100u`
- 单笔触发 `-10%` 止损时，理论最大亏损：约 `10u`，实际还要加上手续费和滑点
- 触发 `+30%` 时先卖一半：先落袋约 `15u`
- 出现 `1` 次违规后的次日单笔上限：`50u`
