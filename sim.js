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
