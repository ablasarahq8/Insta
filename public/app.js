import { FUNNEL, FUNNEL_TARGET, GOALS, FORMATS } from "./taxonomy.js";
import {
  $, $$, esc, api, toast, busy, show, STATUSES, funnelBadge, goalBadge,
  localDateStr, fromDateStr, fmtDate, uploadFiles,
} from "./common.js";
import { strategyWeek } from "./planutil.js";

let ideas = [];
let filter = "all";
let editing = null; // نسخة من الفكرة اللي نعدلها

// ---------- الأفكار ----------
async function loadIdeas() {
  ideas = await api("/api/ideas");
  renderIdeas();
  renderWeek();
  window.dispatchEvent(new CustomEvent("ideas-changed", { detail: ideas }));
}

function renderIdeas() {
  const list = filter === "all" ? ideas : ideas.filter((i) => i.status === filter);
  const el = $("#ideas");
  if (!list.length) {
    el.innerHTML = `<p class="empty">ما في شي هني للحين — اكتب أول فكرة فوق أو خذ اقتراحات 👆</p>`;
    return;
  }
  el.innerHTML = list.map((i) => {
    const thumb = i.media?.find((m) => m.type === "image");
    const when = i.scheduledAt ? new Date(i.scheduledAt).toLocaleString("ar-KW", { dateStyle: "medium", timeStyle: "short" }) : "";
    return `
      <article class="card idea" data-id="${i.id}">
        ${thumb ? `<img class="thumb" src="${esc(thumb.url)}" alt="">` : ""}
        <h3>${esc(i.title)}</h3>
        ${i.notes || i.caption ? `<p>${esc(i.notes || i.caption)}</p>` : ""}
        <div class="meta">
          <span class="badge">${FORMATS[i.format] || i.format}</span>
          ${funnelBadge(i.funnel)}${goalBadge(i.goal)}
          <span class="badge ${i.status}">${STATUSES[i.status]}</span>
          ${i.source === "ai" ? `<span class="badge ai">✨ مقترحة</span>` : ""}
          ${when && i.status === "scheduled" ? `<span class="badge">${when}</span>` : ""}
        </div>
      </article>`;
  }).join("");
}

$("#ideas").addEventListener("click", (e) => {
  const card = e.target.closest(".idea");
  if (card) openEditor(ideas.find((i) => i.id === card.dataset.id));
});

$$(".chip").forEach((c) => c.addEventListener("click", () => {
  filter = c.dataset.status;
  $$(".chip").forEach((x) => x.classList.toggle("active", x === c));
  renderIdeas();
}));

$("#quick").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  try {
    await api("/api/ideas", { method: "POST", body: data });
    form.reset();
    await loadIdeas();
    toast("انحفظت الفكرة ✓");
  } catch (err) { toast(err.message); }
});

// ---------- المحرر ----------
const dialog = $("#editor");
const editorForm = $("#editor-form");

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function openEditor(idea) {
  editing = structuredClone(idea);
  for (const name of ["title", "format", "funnel", "goal", "status", "notes", "caption", "hashtags", "script"]) {
    editorForm.elements[name].value = editing[name] || "";
  }
  editorForm.elements.scheduledAt.value = toLocalInput(editing.scheduledAt);
  $("#editor-error").hidden = !editing.error;
  $("#editor-error").textContent = editing.error ? `آخر محاولة نشر فشلت: ${editing.error}` : "";
  renderMedia();
  updateScheduleHint();
  updateScriptBox();
  dialog.showModal();
}

// سكربت الفويس اوفر يطلع بس للريلز (أو إذا فيه سكربت محفوظ)
function updateScriptBox() {
  $("#script-box").hidden = editorForm.elements.format.value !== "reel" && !editorForm.elements.script.value;
}
editorForm.elements.format.addEventListener("change", updateScriptBox);

$("#ai-voiceover").addEventListener("click", (e) => busy(e.target, async () => {
  await saveEditor();
  const { script } = await api(`/api/ideas/${editing.id}/voiceover`, { method: "POST" });
  editorForm.elements.script.value = script;
  toast("انكتب السكربت — 📁 لقطة من مكتبتك · 🆕 لقطة تحتاج تصورها");
}));

