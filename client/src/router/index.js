import { createRouter, createWebHistory } from "vue-router";

const routes = [
  { path: "/login", name: "Login", component: () => import("../views/Login.vue") },
  { path: "/register", name: "Register", component: () => import("../views/Register.vue") },
  {
    path: "/",
    component: () => import("../layouts/UserLayout.vue"),
    meta: { requiresAuth: true },
    children: [
      { path: "", name: "TicketList", component: () => import("../views/TicketList.vue") },
      { path: "dashboard", name: "Dashboard", component: () => import("../views/Dashboard.vue") },
      { path: "tickets/new", name: "TicketCreate", component: () => import("../views/TicketCreate.vue") },
      { path: "tickets/:id", name: "TicketDetail", component: () => import("../views/TicketDetail.vue") },
      { path: "toolkit", name: "ToolkitList", component: () => import("../views/ToolkitList.vue") },
      { path: "toolkit/:id", name: "ToolkitDetail", component: () => import("../views/ToolkitDetail.vue") },
      { path: "notifications", name: "Notifications", component: () => import("../views/Notifications.vue") },
    ],
  },
  {
    path: "/admin",
    component: () => import("../layouts/AdminLayout.vue"),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: "tickets", name: "AdminTickets", component: () => import("../views/admin/AdminTickets.vue") },
      { path: "users", name: "AdminUsers", component: () => import("../views/admin/AdminUsers.vue") },
    ],
  },
  { path: "/:pathMatch(.*)*", name: "NotFound", component: () => import("../views/NotFound.vue") },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (to.meta.requiresAuth && !token) { next("/login"); return; }
  if (to.meta.requiresAdmin && !["admin", "dev_lead"].includes(user?.role)) { next("/"); return; }
  if ((to.path === "/login" || to.path === "/register") && token) { next("/"); return; }
  next();
});

export default router;
