// حسابات التواريخ للخطة — مشتركة بين السيرفر والواجهة
// التواريخ نصوص "YYYY-MM-DD" ونحسبها بـ UTC عشان ما تتأثر بفرق التوقيت

const DAY_MS = 86_400_000;
const parse = (s) => Date.UTC(...s.split("-").map((n, i) => Number(n) - (i === 1 ? 1 : 0)));

export const addDaysStr = (s, n) => new Date(parse(s) + n * DAY_MS).toISOString().slice(0, 10);
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / DAY_MS);

// يحول تاريخ لأقرب يوم أحد قبله (بداية الأسبوع)
export const toSunday = (s) => addDaysStr(s, -new Date(parse(s)).getUTCDay());

// كل خطوات الإعلان عن الإطلاقات مع تواريخها
export function launchEvents(strategy) {
  const events = [];
  for (const lp of strategy?.plan?.launchPlans || []) {
    const launch = strategy.launches.find((l) => l.name === lp.launchName);
    if (!launch?.date) continue;
    for (const step of lp.steps) {
      events.push({
        date: addDaysStr(launch.date, step.daysFromLaunch),
        launch: launch.name,
        title: step.title,
        action: step.action,
        isLaunchDay: step.daysFromLaunch === 0,
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

// معلومات أسبوع معين من الخطة: رقمه، خطته، وأحداث الإطلاق فيه
export function strategyWeek(strategy, weekDate) {
  if (!strategy?.plan || !strategy.startDate) return null;
  const n = Math.floor(diffDays(weekDate, toSunday(strategy.startDate)) / 7) + 1;
  const week = strategy.plan.weeks.find((w) => w.week === n);
  if (!week) return null;
  const end = addDaysStr(weekDate, 6);
  const events = launchEvents(strategy).filter((e) => e.date >= weekDate && e.date <= end);
  return { ...week, events };
}
