"""يبني شرائح الكاروسيل المتحرك (8 شرائح) كملفات HTML."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
TOTAL = "٠٨"
NUMS = ["٠١", "٠٢", "٠٣", "٠٤", "٠٥", "٠٦", "٠٧", "٠٨"]


def page(n, bg, body, extra_css=""):
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="anim.css">
<style>{extra_css}</style>
</head>
<body>
  <div class="slide bg-{bg}">
    <div class="header a" style="--d:0s">
      <div class="handle">ABLASARAHQ8@</div>
      <div class="logo"></div>
    </div>
{body}
    <div class="page-number">{TOTAL} / {NUMS[n-1]}</div>
  </div>
</body>
</html>"""


def tool_slide(n, bg, num, name, icon, grad, tagline, small, items, tag, warn=False):
    lis = "\n".join(
        f'          <div class="use-item a side" style="--d:{1.5 + i*0.45:.2f}s"><div class="check">✓</div><div>{t}</div></div>'
        for i, t in enumerate(items)
    )
    tag_d = 1.5 + len(items) * 0.45 + 0.2
    body = f"""    <div class="main">
      <div class="pre-title a" style="--d:.2s">التحديث رقم {num}</div>
      <div class="tool-header a pop" style="--d:.45s">
        <div class="tool-info">
          <div class="tool-name-big">{name}</div>
        </div>
        <div class="tool-logo {grad} float">{icon}</div>
      </div>
      <div class="tool-tagline a" style="--d:.8s">{tagline}<small>{small}</small></div>
      <div class="use-cases a" style="--d:1.15s">
        <div class="use-label">شلون تستفيدين منه</div>
        <div class="use-items">
{lis}
        </div>
      </div>
      <div class="best-for-tag a pop {'warn' if warn else ''}" style="--d:{tag_d:.2f}s">{tag}</div>
    </div>"""
    return page(n, bg, body)


slides = {}

# ---------- 1. الهوك ----------
slides[1] = page(1, "light", """
    <div class="dot-decoration float" style="position:absolute;border-radius:50%;top:17%;left:10%;width:80px;height:80px;background:#7d579b;opacity:.3"></div>
    <div class="dot-decoration float slow" style="position:absolute;border-radius:50%;top:23%;left:22%;width:20px;height:20px;background:#fe9a6c"></div>
    <div class="dot-decoration float" style="position:absolute;border-radius:50%;bottom:24%;right:12%;width:32px;height:32px;background:#c9617d;opacity:.5"></div>
    <div class="main">
      <div class="pre-title a" style="--d:.2s">أخبار نوفمبر ٢٠٢٦</div>
      <h1 class="title" style="font-size:104px;line-height:1.25">
        <span class="a" style="--d:.5s;display:block">٥ تحديثات</span>
        <span class="a" style="--d:.85s;display:block"><span class="shine">ذكاء اصطناعي</span></span>
        <span class="a" style="--d:1.2s;display:block;font-size:76px">بتوفّر عليچ ساعات</span>
      </h1>
      <div class="a pop" style="--d:1.7s;display:inline-flex;align-items:center;gap:12px;background:linear-gradient(135deg,#7d579b 0%,#c9617d 100%);color:#fff;padding:16px 38px;border-radius:60px;font-size:30px;font-weight:700;box-shadow:0 15px 40px rgba(125,87,155,.3)">🔥 نزلت هالشهر.. وتهم المعلمة</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:10px">
        <div class="a pop chip" style="--d:2.1s">ChatGPT</div>
        <div class="a pop chip" style="--d:2.3s">Gemini</div>
        <div class="a pop chip" style="--d:2.5s">Classroom</div>
        <div class="a pop chip" style="--d:2.7s">Claude</div>
      </div>
    </div>
    <div class="a" style="--d:3s;position:absolute;bottom:60px;left:50%;margin-left:-150px;width:300px;justify-content:center;background:#2d1f3d;color:#fef8f5;padding:16px 32px;border-radius:60px;display:flex;align-items:center;gap:12px;font-size:24px;font-weight:700;z-index:10">
      <span>اسحبي لليسار</span>
      <div class="nudge" style="width:40px;height:40px;background:#fe9a6c;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff">←</div>
    </div>
""", """
  .chip { background:#fff; border:1.5px solid rgba(125,87,155,.2); padding:14px 30px; border-radius:50px; font-size:28px; font-weight:700; color:#4a3529; direction:ltr; }
""")

