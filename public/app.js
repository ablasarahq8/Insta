import { FUNNEL, FUNNEL_TARGET, GOALS, FORMATS, STORY_TYPES, STORY_ENDINGS } from "./taxonomy.js";
import {
  $, $$, esc, api, toast, busy, show, STATUSES, funnelBadge, goalBadge, icon, setAdvanced, checksBadge,
  localDateStr, fromDateStr, fmtDate, uploadFiles,
} from "./common.js";
import { strategyWeek } from "./planutil.js";
import { openDesigner } from "./design.js";

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
    el.innerHTML = `<p class="empty">ما في شي هني للحين — اكتبي أول فكرة فوق، أو خذي اقتراحات</p>`;
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
          <span class="badge ${i.status}">${STATUSES[i.status]}</span>${checksBadge(i.checks)}
          ${i.source === "ai" ? `<span class="badge ai">مقترحة</span>` : ""}
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
  $$("#post-checks [data-check]").forEach((c) => { c.checked = (editing.checks || []).includes(c.dataset.check); });
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
  toast("انكتب السكربت. «📁» لقطة من مكتبتچ، و«🆕» لقطة تحتاجين تصورينها");
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
      <button type="button" data-remove="${idx}" title="شيلي">${icon("x", 14)}</button>
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
  data.design = editing.design || null;
  data.checks = $$("#post-checks [data-check]").filter((c) => c.checked).map((c) => c.dataset.check);
  // «نزلت» يعني المنشور انتشر
  if (data.checks.includes("posted")) data.status = "published";
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

// مصمم البوست — نحفظ أول عشان ياخذ آخر عنوان وكابشن
$("#open-designer").addEventListener("click", (e) => busy(e.target, async () => {
  await saveEditor();
  await openDesigner(editing, async (design, media) => {
    editing.design = design;
    // إذا تغير النوع من المصمم (مثلاً بوست ← كاروسيل) نحدّثه بالمنشور
    if (design.format) { editing.format = design.format; editorForm.elements.format.value = design.format; updateScriptBox(); }
    if (media) editing.media = [...editing.media.filter((m) => m.type === "video"), ...media];
    renderMedia();
    await saveEditor();
  });
}));

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
      toast("انتشرت على إنستغرام");
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
      <p class="hook">${esc(s.hook)}</p>
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
let storyList = []; // الستوريات عشان تطلع بأيام الأسبوع

const weekStories = (day) => storyList.filter((s) => s.date === localDateStr(day));
const loadStories = () => api("/api/stories").then((s) => { storyList = s; renderWeek(); }).catch(() => {});
window.addEventListener("stories-changed", loadStories);
window.addEventListener("ideas-reload", () => loadIdeas().catch(() => {}));

const currentStrategyWeek = () => strategyWeek(strategy, localDateStr(weekStart));

