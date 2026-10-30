// صفحة الخطة التسويقية
import { FUNNEL, GOALS, STRATEGY_GOALS, LAUNCH_TYPES } from "./taxonomy.js";
import { $, $$, esc, api, toast, busy, goalBadge, localDateStr, fromDateStr, fmtDate } from "./common.js";
import { addDaysStr, toSunday, launchEvents, strategyWeek } from "./planutil.js";

const form = $("#strategy-form");
let strategy = null;
let ideas = [];

window.addEventListener("ideas-changed", (e) => { ideas = e.detail; renderPlan(); });

const dateLabel = (s, opts = { day: "numeric", month: "short" }) => fmtDate(fromDateStr(s), opts);

// ---------- النموذج ----------
$("#goal-list").innerHTML = Object.entries(STRATEGY_GOALS).map(([k, g]) => `
  <div class="goal-row">
    <label class="check"><input type="checkbox" data-goal="${k}"> ${g.emoji} ${g.name}</label>
    <input data-detail="${k}" placeholder="${g.placeholder}">
  </div>`).join("");

function launchRow(l = {}) {
  const div = document.createElement("div");
  div.className = "launch-row";
  div.innerHTML = `
    <input data-f="name" placeholder="اسم الإطلاق — مثلاً: دورة التصوير بالجوال" value="${esc(l.name || "")}">
    <select data-f="type">${Object.entries(LAUNCH_TYPES).map(([k, v]) => `<option value="${k}" ${l.type === k ? "selected" : ""}>${v}</option>`).join("")}</select>
    <input data-f="date" type="date" value="${esc(l.date || "")}" title="تاريخ الإطلاق">
    <input data-f="details" placeholder="تفاصيل: السعر، لمنو، شنو يميزه..." value="${esc(l.details || "")}">
    <button type="button" class="ghost" data-remove title="شيل">✕</button>`;
  if (l.id) div.dataset.id = l.id;
  return div;
}

$("#add-launch").addEventListener("click", () => $("#launch-list").append(launchRow()));
$("#launch-list").addEventListener("click", (e) => {
  if (e.target.closest("[data-remove]")) e.target.closest(".launch-row").remove();
});

function fillForm() {
  form.elements.startDate.value = strategy.startDate || localDateStr(new Date());
  form.elements.weeks.value = String(strategy.weeks || 13);
  form.elements.notes.value = strategy.notes || "";
  for (const box of $$("[data-goal]")) {
    const g = strategy.goals.find((x) => x.type === box.dataset.goal);
    box.checked = Boolean(g);
    $(`[data-detail=${box.dataset.goal}]`).value = g?.detail || "";
  }
  $("#launch-list").replaceChildren(...strategy.launches.map(launchRow));
}

function collectForm() {
  const startDate = form.elements.startDate.value;
  if (!startDate) throw new Error("حدد تاريخ بداية الخطة");
  return {
    startDate: toSunday(startDate),
    weeks: Number(form.elements.weeks.value),
    notes: form.elements.notes.value,
    goals: $$("[data-goal]:checked").map((b) => ({
      type: b.dataset.goal,
      detail: $(`[data-detail=${b.dataset.goal}]`).value.trim(),
    })),
    launches: $$(".launch-row")
      .map((row) => ({
        id: row.dataset.id,
        ...Object.fromEntries($$("[data-f]", row).map((el) => [el.dataset.f, el.value.trim()])),
      }))
      .filter((l) => l.name),
  };
}

async function saveForm() {
  strategy = await api("/api/strategy", { method: "PUT", body: collectForm() });
  fillForm();
  publish();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  try { await saveForm(); toast("انحفظت ✓"); } catch (err) { toast(err.message); }
});

$("#build-strategy").addEventListener("click", (e) => {
  if (strategy.plan && !confirm("بتنبني خطة جديدة مكان الحالية. أكمل؟")) return;
  busy(e.target, async () => {
    await saveForm();
    toast("جاري بناء الخطة... ممكن تاخذ دقيقة");
    strategy = await api("/api/ai/strategy", { method: "POST" });
    publish();
    renderPlan();
    $("#strategy-plan").scrollIntoView({ behavior: "smooth" });
  });
});

const publish = () => window.dispatchEvent(new CustomEvent("strategy-changed", { detail: strategy }));

