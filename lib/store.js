// تخزين بسيط بملف JSON — كافي لحساب واحد أو حسابات قليلة
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.resolve("data");
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
});

let db = load();

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) return empty();
  const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  return { ...empty(), ...parsed, profile: { ...empty().profile, ...parsed.profile } };
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
  "media", "status", "scheduledAt", "source",
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