function updateScheduleHint() {
  const { status, scheduledAt } = editorForm.elements;
  $("#schedule-hint").hidden = !(scheduledAt.value && ["idea", "draft"].includes(status.value));
}
editorForm.elements.status.addEventListener("change", updateScheduleHint);
editorForm.elements.scheduledAt.addEventListener("change", updateScheduleHint);

function renderMedia() {
  $("#media").innerHTML = editing.media.map((m, idx) => `
    <figure>
      ${m.type === "video" ? `<video src="${esc(m.url)}" muted></video>` : `<img src="${esc(m.url)}" alt="">`}
      <button type="button" data-remove="${idx}" title="شيل">✕</button>
    </figure>`).join("");
}

$("#media").addEventListener("click", (e) => {
  const idx = e.target.dataset.remove;
  if (idx !== undefined) { editing.media.splice(Number(idx), 1); renderMedia(); }
});

$("#files").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  try {
    editing.media.push(...(await uploadFiles(files)));
    renderMedia();
  } catch (err) { toast(err.message); }
});

$("#media-url").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const url = e.target.value.trim();
  if (!/^https?:\/\//.test(url)) return toast("لازم الرابط يبدأ بـ https://");
  editing.media.push({ url, type: /\.(mp4|mov)(\?|$)/i.test(url) ? "video" : "image" });
  e.target.value = "";
  renderMedia();
});

function collectEditor() {
  const data = Object.fromEntries(new FormData(editorForm));
  data.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt).toISOString() : null;
  data.media = editing.media;
  if (data.status === "scheduled" && !data.scheduledAt) throw new Error("حدد موعد النشر للمنشور المجدول");
  return data;
}

async function saveEditor() {
  const saved = await api(`/api/ideas/${editing.id}`, { method: "PUT", body: collectEditor() });
  editing = structuredClone(saved);
  await loadIdeas();
  return saved;
}

editorForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await saveEditor();
    dialog.close();
    toast("انحفظ ✓");
  } catch (err) { toast(err.message); }
});

$$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

$("#delete").addEventListener("click", async () => {
  if (!confirm("أكيد تبي تحذف هذي الفكرة؟")) return;
  await api(`/api/ideas/${editing.id}`, { method: "DELETE" });
  dialog.close();
  await loadIdeas();
  toast("انحذفت");
});

$("#ai-caption").addEventListener("click", (e) => busy(e.target, async () => {
  await saveEditor();
  const { caption, hashtags } = await api(`/api/ideas/${editing.id}/caption`, { method: "POST" });
  editorForm.elements.caption.value = caption;
  editorForm.elements.hashtags.value = hashtags;
}));

$("#publish").addEventListener("click", (e) => {
  if (!confirm("بننشرها الحين على إنستغرام. متأكد؟")) return;
  busy(e.target, async () => {
    try {
      await saveEditor();
      await api(`/api/ideas/${editing.id}/publish`, { method: "POST" });
      dialog.close();
      toast("انتشرت على إنستغرام 🎉");
    } finally {
      await loadIdeas();
    }
  });
});

// ---------- الاقتراحات ----------
let suggestions = [];

$("#suggest-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  busy($("button", e.target), async () => {
    suggestions = await api("/api/ai/suggest", { method: "POST", body });
    renderSuggestions();
  });
});

function renderSuggestions() {
  $("#suggestions").innerHTML = suggestions.map((s, idx) => `
    <article class="card idea" style="cursor:default">
      <h3>${esc(s.title)}</h3>
      <p class="hook">🎣 ${esc(s.hook)}</p>
      <p>${esc(s.notes)}</p>
      <div class="row between">
        <span class="meta"><span class="badge">${FORMATS[s.format] || s.format}</span>${funnelBadge(s.funnel)}${goalBadge(s.goal)}</span>
        ${s.saved ? `<span class="badge published">انضافت ✓</span>` : `<button class="primary small" data-save="${idx}">ضيفها لأفكاري</button>`}
      </div>
    </article>`).join("");
}

