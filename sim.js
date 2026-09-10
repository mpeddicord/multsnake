// Pure game simulation. Host runs this; guests only render what the host sends.
const W = 40, H = 30, FOOD = 3, RESPAWN_TICKS = 15;
const COLORS = ['#7CFF4A', '#3DE1FF', '#FF4FD8', '#FFB03A', '#B48CFF', '#FFF15A', '#FF7A45', '#5AFFC8'];
const rnd = n => Math.floor(Math.random() * n);

function newGame() { return { snakes: {}, food: [], tick: 0 }; }

function place(s) {
  const x = 3 + rnd(W - 6), y = 1 + rnd(H - 2);
  s.body = [[x, y], [x - 1, y], [x - 2, y]];
  s.dir = s.next = [1, 0];
  s.alive = true;
  s.score = 0;
}

function spawn(g, id, name) {
  const used = new Set(Object.values(g.snakes).map(s => s.color));
  const s = { name: String(name).slice(0, 12) || 'anon', color: COLORS.find(c => !used.has(c)) || COLORS[rnd(COLORS.length)], best: 0 };
  place(s);
  g.snakes[id] = s;
  return s;
}

function turn(s, d) {
  if (d[0] === -s.dir[0] && d[1] === -s.dir[1]) return; // no 180s
  s.next = d;
}

function step(g) {
  g.tick++;
  const S = g.snakes;
  for (const id in S) {
    const s = S[id];
    if (!s.alive) { if (g.tick >= s.respawnAt) place(s); continue; }
    s.dir = s.next;
    const [hx, hy] = s.body[0];
    s.body.unshift([hx + s.dir[0], hy + s.dir[1]]);
    const fi = g.food.findIndex(f => f[0] === s.body[0][0] && f[1] === s.body[0][1]);
    if (fi >= 0) { g.food.splice(fi, 1); s.score++; s.best = Math.max(s.best, s.score); }
    else s.body.pop();
  }
  const dead = new Set();
  for (const id in S) {
    const s = S[id];
    if (!s.alive) continue;
    const [hx, hy] = s.body[0];
    if (hx < 0 || hy < 0 || hx >= W || hy >= H) { dead.add(id); continue; }
    for (const oid in S) {
      const o = S[oid];
      if (!o.alive) continue;
      for (let i = oid === id ? 1 : 0; i < o.body.length; i++)
        if (o.body[i][0] === hx && o.body[i][1] === hy) { dead.add(id); break; }
    }
  }
  for (const id of dead) { const s = S[id]; s.alive = false; s.body = []; s.respawnAt = g.tick + RESPAWN_TICKS; }
  const taken = new Set();
  for (const id in S) for (const [x, y] of S[id].body) taken.add(x + ',' + y);
  for (const [x, y] of g.food) taken.add(x + ',' + y);
  while (g.food.length < FOOD) {
    const x = rnd(W), y = rnd(H);
    if (!taken.has(x + ',' + y)) { g.food.push([x, y]); taken.add(x + ',' + y); }
  }
}

if (typeof module !== 'undefined') module.exports = { W, H, newGame, spawn, turn, step };

// ---- Autopilot: BFS to nearest food, but only if the tail stays reachable after walking there (never traps itself).
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (x, y) => x * H + y;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

function bfs(k0, blocked) {
  const dist = new Int16Array(W * H).fill(-1), prev = new Int16Array(W * H).fill(-1), q = [k0];
  dist[k0] = 0;
  for (let i = 0; i < q.length; i++) {
    const k = q[i], x = Math.floor(k / H), y = k % H;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const nk = key(nx, ny);
      if (blocked[nk] || dist[nk] >= 0) continue;
      dist[nk] = dist[k] + 1; prev[nk] = k; q.push(nk);
    }
  }
  return { dist, prev };
}

function think(g, id) {
  const me = g.snakes[id];
  if (!me || !me.alive) return null;
  const occ = new Uint8Array(W * H), danger = new Uint8Array(W * H), isFood = new Uint8Array(W * H), othersOcc = new Uint8Array(W * H);
  for (const oid in g.snakes) {
    const s = g.snakes[oid];
    if (!s.alive) continue;
    for (const [x, y] of s.body) { occ[key(x, y)] = 1; if (oid !== id) othersOcc[key(x, y)] = 1; }
    if (oid !== id) for (const [dx, dy] of DIRS) { const x = s.body[0][0] + dx, y = s.body[0][1] + dy; if (inb(x, y)) danger[key(x, y)] = 1; }
  }
  for (const [x, y] of g.food) isFood[key(x, y)] = 1;
  const head = key(me.body[0][0], me.body[0][1]);

  const walk = path => { // body after following path (grows on food, like step)
    const b = me.body.slice();
    for (const k of path) { b.unshift([Math.floor(k / H), k % H]); if (!isFood[k]) b.pop(); }
    return b;
  };
  const tailReachable = b => {
    const blocked = othersOcc.slice();
    for (let i = 0; i < b.length - 1; i++) blocked[key(b[i][0], b[i][1])] = 1;
    return bfs(key(b[0][0], b[0][1]), blocked).dist[key(b[b.length - 1][0], b[b.length - 1][1])] >= 0;
  };
  const dirTo = k => [Math.floor(k / H) - me.body[0][0], k % H - me.body[0][1]];

  const blocked = occ.map((v, i) => v | danger[i]);
  const { dist, prev } = bfs(head, blocked);
  let target = -1;
  for (const [x, y] of g.food) { const k = key(x, y); if (dist[k] >= 0 && (target < 0 || dist[k] < dist[target])) target = k; }
  if (target >= 0) {
    const path = [];
    for (let k = target; k !== head; k = prev[k]) path.unshift(k);
    if (tailReachable(walk(path))) return dirTo(path[0]);
  }

  let best = null, bestScore = -1;
  for (const [dx, dy] of DIRS) {
    if (dx === -me.dir[0] && dy === -me.dir[1]) continue;
    const x = me.body[0][0] + dx, y = me.body[0][1] + dy;
    if (!inb(x, y) || occ[key(x, y)]) continue;
    const k = key(x, y), b = walk([k]);
    let area = 0;
    for (const d of bfs(k, occ).dist) if (d >= 0) area++;
    const score = (tailReachable(b) ? 1e6 : 0) + (danger[k] ? 0 : 1e5) + area;
    if (score > bestScore) { bestScore = score; best = [dx, dy]; }
  }
  return best;
}

if (typeof module !== 'undefined') module.exports.think = think;
