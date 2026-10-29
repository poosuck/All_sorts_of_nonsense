import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: { title: "별짓 — 아주 쓸데있는 딴짓" },
    },
    {
      path: "/pudding",
      name: "pudding",
      component: () => import("./views/PuddingView.vue"),
      meta: { title: "말랑 푸딩 — 별짓" },
    },
    {
      path: "/pigeon",
      name: "pigeon",
      component: () => import("./views/PigeonView.vue"),
      meta: { title: "비둘기 모이주기 · 새로 준비 중 — 별짓" },
    },
    {
      path: "/:pathMatch(.*)*",
      component: () => import("./views/NotFoundView.vue"),
      meta: { title: "길 잃은 별짓" },
    },
  ],
  scrollBehavior(to) {
    return to.hash ? { el: to.hash, behavior: "smooth" } : { top: 0 };
  },
});
router.afterEach((to) => {
  document.title = to.meta.title;
});
export default router;
