// مصمم البوست: سلايدات بألوان البراند + معاينة بشكل الإنستغرام + حفظها كصور
import { $, esc, api, toast, busy, uploadFiles } from "./common.js";

const STYLES = {
  bold: "جريء",
  minimal: "هادئ",
  gradient: "متدرج",
};

const dialog = $("#designer");
let state = null; // { idea, profile, style, slides, index, onSave }

// مقاس السلايد الحقيقي (بكسل) — الريل غلاف طولي، الباقي ٤:٥
const sizeOf = (format) => (format === "reel" ? { w: 1080, h: 1920 } : { w: 1080, h: 1350 });

export async function openDesigner(idea, onSave) {
  const profile = await api("/api/profile");
  state = {
    idea,
    profile,
    style: idea.design?.style || "bold",
    slides: structuredClone(idea.design?.slides || []),
    index: 0,
    onSave,
  };
  $("#design-style").innerHTML = Object.entries(STYLES)
    .map(([k, v]) => `<option value="${k}" ${k === state.style ? "selected" : ""}>${v}</option>`).join("");
  $("#design-save").hidden = idea.format === "reel";
  $("#design-reel-hint").hidden = idea.format !== "reel";
  dialog.showModal(); // قبل الرسم عشان نعرف عرض الشاشة
  render();
  if (!state.slides.length) generate($("#design-ai"));
}

function brandVars() {
  const p = state.profile;
  return `--b1:${p.brandPrimary || "#d6336c"};--b2:${p.brandAccent || "#f08c00"};--bg:${p.brandBg || "#faf7f5"}`;
}

const handle = () => (state.profile.handle || "@myaccount").replace(/^@?/, "@");

// HTML السلايد بالمقاس الحقيقي
function slideHTML(slide, i) {
  const total = state.slides.length;
  const { w, h } = sizeOf(state.idea.format);
  return `
    <div class="slide style-${state.style} kind-${slide.kind} fmt-${state.idea.format}" style="width:${w}px;height:${h}px;${brandVars()}">
      <div class="slide-top"><span>${esc(handle())}</span>${total > 1 ? `<span>${i + 1}/${total}</span>` : ""}</div>
      <div class="slide-main">
        ${slide.kind === "content" ? `<div class="slide-num">${i}</div>` : ""}
        <h2>${esc(slide.title)}</h2>
        ${slide.body ? `<p>${esc(slide.body)}</p>` : ""}
        ${slide.kind === "cta" ? `<div class="slide-pill">تابعني ${esc(handle())}</div>` : ""}
      </div>
      ${slide.kind === "cover" && total > 1 ? `<div class="slide-swipe">اسحب ←</div>` : ""}
    </div>`;
}

