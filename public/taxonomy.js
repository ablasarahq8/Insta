// تصنيفات المحتوى — مشتركة بين السيرفر والواجهة

// مرحلة القمع التسويقي
export const FUNNEL = {
  tof: { label: "TOF", name: "وعي وانتشار", hint: "محتوى يوصل لناس جدد ما يعرفونك" },
  mof: { label: "MOF", name: "ثقة واهتمام", hint: "محتوى يبني ثقة المتابع ويخليه يفكر فيك" },
  bof: { label: "BOF", name: "تحويل وبيع", hint: "محتوى يحوّل المتابع لعميل" },
};

// النسبة المقترحة لكل مرحلة بالأسبوع
export const FUNNEL_TARGET = { tof: 50, mof: 30, bof: 20 };

// هدف المنشور
export const GOALS = {
  sales: { name: "بيعي", emoji: "💰" },
  marketing: { name: "تسويقي", emoji: "📣" },
  leads: { name: "جذب عملاء", emoji: "🧲" },
  humor: { name: "فكاهي", emoji: "😂" },
  news: { name: "أخبار", emoji: "📰" },
  tech: { name: "تقني", emoji: "💻" },
  educational: { name: "تعليمي", emoji: "🎓" },
  engagement: { name: "تفاعلي", emoji: "💬" },
  behind: { name: "خلف الكواليس", emoji: "🎬" },
};

export const FORMATS = { post: "بوست", carousel: "كاروسيل", reel: "ريل" };

// أهداف الخطة التسويقية
export const STRATEGY_GOALS = {
  followers: { name: "زيادة المتابعين", emoji: "📈", placeholder: "مثلاً: من ٢,٠٠٠ إلى ٥,٠٠٠" },
  engagement: { name: "رفع التفاعل", emoji: "💬", placeholder: "مثلاً: تعليقات وحفظ أكثر" },
  subscriptions: { name: "زيادة الاشتراكات", emoji: "🔔", placeholder: "مثلاً: ٢٠٠ مشترك جديد" },
  community: { name: "الانضمام للمجتمع", emoji: "🤝", placeholder: "مثلاً: ١٠٠ عضو بالمجتمع" },
  courses: { name: "بيع الدورات", emoji: "🎓", placeholder: "مثلاً: ٥٠ تسجيل بالدورة" },
  sales: { name: "مبيعات منتج/خدمة", emoji: "💰", placeholder: "مثلاً: ٣٠ طلب بالشهر" },
  brand: { name: "بناء البراند الشخصي", emoji: "⭐", placeholder: "مثلاً: يعرفوني كمرجع بمجالي" },
};

// أنواع الإطلاقات
export const LAUNCH_TYPES = {
  course: "دورة",
  community: "مجتمع",
  subscription: "اشتراك",
  product: "منتج",
  event: "فعالية / ورشة",
};

// أنواع تسلسلات الستوري (من مهارة stories-and-scripts)
export const STORY_TYPES = {
  educational: { name: "تعليمي", emoji: "🎓", color: "#1c7ed6" },
  credibility: { name: "مصداقية", emoji: "🏆", color: "#2b8a3e" },
  personal: { name: "شخصي", emoji: "🌸", color: "#c9617d" },
  value: { name: "قيمة", emoji: "🎁", color: "#f08c00" },
  objection: { name: "سؤال/اعتراض", emoji: "❓", color: "#7048e8" },
  principle: { name: "مبدأ/وجهة نظر", emoji: "💡", color: "#0c8599" },
  invitation: { name: "دعوة", emoji: "💌", color: "#d6336c" },
};

export const STORY_ENDINGS = {
  none: "بدون دعوة",
  dm_keyword: "كلمة بالخاص",
  reply: "طلب رد",
  link: "رابط",
  poll: "تصويت",
};

// الجدول الأسبوعي المقترح (٠ = الأحد)
export const STORY_SCHEDULE = [
  { type: "educational", ending: "none" },
  { type: "credibility", ending: "dm_keyword" },
  { type: "personal", ending: "none" },
  { type: "value", ending: "link" },
  { type: "objection", ending: "reply" },
  { type: "principle", ending: "none" },
  { type: "invitation", ending: "dm_keyword" },
];
