// مصمم البوست: سلايدات بألوان البراند + معاينة بشكل الإنستغرام + حفظها كصور
import { $, esc, api, toast, busy, uploadFiles, icon } from "./common.js";

const STYLES = {
  sarah: "أبلة سارة (هويتي)",
  scrapbook: "سكراب بوك (هويتي)",
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
    style: idea.design?.style || "sarah",
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

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const arNum = (n) => String(n).padStart(2, "0").replace(/\d/g, (d) => AR_DIGITS[d]);

// العنوان مع تلوين الكلمة المهمة بالتدرج
function titleHTML(slide) {
  const title = esc(slide.title);
  const hl = esc(slide.highlight || "");
  return hl && title.includes(hl) ? title.replace(hl, `<span class="s-grad">${hl}</span>`) : title;
}

// هوية أبلة سارة: فاتح/غامق بالتناوب، اللوغو، الترقيم بالأرقام الهندية، CTA ناعم
function sarahSlideHTML(slide, i, w, h) {
  const total = state.slides.length;
  const dark = slide.kind === "cta" || (slide.kind === "content" && i % 2 === 0);
  const tone = dark ? "dark" : "light";
  const handleText = `${(state.profile.handle || "ABLASARAHQ8").replace(/^@/, "").toUpperCase()}@`;
  return `
    <div class="slide style-sarah s-${tone} kind-${slide.kind} fmt-${state.idea.format}" style="width:${w}px;height:${h}px">
      ${slide.kind === "cover" ? `<i class="s-dot s-dot1"></i><i class="s-dot s-dot2"></i><i class="s-dot s-dot3"></i>` : ""}
      <div class="s-header"><span class="s-handle">${esc(handleText)}</span><img class="s-logo" src="/brand/logo_${dark ? "light" : "dark"}.png" alt=""></div>
      <div class="s-main">
        ${slide.pre ? `<div class="s-pre">${esc(slide.pre)}</div>` : ""}
        <h2 class="s-title">${titleHTML(slide)}</h2>
        ${slide.body ? (slide.kind === "content" ? `<div class="s-card"><p>${esc(slide.body)}</p></div>` : `<p class="s-sub">${esc(slide.body)}</p>`) : ""}
        ${slide.kind === "cta" ? `<div class="s-actions"><span>📌 احفظي</span><span class="primary">💬 علّقي</span><span>↗ شاركي</span></div>` : ""}
      </div>
      ${slide.kind === "cover" && total > 1 ? `<div class="s-swipe">اسحبي لليسار <i></i></div>` : ""}
      ${total > 1 ? `<div class="s-page">${arNum(total)} / ${arNum(i + 1)}</div>` : ""}
    </div>`;
}

// ---------- سكراب بوك (من مهارة sarah-scrapbook-reel) ----------
// أرقام شبه عشوائية ثابتة لكل سلايد، عشان التصميم ما يتغير كل مرة نرسمه
const rand = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// حافة ورق ممزقة فوق وتحت (clip-path)
function torn(seed, depth = 3) {
  const r = rand(seed + 7);
  const top = [], bottom = [];
  for (let x = 0; x <= 100; x += 5) {
    top.push(`${x}% ${(r() * depth).toFixed(1)}%`);
    bottom.push(`${100 - x}% ${(100 - r() * depth).toFixed(1)}%`);
  }
  return `polygon(${[...top, ...bottom].join(",")})`;
}

// شخابيط يدوية (SVG) — الخط بسماكة ثابتة مهما كبر الشكل
const DOODLES = {
  circle: "M12 52 C8 18 88 6 95 44 C101 84 22 98 8 62 C3 44 18 26 36 20",
  underline: "M3 60 C25 40 45 75 65 52 S90 45 97 55",
  arrow: "M90 20 C60 25 35 45 18 78 M18 78 L22 52 M18 78 L42 70",
  star: "M50 8 L61 38 L93 39 L67 58 L77 90 L50 71 L23 90 L33 58 L7 39 L39 38 Z",
  sparkle: "M50 5 C53 40 60 47 95 50 C60 53 53 60 50 95 C47 60 40 53 5 50 C40 47 47 40 50 5 Z",
  heart: "M50 88 C15 62 5 40 18 24 C30 10 46 18 50 32 C54 18 70 10 82 24 C95 40 85 62 50 88 Z",
  check: "M10 55 L38 82 L92 18",
};
const doodle = (name, cls, color = "#2d1f3d") =>
  `<svg class="doodle ${cls}" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${DOODLES[name]}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;

function scrapSlideHTML(slide, i, w, h) {
  const total = state.slides.length;
  const r = rand(i * 97 + 13);
  const tilt = i % 2 ? 1 : -1; // الميلان يتناوب يمين/يسار
  const handleText = `@${(state.profile.handle || "ablasarahq8").replace(/^@/, "")}`;
  const title = esc(slide.title);
  const hl = esc(slide.highlight || "");
  const titleHtml = hl && title.includes(hl)
    ? title.replace(hl, `<span class="sc-hl">${hl}${doodle("circle", "sc-hl-ring", "#fe6c77")}</span>`)
    : title;
  const deco = ["star", "sparkle", "heart"];
  return `
    <div class="slide style-scrap kind-${slide.kind} fmt-${state.idea.format}" style="width:${w}px;height:${h}px">
      <i class="sc-scrap sc-lilac" style="clip-path:${torn(i + 1, 8)}"></i>
      <i class="sc-scrap sc-blush" style="clip-path:${torn(i + 2, 8)}"></i>
      <i class="sc-scrap sc-cream" style="clip-path:${torn(i + 3, 8)}"></i>
      <div class="sc-header">
        <span class="sc-sticker" dir="ltr">${esc(handleText)}</span>
        <img class="sc-logo" src="/brand/logo_dark.png" alt="">
      </div>
      <div class="sc-main">
        ${slide.pre ? `<span class="sc-sticker sc-pre" style="transform:rotate(${tilt * -3}deg)">${esc(slide.pre)}</span>` : ""}
        <div class="sc-label" style="clip-path:${torn(i + 11)};transform:rotate(${(tilt * (1 + r() * 1.5)).toFixed(1)}deg)">
          <h2>${titleHtml}</h2>
        </div>
        ${slide.body ? (slide.kind === "content"
          ? `<div class="sc-polaroid" style="transform:rotate(${(tilt * (2 + r() * 2)).toFixed(1)}deg)"><i class="sc-tape"></i><p>${esc(slide.body)}</p></div>`
          : `<p class="sc-sub">${esc(slide.body)}</p>`) : ""}
        ${slide.kind === "cta" ? `<div class="sc-actions"><span class="sc-sticker">📌 احفظي</span><span class="sc-sticker sc-coral">💬 علّقي</span><span class="sc-sticker">↗ شاركي</span></div>` : ""}
      </div>
      ${doodle(deco[i % 3], "sc-deco sc-deco1", i % 2 ? "#fe9a6c" : "#7d579b")}
      ${doodle("sparkle", "sc-deco sc-deco2", "#c9617d")}
      ${slide.kind === "content" ? doodle("underline", "sc-under", "#2d1f3d") : ""}
      ${slide.kind === "cover" && total > 1 ? `<div class="sc-swipe"><span class="sc-sticker sc-ink">اسحبي لليسار</span>${doodle("arrow", "sc-swipe-arrow")}</div>` : ""}
      ${slide.kind === "cta" ? doodle("heart", "sc-cta-heart", "#fe6c77") : ""}
      ${total > 1 ? `<span class="sc-page">${arNum(total)} / ${arNum(i + 1)}</span>` : ""}
    </div>`;
}

// HTML السلايد بالمقاس الحقيقي
function slideHTML(slide, i) {
  const total = state.slides.length;
  const { w, h } = sizeOf(state.idea.format);
  if (state.style === "sarah") return sarahSlideHTML(slide, i, w, h);
  if (state.style === "scrapbook") return scrapSlideHTML(slide, i, w, h);
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
    <div class="ig-actions">${icon("heart", 22)}${icon("message", 22)}${icon("send", 22)}<span class="ig-save">${icon("bookmark", 22)}</span></div>
    <div class="ig-caption"><b>${esc(handle().slice(1))}</b> ${esc(caption || "الكابشن بيطلع هني...").replace(/(#[^\s#]+)/g, '<span class="ig-tag">$1</span>')}</div>`;

  // تعديل النصوص
  $("#design-slides").innerHTML = slides.map((s, i) => `
    <div class="design-slide ${i === state.index ? "on" : ""}" data-i="${i}">
      <div class="row between"><b>سلايد ${i + 1}</b><span class="hint">${{ cover: "غلاف", content: "محتوى", cta: "دعوة للإجراء" }[s.kind]}</span></div>
      ${["sarah", "scrapbook"].includes(state.style) ? `<input data-f="pre" value="${esc(s.pre || "")}" placeholder="التمهيد فوق العنوان">` : ""}
      <input data-f="title" value="${esc(s.title)}" placeholder="العنوان">
      ${["sarah", "scrapbook"].includes(state.style) ? `<input data-f="highlight" value="${esc(s.highlight || "")}" placeholder="الكلمة الملونة (من العنوان)">` : ""}
      <textarea data-f="body" rows="2" placeholder="النص">${esc(s.body)}</textarea>
    </div>`).join("");
}

function generate(btn) {
  busy(btn, async () => {
    state.slides = await api(`/api/ideas/${state.idea.id}/design`, { method: "POST", body: { style: state.style } });
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
