// resources/js/utils/habitToggle.js
import axios from 'axios';

/**
 * 習慣のチェック/解除をトグルし、全体に通知イベントを飛ばす。
 * @param {Object} p
 * @param {number} p.habitId
 * @param {string} p.date       // 'YYYY-MM-DD'
 * @param {number} [p.time_slot] // 0=終日/すべて（デフォルト0）
 * @param {boolean|null} [p.value] // true/false 指定。省略(null)でトグル
 */
export async function toggleHabit({ habitId, date, time_slot = 0, value = null }) {
  const { data } = await axios.post('/api/habit-logs/toggle', {
    habit_id: habitId,
    date,
    time_slot,
    ...(value === null ? {} : { value })
  });

  // 週タブの一覧 & グラフを即時更新させるための通知
  window.dispatchEvent(new CustomEvent('habit:toggle', {
    detail: {
      habitId,
      date,
      time_slot,
      status: data.status // true/false
    }
  }));

  return data; // 呼び出し元でも即時反映に使える
}