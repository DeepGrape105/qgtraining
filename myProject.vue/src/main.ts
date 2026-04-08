import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'  // 1. 导入
import App from './App.vue'

const pinia = createPinia()          // 2. 创建
const app = createApp(App)

app.use(pinia)                       // 3. 挂载
app.mount('#app')