window.addEventListener("strategy-changed", (e) => { strategy = e.detail; renderWeek(); });
window.addEventListener("goto-week", (e) => {
  // ننقل للصفحة أول، عشان لو صار خطأ بالرسم ما يبين إن الزر ما سوى شي
  show("week");
  window.scrollTo(0, 0);
  try {
    weekStart = startOfWeek(fromDateStr(e.detail));
    renderWeek();
  } catch (err) {
    console.error(err);
    toast(`ما قدرت أعرض هالأسبوع: ${err.message}`);
  }
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
            <span class="meta">${funnelBadge(p.funnel)}${goalBadge(p.goal)}<span class="badge ${p.status}">${STATUSES[p.status]}</span>${checksBadge(p.checks)}</span>
          </div>`).join("")}
        ${weekStories(day).map((s) => `
          <div class="post story-item" data-story="${s.id}" style="border-inline-start-color:${STORY_TYPES[s.type]?.color || "var(--muted)"}">
            <span class="time">${icon("phone", 13)} ستوري · ${STORY_TYPES[s.type]?.name || ""}</span>
            <b>${esc(s.title)}</b>
            <span class="meta">${checksBadge(s.checks)}</span>
          </div>`).join("")}
        <button class="add-day" data-day="${idx}">${icon("plus", 14)} ضيفي</button>
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
    <div class="row between"><b>${icon("map", 16)} الأسبوع ${sw.week} من الخطة · ${esc(sw.phase)}</b><span class="badge">${sw.postsPerWeek} منشورات مقترحة</span></div>
    <div><b>${esc(sw.theme)}</b> — ${esc(sw.focus)}</div>
    <div class="hint">الدعوة للإجراء: ${esc(sw.cta)}</div>
    ${sw.events.length ? `<ul class="events">${sw.events.map((ev) => `
      <li class="${ev.isLaunchDay ? "launch-day" : ""}"><b>${fmtDate(fromDateStr(ev.date), { weekday: "long", day: "numeric", month: "short" })}</b> · ${icon("megaphone", 14)} ${esc(ev.launch)} — ${esc(ev.title)}</li>`).join("")}</ul>` : ""}`;
}

function renderBalance(posts) {
  const total = posts.length;
  if (!total) {
    $("#balance").innerHTML = `<p class="hint">الأسبوع فاضي. ضيفي منشورات بالأيام، أو خلي الذكاء الاصطناعي يخطط لچ</p>`;
    return;
  }
  const count = (key, val) => posts.filter((p) => p[key] === val).length;
  const pct = (n) => Math.round((n / total) * 100);
  const funnel = Object.fromEntries(Object.keys(FUNNEL).map((k) => [k, count("funnel", k)]));
  const unset = total - Object.values(funnel).reduce((a, b) => a + b, 0);

  const sw = currentStrategyWeek();
  const mix = sw && [sw.tof, sw.mof, sw.bof].every(Number.isFinite) ? { tof: sw.tof, mof: sw.mof, bof: sw.bof } : FUNNEL_TARGET;
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
      <div class="goals">${goalCounts.map(([k, n]) => `<span class="badge ${n ? "" : "zero"}">${GOALS[k].name} <b>${n}</b></span>`).join("")}</div>
      ${tips.length ? `<ul class="tips">${tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="hint ok-text">${icon("check", 14)} الأسبوع متوازن</p>`}
    </div>`;
}

$("#prev-week").addEventListener("click", () => { weekStart = addDays(weekStart, -7); renderWeek(); });
$("#next-week").addEventListener("click", () => { weekStart = addDays(weekStart, 7); renderWeek(); });
$("#this-week").addEventListener("click", () => { weekStart = startOfWeek(new Date()); renderWeek(); });

$("#week").addEventListener("click", (e) => {
  const st = e.target.closest(".story-item");
  if (st) return window.dispatchEvent(new CustomEvent("open-story", { detail: st.dataset.story }));
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
        <p>${esc(p.hook)}</p>
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

// ---------- الأدوات المتقدمة ----------
$("#advanced-toggle").checked = document.body.classList.contains("advanced");
$("#advanced-toggle").addEventListener("change", (e) => {
  setAdvanced(e.target.checked);
  toast(e.target.checked ? "انفتحت الأدوات المتقدمة" : "رجع الموقع للوضع البسيط");
});

// ---------- النسخ ----------
async function copyText(text, done = "انسخ ✓") {
  try { await navigator.clipboard.writeText(text); toast(done); }
  catch { toast("ما قدرت أنسخ من هالمتصفح"); }
}

$("#copy-caption").addEventListener("click", () => {
  const { caption, hashtags } = editorForm.elements;
  copyText([caption.value, hashtags.value].filter(Boolean).join("\n\n"), "انسخ الكابشن والهاشتاقات ✓");
});

// الأسبوع كامل كنص مرتب — تلصقينه بأي محادثة (Claude أو ChatGPT)
function weekText() {
  const sw = currentStrategyWeek();
  const end = addDays(weekStart, 6);
  const lines = [`# خطة الأسبوع: ${fmtDate(weekStart, { day: "numeric", month: "long" })} – ${fmtDate(end, { day: "numeric", month: "long", year: "numeric" })}`];
  if (sw) lines.push(`الأسبوع ${sw.week} من الخطة (${sw.phase})`, `الثيم: ${sw.theme} — ${sw.focus}`, `الدعوة للإجراء: ${sw.cta}`);
  const posts = weekPosts();
  let any = false;
  DAYS.forEach((name, idx) => {
    const day = addDays(weekStart, idx);
    const dayPosts = posts.filter((p) => sameDay(new Date(p.scheduledAt), day));
    const dayStories = weekStories(day);
    if (!dayPosts.length && !dayStories.length) return;
    any = true;
    lines.push("", `## ${name} ${fmtDate(day, { day: "numeric", month: "long" })}`);
    for (const p of dayPosts) {
      lines.push("", `### ${FORMATS[p.format] || "منشور"}: ${p.title}`);
      const tags = [FUNNEL[p.funnel]?.label, GOALS[p.goal]?.name].filter(Boolean).join(" · ");
      if (tags) lines.push(tags);
      if (p.notes) lines.push(`الفكرة والتنفيذ: ${p.notes}`);
      if (p.script) lines.push(`السكربت:\n${p.script}`);
      if (p.caption) lines.push(`الكابشن:\n${p.caption}`);
      if (p.hashtags) lines.push(`الهاشتاقات: ${p.hashtags}`);
    }
    for (const s of dayStories) {
      lines.push("", `### ستوري (${STORY_TYPES[s.type]?.name || ""} · ${STORY_ENDINGS[s.ending] || ""}): ${s.title}`);
      s.frames.forEach((f, i) => {
        lines.push(`${i + 1}. ${f.role} (${f.media === "video" ? "فيديو" : "صورة"}) — تصوير: ${f.shot || "—"}`);
        if (f.statements?.length) lines.push(`   النص: ${f.statements.join(" / ")}`);
        if (f.ctaKeyword) lines.push(`   الدعوة: ${f.ctaLine || "ارسلوا لي كلمة"} «${f.ctaKeyword}» ${f.ctaSub || "بالخاص"}`);
      });
      if (s.measure) lines.push(`شنو تقيسين: ${s.measure}`);
    }
  });
  if (!any) lines.push("", "(ما فيه منشورات أو ستوري محطوطة هالأسبوع)");
  return lines.join("\n");
}

$("#week-copy").addEventListener("click", () => copyText(weekText(), "انسخ الأسبوع ✓ الصقيه بأي محادثة"));

$("#week-plan-stories").addEventListener("click", (e) =>
  window.dispatchEvent(new CustomEvent("plan-story-week", { detail: { weekDate: localDateStr(weekStart), btn: e.currentTarget } })));

// ---------- رفع ملف جاهز ----------
$("#quick-pub-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const when = fd.get("when");
  fd.delete("when");
  if (when) fd.set("publishAt", new Date(when).toISOString());
  const later = when && new Date(when) > new Date();
  if (!later && !confirm("بينتشر على الإنستغرام الحين. متأكدة؟")) return;
  busy($("button", form), async () => {
    const res = await api("/api/quick-publish", { method: "POST", body: fd });
    form.reset();
    await loadIdeas();
    window.dispatchEvent(new Event("stories-changed"));
    window.dispatchEvent(new Event("stories-reload"));
    toast(later ? "انجدول ✓" : res.status === "failed" ? `فشل: ${res.error}` : "انتشر");
  });
});

