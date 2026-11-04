// النشر عن طريق Instagram Graph API (حساب Business أو Creator)
// https://developers.facebook.com/docs/instagram-platform/content-publishing

const HOST = process.env.IG_GRAPH_HOST || "https://graph.facebook.com";
const VERSION = process.env.IG_GRAPH_VERSION || "v21.0";

export const isConfigured = () => Boolean(process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN);

async function graph(method, pathname, params = {}) {
  const url = new URL(`${HOST}/${VERSION}/${pathname}`);
  const body = new URLSearchParams({ ...params, access_token: process.env.IG_ACCESS_TOKEN });
  let res;
  if (method === "GET") {
    body.forEach((v, k) => url.searchParams.set(k, v));
    res = await fetch(url);
  } else {
    res = await fetch(url, { method, body });
  }
  const json = await res.json();
  if (!res.ok || json.error) {
    // نعرض رقم الخطأ والنوع الفرعي من Meta عشان نعرف السبب بالضبط
    const e = json.error || {};
    const codes = [e.code && `code ${e.code}`, e.error_subcode && `subcode ${e.error_subcode}`, e.type].filter(Boolean).join(", ");
    const detail = e.error_user_msg ? ` — ${e.error_user_msg}` : "";
    throw new Error(`${e.message || `Instagram API ${res.status}`}${detail}${codes ? ` (${codes})` : ""}`);
  }
  return json;
}

async function waitUntilReady(containerId, { tries = 30, delayMs = 5000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const { status_code } = await graph("GET", containerId, { fields: "status_code" });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`فشل تجهيز الوسائط (${status_code})`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("تأخر تجهيز الوسائط في إنستغرام");
}

function mediaParams(item) {
  return item.type === "video" ? { media_type: "REELS", video_url: item.url } : { image_url: item.url };
}

// media: [{ url, type }] — لازم تكون روابط عامة يقدر إنستغرام يوصل لها
export async function publish({ media, caption }) {
  if (!isConfigured()) throw new Error("إعدادات إنستغرام ناقصة (IG_USER_ID و IG_ACCESS_TOKEN)");
  if (!media?.length) throw new Error("يجب إضافة صورة أو فيديو قبل النشر");
  const user = process.env.IG_USER_ID;

  let containerId;
  if (media.length === 1) {
    ({ id: containerId } = await graph("POST", `${user}/media`, { ...mediaParams(media[0]), caption }));
  } else {
    if (media.length > 10) throw new Error("الحد الأقصى للكاروسيل ١٠ عناصر");
    const children = [];
    for (const item of media) {
      const params = item.type === "video"
        ? { media_type: "VIDEO", video_url: item.url }
        : { image_url: item.url };
      const { id } = await graph("POST", `${user}/media`, { ...params, is_carousel_item: "true" });
      if (item.type === "video") await waitUntilReady(id);
      children.push(id);
    }
    ({ id: containerId } = await graph("POST", `${user}/media`, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
    }));
  }

  await waitUntilReady(containerId);
  const { id } = await graph("POST", `${user}/media_publish`, { creation_id: containerId });
  return id;
}

// ينشر شرائح الستوري بالترتيب، كل وحدة ستوري بروحها
// items: [{ url, type: "image" | "video" }]
export async function publishStories(items) {
  if (!isConfigured()) throw new Error("إعدادات إنستغرام ناقصة (IG_USER_ID و IG_ACCESS_TOKEN)");
  const user = process.env.IG_USER_ID;
  const ids = [];
  for (const item of items) {
    const params = item.type === "video"
      ? { media_type: "STORIES", video_url: item.url }
      : { media_type: "STORIES", image_url: item.url };
    const { id: containerId } = await graph("POST", `${user}/media`, params);
    await waitUntilReady(containerId);
    const { id } = await graph("POST", `${user}/media_publish`, { creation_id: containerId });
    ids.push(id);
  }
  return ids;
}
