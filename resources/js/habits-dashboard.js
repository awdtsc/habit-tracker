// resources/js/habits-dashboard.js
import { createApp, getCurrentInstance } from 'vue'
import HabitDashboard from './components/HabitDashboard.vue'

// ルーターがある環境でも/なくても動くようにそのままマウント
const app = createApp(HabitDashboard)
app.mount('#habit-dashboard-root')