// مكتبة اللقطات: صور وفيديوهات B-roll تتصور مرة وحدة وتنستخدم للريلز
import { $, $$, esc, api, toast, busy, uploadFiles } from "./common.js";

let shots = [];
let filter = "all";
let editingShot = null;
const dialog = $("#shot-editor");
const form = $("#shot-form");

async function load() {
  shots = await api("/api/shots");
  render();
}

function render() {
  const done = shots.filter((s) => s.done).length;
  $("#shots-progress").textContent = shots.length ? `صوّرت ${done} من ${shots.length}` : "";
  const list = shots.filter((s) => filter === "all" || (filter === "done" ? s.done : !s.done));
  const el = $("#shots");
  if (!list.length) {
    el.innerHTML = `<p class="empty">${shots.length ? "ما في شي هني" : "المكتبة فاضية — خل الذكاء الاصطناعي يقترح لك شنو تصور 👆"}</p>`;
    return;
  }
  el.innerHTML = list.map((s) => `
    <article class="card shot ${s.done ? "done" : ""}" data-id="${s.id}">
      <div class="row between">
        <label class="check"><input type="checkbox" data-done ${s.done ? "checked" : ""}> ${s.done ? "جاهزة" : "صوّرتها؟"}</label>
        <span class="meta">
          <span class="badge">${s.kind === "photo" ? "📷 صورة" : "🎥 فيديو"}</span>
          ${s.category ? `<span class="badge">${esc(s.category)}</span>` : ""}
        </span>
      </div>
      <h3>${esc(s.title)}</h3>
      ${s.description ? `<p>${esc(s.description)}</p>` : ""}
      ${s.duration && s.kind !== "photo" ? `<span class="hint">⏱️ ${esc(s.duration)}</span>` : ""}
      ${s.tips ? `<span class="hint">💡 ${esc(s.tips)}</span>` : ""}
      ${s.usage ? `<span class="hint">🎯 ${esc(s.usage)}</span>` : ""}
      <div class="media">${s.media.map((m) => m.type === "video"
        ? `<video src="${esc(m.url)}" muted></video>`
        : `<img src="${esc(m.url)}" alt="">`).join("")}</div>
      <div class="row between">
        <label class="ghost small file-btn">+ ارفع اللقطة<input type="file" data-upload accept="image/jpeg,image/png,video/mp4,video/quicktime" multiple hidden></label>
        <button class="ghost small" data-edit>تعديل</button>
      </div>
    </article>`).join("");
}

async function update(id, patch) {
  const updated = await api(`/api/shots/${id}`, { method: "PUT", body: patch });
  shots = shots.map((s) => (s.id === id ? updated : s));
  render();
}

$("#shots").addEventListener("change", async (e) => {
  const id = e.target.closest(".shot")?.dataset.id;
  if (!id) return;
  try {
    if (e.target.matches("[data-done]")) await update(id, { done: e.target.checked });
    if (e.target.matches("[data-upload]")) {
      const files = [...e.target.files];
      const shot = shots.find((s) => s.id === id);
      const media = await uploadFiles(files);
      await update(id, { media: [...shot.media, ...media], done: true });
      toast("انرفعت ✓");
    }
  } catch (err) { toast(err.message); }
});

$("#shots").addEventListener("click", (e) => {
  if (e.target.closest("[data-edit]")) openEditor(shots.find((s) => s.id === e.target.closest(".shot").dataset.id));
});

$$(".shot-filter").forEach((c) => c.addEventListener("click", () => {
  filter = c.dataset.filter;
  $$(".shot-filter").forEach((x) => x.classList.toggle("active", x === c));
  render();
}));

$("#suggest-shots").addEventListener("click", (e) => busy(e.target, async () => {
  const added = await api("/api/ai/shots", { method: "POST", body: { count: $("#shots-count").value } });
  shots.push(...added);
  render();
  toast(`انضافت ${added.length} لقطة ✓`);
}));

// ---------- المحرر ----------
const FIELDS = ["title", "kind", "category", "duration", "description", "tips", "usage"];

function openEditor(shot) {
  editingShot = shot;
  for (const f of FIELDS) form.elements[f].value = shot?.[f] || (f === "kind" ? "video" : "");
  $("#shot-delete").hidden = !shot;
  dialog.showModal();
}

$("#add-shot").addEventListener("click", () => openEditor(null));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(FIELDS.map((f) => [f, form.elements[f].value]));
  try {
    if (editingShot) await update(editingShot.id, data);
    else { shots.push(await api("/api/shots", { method: "POST", body: data })); render(); }
    dialog.close();
  } catch (err) { toast(err.message); }
});

$("#shot-delete").addEventListener("click", async () => {
  if (!confirm("تحذف هاللقطة؟")) return;
  await api(`/api/shots/${editingShot.id}`, { method: "DELETE" });
  shots = shots.filter((s) => s.id !== editingShot.id);
  dialog.close();
  render();
});

load().catch((err) => toast(err.message));
