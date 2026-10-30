import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import * as store from "./lib/store.js";
import * as ai from "./lib/ai.js";
import * as instagram from "./lib/instagram.js";

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.resolve("data/uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: "1mb" }));

// الملفات المرفوعة لازم تكون عامة عشان إنستغرام يقدر يسحبها وقت النشر
app.use("/uploads", express.static(UPLOAD_DIR));

// حماية بسيطة بكلمة سر (اختيارية) لباقي الموقع
if (process.env.APP_PASSWORD) {
  app.use((req, res, next) => {
    const [, encoded] = (req.headers.authorization || "").split(" ");
    const [, pass] = Buffer.from(encoded || "", "base64").toString().split(":");
    if (pass === process.env.APP_PASSWORD) return next();
    res.set("WWW-Authenticate", 'Basic realm="Insta Ideas"').status(401).send("لازم تدخل كلمة السر");
  });
}

app.use(express.static(path.resolve("public")));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) =>
      cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    cb(null, /^(image\/(jpeg|png)|video\/(mp4|quicktime))$/.test(file.mimetype)),
});

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

// ---------- الإعدادات ----------
app.get("/api/status", (req, res) =>
  res.json({
    instagram: instagram.isConfigured(),
    publicUrl: Boolean(process.env.PUBLIC_BASE_URL),
  }),
);

app.get("/api/profile", (req, res) => res.json(store.getProfile()));
app.put("/api/profile", (req, res) => res.json(store.updateProfile(req.body)));

// ---------- الأفكار ----------
app.get("/api/ideas", (req, res) => res.json(store.listIdeas()));
app.post("/api/ideas", (req, res) => res.status(201).json(store.createIdea(req.body)));

app.put("/api/ideas/:id", (req, res) => {
  const idea = store.updateIdea(req.params.id, req.body);
  idea ? res.json(idea) : res.status(404).json({ error: "الفكرة مو موجودة" });
});

app.delete("/api/ideas/:id", (req, res) => {
  store.deleteIdea(req.params.id) ? res.status(204).end() : res.status(404).json({ error: "الفكرة مو موجودة" });
});

app.post("/api/upload", upload.array("files", 10), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: "نوع الملف مو مدعوم (JPG/PNG/MP4/MOV)" });
  res.json(
    req.files.map((f) => ({
      url: `/uploads/${f.filename}`,
      type: f.mimetype.startsWith("video/") ? "video" : "image",
    })),
  );
});

// ---------- الذكاء الاصطناعي ----------
app.post("/api/ai/suggest", wrap(async (req, res) => {
  const count = Math.min(Math.max(Number(req.body.count) || 5, 1), 10);
  const { topic = "", funnel = "", goal = "" } = req.body;
  res.json(await ai.suggestIdeas(store.getProfile(), store.listIdeas(), { count, topic, funnel, goal }));
}));

// start/end: حدود الأسبوع بتوقيت المستخدم (ISO) عشان نعرف شنو محطوط فيه
app.post("/api/ai/plan-week", wrap(async (req, res) => {
  const start = new Date(req.body.start);
  const end = new Date(req.body.end);
  if (isNaN(start) || isNaN(end)) return res.status(400).json({ error: "حدود الأسبوع غلط" });
  const count = Math.min(Math.max(Number(req.body.count) || 7, 1), 14);
  const weekPosts = store.listIdeas()
    .filter((i) => i.scheduledAt && new Date(i.scheduledAt) >= start && new Date(i.scheduledAt) < end)
    .map((i) => ({ ...i, day: Math.floor((new Date(i.scheduledAt) - start) / 86_400_000) }));
  res.json(await ai.planWeek(store.getProfile(), store.listIdeas(), weekPosts, {
    count,
    topic: req.body.topic || "",
  }));
}));

app.post("/api/ideas/:id/caption", wrap(async (req, res) => {
  const idea = store.getIdea(req.params.id);
  if (!idea) return res.status(404).json({ error: "الفكرة مو موجودة" });
  res.json(await ai.writeCaption(store.getProfile(), idea));
}));

// ---------- النشر ----------
const publishing = new Set();

async function publishIdea(idea) {
  if (publishing.has(idea.id)) throw new Error("النشر شغال على هذي الفكرة");
  publishing.add(idea.id);
  try {
    const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
    const media = idea.media.map((m) => {
      if (/^https?:\/\//.test(m.url)) return m;
      if (!base) throw new Error("لازم تحدد PUBLIC_BASE_URL عشان إنستغرام يوصل للملفات المرفوعة");
      return { ...m, url: base + m.url };
    });
    const caption = [idea.caption, idea.hashtags].filter(Boolean).join("\n\n");
    const publishedId = await instagram.publish({ media, caption });
    return store.updateIdea(idea.id, { status: "published", publishedId, error: null }, { internal: true });
  } catch (err) {
    store.updateIdea(idea.id, { status: "failed", error: err.message }, { internal: true });
    throw err;
  } finally {
    publishing.delete(idea.id);
  }
}

app.post("/api/ideas/:id/publish", wrap(async (req, res) => {
  const idea = store.getIdea(req.params.id);
  if (!idea) return res.status(404).json({ error: "الفكرة مو موجودة" });
  res.json(await publishIdea(idea));
}));

// كل دقيقة: انشر المنشورات المجدولة اللي جا وقتها
setInterval(() => {
  const now = new Date();
  for (const idea of store.listIdeas()) {
    if (idea.status === "scheduled" && idea.scheduledAt && new Date(idea.scheduledAt) <= now) {
      publishIdea(idea).catch((err) => console.error(`فشل نشر "${idea.title}":`, err.message));
    }
  }
}, 60_000);

app.listen(PORT, () => console.log(`الموقع شغال على http://localhost:${PORT}`));