# ---------- 2-6. التحديثات ----------
slides[2] = tool_slide(2, "dark", "٠١", "ChatGPT", "🎞️", "",
    "صار يسوّي <span class='shine'>صور متحركة GIF</span>", "تحديث الصور Images 2.6",
    ["GIF يشرح خطوات: دورة الماء أو حل مسألة",
     "تحطينه بالسلايد أو ترسلينه بقروب الصف",
     "يحفظ صورة مرجعية.. شخصية صفچ تطلع بنفس الشكل"],
    "🎯 شرح الخطوات صار يتحرك")

slides[3] = tool_slide(3, "light", "٠٢", "Google Vids", "🎬", "g2",
    "Gemini يسوّي لچ <span class='shine'>فيديو قصير</span>", "لين ١٥ ثانية، من وصف تكتبينه",
    ["مقدمة تشد الطالبات أول الحصة",
     "فيديو تشويقي قبل الوحدة اليديدة",
     "بدون تصوير ولا مونتاج"],
    "🎯 بداية حصة ما تنتسى")

slides[4] = tool_slide(4, "dark", "٠٣", "Google Classroom", "🧭", "g3",
    "<span class='shine'>التعلّم الموجّه</span> داخل الواجب", "الطالبة تتعلم خطوة بخطوة بدل الجواب الجاهز",
    ["تربطينه بأي واجب وتختارين المحتوى",
     "الشات العادي يتسكّر.. وتظل بوضع التعلّم",
     "تشوفين محادثة كل طالبة وتعرفين وين علقت"],
    "🎯 تعرفين مستوى كل طالبة")

slides[5] = tool_slide(5, "light", "٠٤", "Gemini × Classroom", "📝", "",
    "يسوّي لچ <span class='shine'>روبرك التصحيح</span>", "وانتي تسوّين الواجب",
    ["يقرا محتوى الواجب ويطلع روبرك مناسب",
     "تعدّلين عليه بدل ما تبدين من الصفر",
     "الطالبات يعرفون شنو المطلوب من البداية"],
    "🎯 تصحيح أسرع وأوضح")

slides[6] = tool_slide(6, "dark", "٠٥", "Claude Meetings", "🗓️", "g2",
    "Claude <span class='shine'>يدخل الاجتماع</span> معاچ", "يكتب المحضر والمهام وانتو تتكلمون",
    ["تضيفينه لاجتماع Google Meet",
     "يطلع ملاحظات ومهام ومستندات خلال الاجتماع",
     "ينفع لاجتماعات القسم بدل ما تكتبين المحضر بروحچ"],
    "⚠️ تجريبي.. ولخطط Team و Enterprise بس", warn=True)

