/**
 * gameRooms — 好友约战房间管理（服务端权威裁判；无 ws / 定时器依赖，便于单测）。
 *
 * 注入：
 *   sendTo(userId, obj)        → 推给该用户的所有连接
 *   online(userId)             → 是否在线
 *   isFriendOf(conn, userId)   → Promise<boolean>
 *   now() / rand() / setTimer(fn, ms) / clearTimer(id)
 *
 * WS 线协议（客户端 → 服务端）：
 *   game:invite  { to, game }            game:invite-cancel { inviteId }
 *   game:respond { inviteId, accept }    game:action { roomId, action }
 *   game:resign  { roomId }              game:rematch { roomId }
 *   game:leave   { roomId }              game:sync
 * 服务端 → 客户端：
 *   game:invited / game:invite-sent / game:invite-closed { inviteId, reason }
 *   game:room { room }（开局、每步、结束都推完整视图）/ game:closed { roomId }
 *   game:error { error }
 *
 * 规则：一人同一时间只能在一个对局里；邀请 60s 过期；对局中掉线 60s 未回 → 判负。
 */

import { createGomoku, applyGomoku, gomokuView } from './gomoku.js';
import { createBanqi, applyBanqi, banqiView } from './banqi.js';

export const GAMES = {
  gomoku: { create: () => createGomoku(), apply: applyGomoku, view: gomokuView },
  banqi: { create: (rand) => createBanqi(rand), apply: applyBanqi, view: banqiView },
};

export const INVITE_TTL_MS = 60_000;
export const RECONNECT_GRACE_MS = 60_000;
const MAX_OUTGOING_INVITES = 3;

