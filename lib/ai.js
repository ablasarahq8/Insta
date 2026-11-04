// اقتراح الأفكار وكتابة الكابشن باستخدام Claude
import Anthropic from "@anthropic-ai/sdk";
import {
  FUNNEL, FUNNEL_TARGET, GOALS, STRATEGY_GOALS, LAUNCH_TYPES, STORY_TYPES, STORY_ENDINGS, STORY_SCHEDULE,
} from "../public/taxonomy.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
let client;

const SYSTEM = `أنت خبير محتوى إنستغرام تساعد صاحب حساب يخطط منشوراته.
قاعدة اللغة: كل نص ينشر للجمهور (الكابشن، الهوك، نصوص الشرائح والكاروسيل، عبارات الستوري، التعليق الصوتي، الدعوة للإجراء) يكون باللغة واللهجة المحددة في ملف الحساب.
أما الشروحات والملاحظات والعناوين الداخلية (ملخص الخطة، المراحل، ثيم الأسبوع وتركيزه، شرح التنفيذ، وصف اللقطات ونصائح التصوير، مؤشرات القياس) فتكون بالعربية الفصحى المبسطة.
خل الأفكار عملية وتناسب جمهور الحساب بالضبط.
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
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("أضف ANTHROPIC_API_KEY في إعدادات الخادم لتعمل الاقتراحات");
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
  if (response.stop_reason === "refusal") throw new Error("رفض النموذج الطلب");
  if (response.stop_reason === "max_tokens") throw new Error("انقطع الرد؛ جرّب عددًا أقل");
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("لم يصل رد من النموذج");
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

// ---------- تصميم البوست ----------
const SLIDES_SCHEMA = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["cover", "content", "cta"] },
          pre: { type: "string" },
          title: { type: "string" },
          highlight: { type: "string" },
          body: { type: "string" },
        },
        required: ["kind", "pre", "title", "highlight", "body"],
        additionalProperties: false,
      },
    },
  },
  required: ["slides"],
  additionalProperties: false,
};

// يكتب نصوص السلايدات اللي تنحط على التصميم
// style = "sarah": هوية أبلة سارة (٧ سلايدات للكاروسيل، خطاب للمعلمة، CTA ناعم)
export async function designSlides(profile, idea, style = "") {
  const sarah = style === "sarah";
  const shape = sarah && idea.format === "carousel"
    ? `٧ سلايدات بالضبط بهالترتيب:
  ١ cover: الهوك (مشكلة محددة، مو مقدمة عامة).
  ٢ content: الأرقام أو المشكلة.
  ٣ و ٤ و ٥ content: المحتوى الرئيسي، كل سلايد فكرة وحدة.
  ٦ content: الخلاصة أو مرجع سريع.
  ٧ cta: سؤال تفاعل + دعوة ناعمة (احفظي / علّقي / شاركي)، بدون بيع مباشر.`
    : {
    post: "سلايد وحدة (kind=cover): عنوان قوي قصير ونص قصير تحته.",
    carousel: "من ٥ إلى ٧ سلايدات: أول وحدة cover (هوك يخلي الناس تسحب)، بعدها content (كل وحدة نقطة وحدة واضحة)، وآخر وحدة cta (دعوة للإجراء تناسب الهدف).",
    reel: "سلايد وحدة (kind=cover) تكون غلاف الريل: عنوان قصير وايد يشد من أول نظرة، ونص قصير أو فاضي.",
  }[idea.format] || "سلايد وحدة (kind=cover).";
  const prompt = `${profileText(profile)}

المنشور:
- العنوان: ${idea.title}
- النوع: ${idea.format}
- مرحلة القمع: ${FUNNEL[idea.funnel] ? `${idea.funnel} (${FUNNEL[idea.funnel].name})` : "غير محددة"}
- الهدف: ${GOALS[idea.goal]?.name || "غير محدد"}
- ملاحظات: ${idea.notes || "لا يوجد"}
- الكابشن: ${idea.caption || "لا يوجد"}

اكتب النصوص اللي بتنحط على تصميم المنشور نفسه (مو الكابشن): ${shape}
لكل سلايد:
- pre: تمهيد قصير جداً فوق العنوان (٢-٤ كلمات)، مثل "للمعلمة الذكية" أو "الخطوة الأولى".
- title: العنوان، ما يزيد عن ٨ كلمات.
- highlight: كلمة أو كلمتين من العنوان نفسه بالضبط تنلوّن (أهم كلمة)، أو فاضي.
- body: نص قصير ما يزيد عن ٢٥ كلمة.
باللهجة المحددة، وبدون هاشتاقات.${sarah || style === "scrapbook" ? `
الجمهور معلمات: خاطبي بصيغة المؤنث بالكويتي ("چ" مثل شغلچ، عندچ، طلابچ)، بلا فصحى رسمية، وإيموجي قليل (✨ 🌸 💜 🎯). لا تذكري ChatGPT (استخدمي Gemini إذا لازم)، ولا ManyChat.` : ""}`;
  const { slides } = await askJSON(prompt, SLIDES_SCHEMA, "low");
  return slides;
}

// ---------- خطة الستوري (مبنية على مهارة stories-and-scripts) ----------
const STORY_RULES = `أنت تكتب تسلسلات ستوري إنستغرام. الفكرة: الريلز تجيب الانتباه ← الستوري تبني الثقة والنية ← الدعوة والخاص تحوّل النية.
كل تسلسل = فيديو بيع مصغّر، وكل شريحة لها وظيفة (انتباه، مصداقية، صلة، رغبة، وضوح، فعل). إذا ما سوت ولا وحدة، تنحذف.

