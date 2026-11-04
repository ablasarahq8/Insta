// صفحة الستوري: خطة أسبوعية لتسلسلات الستوري + تصميم الشرائح ٩:١٦ (من مهارة stories-and-scripts)
import { STORY_TYPES, STORY_ENDINGS, STORY_SCHEDULE } from "./taxonomy.js";
import { $, $$, esc, api, toast, busy, localDateStr, fromDateStr, fmtDate, uploadFiles, icon, checksBadge } from "./common.js";
import { addDaysStr, strategyWeek } from "./planutil.js";

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const AR = "٠١٢٣٤٥٦٧٨٩";
const arNum = (n) => String(n).replace(/\d/g, (d) => AR[d]);

let stories = [];
let library = []; // ملفات مكتبة اللقطات: [{ url, type, title }]
let strategy = null;
let profile = {};
let weekDate = sundayOf(localDateStr(new Date()));
let editing = null; // نسخة من التسلسل المفتوح
let frameIndex = 0;

const dialog = $("#story-editor");
const form = $("#story-edit-form");

function sundayOf(dateStr) {
  const d = fromDateStr(dateStr);
  d.setDate(d.getDate() - d.getDay());
  return localDateStr(d);
}

window.addEventListener("strategy-changed", (e) => { strategy = e.detail; renderWeek(); });
const changed = () => window.dispatchEvent(new Event("stories-changed"));
window.addEventListener("stories-reload", () => api("/api/stories").then((s) => { stories = s; renderWeek(); }).catch(() => {}));

// من صفحة الأسبوع: فتح ستوري، أو تخطيط ستوري أسبوع معين
window.addEventListener("open-story", (e) => {
  const s = stories.find((x) => x.id === e.detail);
  if (s) openEditor(s);
});
window.addEventListener("plan-story-week", (e) => {
  weekDate = sundayOf(e.detail.weekDate);
  renderWeek();
  generate([0, 1, 2, 3, 4, 5, 6], e.detail.btn);
});

async function load() {
  [stories, profile] = await Promise.all([api("/api/stories"), api("/api/profile")]);
  renderWeek();
}

// ---------- الأسبوع ----------
function renderWeek() {
  const end = addDaysStr(weekDate, 6);
  $("#story-week-label").textContent =
    `${fmtDate(fromDateStr(weekDate), { day: "numeric", month: "long" })} – ${fmtDate(fromDateStr(end), { day: "numeric", month: "long" })}`;
  $("#story-this-week").hidden = weekDate === sundayOf(localDateStr(new Date()));

  const sw = strategyWeek(strategy, weekDate);
  $("#story-strategy").hidden = !sw;
  if (sw) {
    $("#story-strategy").innerHTML = `${icon("map", 16)} الأسبوع ${sw.week} من الخطة · <b>${esc(sw.theme)}</b>${sw.events.length
      ? ` · ${icon("megaphone", 14)} ${sw.events.map((e) => esc(`${e.launch} — ${e.title}`)).join("، ")}` : ""}`;
  }

  const today = localDateStr(new Date());
  $("#story-week").innerHTML = DAYS.map((name, d) => {
    const date = addDaysStr(weekDate, d);
    const list = stories.filter((s) => s.date === date);
    const sched = STORY_SCHEDULE[d];
    return `
      <div class="day ${date === today ? "today" : ""}">
        <div class="day-head"><b>${name}</b><span>${fmtDate(fromDateStr(date), { day: "numeric", month: "short" })}</span></div>
        ${list.length ? list.map((s) => `
          <div class="post story-card" data-id="${s.id}" style="border-inline-start-color:${STORY_TYPES[s.type]?.color}">
            <span class="time"><i class="type-dot" style="background:${STORY_TYPES[s.type]?.color}"></i>${STORY_TYPES[s.type]?.name}، ${arNum(s.frames.length)} شرائح</span>
            <b>${esc(s.title)}</b>
            <span class="meta"><span class="badge">${STORY_ENDINGS[s.ending] || ""}</span>${checksBadge(s.checks)}${{ posted: `<span class="badge published">انتشرت</span>`, scheduled: `<span class="badge scheduled">مجدولة</span>`, failed: `<span class="badge failed">فشلت</span>` }[s.status] || ""}</span>
          </div>`).join("")
          : `<p class="hint"><i class="type-dot" style="background:${STORY_TYPES[sched.type].color}"></i>المقترح: ${STORY_TYPES[sched.type].name}</p>`}
        <button class="add-day" data-day="${d}">${list.length ? `${icon("refresh", 14)} اكتبيه من جديد` : `${icon("sparkles", 14)} اكتبي ستوري هاليوم`}</button>
      </div>`;
  }).join("");
}

