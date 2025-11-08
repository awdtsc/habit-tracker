// practice.js
// ===== すごく小さいテストランナー =====
function eq(actual, expected) {
  const ja = JSON.stringify(actual);
  const je = JSON.stringify(expected);
  if (ja !== je) throw new Error(`expected ${je}, got ${ja}`);
}
async function test(name, fn) {
  try { await fn(); console.log("✅ PASS:", name); }
  catch (e) { console.error("❌ FAIL:", name, "-", e.message); }
}

// ===== ここから“あなたが埋める”小さな練習 =====
// ハビットトラッカーで出てきた要素だけに限定しているよ。

/* Lv.0: ウォームアップ（+1できる） */
const Counter = {
  value: 0,
  inc() {
    // TODO: this.value を 1 増やして返す
    // 例: 0 -> 1 -> 2 ...
    this.value += 1;
    return this.value;
  }
};

/* Lv.1: 文字列ユーティリティ (todayYmd) */
function todayYmd(date = new Date()) {
  // TODO: YYYY-MM-DD を返す
  // 例: 2025-09-04
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

/* Lv.2: 時間帯 → スロット番号 (toSlotNum)
   morning=1, afternoon=2, evening=3, null/undefined=0, 数値はそのまま整数化 */
function toSlotNum(s) {
  // TODO
  if (s === null || s === undefined) return 0;
  if (typeof s === 'number') return s | 0;
  const map = { morning:1, afternoon:2, evening:3, anytime:0 };
  return map[s] ?? 0;
}

/* Lv.3: 週の開始 (startOfWeek: 月曜始まり) */
function startOfWeek(date = new Date()) {
  // TODO: 与えられた日付の「その週の月曜日」を返す（時刻は日単位でOK）
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const w = d.getDay() || 7; // Sun=0 -> 7
  if (w !== 1) d.setDate(d.getDate() - (w - 1));
  return d;
}

/* Lv.4: 日付加算 (addDays) と ISOローカル文字列 (isoLocal) */
function addDays(date, n) {
  // TODO: date に n 日足した新しい Date を返す
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function isoLocal(date) {
  // TODO: YYYY-MM-DD を返す (todayYmd と同じ形式でOK)
  return todayYmd(date);
}

/* Lv.5: ログのキー (logKey)
   仕様: `${habitId}|${date}|${slotNum}`
   例: logKey(2, '2025-09-04', 3) => "2|2025-09-04|3"
*/
function logKey(habitId, ymd, slotNum) {
  // TODO
  return `${habitId}|${ymd}|${slotNum}`;
}

/* Lv.6: 簡易ストア（checks と rates）
   - checks: { [logKey]: true/false } でチェック状態を持つ
   - rates:   7日ぶんの完了率 (0/50/100) を持つ（超簡略版）
*/
function createBoard() {
  const state = {
    checks: {},        // { "2|2025-09-04|3": true, ... }
    rates: [0,0,0,0,0,0,0], // 月〜日の達成率
  };

  function recomputeRates() {
    // TODO: ここでは簡略化して「true があれば100、なければ0」というルールにする
    // 実際は日別に集計するが、練習なので全体で一個でも true があれば [100,0,0,0,0,0,0] にするなどでもOK
    const hasTrue = Object.values(state.checks).some(Boolean);
    state.rates = hasTrue ? [100,0,0,0,0,0,0] : [0,0,0,0,0,0,0];
  }

  function toggle(habitId, ymd, slotNum, desired) {
    // TODO: checks[logKey] を desired（true/false）にして recomputeRates を呼ぶ
    const k = logKey(habitId, ymd, slotNum);
    state.checks[k] = !!desired;
    recomputeRates();
    return state;
  }

  function getLog(habitId, ymd, slotNum) {
    // TODO: checks から状態を返す（なければ false）
    const k = logKey(habitId, ymd, slotNum);
    return !!state.checks[k];
  }

  return { state, toggle, getLog, recomputeRates };
}

/* Lv.7: timeslot 正規化 (normalizeTimeslot)
   - 入力: 'morning'|'afternoon'|'evening'|null|undefined|number
   - 出力: 'morning'|'afternoon'|'evening'|'anytime'
*/
function normalizeTimeslot(s) {
  // TODO: 数値なら 1/2/3 を文字列に、null/undefined は 'anytime'
  if (s === null || s === undefined) return 'anytime';
  const n = typeof s === 'number' ? (s|0) : toSlotNum(s);
  const m = {1:'morning', 2:'afternoon', 3:'evening', 0:'anytime'};
  return m[n] ?? 'anytime';
}

/* Lv.8: 今日出すべき習慣のフィルタ (plannedHabits)
   入力: habits: [{id, days_of_week:[1..7], time_slot:'morning|afternoon|evening|anytime'}]
        todayW: 1..7（月=1）
   仕様: todayW が含まれていて、time_slot が一致 or 'anytime' なら採用
*/
function plannedHabits(habits, todayW, targetSlot) {
  // TODO
  return habits.filter(h => {
    const okDay = Array.isArray(h.days_of_week) && h.days_of_week.includes(todayW);
    const slot  = normalizeTimeslot(h.time_slot);
    const okSlot = slot === 'anytime' || slot === targetSlot;
    return okDay && okSlot;
  });
}

/* Lv.9: 最優先1件を選ぶ (priorityScore は超簡略)
   - ここでは仮の優先度: morning=3, afternoon=2, evening=1, anytime=0 + title の長さ/100
*/
function priorityScore(h) {
  const base = { morning:3, afternoon:2, evening:1, anytime:0 }[normalizeTimeslot(h.time_slot)] ?? 0;
  return base + (h.title?.length ?? 0)/100;
}
function pickTop(habits) {
  // TODO: 最大 priorityScore の1件（同点なら先に出た方）
  let best = null, bestScore = -Infinity;
  for (const h of habits) {
    const s = priorityScore(h);
    if (s > bestScore) { best = h; bestScore = s; }
  }
  return best;
}

/* Lv.10: 0→目標の途中を経由しないパーセント更新 (noZeroJump)
   - 現在値 cur、目標値 next
   - 連続で呼ばれても 0 を経由しない（cur=30→next=60→next=40 など）
   - 戻り値: 次の表示値
*/
function noZeroJump(cur, next) {
  // TODO: 0→next はOK。cur>0 のとき next が 0 でない限り 0 を挟まない。
  // ここでは単純に next を返す実装でOK（可視化側でアニメ制御想定）。
  return next;
}

/* Lv.11: 依存関係トラッカー（超ミニ）
   - track(prop, effectFn), trigger(prop) で effectFn を呼ぶ
*/
function createDeps() {
  const depsMap = new Map(); // prop -> Set<fn>
  function track(prop, fn) {
    // TODO
    if (!depsMap.has(prop)) depsMap.set(prop, new Set());
    depsMap.get(prop).add(fn);
  }
  function trigger(prop) {
    // TODO
    if (depsMap.has(prop)) {
      for (const fn of depsMap.get(prop)) fn();
    }
  }
  return { track, trigger, _deps: depsMap };
}

/* Lv.12: 疑似API (axios の代わり) を await で扱う
   - fetchHabits(): 50ms 後に習慣配列を返す
*/
function fetchHabits() {
  // TODO: Promise を返し、setTimeoutでresolve
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        { id: 1, title: '水を飲む', days_of_week: [1,2,3,4,5,6,7], time_slot: 'morning' },
        { id: 2, title: '日記',     days_of_week: [1,2,3,4,5,6,7], time_slot: 'evening' },
        { id: 3, title: '散歩',     days_of_week: [1,3,5],         time_slot: 'anytime' },
      ]);
    }, 50);
  });
}