$("#suggestions").addEventListener("click", async (e) => {
  const idx = e.target.dataset.save;
  if (idx === undefined) return;
  const s = suggestions[idx];
  await api("/api/ideas", {
    method: "POST",
    body: {
      title: s.title,
      format: s.format,
      funnel: s.funnel,
      goal: s.goal,
      notes: `الهوك: ${s.hook}\n\n${s.notes}`,
      caption: s.caption,
      hashtags: s.hashtags,
      source: "ai",
    },
  });
  s.saved = true;
  renderSuggestions();
  await loadIdeas();
  toast("انضافت لأفكارك ✓");
});

// ---------- الأسبوع ----------
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAY_MS = 86_400_000;

// الأسبوع يبدأ يوم الأحد
function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const fmtTime = (d) => d.toLocaleTimeString("ar-KW", { hour: "numeric", minute: "2-digit" });

let weekStart = startOfWeek(new Date());
let planDraft = null; // { posts, time, start }
let strategy = null; // الخطة التسويقية (من strategy.js)

const currentStrategyWeek = () => strategyWeek(strategy, localDateStr(weekStart));

window.addEventListener("strategy-changed", (e) => { strategy = e.detail; renderWeek(); });
window.addEventListener("goto-week", (e) => {
  weekStart = startOfWeek(fromDateStr(e.detail));
  renderWeek();
  show("week");
  window.scrollTo(0, 0);
});

const weekPosts = () => {
  const end = addDays(weekStart, 7);
  return ideas
    .filter((i) => i.scheduledAt && new Date(i.scheduledAt) >= weekStart && new Date(i.scheduledAt) < end)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
};

function renderWeek() {
  const end = addDays(weekStart, 6);
  $("#week-label").textContent = `${fmtDate(weekStart, { day: "numeric", month: "long" })} – ${fmtDate(end, { day: "numeric", month: "long", year: "numeric" })}`;
  $("#this-week").hidden = sameDay(weekStart, startOfWeek(new Date()));

  const posts = weekPosts();
  const today = new Date();
  $("#week").innerHTML = DAYS.map((name, idx) => {
    const day = addDays(weekStart, idx);
    const dayPosts = posts.filter((p) => sameDay(new Date(p.scheduledAt), day));
    return `
      <div class="day ${sameDay(day, today) ? "today" : ""}">
        <div class="day-head"><b>${name}</b><span>${fmtDate(day, { day: "numeric", month: "short" })}</span></div>
        ${dayPosts.map((p) => `
          <div class="post ${p.funnel}" data-id="${p.id}">
            <span class="time">${fmtTime(new Date(p.scheduledAt))} · ${FORMATS[p.format] || ""}</span>
            <b>${esc(p.title)}</b>
            <span class="meta">${funnelBadge(p.funnel)}${goalBadge(p.goal)}<span class="badge ${p.status}">${STATUSES[p.status]}</span></span>
          </div>`).join("")}
        <button class="add-day" data-day="${idx}">+ ضيف</button>
      </div>`;
  }).join("");

  renderStrategyWeek();
  renderBalance(posts);
}

// ملخص هالأسبوع من الخطة التسويقية
function renderStrategyWeek() {
  const sw = currentStrategyWeek();
  const el = $("#week-strategy");
  el.hidden = !sw;
  if (!sw) return;
  el.innerHTML = `
    <div class="row between"><b>📋 الأسبوع ${sw.week} من الخطة · ${esc(sw.phase)}</b><span class="badge">${sw.postsPerWeek} منشورات مقترحة</span></div>
    <div><b>${esc(sw.theme)}</b> — ${esc(sw.focus)}</div>
    <div class="hint">🎯 الدعوة للإجراء: ${esc(sw.cta)}</div>
    ${sw.events.length ? `<ul class="events">${sw.events.map((ev) => `
      <li class="${ev.isLaunchDay ? "launch-day" : ""}"><b>${fmtDate(fromDateStr(ev.date), { weekday: "long", day: "numeric", month: "short" })}</b> · 📢 ${esc(ev.launch)} — ${esc(ev.title)}</li>`).join("")}</ul>` : ""}`;
}