$("#story-prev").addEventListener("click", () => { weekDate = addDaysStr(weekDate, -7); renderWeek(); });
$("#story-next").addEventListener("click", () => { weekDate = addDaysStr(weekDate, 7); renderWeek(); });
$("#story-this-week").addEventListener("click", () => { weekDate = sundayOf(localDateStr(new Date())); renderWeek(); });

async function generate(days, btn) {
  const exists = stories.some((s) => days.some((d) => s.date === addDaysStr(weekDate, d)));
  if (exists && !confirm("فيه ستوري محطوط بهالأيام، بيتبدل بالجديد. أكمل؟")) return;
  const start = fromDateStr(weekDate);
  const end = fromDateStr(addDaysStr(weekDate, 7));
  await busy(btn, async () => {
    await api("/api/ai/story-week", {
      method: "POST",
      body: { weekDate, days, topic: $("#story-form").elements.topic.value, start: start.toISOString(), end: end.toISOString() },
    });
    stories = await api("/api/stories");
    renderWeek();
    changed();
    toast("انكتبت الستوريات ✓ تلقينها بأيام الأسبوع");
  });
}

$("#story-form").addEventListener("submit", (e) => {
  e.preventDefault();
  generate([0, 1, 2, 3, 4, 5, 6], $("button", e.target));
});

$("#story-week").addEventListener("click", (e) => {
  const card = e.target.closest(".story-card");
  if (card) return openEditor(stories.find((s) => s.id === card.dataset.id));
  const add = e.target.closest(".add-day");
  if (add) generate([Number(add.dataset.day)], add);
});

// ---------- تصميم الشريحة (١٠٨٠×١٩٢٠، الثيم الفاتح المعتمد) ----------
const highlight = (text) => esc(text).replace(/\[\[(.+?)\]\]/g, "<mark>$1</mark>");

function frameHTML(f, i, total, { exporting = false } = {}) {
  const video = f.media === "video";
  const handle = `@${(profile.handle || "ablasarahq8").replace(/^@/, "")}`;
  const last = i === total - 1;
  const body = f.quotes
    ? f.statements.map((s) => `<div class="st-quote"><i>”</i><p>${highlight(s)}</p></div>`).join("")
    : f.statements.map((s) => `<p class="st-line">${highlight(s)}</p>`).join("");
  const content = `
    ${f.kicker ? `<span class="st-kicker">${esc(f.kicker)}</span>` : ""}
    ${body}
    ${f.ctaKeyword ? `<div class="st-cta"><span>${esc(f.ctaLine || "ارسلوا لي كلمة")}</span><b>«${esc(f.ctaKeyword)}»</b><span>${esc(f.ctaSub || "بالخاص")}</span></div>` : ""}
    ${f.sticker ? `<div class="st-sticker">مكان ملصق ${esc(f.sticker)}</div>` : ""}`;
  return `
    <div class="story-frame ${video ? "st-video" : "st-photo"} ${exporting ? "exporting" : ""}">
      ${video
        ? (exporting ? "" : f.video
          ? `<video class="st-media" src="${esc(f.video)}" muted autoplay loop playsinline></video>`
          : `<div class="st-video-bg">${icon("video", 90)}<br>${esc(f.shot || "الفيديو")}</div>`)
        : f.image
          ? `<div class="st-media" style="background-image:url('${esc(f.image)}')"></div>`
          : `<i class="st-blob st-b1"></i><i class="st-blob st-b2"></i><i class="st-blob st-b3"></i>`}
      <div class="st-safe">
        ${video || f.image ? `<div class="st-card">${content}</div>` : content}
      </div>
      <div class="st-foot">
        ${last ? `<img class="st-logo" src="/brand/logo_dark.png" alt="">` : ""}
        ${last || f.ctaKeyword ? `<span class="st-handle" dir="ltr">${esc(handle)}</span>` : ""}
      </div>
    </div>`;
}

