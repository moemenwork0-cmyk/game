// Shared database (Cloud Firestore). Every phone reads and writes the same data.
// Firestore keeps a copy on the phone, so the app keeps working without internet
// and uploads queued changes on its own when the connection comes back.
import { initializeApp } from "firebase/app";
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  collection, doc, onSnapshot, setDoc, getDoc, getDocs, query, where, writeBatch,
  Bytes, getAggregateFromServer, count, sum
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";



const app = initializeApp(firebaseConfig);
let fs;
try {
  fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }) });
} catch (e) {
  fs = initializeFirestore(app, {});   // no on-device cache available (should not happen in the app)
}

/* ---------- write tracking (for the sync badge) ---------- */
const sync = { pending: 0, snapPending: false, fromCache: true, err: false, listeners: new Set() };
function emit() { for (const f of sync.listeners) try { f(syncState()); } catch (e) {} }
export function onSync(f) { sync.listeners.add(f); f(syncState()); }
export function syncState() {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  return { online: online && !sync.fromCache, pending: sync.pending, busy: sync.pending > 0 || sync.snapPending, err: sync.err };
}
function track(p) {
  sync.pending++; sync.err = false; emit();
  p.then(() => { sync.pending--; emit(); }, (e) => { sync.pending--; sync.err = true; console.error(e); emit(); });
  return p;
}
if (typeof window !== "undefined") { window.addEventListener("online", emit); window.addEventListener("offline", emit); }

/* ---------- inspection records: collection "docs", one document per day (key "YYYY-MM-DD_D") ---------- */
export function listenDocs(cb) {
  return onSnapshot(collection(fs, "docs"), { includeMetadataChanges: true }, (snap) => {
    sync.snapPending = snap.metadata.hasPendingWrites; sync.fromCache = snap.metadata.fromCache; emit();
    const m = new Map();
    snap.forEach(d => m.set(d.id, d.data()));
    cb(m, snap.metadata);
  }, (e) => { console.error(e); sync.err = true; emit(); });
}
// merge only the given fields (marks / notes / times of one point) so phones never overwrite each other's points
export function writeDoc(key, fields) {
  return track(setDoc(doc(fs, "docs", key), fields, { merge: true }));
}

/* ---------- photos: "pmeta" = details + small thumbnail, "pfull" = compressed JPEG ---------- */
export function listenPhotosOfDay(date, cb) {
  return onSnapshot(query(collection(fs, "pmeta"), where("date", "==", date)), (snap) => {
    cb(snap.docs.map(d => d.data()));
  }, (e) => { console.error(e); cb(null); });
}
export async function photoMetasOfDay(date) {
  const s = await getDocs(query(collection(fs, "pmeta"), where("date", "==", date)));
  return s.docs.map(d => d.data());
}
export async function allPhotoMetas() {
  const s = await getDocs(collection(fs, "pmeta"));
  return s.docs.map(d => d.data());
}
export async function photoMetasBefore(date) {
  const s = await getDocs(query(collection(fs, "pmeta"), where("date", "<", date)));
  return s.docs.map(d => d.data());
}
export async function photoExists(id) {
  try { return (await getDoc(doc(fs, "pmeta", id))).exists(); } catch (e) { return false; }
}
const fullCache = new Map();
export async function getFullPhoto(id) {
  if (fullCache.has(id)) return fullCache.get(id);
  const s = await getDoc(doc(fs, "pfull", id));
  if (!s.exists()) return null;
  const r = s.data();
  const blob = new Blob([r.data.toUint8Array()], { type: r.type || "image/jpeg" });
  if (fullCache.size > 40) fullCache.delete(fullCache.keys().next().value);
  fullCache.set(id, blob);
  return blob;
}
export async function putPhoto(meta, blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  fullCache.set(meta.id, blob);
  const b = writeBatch(fs);
  b.set(doc(fs, "pmeta", meta.id), meta);
  b.set(doc(fs, "pfull", meta.id), { id: meta.id, type: blob.type || "image/jpeg", data: Bytes.fromUint8Array(buf) });
  track(b.commit());        // saved on the phone at once; uploaded when online
}
export async function deletePhotos(ids) {
  for (let i = 0; i < ids.length; i += 200) {
    const b = writeBatch(fs);
    for (const id of ids.slice(i, i + 200)) { b.delete(doc(fs, "pmeta", id)); b.delete(doc(fs, "pfull", id)); fullCache.delete(id); }
    track(b.commit());
  }
}
export async function deleteDocs(keys) {
  for (let i = 0; i < keys.length; i += 400) {
    const b = writeBatch(fs);
    for (const k of keys.slice(i, i + 400)) b.delete(doc(fs, "docs", k));
    track(b.commit());
  }
}
export async function photoStats() {
  const r = await getAggregateFromServer(collection(fs, "pmeta"), { n: count(), bytes: sum("size") });
  return r.data();
}