الإطار RAPIR: نتيجة ← زاوية ← طريقة ← هوية ← استجابة. الانتقالات أهم من الشرائح (لفت ← إثبات ← تحليل ← ربط ← تحريك).

الأنواع:
- تعليمي: هوك ← النتيجة اللي يبونها أو الألم ← نقطة ١ الآلية/الغلط ← نقطة ٢ السبب الأعمق ← نقطة ٣ اتجاه الحل ← جملة ثقة (مو كل تعليمي يحتاج دعوة).
- مصداقية: لقطة قوية ← نتيجة متدربة مع السياق (منو، وين كانت، شنو تغيّر) ← نتيجة ثانية ← قلب الفكرة (اربط الإثبات بدرس) ← جملة واثقة ← (اختياري) دعوة ناعمة.
- قيمة: هوك ← نتيجة/مشكلة مربوطة بالمحتوى ← شنو فيه وليش مهم ← شريحة الرابط بغلاف جذاب. الرابط لازم يتأطر قبل.
- سؤال/اعتراض: ملصق السؤال أو اقتباس الاعتراض ← جواب قصير ← شرح أعمق أو مثال ← زاوية شخصية ← «إذا هذا إنتوا، ردّوا علي». اعتراض شراء حقيقي (ما عندي وقت، أنا مو تقنية، جربت دورات قبل وما استفدت، الأدوات وايد من وين أبدي).
- شخصي: قصة (اعتراف ← فصل ١ ← فصل ٢ ← الدرس) أو درس يومي، ينتهي على الجملة بدون دعوة.
- مبدأ/وجهة نظر: فكرة تستاهل سكرين شوت.
- دعوة: نداء للفئة ووضعهم ← «عندي شي لكم» ← شنو العرض وليش ينفع ← كلمة وحدة بالخاص ← «برد عليكم وحدة وحدة».

قواعد الكتابة:
- ٤ إلى ٧ شرائح. الأولى هوك بجملة وحدة. كل شريحة بعدها ٣ عبارات بالكثير، وكل عبارة سطرين بالكثير.
- كلمة وحدة مظللة بكل عبارة بين [[ ]].
- فيديو واحد بالتسلسل (غالباً الهوك)، والباقي صور طبيعية.
- الإثبات لازم يكون حقيقي: لا تخترع أرقام ولا نتائج ولا أسماء متدربات. إذا محتاج إثبات، حطه بين [أقواس] تعبيه صاحبة الحساب.
- لا تكتب أسعار ولا مواعيد دورات إلا إذا انذكرت بالخطة.
- الخطاب للمجموعة (تشرحون، عندكم، ارسلوا)، والجمع الطبيعي (جاهزين، يشرحون مو جاهزات، يشرحن).
- لهجة كويتية خالصة: شلون، شنو، وايد، تنطرون، يديد، الحين، عشان جذي. ممنوع: شكو، ماكو، هواي، تستنون، تحچون، شو. والمصطلحات التقنية تبقى.
- الدعوات ٢-٣ مرات بالأسبوع بالكثير، وناعمة مبنية على الهوية مو بيع مباشر.
- measure: الرقم اللي يحكم على التسلسل (مثل: الخروج من الشريحة ٣، ردود كلمة «ملف» بالخاص، نسبة الإكمال).`;

const STORY_FRAME = {
  type: "object",
  properties: {
    role: { type: "string" },
    media: { type: "string", enum: ["photo", "video"] },
    shot: { type: "string" },
    kicker: { type: "string" },
    statements: { type: "array", items: { type: "string" } },
    quotes: { type: "boolean" },
    sticker: { type: "string" },
    ctaLine: { type: "string" },
    ctaKeyword: { type: "string" },
    ctaSub: { type: "string" },
  },
  required: ["role", "media", "shot", "kicker", "statements", "quotes", "sticker", "ctaLine", "ctaKeyword", "ctaSub"],
  additionalProperties: false,
};

const STORY_SEQ = {
  type: "object",
  properties: {
    day: { type: "integer", enum: [0, 1, 2, 3, 4, 5, 6] },
    type: { type: "string", enum: Object.keys(STORY_TYPES) },
    ending: { type: "string", enum: Object.keys(STORY_ENDINGS) },
    title: { type: "string" },
    measure: { type: "string" },
    frames: { type: "array", items: STORY_FRAME },
  },
  required: ["day", "type", "ending", "title", "measure", "frames"],
  additionalProperties: false,
};

const STORY_WEEK_SCHEMA = {
  type: "object",
  properties: { sequences: { type: "array", items: STORY_SEQ } },
  required: ["sequences"],
  additionalProperties: false,
};

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// days: أرقام الأيام المطلوبة (٠ = الأحد). weekPosts: منشورات الأسبوع عشان الستوري يكمّلها
export async function planStoryWeek(profile, { days = [0, 1, 2, 3, 4, 5, 6], topic = "", strategyWeek = null, weekPosts = [] } = {}) {
  const schedule = days
    .map((d) => `- ${DAY_NAMES[d]} (day=${d}): ${STORY_TYPES[STORY_SCHEDULE[d].type].name} — النهاية: ${STORY_ENDINGS[STORY_SCHEDULE[d].ending]}`)
    .join("\n");
  const posts = weekPosts.map((p) => `- ${DAY_NAMES[p.day]}: ${p.title} (${p.format})`).join("\n");
  const sw = strategyWeek ? `