// ---------- المحرر ----------
function openEditor(story) {
  editing = structuredClone(story);
  frameIndex = 0;
  form.elements.title.value = editing.title;
  form.elements.type.innerHTML = Object.entries(STORY_TYPES)
    .map(([k, t]) => `<option value="${k}" ${k === editing.type ? "selected" : ""}>${t.name}</option>`).join("");
  form.elements.ending.innerHTML = Object.entries(STORY_ENDINGS)
    .map(([k, v]) => `<option value="${k}" ${k === editing.ending ? "selected" : ""}>${v}</option>`).join("");
  form.elements.measure.value = editing.measure;
  form.elements.status.value = editing.status;
  $$("#story-checks [data-check]").forEach((c) => { c.checked = (editing.checks || []).includes(c.dataset.check); });
  form.elements.publishAt.value = editing.publishAt ? toLocalInput(editing.publishAt) : `${editing.date}T19:00`;
  $("#story-error").hidden = !editing.error;
  $("#story-error").textContent = editing.error ? `آخر محاولة نشر فشلت: ${editing.error}` : "";
  api("/api/shots").then((shots) => {
    library = shots.flatMap((s) => s.media.map((m) => ({ ...m, title: s.title })));
    if (dialog.open) renderEditor();
  }).catch(() => {});
  $("#story-edit-date").textContent = `${DAYS[fromDateStr(editing.date).getDay()]} ${fmtDate(fromDateStr(editing.date), { day: "numeric", month: "long" })}`;
  dialog.showModal();
  renderEditor();
}

function toLocalInput(iso) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// قائمة الخلفية: من مكتبة اللقطات (صور للشرائح العادية، فيديو لشرائح الفيديو)
function bgPicker(f) {
  const want = f.media === "video" ? "video" : "image";
  const current = f.media === "video" ? f.video : f.image;
  const opts = library.filter((m) => m.type === want);
  return `
    <div class="row st-bg-row">
      <select data-bg>
        <option value="">${want === "video" ? "الفيديو: ما اخترتي" : "الخلفية: الثيم الفاتح"}</option>
        ${opts.map((m) => `<option value="${esc(m.url)}" ${m.url === current ? "selected" : ""}>من المكتبة: ${esc(m.title)}</option>`).join("")}
        ${current && !opts.some((m) => m.url === current) ? `<option value="${esc(current)}" selected>ملف مرفوع</option>` : ""}
      </select>
      <label class="ghost small file-btn">${icon("upload", 14)} ارفعي${want === "video" ? " فيديو" : " صورة"}<input type="file" data-bg-file accept="${want === "video" ? "video/mp4,video/quicktime" : "image/jpeg,image/png"}" hidden></label>
    </div>`;
}

function renderPreview() {
  const frames = editing.frames;
  frameIndex = Math.min(frameIndex, frames.length - 1);
  const w = Math.min(300, dialog.clientWidth - 80);
  $("#story-preview").innerHTML = `
    <div class="st-bars">${frames.map((_, i) => `<i class="${i <= frameIndex ? "on" : ""}"></i>`).join("")}</div>
    <div class="st-screen" style="width:${w}px;height:${w * 16 / 9}px">
      <div class="ig-scale" style="transform:scale(${w / 1080})">${frameHTML(frames[frameIndex], frameIndex, frames.length)}</div>
      <button type="button" class="ig-nav prev" data-nav="-1" ${frameIndex === 0 ? "hidden" : ""}>‹</button>
      <button type="button" class="ig-nav next" data-nav="1" ${frameIndex === frames.length - 1 ? "hidden" : ""}>›</button>
    </div>`;
}