export function createGameRooms({
  sendTo, online, isFriendOf,
  now = () => Date.now(), rand = Math.random,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id),
}) {
  const invites = new Map();   // inviteId -> { id, from, to, game, expiresAt, timer }
  const rooms = new Map();     // roomId -> room
  const userRoom = new Map();  // userId -> roomId（仅未关闭的房间）
  let seq = 0;
  const newId = (p) => `${p}${now().toString(36)}${(++seq).toString(36)}`;

  /** 是否在进行中的对局里（已结束的房间不算忙） */
  function busy(uid) {
    const room = rooms.get(userRoom.get(uid));
    return !!room && room.status === 'playing';
  }

  const err = (conn, error) => conn.send({ type: 'game:error', error });
  const inviteDto = (inv) => ({ id: inv.id, from: inv.from, to: inv.to, game: inv.game, expiresAt: inv.expiresAt });

  function closeInvite(inv, reason) {
    if (!invites.has(inv.id)) return;
    invites.delete(inv.id);
    clearTimer(inv.timer);
    const msg = { type: 'game:invite-closed', inviteId: inv.id, reason };
    sendTo(inv.from, msg);
    sendTo(inv.to, msg);
  }

  function roomView(room, userId) {
    const seat = room.players.indexOf(userId) + 1;
    return {
      id: room.id,
      game: room.game,
      seat,
      players: room.players,
      state: GAMES[room.game].view(room.state, seat),
      status: room.status,            // playing | over
      result: room.result,            // { winner: seat|0, reason }
      opponentOnline: online(room.players[seat === 1 ? 1 : 0]),
      rematch: room.rematch,          // 请求再来一局的 userId 列表
    };
  }

  function push(room) {
    for (const uid of room.players) sendTo(uid, { type: 'game:room', room: roomView(room, uid) });
  }

  function finish(room, winner, reason) {
    if (room.status === 'over') return;
    room.status = 'over';
    room.result = { winner, reason };
    for (const t of room.graceTimers.values()) clearTimer(t);
    room.graceTimers.clear();
    push(room);
  }

  /** keepOrder=true 时 playerA 固定为 seat 1（再来一局交换先后手用），否则先后手随机 */
  function startRoom(game, playerA, playerB, keepOrder = false) {
    const players = keepOrder || rand() < 0.5 ? [playerA, playerB] : [playerB, playerA];
    const room = {
      id: newId('r'), game, players, state: GAMES[game].create(rand),
      status: 'playing', result: null, rematch: [], graceTimers: new Map(),
    };
    rooms.set(room.id, room);
    for (const uid of players) {
      const old = rooms.get(userRoom.get(uid));
      if (old) closeRoom(old); // 上一局已结束的房间
      userRoom.set(uid, room.id);
      // 开局后，双方其它未决邀请全部作废
      for (const inv of [...invites.values()]) {
        if (inv.from === uid || inv.to === uid) closeInvite(inv, 'busy');
      }
    }
    push(room);
    return room;
  }

  function closeRoom(room) {
    rooms.delete(room.id);
    for (const uid of room.players) {
      if (userRoom.get(uid) === room.id) userRoom.delete(uid);
      sendTo(uid, { type: 'game:closed', roomId: room.id });
    }
  }

  function roomOf(conn, roomId) {
    const room = rooms.get(roomId);
    if (!room || !room.players.includes(conn.userId)) return null;
    return room;
  }

  async function handle(conn, msg) {
    const me = conn.userId;
    switch (msg.type) {
      case 'game:invite': {
        const to = Number(msg.to);
        if (typeof msg.game !== 'string' || !Object.hasOwn(GAMES, msg.game)) return err(conn, '未知游戏');
        if (!Number.isInteger(to) || to === me) return err(conn, '无效对手');
        if (!(await isFriendOf(conn, to))) return err(conn, '只能邀请好友');
        if (!online(to)) return err(conn, '好友当前不在线');
        if (busy(me)) return err(conn, '你还有未结束的对局');
        if (busy(to)) return err(conn, '对方正在对局中');
        const mine = [...invites.values()].filter((i) => i.from === me);
        if (mine.some((i) => i.to === to)) return err(conn, '已经邀请过了，等对方回应');
        if (mine.length >= MAX_OUTGOING_INVITES) return err(conn, '同时邀请的人太多了');
        const inv = { id: newId('i'), from: me, to, game: msg.game, expiresAt: now() + INVITE_TTL_MS };
        inv.timer = setTimer(() => closeInvite(inv, 'expired'), INVITE_TTL_MS);
        invites.set(inv.id, inv);
        sendTo(to, { type: 'game:invited', invite: inviteDto(inv) });
        sendTo(me, { type: 'game:invite-sent', invite: inviteDto(inv) });
        return undefined;
      }
      case 'game:invite-cancel': {
        const inv = invites.get(msg.inviteId);
        if (inv && inv.from === me) closeInvite(inv, 'cancelled');
        return undefined;
      }
      case 'game:respond': {
        const inv = invites.get(msg.inviteId);
        if (!inv || inv.to !== me) return err(conn, '邀请已失效');
        if (!msg.accept) return closeInvite(inv, 'declined');
        if (busy(me) || busy(inv.from)) return closeInvite(inv, 'busy');
        if (!online(inv.from)) return closeInvite(inv, 'offline');
        closeInvite(inv, 'accepted');
        startRoom(inv.game, inv.from, inv.to);
        return undefined;
      }
      case 'game:action': {
        const room = roomOf(conn, msg.roomId);
        if (!room) return err(conn, '对局不存在');
        if (room.status !== 'playing') return err(conn, '对局已结束');
        const seat = room.players.indexOf(me) + 1;
        const res = GAMES[room.game].apply(room.state, seat, msg.action);
        if (!res.ok) return err(conn, res.error);
        room.state = res.state;
        if (res.state.winner) finish(room, res.state.winner, 'win');
        else if (res.state.draw) finish(room, 0, 'draw');
        else push(room);
        return undefined;
      }
      case 'game:resign': {
        const room = roomOf(conn, msg.roomId);
        if (!room || room.status !== 'playing') return undefined;
        const seat = room.players.indexOf(me) + 1;
        finish(room, seat === 1 ? 2 : 1, 'resign');
        return undefined;
      }
      case 'game:rematch': {
        const room = roomOf(conn, msg.roomId);
        if (!room || room.status !== 'over') return undefined;
        if (!room.rematch.includes(me)) room.rematch.push(me);
        const other = room.players.find((u) => u !== me);
        if (room.rematch.length === 2) {
          if (!online(other)) return err(conn, '对方已离线');
          if (userRoom.get(other) !== room.id) return err(conn, '对方已经离开');
          closeRoom(room);
          startRoom(room.game, room.players[1], room.players[0], true);
        } else {
          push(room);
        }
        return undefined;
      }
      case 'game:leave': {
        const room = roomOf(conn, msg.roomId);
        if (!room) return undefined;
        if (room.status === 'playing') {
          const seat = room.players.indexOf(me) + 1;
          finish(room, seat === 1 ? 2 : 1, 'resign');
        }
        closeRoom(room);
        return undefined;
      }
      case 'game:sync': {
        const rid = userRoom.get(me);
        const room = rid ? rooms.get(rid) : null;
        conn.send({
          type: 'game:sync',
          room: room ? roomView(room, me) : null,
          invites: [...invites.values()].filter((i) => i.from === me || i.to === me).map(inviteDto),
        });
        return undefined;
      }
      default:
        return undefined;
    }
  }

  /** 用户全部连接断开 */
  function onOffline(userId) {
    for (const inv of [...invites.values()]) {
      if (inv.from === userId || inv.to === userId) closeInvite(inv, 'offline');
    }
    const rid = userRoom.get(userId);
    const room = rid && rooms.get(rid);
    if (!room) return;
    if (room.status !== 'playing') {
      if (room.players.every((u) => !online(u))) closeRoom(room); // 都走了就回收
      else push(room);
      return;
    }
    const seat = room.players.indexOf(userId) + 1;
    room.graceTimers.set(userId, setTimer(() => {
      room.graceTimers.delete(userId);
      if (!online(userId)) finish(room, seat === 1 ? 2 : 1, 'disconnect');
    }, RECONNECT_GRACE_MS));
    push(room); // 通知对手 opponentOnline=false
  }

  /** 用户重新上线（第一条连接） */
  function onOnline(userId) {
    const rid = userRoom.get(userId);
    const room = rid && rooms.get(rid);
    if (!room) return;
    const t = room.graceTimers.get(userId);
    if (t) { clearTimer(t); room.graceTimers.delete(userId); }
    push(room);
  }

  return { handle, onOffline, onOnline, _rooms: rooms, _invites: invites, _userRoom: userRoom };
}
