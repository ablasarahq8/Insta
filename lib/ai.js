// اقتراح الأفكار وكتابة الكابشن باستخدام Claude
import Anthropic from "@anthropic-ai/sdk";
import { FUNNEL, FUNNEL_TARGET, GOALS } from "../public/taxonomy.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
let client;

const SYSTEM = `أنت خبير محتوى إنستغرام تساعد صاحب حساب يخطط منشوراته.
اكتب دايماً باللغة واللهجة المحددة في ملف الحساب، وخل الأفكار عملية وتناسب جمهور الحساب بالضبط.
تجنب الأفكار العامة المكررة؛ كل فكرة لازم يكون لها زاوية واضحة وهوك قوي في أول ثانية.

كل منشور له مرحلة بالقمع التسويقي:
${Object.entries(FUNNEL).map(([k, f]) => `- ${k}: ${f.name} — ${f.hint}`).join("\n")}

وله هدف واحد من: ${Object.entries(GOALS).map(([k, g]) => `${k} (${g.name})`).join("، ")}.
خل المرحلة والهدف ينعكسون فعلاً على الفكرة والكابشن والدعوة للتفاعل.`;

const POST_PROPS = {
  title: { type: "string" },
  format: { type: "string", enum: ["post", "carousel", "reel"] },
  funnel: { type: "string", enum: Object.keys(FUNNEL) },
  goal: { type: "string", enum: Object.keys(GOALS) },
  hook: { type: "string" },
  notes: { type: "string" },
  caption: { type: "string" },
  hashtags: { type: "string" },
};

const IDEA_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: POST_PROPS,
        required: Object.keys(POST_PROPS),
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    posts: {
      type: "array",
      items: {
        type: "object",
        properties: { day: { type: "integer", enum: [0, 1, 2, 3, 4, 5, 6] }, ...POST_PROPS },
        required: ["day", ...Object.keys(POST_PROPS)],
        additionalProperties: false,
      },
    },
  },
  required: ["posts"],
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

const recentText = (ideas) =>
  ideas
    .slice(0, 30)
    .map((i) => `- ${i.title}${i.notes ? `: ${i.notes.slice(0, 120)}` : ""}`)
    .join("\n") || "لا يوجد";

export async function suggestIdeas(profile, existingIdeas, { count = 5, topic = "", funnel = "", goal = "" } = {}) {
  const focus = [
    topic && `ركز على هذا الموضوع: ${topic}`,
    FUNNEL[funnel] && `كل الأفكار لازم تكون مرحلة ${funnel} (${FUNNEL[funnel].name}).`,
    GOALS[goal] && `كل الأفكار لازم يكون هدفها ${goal} (${GOALS[goal].name}).`,
  ].filter(Boolean).join("\n");
  const prompt = `${profileText(profile)}

أفكار موجودة عندي (لا تكررها، بس تقدر تبني عليها):
${recentText(existingIdeas)}

${focus ? focus + "\n" : ""}اقترح ${count} أفكار منشورات جديدة خاصة بهذا الحساب.
لكل فكرة: عنوان قصير، نوع المنشور (post أو carousel أو reel)، مرحلة القمع، الهدف، هوك أول ثانية،
شرح التنفيذ (شنو يتصور/يتكتب بكل سلايد أو مشهد)، كابشن جاهز، و٨-١٥ هاشتاق مناسبة مفصولة بمسافات.`;
  const { ideas } = await askJSON(prompt, IDEA_SCHEMA);
  return ideas;
}

// يخطط أسبوع كامل متوازن بين مراحل القمع والأهداف
// day: 0 = الأحد ... 6 = السبت
export async function planWeek(profile, existingIdeas, weekPosts, { count = 7, topic = "" } = {}) {
  const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const already = weekPosts
    .map((p) => `- ${DAYS[p.day]}: ${p.title} [${p.funnel || "؟"} / ${p.goal || "؟"}]`)
    .join("\n");
  const target = Object.entries(FUNNEL_TARGET).map(([k, v]) => `${k} ${v}%`).join("، ");
  const prompt = `${profileText(profile)}

أفكار سابقة (لا تكررها):
${recentText(existingIdeas)}

منشورات محطوطة هالأسبوع من قبل (كمّل عليها وغطِّ الناقص):
${already || "لا يوجد"}

${topic ? `مناسبة أو موضوع هالأسبوع: ${topic}\n` : ""}خطط ${count} منشورات جديدة لهالأسبوع (day من 0 = الأحد إلى 6 = السبت).
الشروط:
- وزّع مراحل القمع على الأسبوع كامل (مع المنشورات الموجودة) قريب من: ${target}.
- نوّع الأهداف قد ما تقدر، لا تكرر نفس الهدف بيومين ورا بعض، وخل الحساب منوع (بيعي، فكاهي، أخبار، تقني...) بشكل يناسب مجال الحساب.
- نوّع أنواع المنشورات (ريل، كاروسيل، بوست).
- وزّعها على الأيام بشكل منطقي (مثلاً البيعي مو أول يوم، والخفيف بنهاية الأسبوع).
لكل منشور: اليوم، عنوان قصير، النوع، المرحلة، الهدف، هوك، شرح التنفيذ، كابشن جاهز، و٨-١٥ هاشتاق.`;
  const { posts } = await askJSON(prompt, PLAN_SCHEMA);
  return posts.sort((a, b) => a.day - b.day);
}

export async function writeCaption(profile, idea) {
  const prompt = `${profileText(profile)}

الفكرة:
- العنوان: ${idea.title}
- النوع: ${idea.format}
- مرحلة القمع: ${FUNNEL[idea.funnel] ? `${idea.funnel} (${FUNNEL[idea.funnel].name})` : "غير محددة"}
- الهدف: ${GOALS[idea.goal]?.name || "غير محدد"}
- ملاحظاتي: ${idea.notes || "لا يوجد"}
${idea.caption ? `- كابشن حالي (طوّره): ${idea.caption}` : ""}

اكتب كابشن إنستغرام جاهز للنشر يبدأ بهوك قوي وينتهي بدعوة للتفاعل تناسب مرحلة القمع والهدف، و٨-١٥ هاشتاق مناسبة مفصولة بمسافات.`;
  return askJSON(prompt, CAPTION_SCHEMA, "low");
}
