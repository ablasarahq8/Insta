// أدوات مشتركة بين صفحات الموقع
import { FUNNEL, GOALS } from "./taxonomy.js";
export { icon } from "./icons.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const STATUSES = { idea: "فكرة", draft: "مسودة", scheduled: "مجدولة", published: "منشورة", failed: "فشلت" };


export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function api(url, { method = "GET", body } = {}) {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body && !isForm ? JSON.stringify(body) : body,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `خطأ ${res.status}`);
  return data;
}

export function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 3000);
}

export async function busy(btn, fn) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "لحظة...";
  try { return await fn(); }
  catch (err) { toast(err.message); }
  finally { btn.disabled = false; btn.textContent = label; }
}

// تعبئة قوائم المرحلة والهدف
$$("[data-options=funnel]").forEach((sel) =>
  sel.insertAdjacentHTML("beforeend", Object.entries(FUNNEL)
    .map(([k, f]) => `<option value="${k}">${f.label} — ${f.name}</option>`).join("")));
$$("[data-options=goal]").forEach((sel) =>
  sel.insertAdjacentHTML("beforeend", Object.entries(GOALS)
    .map(([k, g]) => `<option value="${k}">${g.name}</option>`).join("")));

export const funnelBadge = (f) => FUNNEL[f] ? `<span class="badge ${f}" title="${FUNNEL[f].name}">${FUNNEL[f].label}</span>` : "";
export const goalBadge = (g) => GOALS[g] ? `<span class="badge">${GOALS[g].name}</span>` : "";

// ---------- الوضع البسيط / المتقدم ----------
// الأدوات المتقدمة (التصميم والنشر) مخفية إلا إذا شغلتها من ملف الحساب
export function setAdvanced(on) {
  document.body.classList.toggle("advanced", on);
  try { localStorage.setItem("advanced", on ? "1" : ""); } catch {}
}
let advancedSaved = false;
try { advancedSaved = localStorage.getItem("advanced") === "1"; } catch {}
setAdvanced(advancedSaved);

// علامات المتابعة: صورت / عدلت / نزلت
export const CHECKS = { shot: "صورت", edited: "عدلت", posted: "نزلت" };
export const checksBadge = (checks = []) => {
  const n = checks.filter((c) => c in CHECKS).length;
  return n ? `<span class="badge checks ${n === 3 ? "done" : ""}">✓ ${n}/3</span>` : "";
};

// ---------- التنقل ----------
export function show(view) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  $$(".view").forEach((v) => (v.hidden = v.id !== `view-${view}`));
}
$$(".tab").forEach((t) => t.addEventListener("click", () => show(t.dataset.view)));
$$("[data-goto]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); show(a.dataset.goto); }));

// تاريخ محلي بصيغة YYYY-MM-DD
export const localDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// "YYYY-MM-DD" ← Date بتوقيت الجهاز (منتصف الليل)
export const fromDateStr = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

export const fmtDate = (d, opts) => d.toLocaleDateString("ar-KW", opts);

export async function uploadFiles(fileList) {
  const fd = new FormData();
  [...fileList].forEach((f) => fd.append("files", f));
  return api("/api/upload", { method: "POST", body: fd });
}
