// تخزين بسيط بملف JSON — كافي لحساب واحد أو حسابات قليلة
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// على Render يكون DATA_DIR مسار الـ Disk الدائم
export const DATA_DIR = path.resolve(process.env.DATA_DIR || "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const empty = () => ({
  profile: {
    handle: "",
    niche: "",
    audience: "",
    tone: "",
    language: "عربي - لهجة كويتية",
    goals: "",
    pillars: "",
    examples: "",
  },
  ideas: [],
  strategy: {
    startDate: "", // YYYY-MM-DD (يوم أحد)
    weeks: 13,
    goals: [], // [{ type, detail }]
    launches: [], // [{ id, name, type, date, details }]
    notes: "",
    plan: null, // الخطة اللي يطلعها الذكاء الاصطناعي
  },
  shots: [],
});

let db = load();

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) return empty();
  const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  return {
    ...empty(),
    ...parsed,
    profile: { ...empty().profile, ...parsed.profile },
    strategy: { ...empty().strategy, ...parsed.strategy },
  };
}

function save() {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export const getProfile = () => db.profile;

export function updateProfile(patch) {
  db.profile = { ...db.profile, ...pick(patch, Object.keys(empty().profile)) };
  save();
  return db.profile;
}

export const listIdeas = () =>
  [...db.ideas].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const getIdea = (id) => db.ideas.find((i) => i.id === id);

const IDEA_FIELDS = [
  "title", "notes", "format", "funnel", "goal", "caption", "hashtags", "tags",
  "media", "status", "scheduledAt", "source", "script",
];

export function createIdea(data) {
  const now = new Date().toISOString();
  const idea = {
    id: crypto.randomUUID(),
    title: "",
    notes: "",
    format: "post", // post | carousel | reel
    funnel: "", // tof | mof | bof
    goal: "", // مفاتيح GOALS في public/taxonomy.js
    caption: "",
    hashtags: "",
    script: "", // سكربت الفويس اوفر للريلز
    tags: [],
    media: [], // [{ url, type: "image" | "video" }]
    status: "idea", // idea | draft | scheduled | published | failed
    scheduledAt: null,
    source: "me", // me | ai
    publishedId: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    ...pick(data, IDEA_FIELDS),
  };
  db.ideas.push(idea);
  save();
  return idea;
}

export function updateIdea(id, patch, { internal = false } = {}) {
  const idea = getIdea(id);
  if (!idea) return null;
  const fields = internal ? [...IDEA_FIELDS, "publishedId", "error"] : IDEA_FIELDS;
  Object.assign(idea, pick(patch, fields), { updatedAt: new Date().toISOString() });
  save();
  return idea;
}

export function deleteIdea(id) {
  const before = db.ideas.length;
  db.ideas = db.ideas.filter((i) => i.id !== id);
  save();
  return db.ideas.length < before;
}

function pick(obj = {}, keys) {
  return Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
}

// ---------- الخطة التسويقية ----------
export const getStrategy = () => db.strategy;

export function updateStrategy(patch) {
  db.strategy = { ...db.strategy, ...pick(patch, Object.keys(empty().strategy)) };
  db.strategy.launches = (db.strategy.launches || []).map((l) => ({ id: l.id || crypto.randomUUID(), ...l }));
  save();
  return db.strategy;
}

// ---------- مكتبة اللقطات ----------
const SHOT_FIELDS = ["title", "description", "kind", "category", "duration", "tips", "usage", "done", "media"];

export const listShots = () => db.shots;

export function createShot(data) {
  const shot = {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    kind: "video", // video | photo
    category: "",
    duration: "",
    tips: "",
    usage: "",
    done: false,
    media: [],
    createdAt: new Date().toISOString(),
    ...pick(data, SHOT_FIELDS),
  };
  db.shots.push(shot);
  save();
  return shot;
}

export function updateShot(id, patch) {
  const shot = db.shots.find((s) => s.id === id);
  if (!shot) return null;
  Object.assign(shot, pick(patch, SHOT_FIELDS));
  save();
  return shot;
}

export function deleteShot(id) {
  const before = db.shots.length;
  db.shots = db.shots.filter((s) => s.id !== id);
  save();
  return db.shots.length < before;
}
