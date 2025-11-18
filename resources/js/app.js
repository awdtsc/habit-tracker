import './bootstrap'
import Alpine from 'alpinejs'
window.Alpine = Alpine
Alpine.start()

import { createApp } from 'vue'
import HabitWeeklyBoard from './components/HabitWeeklyBoard.vue'
const el = document.getElementById('app')
if (el) createApp(HabitWeeklyBoard).mount(el)