function renderBalance(posts) {
  const total = posts.length;
  if (!total) {
    $("#balance").innerHTML = `<p class="hint">الأسبوع فاضي — ضيف منشورات بالأيام أو خل الذكاء الاصطناعي يخطط لك 👇</p>`;
    return;
  }
  const count = (key, val) => posts.filter((p) => p[key] === val).length;
  const pct = (n) => Math.round((n / total) * 100);
  const funnel = Object.fromEntries(Object.keys(FUNNEL).map((k) => [k, count("funnel", k)]));
  const unset = total - Object.values(funnel).reduce((a, b) => a + b, 0);

  const sw = currentStrategyWeek();
  const mix = sw ? { tof: sw.tof, mof: sw.mof, bof: sw.bof } : FUNNEL_TARGET;
  const tips = [];
  for (const [k, target] of Object.entries(mix)) {
    const diff = pct(funnel[k]) - target;
    if (diff <= -15) tips.push(`${FUNNEL[k].label} (${FUNNEL[k].name}) قليل — المفروض حول ${target}%`);
    if (diff >= 20) tips.push(`${FUNNEL[k].label} (${FUNNEL[k].name}) وايد — المفروض حول ${target}%`);
  }
  if (unset) tips.push(`${unset} منشور ما له مرحلة قمع`);
  const goalCounts = Object.keys(GOALS).map((k) => [k, count("goal", k)]);
  const repeated = goalCounts.filter(([, n]) => n >= 3 && n / total > 0.4);
  repeated.forEach(([k]) => tips.push(`وايد منشورات «${GOALS[k].name}» — نوّع عشان الحساب ما يصير ممل`));

  $("#balance").innerHTML = `
    <div class="balance">
      <div class="bar">${Object.keys(FUNNEL).map((k) => `<div class="${k}" style="width:${pct(funnel[k])}%"></div>`).join("")}</div>
      <div class="legend">
        <span><b>${total}</b> منشور</span>
        ${Object.entries(FUNNEL).map(([k, f]) => `<span><i class="dot ${k}"></i>${f.label} <b>${funnel[k]}</b> (${pct(funnel[k])}% · الهدف ${mix[k]}%)</span>`).join("")}
      </div>
      <div class="goals">${goalCounts.map(([k, n]) => `<span class="badge ${n ? "" : "zero"}">${GOALS[k].emoji} ${GOALS[k].name} ${n}</span>`).join("")}</div>
      ${tips.length ? `<ul class="tips">${tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="hint">✓ الأسبوع متوازن</p>`}
    </div>`;
}

$("#prev-week").addEventListener("click", () => { weekStart = addDays(weekStart, -7); renderWeek(); });
$("#next-week").addEventListener("click", () => { weekStart = addDays(weekStart, 7); renderWeek(); });
$("#this-week").addEventListener("click", () => { weekStart = startOfWeek(new Date()); renderWeek(); });

$("#week").addEventListener("click", (e) => {
  const post = e.target.closest(".post");
  if (post) return openEditor(ideas.find((i) => i.id === post.dataset.id));
  const add = e.target.closest(".add-day");
  if (add) openPicker(addDays(weekStart, Number(add.dataset.day)));
});

// وقت افتراضي للمنشور بيوم معين
function atTime(day, time = $("#plan-form").elements.time.value || "19:00") {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const picker = $("#picker");
let pickerDay = null;

function openPicker(day) {
  pickerDay = day;
  $("#picker-title").textContent = `${DAYS[day.getDay()]} ${fmtDate(day, { day: "numeric", month: "long" })}`;
  const free = ideas.filter((i) => !i.scheduledAt && ["idea", "draft"].includes(i.status));
  $("#picker-list").innerHTML = free.length
    ? free.map((i) => `<button data-id="${i.id}"><b>${esc(i.title)}</b> <span class="meta">${funnelBadge(i.funnel)}${goalBadge(i.goal)}</span></button>`).join("")
    : `<p class="empty">ما عندك أفكار بدون موعد</p>`;
  picker.showModal();
}

$("#picker-new").addEventListener("click", async () => {
  try {
    const idea = await api("/api/ideas", { method: "POST", body: { title: "منشور جديد", status: "draft", scheduledAt: atTime(pickerDay) } });
    picker.close();
    await loadIdeas();
    openEditor(idea);
    editorForm.elements.title.select();
  } catch (err) { toast(err.message); }
});

$("#picker-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;
  try {
    const idea = ideas.find((i) => i.id === btn.dataset.id);
    await api(`/api/ideas/${idea.id}`, {
      method: "PUT",
      body: { scheduledAt: atTime(pickerDay), status: idea.status === "idea" ? "draft" : idea.status },
    });
    picker.close();
    await loadIdeas();
    toast("انضافت لليوم ✓");
  } catch (err) { toast(err.message); }
});

$("#plan-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const { topic, count, time } = Object.fromEntries(new FormData(e.target));
  const start = new Date(weekStart);
  busy($("button", e.target), async () => {
    const posts = await api("/api/ai/plan-week", {
      method: "POST",
      body: { topic, count, start: start.toISOString(), end: addDays(start, 7).toISOString(), weekDate: localDateStr(start) },
    });
    planDraft = { posts, time, start };
    renderPlan();
  });
});