// ---------- ملف الحساب ----------
const profileForm = $("#profile-form");

async function loadProfile() {
  const p = await api("/api/profile");
  for (const [k, v] of Object.entries(p)) if (profileForm.elements[k]) profileForm.elements[k].value = v;
}

// ملف الحساب الجاهز — مأخوذ من مهارات sarah-instagram-carousel و stories-and-scripts
const SARAH_PROFILE = {
  handle: "@ablasarahq8",
  niche: "تقنية وذكاء اصطناعي للمعلمات: أدوات، أفكار للصف، يوميات معلمة علوم",
  audience: "معلمات (٩١٪+ إناث، ٢٥–٤٤ سنة) في الكويت وعمان والسعودية، يبون يشتغلون بذكاء ويرتاحون أكثر ويتطورون مهنياً بالتقنية",
  tone: "أنثوي احترافي: هادي، واثق، واضح، قريب من المعلمة. مو طفولي ولا رسمي جاف. محتوى عملي يفيد بسرعة ويختصر الوقت بخطوات واضحة",
  language: "كويتي خالص (شلون، شنو، وايد، تنطرين، الحين). بدون فصحى رسمية، وإيموجي قليل (✨ 🌸 💜 🎯). لا ChatGPT (استخدمي Gemini)، ولا ManyChat",
  goals: "أساعد المعلمة تشتغل بذكاء، ترتاح أكثر، وتتطور مهنياً باستخدام التقنية. دعوات ناعمة مبنية على الهوية (هدية مجانية، رابط، تصويت، سؤال) مو بيع مباشر",
  pillars: "أدوات الذكاء الاصطناعي للمعلمة، تحضير الدروس، أفكار وأنشطة للصف، يوميات معلمة علوم، التطوير المهني، المجتمع والدورات",
};

$("#profile-preset").addEventListener("click", () => {
  for (const [k, v] of Object.entries(SARAH_PROFILE)) {
    const el = profileForm.elements[k];
    if (el && (!el.value.trim() || confirm(`«${el.closest("label")?.firstChild?.textContent.trim()}» فيه كلام. أبدّله؟`))) el.value = v;
  }
  toast("تعبّى ✓ راجعيه وعدّلي اللي تبين، وبعدين اضغطي «حفظ الملف»");
});

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/api/profile", { method: "PUT", body: Object.fromEntries(new FormData(profileForm)) });
  toast("انحفظ ملف الحساب ✓");
});

// ---------- البداية ----------
async function init() {
  loadStories();
  await Promise.all([loadIdeas(), loadProfile()]);
  const status = await api("/api/status");
  $("#hook-status").innerHTML = status.uploadKey
    ? `${icon("check", 14)} مفعّل. بأي محادثة تسوين فيها ريل قولي «ارفعيه ستوري» أو «انشريه ريل»، وعطيها رابط الموقع <b dir="ltr">${esc(status.baseUrl || location.origin)}</b> ومفتاح الرفع (UPLOAD_KEY) أول مرة.`
    : `مو مفعّل. من Render: الخدمة ← Environment ← ضيفي <b>UPLOAD_KEY</b> واضغطي Generate عشان يطلع مفتاح عشوائي، وبعدين Save.`;
  const warnings = [];
  if (!status.instagram) warnings.push("الإنستغرام مو مربوط، فالنشر ما يشتغل. (IG_USER_ID و IG_ACCESS_TOKEN)");
  if (!status.publicUrl) warnings.push("رابط الموقع العام مو محدد، فالصور المرفوعة ما تنتشر. (PUBLIC_BASE_URL)");
  if (warnings.length) {
    $("#banner").innerHTML = warnings.map(esc).join("<br>");
    $("#banner").hidden = false;
  }
}
init().catch((err) => toast(err.message));