/* ============== テスト ============== */
(async () => {
  // Lv.0
  await test("Lv.0 Counter +1", () => {
    Counter.value = 0;
    eq(Counter.inc(), 1);
    eq(Counter.inc(), 2);
  });

  // Lv.1
  await test("Lv.1 todayYmd", () => {
    const d = new Date(2025, 8, 4); // 2025-09-04 (month 0-based)
    eq(todayYmd(d), "2025-09-04");
  });

  // Lv.2
  await test("Lv.2 toSlotNum", () => {
    eq(toSlotNum('morning'), 1);
    eq(toSlotNum('afternoon'), 2);
    eq(toSlotNum('evening'), 3);
    eq(toSlotNum('anytime'), 0);
    eq(toSlotNum(undefined), 0);
    eq(toSlotNum(2), 2);
  });

  // Lv.3
  await test("Lv.3 startOfWeek(月曜始まり)", () => {
    const thu = new Date(2025, 8, 4); // Thu 2025-09-04
    const mon = startOfWeek(thu);
    eq(todayYmd(mon), "2025-09-01");
  });

  // Lv.4
  await test("Lv.4 addDays / isoLocal", () => {
    const d = new Date(2025, 8, 1);
    eq(isoLocal(addDays(d, 3)), "2025-09-04");
  });

  // Lv.5
  await test("Lv.5 logKey", () => {
    eq(logKey(2, "2025-09-04", 3), "2|2025-09-04|3");
  });

  // Lv.6
  await test("Lv.6 board.toggle/getLog/recomputeRates", () => {
    const b = createBoard();
    const ymd = "2025-09-04";
    eq(b.getLog(1, ymd, 1), false);
    b.toggle(1, ymd, 1, true);
    eq(b.getLog(1, ymd, 1), true);
    eq(b.state.rates[0], 100);
  });

  // Lv.7
  await test("Lv.7 normalizeTimeslot", () => {
    eq(normalizeTimeslot('morning'), 'morning');
    eq(normalizeTimeslot(2), 'afternoon');
    eq(normalizeTimeslot(null), 'anytime');
  });

  // Lv.8
  await test("Lv.8 plannedHabits", () => {
    const hs = [
      { id:1, title:"水", days_of_week:[1,2,3,4,5,6,7], time_slot:'morning'},
      { id:2, title:"日記", days_of_week:[1,2,3,4,5,6,7], time_slot:'evening'},
      { id:3, title:"散歩", days_of_week:[1,3,5], time_slot:'anytime'},
    ];
    // 木曜=4, 目標スロット 'morning'
    const r = plannedHabits(hs, 4, 'morning');
    eq(r.map(h=>h.id), [1,3]); // morning と anytime
  });

  // Lv.9
  await test("Lv.9 pickTop (priorityScore)", () => {
    const hs = [
      { id:10, title:"zzz", time_slot:'evening' },
      { id:20, title:"水を飲む", time_slot:'morning' },
      { id:30, title:"日記", time_slot:'afternoon' },
    ];
    eq(pickTop(hs).id, 20); // morningが最優先
  });

  // Lv.10
  await test("Lv.10 noZeroJump", () => {
    eq(noZeroJump(30, 60), 60);
    eq(noZeroJump(60, 40), 40);
  });

  // Lv.11
  await test("Lv.11 deps track/trigger", () => {
    const { track, trigger, _deps } = createDeps();
    let called = 0;
    track('count', () => { called++; });
    eq(called, 0);
    trigger('count');
    eq(called, 1);
    eq(_deps.has('count'), true);
  });

  // Lv.12
  await test("Lv.12 fetchHabits (擬似API)", async () => {
    const hs = await fetchHabits();
    eq(Array.isArray(hs), true);
    eq(hs.length > 0, true);
  });
})();