هذا الأسبوع رقم ${strategyWeek.week} من الخطة التسويقية (مرحلة: ${strategyWeek.phase}):
- الثيم: ${strategyWeek.theme} — ${strategyWeek.focus}
- الدعوة للإجراء: ${strategyWeek.cta}
${strategyWeek.events.length ? `- أحداث إطلاق هالأسبوع:\n${strategyWeek.events.map((e) => `  • ${DAY_NAMES[new Date(e.date + "T00:00:00Z").getUTCDay()]}: ${e.launch} — ${e.title}: ${e.action}`).join("\n")}
  إذا فيه تسجيل أو إطلاق، زيد المصداقية والاعتراضات قبل يوم الدعوة، وخل يوم الإطلاق دعوة.` : ""}` : "";
  const prompt = `${STORY_RULES}

${profileText(profile)}
${sw}
منشورات الأسبوع بالفيد (الستوري يكمّلها ويدز لها إذا يناسب):
${posts || "لا يوجد"}

${topic ? `موضوع أو ملاحظة لهالأسبوع: ${topic}\n` : ""}الجدول المطلوب (تقدر تبدّل نوع يوم إذا الخطة تحتاج، بس خل الدعوات ٢-٣ بالكثير):
${schedule}

اكتب تسلسل لكل يوم من هالأيام. لكل شريحة:
- role: وظيفتها (الهوك، الإثبات، الطريقة...)، media: photo أو video، shot: شنو تصور بالضبط.
- kicker: عنوان صغير فوق النص (مثل «تعرفون هالشعور؟»، «السر») أو فاضي.
- statements: العبارات بالتظليل [[ ]]. quotes=true إذا العبارات كلام متدربات.
- sticker: اسم ملصق انستغرام إذا تحتاجه (تصويت، سؤال، رابط) أو فاضي.
- ctaLine/ctaKeyword/ctaSub: مربع الكلمة بالخاص بس بشريحة الدعوة (مثل «ارسلوا لي كلمة» / «ملف» / «بالخاص»)، وإلا فاضية.`;
  const { sequences } = await askJSON(prompt, STORY_WEEK_SCHEMA, "medium");
  return sequences.sort((a, b) => a.day - b.day);
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

// ---------- المساعد الشخصي ----------
const ASSISTANT_SYSTEM = `إنتي مساعدة شخصية لصاحبة حساب إنستغرام، تفكرين معاها بالمحتوى والتسويق والمشاريع.
- تقترحين أفكار محتوى، ومنتجات أو دورات أو خدمات تقدر تضيفها (مع لمنو، وليش تنفع، وشلون تختبرها بسرعة قبل لا تبنيها كاملة).
- تراجعين خطتها وتقولين رأيچ بصراحة ولطف، وتسألين سؤال واحد إذا شي مو واضح.
- عملية ومختصرة: نقاط قصيرة وخطوات واضحة، بدون مقدمات طويلة.
- لا تخترعين أرقام أو نتائج عن حسابها؛ إذا تحتاجين رقم، اسأليها.
- ردي بالعربية الفصحى المبسطة الواضحة. وإذا كتبتِ نصًا للنشر (كابشن، هوك، نص شريحة أو ستوري)، فاكتبيه باللهجة المحددة في ملف الحساب.`;

// context: نص فيه ملف الحساب والخطة والأسبوع والأفكار. history: [{ role, content }]
export async function assistantReply(profile, context, history) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("أضف ANTHROPIC_API_KEY في إعدادات الخادم ليعمل المساعد");
  client ??= new Anthropic();
  const response = await client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: ASSISTANT_SYSTEM },
      { type: "text", text: `${profileText(profile)}\n\n${context}` },
    ],
    output_config: { effort: "medium" },
    messages: history.map(({ role, content }) => ({ role, content })),
  }).finalMessage();
  if (response.stop_reason === "refusal") throw new Error("تعذّر الرد على هذا الطلب؛ جرّب صياغته بطريقة أخرى");
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  if (!text) throw new Error("لم يصل رد");
  return text;
}
