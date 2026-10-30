// اقتراح الأفكار وكتابة الكابشن باستخدام Claude
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
let client;

const SYSTEM = `أنت خبير محتوى إنستغرام تساعد صاحب حساب يخطط منشوراته.
اكتب دايماً باللغة واللهجة المحددة في ملف الحساب، وخل الأفكار عملية وتناسب جمهور الحساب بالضبط.
تجنب الأفكار العامة المكررة؛ كل فكرة لازم يكون لها زاوية واضحة وهوك قوي في أول ثانية.`;

const IDEA_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          format: { type: "string", enum: ["post", "carousel", "reel"] },
          hook: { type: "string" },
          notes: { type: "string" },
          caption: { type: "string" },
          hashtags: { type: "string" },
        },
        required: ["title", "format", "hook", "notes", "caption", "hashtags"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

const CAPTION_SCHEMA = {
  type: "object",
  properties: {
    caption: { type: "string" },
    hashtags: { type: "string" },
  },
  required: ["caption", "hashtags"],
  additionalProperties: false,
};

function profileText(p) {
  return `ملف الحساب:
- اسم الحساب: ${p.handle || "غير محدد"}
- المجال: ${p.niche || "غير محدد"}
- الجمهور: ${p.audience || "غير محدد"}
- الأسلوب/النبرة: ${p.tone || "غير محدد"}
- اللغة واللهجة: ${p.language || "عربي"}
- الأهداف: ${p.goals || "غير محدد"}
- محاور المحتوى: ${p.pillars || "غير محدد"}
- أمثلة من منشورات سابقة: ${p.examples || "لا يوجد"}`;
}

async function askJSON(prompt, schema, effort = "medium") {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("حط ANTHROPIC_API_KEY في ملف .env عشان تشتغل الاقتراحات");
  client ??= new Anthropic();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort, format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("النموذج رفض الطلب");
  if (response.stop_reason === "max_tokens") throw new Error("الرد انقطع، جرب عدد أفكار أقل");
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("ما وصل رد من النموذج");
  return JSON.parse(text);
}

export async function suggestIdeas(profile, existingIdeas, { count = 5, topic = "" } = {}) {
  const recent = existingIdeas
    .slice(0, 30)
    .map((i) => `- ${i.title}${i.notes ? `: ${i.notes.slice(0, 120)}` : ""}`)
    .join("\n");
  const prompt = `${profileText(profile)}

أفكار موجودة عندي (لا تكررها، بس تقدر تبني عليها):
${recent || "لا يوجد"}

${topic ? `ركز على هذا الموضوع: ${topic}\n` : ""}اقترح ${count} أفكار منشورات جديدة خاصة بهذا الحساب.
لكل فكرة: عنوان قصير، نوع المنشور (post أو carousel أو reel)، هوك أول ثانية،
شرح التنفيذ (شنو يتصور/يتكتب بكل سلايد أو مشهد)، كابشن جاهز، و٨-١٥ هاشتاق مناسبة مفصولة بمسافات.`;
  const { ideas } = await askJSON(prompt, IDEA_SCHEMA);
  return ideas;
}

export async function writeCaption(profile, idea) {
  const prompt = `${profileText(profile)}

الفكرة:
- العنوان: ${idea.title}
- النوع: ${idea.format}
- ملاحظاتي: ${idea.notes || "لا يوجد"}
${idea.caption ? `- كابشن حالي (طوّره): ${idea.caption}` : ""}

اكتب كابشن إنستغرام جاهز للنشر يبدأ بهوك قوي وينتهي بدعوة للتفاعل، و٨-١٥ هاشتاق مناسبة مفصولة بمسافات.`;
  return askJSON(prompt, CAPTION_SCHEMA, "low");
}
