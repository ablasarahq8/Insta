// اقتراح الأفكار وكتابة الكابشن باستخدام Claude
import Anthropic from "@anthropic-ai/sdk";
import { FUNNEL, FUNNEL_TARGET, GOALS, STRATEGY_GOALS, LAUNCH_TYPES } from "../public/taxonomy.js";

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
  const response = await client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort, format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: prompt }],
  }).finalMessage();
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
// strategyWeek: خطة هالأسبوع من الخطة التسويقية (إذا موجودة)
export async function planWeek(profile, existingIdeas, weekPosts, { count = 7, topic = "", strategyWeek = null } = {}) {
  const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const already = weekPosts
    .map((p) => `- ${DAYS[p.day]}: ${p.title} [${p.funnel || "؟"} / ${p.goal || "؟"}]`)
    .join("\n");
  const mix = strategyWeek ? { tof: strategyWeek.tof, mof: strategyWeek.mof, bof: strategyWeek.bof } : FUNNEL_TARGET;
  const target = Object.entries(mix).map(([k, v]) => `${k} ${v}%`).join("، ");
  const DAYS_FROM = (date) => DAYS[new Date(date + "T00:00:00Z").getUTCDay()];
  const strategyText = strategyWeek ? `
هذا الأسبوع رقم ${strategyWeek.week} من الخطة التسويقية (مرحلة: ${strategyWeek.phase}):
- الثيم: ${strategyWeek.theme}
- التركيز: ${strategyWeek.focus}
- الدعوة للإجراء: ${strategyWeek.cta}
- محتوى أساسي مقترح: ${strategyWeek.keyContent.join("، ")}
${strategyWeek.events.length ? `- أحداث إطلاق هالأسبوع (لازم تغطيها بمنشورات بنفس اليوم أو قبله):\n${strategyWeek.events.map((e) => `  • ${DAYS_FROM(e.date)}: ${e.launch} — ${e.title}: ${e.action}`).join("\n")}` : ""}
` : "";
  const prompt = `${profileText(profile)}
${strategyText}

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

// ---------- الخطة التسويقية ----------
const STRATEGY_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    kpis: {
      type: "array",
      items: {
        type: "object",
        properties: { goal: { type: "string" }, metric: { type: "string" }, target: { type: "string" } },
        required: ["goal", "metric", "target"],
        additionalProperties: false,
      },
    },
    phases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          startWeek: { type: "integer" },
          endWeek: { type: "integer" },
          objective: { type: "string" },
        },
        required: ["name", "startWeek", "endWeek", "objective"],
        additionalProperties: false,
      },
    },
    weeks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          week: { type: "integer" },
          phase: { type: "string" },
          theme: { type: "string" },
          focus: { type: "string" },
          tof: { type: "integer" },
          mof: { type: "integer" },
          bof: { type: "integer" },
          goals: { type: "array", items: { type: "string", enum: Object.keys(GOALS) } },
          postsPerWeek: { type: "integer" },
          keyContent: { type: "array", items: { type: "string" } },
          cta: { type: "string" },
        },
        required: ["week", "phase", "theme", "focus", "tof", "mof", "bof", "goals", "postsPerWeek", "keyContent", "cta"],
        additionalProperties: false,
      },
    },
    launchPlans: {
      type: "array",
      items: {
        type: "object",
        properties: {
          launchName: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                daysFromLaunch: { type: "integer" },
                title: { type: "string" },
                action: { type: "string" },
              },
              required: ["daysFromLaunch", "title", "action"],
              additionalProperties: false,
            },
          },
        },
        required: ["launchName", "steps"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "kpis", "phases", "weeks", "launchPlans"],
  additionalProperties: false,
};

function strategyInputText(st) {
  const goals = st.goals
    .map((g) => `- ${STRATEGY_GOALS[g.type]?.name || g.type}${g.detail ? `: ${g.detail}` : ""}`)
    .join("\n");
  const launches = st.launches
    .map((l) => `- "${l.name}" (${LAUNCH_TYPES[l.type] || l.type}) — تاريخ الإطلاق ${l.date || "غير محدد"}${l.details ? ` — ${l.details}` : ""}`)
    .join("\n");
  return `تاريخ بداية الخطة: ${st.startDate} (الأسبوع ١ يبدأ يوم الأحد ${st.startDate})
مدة الخطة: ${st.weeks} أسبوع
الأهداف:
${goals || "- غير محددة"}
الإطلاقات:
${launches || "- لا يوجد"}
ملاحظات: ${st.notes || "لا يوجد"}`;
}

export async function buildStrategy(profile, strategy) {
  const prompt = `${profileText(profile)}

${strategyInputText(strategy)}

سوّ خطة تسويقية للإنستغرام لهالمدة مبنية على الأهداف والإطلاقات:
- summary: ملخص الاستراتيجية بفقرة أو فقرتين (ليش هالترتيب).
- kpis: مؤشرات قياس لكل هدف مع رقم مستهدف واقعي.
- phases: قسّم المدة لمراحل (مثلاً: بناء جمهور ← بناء ثقة ← تشويق ← إطلاق ← ما بعد الإطلاق) مع أرقام الأسابيع.
- weeks: لكل أسبوع من ١ إلى ${strategy.weeks}: المرحلة، ثيم الأسبوع، التركيز، نسب القمع tof/mof/bof (مجموعها ١٠٠)،
  أهم أهداف المنشورات، عدد المنشورات المقترح، ٣-٤ أفكار محتوى أساسية، والدعوة للإجراء (CTA) لهالأسبوع.
  خل نسب القمع تتغير مع المراحل: البداية TOF عالي، وقبل الإطلاق وأثناءه BOF يرتفع، وبعده يرجع توازن.
- launchPlans: لكل إطلاق (launchName بنفس الاسم بالضبط بين علامات التنصيص)، جدول الإعلان كخطوات بعدد الأيام من يوم الإطلاق
  (سالب = قبل، ٠ = يوم الإطلاق، موجب = بعد): متى تبدأ التلميح، متى تفتح قائمة الانتظار، التسجيل المبكر، الإطلاق، تذكير آخر فرصة، ومتابعة بعد الإطلاق.
  خل البداية بوقت كافي (عادة ٣-٤ أسابيع قبل الإطلاق) وراعي بداية الخطة.`;
  const plan = await askJSON(prompt, STRATEGY_SCHEMA, "high");
  plan.weeks.sort((a, b) => a.week - b.week);
  return plan;
}

// ---------- مكتبة اللقطات ----------
const SHOTS_SCHEMA = {
  type: "object",
  properties: {
    shots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          kind: { type: "string", enum: ["video", "photo"] },
          category: { type: "string" },
          duration: { type: "string" },
          tips: { type: "string" },
          usage: { type: "string" },
        },
        required: ["title", "description", "kind", "category", "duration", "tips", "usage"],
        additionalProperties: false,
      },
    },
  },
  required: ["shots"],
  additionalProperties: false,
};

export async function suggestShots(profile, strategy, existingShots, { count = 15 } = {}) {
  const existing = existingShots.map((s) => `- ${s.title}`).join("\n");
  const prompt = `${profileText(profile)}

${strategy?.plan ? `${strategyInputText(strategy)}\nملخص الخطة: ${strategy.plan.summary}` : ""}

لقطات موجودة عندي (لا تكررها):
${existing || "لا يوجد"}

اقترح ${count} لقطة (صور أو فيديوهات قصيرة B-roll) أصورها مرة وحدة وأخليها مكتبة عندي،
عشان أركّب عليها ريلز فويس اوفر طول فترة الخطة بدون ما أحتاج أصور كل مرة.
خلها خاصة بمجال الحساب والإطلاقات، ومتنوعة: لقطات شغل وأدوات، يوميات وأجواء، وجه وتعابير، يدين وتفاصيل قريبة،
تسجيل شاشة، ونتائج/قبل وبعد، ولقطات تصلح للإعلان عن الإطلاقات.
لكل لقطة: عنوان، وصف شنو يتصور بالضبط، النوع (video أو photo)، تصنيف قصير (مثلاً: شغل، أجواء، وجه، تفاصيل، شاشة، إطلاق)،
المدة المقترحة للفيديو، نصايح تصوير (الزاوية، الإضاءة، الحركة)، وبأي نوع ريلز تنفع.`;
  const { shots } = await askJSON(prompt, SHOTS_SCHEMA);
  return shots;
}

// ---------- سكربت الفويس اوفر ----------
const VOICEOVER_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          seconds: { type: "integer" },
          shot: { type: "string" },
          fromLibrary: { type: "boolean" },
          voiceover: { type: "string" },
          onScreenText: { type: "string" },
        },
        required: ["seconds", "shot", "fromLibrary", "voiceover", "onScreenText"],
        additionalProperties: false,
      },
    },
  },
  required: ["scenes"],
  additionalProperties: false,
};

export async function voiceoverScript(profile, idea, shots) {
  const library = shots
    .map((s) => `- ${s.title} (${s.kind === "photo" ? "صورة" : "فيديو"}${s.done ? "، جاهزة" : ""}): ${s.description}`)
    .join("\n");
  const prompt = `${profileText(profile)}

الريل:
- العنوان: ${idea.title}
- مرحلة القمع: ${FUNNEL[idea.funnel] ? `${idea.funnel} (${FUNNEL[idea.funnel].name})` : "غير محددة"}
- الهدف: ${GOALS[idea.goal]?.name || "غير محدد"}
- ملاحظاتي: ${idea.notes || "لا يوجد"}

مكتبة اللقطات اللي عندي:
${library || "لا يوجد"}

اكتب سكربت ريل فويس اوفر (٢٠-٤٥ ثانية) مقسم لمشاهد.
لكل مشهد: المدة بالثواني، اللقطة (اختار من المكتبة بنفس العنوان بالضبط وخل fromLibrary=true، وإذا ما في لقطة مناسبة اقترح لقطة جديدة وخل fromLibrary=false)،
نص الفويس اوفر باللهجة المحددة (طبيعي كأنه كلام، مو كتابة)، ونص قصير يطلع على الشاشة.
أول مشهد هوك قوي بأول ٣ ثواني، وآخر مشهد دعوة للإجراء تناسب الهدف.`;
  const { scenes } = await askJSON(prompt, VOICEOVER_SCHEMA, "low");
  return scenes;
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
