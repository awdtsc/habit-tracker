const TEST_FILTER = ""; // 例: "1-2" と入れるとその問題だけ実行

/*************** 簡易テストランナー *****************/
function eq(actual, expected) {
  const ja = JSON.stringify(actual);
  const je = JSON.stringify(expected);
  if (ja !== je) throw new Error(`expected ${je}, got ${ja}`);
}
async function test(name, fn) {
  if (TEST_FILTER && !name.includes(TEST_FILTER)) return;
  try { await fn(); console.log("✅ PASS:", name); }
  catch (e) { console.error("❌ FAIL:", name, "-", e.message); }
}
/*****************************************************/

/*************** ここから “あなたの回答” を書く ***************/
// TODO を自分で埋めよう。最初はわざと未完成なので FAIL になります。

const Answers = {
  // Lv.0

  // 0-1 角括弧アクセス: obj[k] を返して
  q01_bracketAccess(obj, k) {
    return obj[k];
  },

  key(hid, iso) {
    /* TODO: 例 → key(7, '2025-08-20') は "7|2025-08-20" */
    return `${hid}|${iso}`;
  },

  toBool(v) {
    /* TODO: v を真偽値にして返す（Boolean(v) でもOK） */
    return !!v;
  },

  jpDow(d) {
    /* TODO: ['日','月','火','水','木','金','土'][d.getDay()] を使う */
    return ['日','月','火','水','木','金','土'][d.getDay()];
  },

  // 1-1 state.checks から素の状態を boolean で返す
  isCheckedRaw(state, hid, iso) {
    /* TODO:
       - Answers.key(hid, iso) でキー作成
       - state.checks[key] を boolean 化して返す（!! または Boolean）
    */
    const key = Answers.key(hid, iso);
    return !!state.chacks[key];
  },

  checkedNow(state, overrides, hid, iso) {
    /* TODO:
       - const k = Answers.key(hid, iso)
       - (k in overrides) ? overrides[k] : Answers.isCheckedRaw(state, hid, iso)
    */
    const k = Answers.key(hid, iso);
    return (k in overrides) ? overrides[k] : Answers.isCheckedRaw(state, hid, iso);
  },

  // 1-3 楽観反映の onToggle:
  //     ① 即 overrides に書く → ② await 保存 → ③ isCheckedRaw と一致したら delete
  async onToggle(fakeToggle, state, overrides, hid, iso, val) {
    
    return undefined;
  },

};

// 1-2 overrides にキーがあればそれを優先、無ければ isCheckedRaw
  
(async () => {
  console.clear?.();
  console.log("KATA start\n");

  // Lv.0
  await test("0-1 bracket access", () => {
    const obj = { a: 1, b: 2 }, k = 'a';
    eq(Answers.q01_bracketAccess(obj, k), 1);
  });

  await test("0-2 template key", () => {
    eq(Answers.key(7, '2025-08-20'), "7|2025-08-20");
  });

  await test("0-3 to boolean", () => {
    eq([Answers.toBool(0), Answers.toBool(1), Answers.toBool(''), Answers.toBool('ok')], [false, true, false, true]);
  });

  await test("0-4 jp day of week", () => {
    // 2025-08-20 は水曜（タイムゾーン差回避のため YYYY/MM/DD 形式）
    eq(Answers.jpDow(new Date('2025/08/20')), '水');
  });

  // Lv.1
  await test("1-1 isCheckedRaw", () => {
    const iso = '2025-08-20', k = `${7}|${iso}`;
    const state = { checks: { [k]: true, [`${8}|${iso}`]: 0 } };
    eq([Answers.isCheckedRaw(state, 7, iso), Answers.isCheckedRaw(state, 8, iso), Answers.isCheckedRaw(state, 9, iso)], [true, false, false]);
  });

  await test("1-2 checkedNow override first", () => {
    const iso = '2025-08-20';
    const state = { checks: { [`${7}|${iso}`]: true } };
    const overrides = {};
    eq(Answers.checkedNow(state, overrides, 7, iso), true);
    overrides[`${7}|${iso}`] = false;
    eq(Answers.checkedNow(state, overrides, 7, iso), false);
    delete overrides[`${7}|${iso}`];
    eq(Answers.checkedNow(state, overrides, 7, iso), true);
  });

  await test("1-3 optimistic toggle flow", async () => {
    const iso = '2025-08-20';
    const state = { checks: { [`${7}|${iso}`]: false } };
    const overrides = {};
    const fakeToggle = (hid, iso, val) => new Promise(res => {
      setTimeout(() => { state.checks[`${hid}|${iso}`] = val; res(); }, 50);
    });

    await Answers.onToggle(fakeToggle, state, overrides, 7, iso, true);
    eq([overrides[`${7}|${iso}`] ?? null, state.checks[`${7}|${iso}`]], [null, true]);

    await Answers.onToggle(fakeToggle, state, overrides, 7, iso, false);
    eq([overrides[`${7}|${iso}`] ?? null, state.checks[`${7}|${iso}`]], [null, false]);
  });

  // Lv.2
  await test("2-1 candidates for today (Wed)", () => {
    const todayISO = '2025/08/20';
    const dow = new Date(todayISO).getDay(); // 3 (水)
    const habits = [
      { id: 1, title: '歯磨き',  frequency_type: 'daily' },
      { id: 2, title: '日記',    frequency_type: 'weekdays' },
      { id: 3, title: '筋トレ',  frequency_type: 'custom', days_of_week: [1,3,5] }, // 月水金
      { id: 4, title: '禁酒',    frequency_type: 'custom', days_of_week: [2,4] },   // 火木
    ];
    const shown = habits.filter(h => Answers.shownToday(h, dow));
    eq(shown.map(h => h.title), ['歯磨き','日記','筋トレ']);
  });

  await test("2-2 progress numbers", () => {
    const iso = '2025-08-20';
    const candidates = [{id:1,title:'歯磨き'},{id:2,title:'日記'},{id:3,title:'筋トレ'}];
    const state = { checks: { [`${1}|${iso}`]: true } };
    const p = Answers.progress(candidates, state, iso);
    eq([p.done, p.total, p.percent], [1,3,33]);
  });

  // Lv.3
  await test("3-1 status pill decision", () => {
    eq(Answers.statusPill(true,false)?.label, '達成済み');
    eq(Answers.statusPill(false,false)?.label, '未完了');
    eq(Answers.statusPill(false,true)?.label, '対象外');
  });

  console.log("\nKATA finished.");
})();