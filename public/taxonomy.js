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
