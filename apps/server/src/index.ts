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

    // 线上环境强制升级为 HTTPS，避免非安全环境下 WebSocket 被运营商/代理拦截
    if (
      url.protocol === 'http:' &&
      !url.hostname.includes('localhost') &&
      !url.hostname.includes('127.0.0.1')
    ) {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    // 跨域预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (url.pathname.startsWith('/api/auth/')) {
      const id = env.ROOM.idFromName('__system_auth__');
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    // 创建专属新房间 (生成唯一字母数字短序列 ID)
    if (url.pathname === '/api/room/create' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          name?: string;
          password?: string;
          createdBy?: string;
        };
        const chars = '23456789abcdefghjkmnpqrstuvwxyz';
        let idStr = '';
        const bytes = new Uint8Array(6);
        crypto.getRandomValues(bytes);
        for (let i = 0; i < 6; i++) {
          idStr += chars[bytes[i]! % chars.length];
        }
        const roomId = `fam-${idStr}`;

        const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
        const initRes = await stub.fetch(
          new Request('https://internal/api/room/init-meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
              name: body.name || '温馨家庭房',
              password: body.password || '',
              createdBy: body.createdBy || '房主'
            })
          })
        );
        return initRes;
      } catch {
        return Response.json(
          { ok: false, message: '创建房间失败，请稍后重试' },
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }
    }

    // 房间元数据查询与 6 位密码校验
    if (
      url.pathname === '/api/room/meta' ||
      url.pathname === '/api/room/verify-password'
    ) {
      const roomName = url.searchParams.get('room') ?? 'default';
      const stub = env.ROOM.get(env.ROOM.idFromName(roomName));
      return stub.fetch(request);
    }

    if (url.pathname === '/api/room-status') {
      const roomName = url.searchParams.get('room') ?? 'default';
      const playerId = url.searchParams.get('playerId') ?? '';
      const stub1 = env.ROOM.get(env.ROOM.idFromName(roomName));
      const res1 = await stub1.fetch(
        new Request(
          `https://internal/api/table-status?table=1&playerId=${encodeURIComponent(playerId)}`
        )
      );
      const data1 = res1.ok
        ? ((await res1.json()) as { table: unknown; meta?: { name?: string; hasPassword?: boolean } })
        : null;

      const fallbackSeats = [0, 1, 2, 3].map((i) => ({
        seat: i,
        name: `机器人 ${i + 1}`,
        isBot: true,
        connected: false,
        status: 'online' as const
      }));

      const table1Info = data1?.table ?? {
        id: '1',
        name: '1号桌 · 经典掼蛋',
        type: 'guandan',
        gameActive: false,
        isFull: false,
        isMember: false,
        humanSeatsCount: 0,
        maxSeats: 4,
        status: 'empty',
        seats: fallbackSeats
      };

      const table2Info = {
        id: '2',
        name: '2号桌 · 经典双升',
        type: 'shuangsheng',
        gameActive: false,
        isFull: false,
        isMember: false,
        humanSeatsCount: 0,
        maxSeats: 4,
        status: 'developing',
        seats: [0, 1, 2, 3].map((i) => ({
          seat: i,
          name: '待开放',
          isBot: true,
          connected: false,
          status: 'online' as const
        }))
      };

      const meta = data1?.meta;

      return Response.json(
        {
          room: roomName,
          roomName: meta?.name ?? (roomName === 'default' ? '公共大厅' : '家庭游戏室'),
          hasPassword: Boolean(meta?.hasPassword),
          tables: [table1Info, table2Info]
        },
        {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'access-control-allow-origin': '*',
            'cache-control': 'no-cache'
          }
        }
      );
    }

    if (url.pathname === '/ws' || url.pathname === '/api/room-reset') {
      const roomName = url.searchParams.get('room') ?? 'default';
      const tableParam = url.searchParams.get('table') ?? '1';
      const doName = tableParam === '2' ? `${roomName}:2` : roomName;
      const id = env.ROOM.idFromName(doName);
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