function renderPlan() {
  $("#plan-preview").hidden = !planDraft;
  if (!planDraft) return;
  $("#plan-list").innerHTML = planDraft.posts.map((p) => `
    <div class="plan-item">
      <span class="when">${DAYS[p.day]}</span>
      <div>
        <b>${esc(p.title)}</b>
        <p>🎣 ${esc(p.hook)}</p>
        <span class="meta"><span class="badge">${FORMATS[p.format] || p.format}</span>${funnelBadge(p.funnel)}${goalBadge(p.goal)}</span>
      </div>
    </div>`).join("");
}

$("#plan-cancel").addEventListener("click", () => { planDraft = null; renderPlan(); });

$("#plan-accept").addEventListener("click", (e) => busy(e.target, async () => {
  for (const p of planDraft.posts) {
    await api("/api/ideas", {
      method: "POST",
      body: {
        title: p.title,
        format: p.format,
        funnel: p.funnel,
        goal: p.goal,
        notes: `الهوك: ${p.hook}\n\n${p.notes}`,
        caption: p.caption,
        hashtags: p.hashtags,
        status: "draft",
        source: "ai",
        scheduledAt: atTime(addDays(planDraft.start, p.day), planDraft.time),
      },
    });
  }
  planDraft = null;
  renderPlan();
  await loadIdeas();
  toast("انحفظت خطة الأسبوع ✓");
}));

// ---------- ملف الحساب ----------
const profileForm = $("#profile-form");

async function loadProfile() {
  const p = await api("/api/profile");
  for (const [k, v] of Object.entries(p)) if (profileForm.elements[k]) profileForm.elements[k].value = v;
}

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/api/profile", { method: "PUT", body: Object.fromEntries(new FormData(profileForm)) });
  toast("انحفظ ملف الحساب ✓");
});

// ---------- البداية ----------
async function init() {
  await Promise.all([loadIdeas(), loadProfile()]);
  const status = await api("/api/status");
  const warnings = [];
  if (!status.instagram) warnings.push("ربط إنستغرام مو مفعّل — حط IG_USER_ID و IG_ACCESS_TOKEN في ملف .env عشان تقدر تنشر.");
  if (!status.publicUrl) warnings.push("PUBLIC_BASE_URL مو محدد — الصور المرفوعة ما راح يقدر إنستغرام يوصلها (الروابط الخارجية تشتغل عادي).");
  if (warnings.length) {
    $("#banner").innerHTML = warnings.map(esc).join("<br>");
    $("#banner").hidden = false;
  }
}
init().catch((err) => toast(err.message));