function renderEditor() {
  renderPreview();
  $("#story-frames").innerHTML = editing.frames.map((f, i) => `
    <div class="design-slide ${i === frameIndex ? "on" : ""}" data-i="${i}">
      <div class="row between">
        <b>${arNum(i + 1)} — <input data-f="role" value="${esc(f.role)}" class="inline"></b>
        <select data-f="media"><option value="photo" ${f.media === "photo" ? "selected" : ""}>صورة</option><option value="video" ${f.media === "video" ? "selected" : ""}>فيديو</option></select>
      </div>
      <input data-f="shot" value="${esc(f.shot)}" placeholder="شنو تصورين (الخلفية)">
      ${bgPicker(f)}
      <input data-f="kicker" value="${esc(f.kicker)}" placeholder="عنوان صغير فوق النص (اختياري)">
      <textarea data-f="statements" rows="3" placeholder="كل عبارة بسطر، والكلمة المظللة بين [[ ]]">${esc(f.statements.join("\n"))}</textarea>
      <div class="row">
        <input data-f="sticker" value="${esc(f.sticker)}" placeholder="ملصق (تصويت، سؤال، رابط)">
        <input data-f="ctaKeyword" value="${esc(f.ctaKeyword)}" placeholder="كلمة بالخاص (للدعوة)">
      </div>
    </div>`).join("");
}

$("#story-preview").addEventListener("click", (e) => {
  const nav = e.target.closest("[data-nav]");
  if (nav) { frameIndex += Number(nav.dataset.nav); renderEditor(); }
});

$("#story-frames").addEventListener("focusin", (e) => {
  const card = e.target.closest(".design-slide");
  if (card && Number(card.dataset.i) !== frameIndex) {
    frameIndex = Number(card.dataset.i);
    renderPreview();
    $$(".design-slide", $("#story-frames")).forEach((c) => c.classList.toggle("on", Number(c.dataset.i) === frameIndex));
  }
});

function onFrameEdit(e) {
  const card = e.target.closest(".design-slide");
  if (!card) return;
  const frame0 = editing.frames[card.dataset.i];
  if (e.type === "change" && e.target.matches("[data-bg]")) {
    frame0[frame0.media === "video" ? "video" : "image"] = e.target.value || "";
    return renderPreview();
  }
  if (e.type === "change" && e.target.matches("[data-bg-file]")) {
    const files = [...e.target.files];
    e.target.value = "";
    uploadFiles(files).then(([m]) => {
      frame0[frame0.media === "video" ? "video" : "image"] = m.url;
      renderEditor();
    }).catch((err) => toast(err.message));
    return;
  }
  const f = e.target.dataset.f;
  if (!f) return;
  if (f === "media" && e.type === "change") { frame0.media = e.target.value; return renderEditor(); }
  const frame = editing.frames[card.dataset.i];
  frame[f] = f === "statements" ? e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) : e.target.value;
  renderPreview();
}
$("#story-frames").addEventListener("input", onFrameEdit);
$("#story-frames").addEventListener("change", onFrameEdit);

function collect() {
  return {
    ...editing,
    title: form.elements.title.value,
    type: form.elements.type.value,
    ending: form.elements.ending.value,
    measure: form.elements.measure.value,
    status: form.elements.status.value,
    publishAt: form.elements.publishAt.value ? new Date(form.elements.publishAt.value).toISOString() : null,
    checks: $$("#story-checks [data-check]").filter((c) => c.checked).map((c) => c.dataset.check),
  };
}

// يرسم الشرائح ويرفعها: صورة نهائية للشرائح العادية، وطبقة شفافة لشرائح الفيديو
async function prepare(s) {
  if (!window.htmlToImage) throw new Error("مكتبة الصور ما تحملت، حدّثي الصفحة");
  await document.fonts.ready;
  const missing = s.frames.findIndex((f) => f.media === "video" && !f.video);
  if (missing >= 0) throw new Error(`الشريحة ${missing + 1} فيديو، ارفعي الفيديو أو اختاريه من اللقطات`);
  const stage = $("#design-stage");
  for (const [i, f] of s.frames.entries()) {
    stage.innerHTML = frameHTML(f, i, s.frames.length, { exporting: true });
    const blob = await window.htmlToImage.toBlob(stage.firstElementChild, { width: 1080, height: 1920, pixelRatio: 1 });
    const [m] = await uploadFiles([new File([blob], `story-${i + 1}.png`, { type: "image/png" })]);
    if (f.media === "video") { f.overlay = m.url; delete f.rendered; } else { f.rendered = m.url; delete f.overlay; }
  }
  stage.innerHTML = "";
  return s;
}

