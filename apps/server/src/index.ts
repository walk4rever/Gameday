// Cloudflare Worker 入口。一个房间 = 一个 Durable Object 实例（见 room.ts）。
// P2 固定单房间："default"，见 PRODUCT.md 联机房间模型的决定。
//
// /ws 走 Durable Object；其余请求交给 [assets]（apps/web 编译出的静态文件），
// 前端和后端只有一次部署、一个域名，见 wrangler.toml 里的说明。

import type { Env } from './env.js';

export { Room } from './room.js';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const roomName = url.searchParams.get('room') ?? 'default';
      const id = env.ROOM.idFromName(roomName);
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
