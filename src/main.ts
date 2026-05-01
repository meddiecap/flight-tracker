import { createApp } from "vue"
import { createPinia } from "pinia"
import { createRouter, createWebHashHistory } from "vue-router"
import "./style.css"
import App from "./App.vue"
import MapView from "./views/MapView.vue"

const router = createRouter({
    history: createWebHashHistory(),
    routes: [{ path: "/", component: MapView }],
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount("#app")
