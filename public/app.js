const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const FORMATS = { post: "بوست", carousel: "كاروسيل", reel: "ريل" };
const STATUSES = { idea: "فكرة", draft: "مسودة", scheduled: "مجدولة", published: "منشورة", failed: "فشلت" };

let ideas = [];
let filter = "all";
let editing = null; // نسخة من الفكرة اللي نعدلها

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function api(url, { method = "GET", body } = {}) {
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

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 3000);
}

async function busy(btn, fn) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "لحظة...";
  try { return await fn(); }
  catch (err) { toast(err.message); }
  finally { btn.disabled = false; btn.textContent = label; }
}

// ---------- التنقل ----------
function show(view) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  $$(".view").forEach((v) => (v.hidden = v.id !== `view-${view}`));
}
$$(".tab").forEach((t) => t.addEventListener("click", () => show(t.dataset.view)));
$$("[data-goto]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); show(a.dataset.goto); }));

// ---------- الأفكار ----------
async function loadIdeas() {
  ideas = await api("/api/ideas");
  renderIdeas();
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
  for (const name of ["title", "format", "status", "notes", "caption", "hashtags"]) {
    editorForm.elements[name].value = editing[name] || "";
  }
  editorForm.elements.scheduledAt.value = toLocalInput(editing.scheduledAt);
  $("#editor-error").hidden = !editing.error;
  $("#editor-error").textContent = editing.error ? `آخر محاولة نشر فشلت: ${editing.error}` : "";
  renderMedia();
  dialog.showModal();
}

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
  const fd = new FormData();
  [...e.target.files].forEach((f) => fd.append("files", f));
  e.target.value = "";
  try {
    editing.media.push(...(await api("/api/upload", { method: "POST", body: fd })));
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

$("[data-close]").addEventListener("click", () => dialog.close());

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
        <span class="badge">${FORMATS[s.format] || s.format}</span>
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
