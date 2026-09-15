# Gameday

家庭联机游戏平台。手机浏览器打开即玩，人数不够由机器人补位，对新手做出牌限制与提示。

首发游戏：**掼蛋（Guandan）**。未来将支持飞行棋、Uno 等适合家庭和聚会的休闲游戏。

---

## 特性

- 📱 **移动端优先**：针对手机端竖屏优化，点选出牌，大按钮与直观手牌布局。
- 🤖 **机器人灵活补位**：1–4 人皆可玩，空缺座位由内置启发式 AI 自动接管。
- ⚖️ **服务端权威**：手牌状态服务端加密隔离，杜绝客户端作弊；规则引擎本地与云端双重校验。
- ⚡️ **纯 Cloudflare 边缘架构**：
  - **Cloudflare Workers**：单次部署，全球边缘低延迟分发。
  - **Durable Objects**：一个房间对应一个 DO 实例，原生支持 WebSocket 长连接与状态常驻。
  - **Workers Assets**：前端单页应用与服务端同域名托管，零跨域。
  - **DO SQLite**：对局战绩轻量持久化。

---

## 项目结构

采用 `pnpm workspace` 单仓（monorepo）架构：

```
Gameday/
├── packages/
│   ├── rules/          掼蛋规则判定（牌型分析、比较大小、合法出牌计算，纯 TS，零依赖）
│   ├── engine/         单局状态机（发牌、出牌循环、贡牌结算，纯 TS）
│   ├── bot/            启发式出牌 AI
│   └── protocol/       WebSocket 消息与通信协议类型
├── apps/
│   ├── server/         Cloudflare Worker + Durable Objects 服务端
│   └── web/            React 19 + Vite 移动端 PWA 前端
├── pnpm-workspace.yaml
└── package.json
```

---

## 快速开始

### 依赖环境

- Node.js >= 22
- pnpm >= 10

### 安装依赖

```bash
pnpm install
```

### 运行测试与类型检查

```bash
# 运行全部单测（47 个规则测试 + 8 个 AI 测试 + 19 个状态机仿真）
pnpm test

# 全局 TypeScript 类型检查
pnpm typecheck

# 构建前端与资源
pnpm build
```

### 本地开发

```bash
# 启动前端本地热重载
pnpm --filter @guandan/web dev

# 启动 Cloudflare Worker 本地仿真环境（包含 Durable Objects）
pnpm --filter @guandan/server dev
```

### 部署到 Cloudflare

```bash
# 登录 Cloudflare（首次）
pnpm --filter @guandan/server exec wrangler login

# 一键构建前端并发布 Worker
pnpm --filter @guandan/server deploy
```

---

## 路线图

- [x] **v0.1.0**：掼蛋完整核心规则、单局状态机、启发式 Bot、Durable Objects 实时联机房间。
- [ ] **P3**：战绩持久化与排行榜（昵称 + PIN 账号体系）。
- [ ] **P4**：新手规则教学与出牌高亮解析。
- [ ] **多游戏支持**：平台主页扩展，支持更多家庭棋牌与聚会游戏。