async function saveStory(s) {
  const saved = await api(`/api/stories/${s.id}`, { method: "PUT", body: s });
  stories = stories.map((x) => (x.id === saved.id ? saved : x));
  editing = structuredClone(saved);
  renderWeek();
  changed();
  return saved;
}

$("#story-publish").addEventListener("click", (e) => {
  if (!confirm("بننشر شرائح هالستوري على الإنستغرام الحين بالترتيب. متأكدة؟")) return;
  busy(e.target, async () => {
    const s = await prepare(collect());
    await saveStory(s);
    toast("جاري النشر... الفيديو ياخذ وقت شوي");
    const done = await api(`/api/stories/${s.id}/publish`, { method: "POST" }).finally(async () => {
      stories = await api("/api/stories");
      renderWeek();
    });
    if (done.status === "posted") { dialog.close(); toast("انتشر الستوري"); }
  });
});

$("#story-schedule").addEventListener("click", (e) => busy(e.target, async () => {
  const s = collect();
  if (!s.publishAt) throw new Error("حددي موعد النشر");
  if (new Date(s.publishAt) < new Date()) throw new Error("الموعد لازم يكون بالمستقبل");
  await prepare(s);
  await saveStory({ ...s, status: "scheduled", error: null });
  dialog.close();
  toast("انجدول الستوري ✓ بينتشر تلقائياً بموعده");
}));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await saveStory(collect());
    dialog.close();
    toast("انحفظ ✓");
  } catch (err) { toast(err.message); }
});

$("#story-delete").addEventListener("click", async () => {
  if (!confirm("تحذفين هالستوري؟")) return;
  await api(`/api/stories/${editing.id}`, { method: "DELETE" });
  stories = stories.filter((s) => s.id !== editing.id);
  renderWeek();
  changed();
  dialog.close();
});

// السكربت بنفس شكل المهارة
function scriptText(s) {
  const frames = s.frames.map((f, i) => [
    `### ${arNum(i + 1)} — ${f.role}  ·  ${f.media === "video" ? "🎥 فيديو" : "📷 صورة"}`,
    `الخلفية: ${f.shot || "—"}`,
    f.kicker && `العنوان الصغير: ${f.kicker}`,
    `النص: ${f.statements.join(" / ")}`,
    f.ctaKeyword && `الدعوة: ${f.ctaLine || "ارسلوا لي كلمة"} «${f.ctaKeyword}» ${f.ctaSub || "بالخاص"}`,
    `الملصق: ${f.sticker || "—"}`,
  ].filter(Boolean).join("\n")).join("\n\n");
  return `# ${s.title}\n${STORY_TYPES[s.type]?.name} · ${STORY_ENDINGS[s.ending]}\n\n${frames}\n\n**شنو تقيسين:** ${s.measure}`;
}

$("#story-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(scriptText(collect()));
    toast("انسخ السكربت ✓");
  } catch {
    toast("ما قدرت أنسخ، جربي من متصفح ثاني");
  }
});

$("#story-download").addEventListener("click", (e) => busy(e.target, async () => {
  if (!window.htmlToImage) throw new Error("مكتبة الصور ما تحملت، حدّثي الصفحة");
  await document.fonts.ready;
  const stage = $("#design-stage");
  const s = collect();
  for (const [i, f] of s.frames.entries()) {
    stage.innerHTML = frameHTML(f, i, s.frames.length, { exporting: true });
    const blob = await window.htmlToImage.toBlob(stage.firstElementChild, { width: 1080, height: 1920, pixelRatio: 1 });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `story-${s.date}-${i + 1}${f.media === "video" ? "-overlay" : ""}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  stage.innerHTML = "";
  toast("نزلت التصاميم — شرائح الفيديو طبقة شفافة تنحط فوق الفيديو");
}));

window.addEventListener("resize", () => { if (dialog.open) renderPreview(); });

load().catch((err) => toast(err.message));