function render() {
  const { idea, slides } = state;
  state.index = Math.min(state.index, Math.max(slides.length - 1, 0));
  const { w, h } = sizeOf(idea.format);
  // عرض المعاينة على قد المساحة (التلفون أضيق)
  const frameW = Math.min(340, dialog.clientWidth - 40 - 34);
  const scale = frameW / w;

  // المعاينة
  const caption = [idea.caption, idea.hashtags].filter(Boolean).join("\n\n");
  $("#ig-preview").innerHTML = `
    <div class="ig-head"><span class="ig-avatar">${esc(handle()[1]?.toUpperCase() || "?")}</span><b>${esc(handle().slice(1))}</b></div>
    <div class="ig-media" style="width:${frameW}px;height:${h * scale}px">
      ${slides.length ? `<div class="ig-scale" style="transform:scale(${scale})">${slideHTML(slides[state.index], state.index)}</div>`
        : `<div class="ig-empty">لحظة... قاعد أصمم</div>`}
      ${slides.length > 1 ? `
        <button type="button" class="ig-nav prev" data-nav="-1" ${state.index === 0 ? "hidden" : ""}>‹</button>
        <button type="button" class="ig-nav next" data-nav="1" ${state.index === slides.length - 1 ? "hidden" : ""}>›</button>` : ""}
    </div>
    ${slides.length > 1 ? `<div class="ig-dots">${slides.map((_, i) => `<i class="${i === state.index ? "on" : ""}"></i>`).join("")}</div>` : ""}
    <div class="ig-actions"><span>♡</span><span>💬</span><span>➤</span><span class="ig-save">🔖</span></div>
    <div class="ig-caption"><b>${esc(handle().slice(1))}</b> ${esc(caption || "الكابشن بيطلع هني...").replace(/(#[^\s#]+)/g, '<span class="ig-tag">$1</span>')}</div>`;

  // تعديل النصوص
  $("#design-slides").innerHTML = slides.map((s, i) => `
    <div class="design-slide ${i === state.index ? "on" : ""}" data-i="${i}">
      <div class="row between"><b>سلايد ${i + 1}</b><span class="hint">${{ cover: "غلاف", content: "محتوى", cta: "دعوة للإجراء" }[s.kind]}</span></div>
      <input data-f="title" value="${esc(s.title)}" placeholder="العنوان">
      <textarea data-f="body" rows="2" placeholder="النص">${esc(s.body)}</textarea>
    </div>`).join("");
}

function generate(btn) {
  busy(btn, async () => {
    state.slides = await api(`/api/ideas/${state.idea.id}/design`, { method: "POST" });
    state.index = 0;
    render();
  });
}

window.addEventListener("resize", () => { if (dialog.open) render(); });

$("#design-ai").addEventListener("click", (e) => generate(e.target));
$("#design-style").addEventListener("change", (e) => { state.style = e.target.value; render(); });

$("#ig-preview").addEventListener("click", (e) => {
  const nav = e.target.closest("[data-nav]");
  if (nav) { state.index += Number(nav.dataset.nav); render(); }
});

$("#design-slides").addEventListener("focusin", (e) => {
  const card = e.target.closest(".design-slide");
  if (card && Number(card.dataset.i) !== state.index) {
    state.index = Number(card.dataset.i);
    render();
    $(`.design-slide[data-i="${state.index}"] [data-f="${e.target.dataset.f}"]`)?.focus();
  }
});

$("#design-slides").addEventListener("input", (e) => {
  const card = e.target.closest(".design-slide");
  state.slides[card.dataset.i][e.target.dataset.f] = e.target.value;
  // نحدث المعاينة بس بدون ما نعيد رسم الحقول (عشان ما يضيع المؤشر)
  const media = $("#ig-preview .ig-scale");
  if (media) media.innerHTML = slideHTML(state.slides[state.index], state.index);
});

// يرسم كل سلايد كصورة PNG بمقاسها الحقيقي
async function renderImages() {
  if (!window.htmlToImage) throw new Error("مكتبة الصور ما تحملت، حدّث الصفحة");
  await document.fonts.ready;
  const stage = $("#design-stage");
  const files = [];
  for (const [i, slide] of state.slides.entries()) {
    stage.innerHTML = slideHTML(slide, i);
    const { w, h } = sizeOf(state.idea.format);
    const blob = await window.htmlToImage.toBlob(stage.firstElementChild, { width: w, height: h, pixelRatio: 1 });
    files.push(new File([blob], `slide-${i + 1}.png`, { type: "image/png" }));
  }
  stage.innerHTML = "";
  return files;
}

$("#design-save").addEventListener("click", (e) => busy(e.target, async () => {
  if (!state.slides.length) throw new Error("ما في سلايدات");
  const media = await uploadFiles(await renderImages());
  await state.onSave({ style: state.style, slides: state.slides }, media);
  dialog.close();
  toast("انحفظ التصميم كصور للمنشور ✓");
}));

$("#design-download").addEventListener("click", (e) => busy(e.target, async () => {
  for (const file of await renderImages()) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  await state.onSave({ style: state.style, slides: state.slides }, null);
}));