# ---------- 7. بونص سريع ----------
slides[7] = page(7, "light", """
    <div class="main">
      <div class="pre-title a" style="--d:.2s">بونص سريع</div>
      <h1 class="title a pop" style="--d:.45s;font-size:96px">وبعد <span class="shine">انتبهي</span> ⚡</h1>
      <div style="display:flex;flex-direction:column;gap:24px;width:100%;max-width:880px">
        <div class="mini a side" style="--d:1s">
          <div class="mi">📚</div>
          <div><b>NotebookLM صار اسمه Gemini Notebook</b><span>نفس الأداة.. حطي ملفات درسچ ويطلع ملخصات وأسئلة</span></div>
        </div>
        <div class="mini a side" style="--d:1.6s">
          <div class="mi">🎙️</div>
          <div><b>صوت ChatGPT يتغيّر ١١ ديسمبر</b><span>الصوت المتقدم يوقف ويحل مكانه GPT-Live.. لمعلمات الإنجليزي</span></div>
        </div>
        <div class="mini a side" style="--d:2.2s">
          <div class="mi">🎓</div>
          <div><b>Copilot: وضع «ادرس وتعلّم» للطالبات</b><span>للمدارس اللي تستخدم حسابات مايكروسوفت، ويتفعّل من الإدارة</span></div>
        </div>
      </div>
    </div>
""", """
  .mini { background:#fff; border-radius:28px; padding:28px 34px; display:flex; gap:24px; align-items:center; box-shadow:0 15px 40px rgba(45,31,61,.08); }
  .mini .mi { width:84px; height:84px; flex-shrink:0; border-radius:24px; background:linear-gradient(135deg,#fe9a6c 0%,#c9617d 100%); display:flex; align-items:center; justify-content:center; font-size:42px; }
  .mini b { display:block; font-size:31px; font-weight:700; color:#2d1f3d; line-height:1.4; }
  .mini span { display:block; font-size:25px; font-weight:500; color:#6b4f42; line-height:1.55; margin-top:6px; }
""")

# ---------- 8. التفاعل ----------
slides[8] = page(8, "dark", """
    <div class="main">
      <div class="pre-title a" style="--d:.2s">نبي نسمع منّچ</div>
      <h1 class="title a pop" style="--d:.45s;font-size:88px;line-height:1.3">أي تحديث<br><span class="shine">بتجرّبين أول</span>؟</h1>
      <div class="poll a" style="--d:1s">
        <div style="text-align:center"><span class="poll-label">صوّتي بالكومنت 🗳</span></div>
        <div class="opts">
          <div class="opt a pop" style="--d:1.4s">🎞️ GIF</div>
          <div class="opt a pop" style="--d:1.6s">🎬 فيديو Vids</div>
          <div class="opt a pop" style="--d:1.8s">🧭 التعلّم الموجّه</div>
          <div class="opt a pop" style="--d:2s">📝 الروبرك</div>
        </div>
      </div>
      <div class="a" style="--d:2.4s;font-size:26px;color:#e8d5c4;line-height:1.7;text-align:center;font-weight:500">
        التوفّر يختلف حسب الدولة والحساب..<br>جرّبيها بحسابچ قبل لا تعتمدين عليها 🌷
      </div>
      <div style="display:flex;gap:18px;justify-content:center">
        <div class="btn a pop" style="--d:2.8s">📌 احفظي</div>
        <div class="btn primary a pop" style="--d:3s">💬 علّقي</div>
        <div class="btn a pop" style="--d:3.2s">↗ شاركيه مع زميلتچ</div>
      </div>
    </div>
""", """
  .poll { background:rgba(254,248,245,.08); border:2px solid rgba(254,154,108,.3); border-radius:28px; padding:32px 38px; width:100%; max-width:860px; }
  .poll-label { display:inline-block; background:linear-gradient(135deg,#fe9a6c 0%,#c9617d 100%); color:#fff; padding:10px 28px; border-radius:50px; font-size:24px; font-weight:700; margin-bottom:24px; }
  .opts { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .opt { background:rgba(254,248,245,.1); border:1.5px solid rgba(254,248,245,.2); color:#fef8f5; padding:20px; border-radius:18px; font-size:27px; font-weight:700; text-align:center; }
  .btn { background:rgba(254,248,245,.1); border:1px solid rgba(254,248,245,.25); color:#fef8f5; padding:16px 30px; border-radius:40px; font-size:24px; font-weight:600; }
  .btn.primary { background:linear-gradient(135deg,#fe9a6c 0%,#c9617d 100%); border:none; font-weight:700; }
""")

for n, html in slides.items():
    with open(os.path.join(HERE, f"slide{n}.html"), "w", encoding="utf-8") as f:
        f.write(html)
print("built", len(slides))
