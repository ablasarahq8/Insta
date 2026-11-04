// المساعد الشخصي: محادثة تعرف ملف الحساب والخطة والأسبوع
import { $, $$, esc, api, toast, icon } from "./common.js";

const log = $("#chat-log");
const form = $("#chat-form");
let chat = [];
let waiting = false;

// تنسيق بسيط للرد: عناوين، نقاط، خط عريض
function format(text) {
  const blocks = esc(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split(/\n{2,}/);
  return blocks.map((b) => {
    const lines = b.split("\n");
    if (lines.every((l) => /^\s*([-•*]|\d+[.)])\s+/.test(l))) {
      return `<ul>${lines.map((l) => `<li>${l.replace(/^\s*([-•*]|\d+[.)])\s+/, "")}</li>`).join("")}</ul>`;
    }
    return `<p>${lines.map((l) => l.replace(/^#{1,4}\s*/, "")).join("<br>")}</p>`;
  }).join("");
}

function render() {
  $("#chat-starters").hidden = chat.length > 0;
  log.innerHTML = chat.length
    ? chat.map((m, i) => `
      <div class="msg ${m.role}">
        ${m.role === "assistant" ? format(m.content) : `<p>${esc(m.content).replace(/\n/g, "<br>")}</p>`}
        ${m.role === "assistant" ? `<div class="msg-actions">
          <button type="button" class="ghost" data-copy="${i}">${icon("copy", 13)} نسخ</button>
          <button type="button" class="ghost" data-idea="${i}">${icon("bulb", 13)} حفظ كفكرة</button>
        </div>` : ""}
      </div>`).join("") + (waiting ? `<div class="typing">جارٍ التفكير…</div>` : "")
    : `<p class="empty">اسأل عن أي شيء يخص محتواك أو منتجاتك، أو اختر أحد الأسئلة أدناه.</p>`;
  log.scrollTop = log.scrollHeight;
}

async function send(message) {
  if (!message.trim() || waiting) return;
  chat.push({ role: "user", content: message });
  waiting = true;
  render();
  try {
    chat = await api("/api/assistant", { method: "POST", body: { message } });
  } catch (err) {
    chat.pop();
    form.elements.message.value = message;
    toast(err.message);
  } finally {
    waiting = false;
    render();
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = form.elements.message.value;
  form.elements.message.value = "";
  send(message);
});

// Enter يرسل، وShift+Enter سطر يديد
form.elements.message.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    form.requestSubmit();
  }
});

$$("#chat-starters .chip").forEach((b) => b.addEventListener("click", () => send(b.textContent)));

log.addEventListener("click", async (e) => {
  const copy = e.target.closest("[data-copy]");
  const idea = e.target.closest("[data-idea]");
  if (copy) {
    try { await navigator.clipboard.writeText(chat[copy.dataset.copy].content); toast("نُسخ ✓"); }
    catch { toast("تعذّر النسخ في هذا المتصفح"); }
  }
  if (idea) {
    const text = chat[idea.dataset.idea].content;
    const title = text.split("\n").map((l) => l.replace(/[#*\-•]/g, "").trim()).find(Boolean)?.slice(0, 80) || "فكرة من المساعد";
    try {
      await api("/api/ideas", { method: "POST", body: { title, notes: text, source: "ai" } });
      window.dispatchEvent(new Event("ideas-reload"));
      toast("حُفظت في الأفكار ✓");
    } catch (err) { toast(err.message); }
  }
});

$("#chat-clear").addEventListener("click", async () => {
  if (chat.length && !confirm("بدء محادثة جديدة؟ ستُحذف المحادثة الحالية.")) return;
  await api("/api/assistant", { method: "DELETE" });
  chat = [];
  render();
});

api("/api/assistant").then((c) => { chat = c; render(); }).catch(() => render());