// ---------- عرض الخطة ----------
function funnelBar(w) {
  return `<div class="bar">${Object.keys(FUNNEL).map((k) => `<div class="${k}" style="width:${w[k]}%"></div>`).join("")}</div>
    <div class="legend">${Object.entries(FUNNEL).map(([k, f]) => `<span><i class="dot ${k}"></i>${f.label} ${w[k]}%</span>`).join("")}</div>`;
}

function renderPlan() {
  const el = $("#strategy-plan");
  const plan = strategy?.plan;
  if (!plan) {
    el.innerHTML = "";
    return;
  }
  const start = toSunday(strategy.startDate);
  const today = localDateStr(new Date());
  const events = launchEvents(strategy);
  const total = plan.weeks.length;

  el.innerHTML = `
    <div class="card plan-summary">
      <h2>ملخص الخطة</h2>
      <p>${esc(plan.summary)}</p>
      <div class="kpis">${plan.kpis.map((k) => `
        <div class="kpi"><span class="hint">${esc(k.goal)}</span><b>${esc(k.target)}</b><span class="hint">${esc(k.metric)}</span></div>`).join("")}</div>
    </div>

    <div class="card">
      <h2>المراحل</h2>
      <div class="phases">${plan.phases.map((p) => `
        <div class="phase" style="flex:${Math.max(p.endWeek - p.startWeek + 1, 1)}" title="${esc(p.objective)}">
          <b>${esc(p.name)}</b><span>أسبوع ${p.startWeek}${p.endWeek > p.startWeek ? `–${p.endWeek}` : ""}</span>
        </div>`).join("")}</div>
      <ul class="phase-list">${plan.phases.map((p) => `<li><b>${esc(p.name)}:</b> ${esc(p.objective)}</li>`).join("")}</ul>
    </div>

    ${events.length ? `
    <div class="card">
      <h2>📢 جدول الإعلان عن الإطلاقات</h2>
      <ol class="timeline">${events.map((ev) => `
        <li class="${ev.isLaunchDay ? "launch-day" : ""} ${ev.date < today ? "past" : ""}">
          <span class="when">${dateLabel(ev.date, { weekday: "short", day: "numeric", month: "short" })}</span>
          <div><b>${esc(ev.launch)} — ${esc(ev.title)}</b><p>${esc(ev.action)}</p></div>
        </li>`).join("")}</ol>
    </div>` : ""}

    <h2 class="section-title">الخطة أسبوع بأسبوع</h2>
    <div class="weeks">${plan.weeks.map((w) => {
      const weekDate = addDaysStr(start, (w.week - 1) * 7);
      const end = addDaysStr(weekDate, 6);
      const sw = strategyWeek(strategy, weekDate);
      const planned = ideas.filter((i) => i.scheduledAt && localDateStr(new Date(i.scheduledAt)) >= weekDate && localDateStr(new Date(i.scheduledAt)) <= end).length;
      const isNow = today >= weekDate && today <= end;
      return `
      <article class="card plan-week ${isNow ? "now" : ""}">
        <div class="row between">
          <b>الأسبوع ${w.week} من ${total}</b>
          <span class="hint">${dateLabel(weekDate)} – ${dateLabel(end)}</span>
        </div>
        <div class="meta"><span class="badge">${esc(w.phase)}</span>${isNow ? `<span class="badge scheduled">هالأسبوع</span>` : ""}</div>
        <h3>${esc(w.theme)}</h3>
        <p>${esc(w.focus)}</p>
        ${funnelBar(w)}
        <div class="meta">${w.goals.map(goalBadge).join("")}</div>
        <ul>${w.keyContent.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
        <p class="hint">🎯 ${esc(w.cta)}</p>
        ${sw?.events.length ? `<ul class="events">${sw.events.map((ev) => `<li class="${ev.isLaunchDay ? "launch-day" : ""}">📢 ${dateLabel(ev.date, { weekday: "short" })}: ${esc(ev.launch)} — ${esc(ev.title)}</li>`).join("")}</ul>` : ""}
        <div class="row between">
          <span class="hint">${planned} من ${w.postsPerWeek} منشورات محطوطة</span>
          <button class="primary small" data-week="${weekDate}">افتح الأسبوع ←</button>
        </div>
      </article>`;
    }).join("")}</div>`;
}

$("#strategy-plan").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-week]");
  if (btn) window.dispatchEvent(new CustomEvent("goto-week", { detail: btn.dataset.week }));
});

// ---------- البداية ----------
Promise.all([api("/api/strategy"), api("/api/ideas")])
  .then(([s, i]) => { strategy = s; ideas = i; fillForm(); renderPlan(); publish(); })
  .catch((err) => toast(err.message));
