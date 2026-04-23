// lib/store.ts
import { can } from './config';

export const K_MIN = 5;
export const DP_EPSILON = 0.8;

export const CryptoEngine = {
  _keyCache: new Map(),
  async deriveKey(orgCode: string, pin: string) {
    const cacheKey = orgCode + ":" + pin;
    if (this._keyCache.has(cacheKey)) return this._keyCache.get(cacheKey);
    try {
      const enc = new TextEncoder();
      const km = await window.crypto.subtle.importKey(
        "raw", enc.encode(pin + orgCode),
        { name: "PBKDF2" }, false, ["deriveKey"]
      );
      const key = await window.crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode("REIBI-SALT-2025-v1"), iterations: 100000, hash: "SHA-256" },
        km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
      );
      this._keyCache.set(cacheKey, key);
      return key;
    } catch { return null; }
  },
  async encrypt(key: CryptoKey, plaintext: string) {
    if (!key) return null;
    try {
      const enc = new TextEncoder();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const ct = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
      const combined = new Uint8Array(iv.length + ct.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(ct), iv.length);
      return btoa(String.fromCharCode(...combined as any));
    } catch { return null; }
  },
  async decrypt(key: CryptoKey, b64: string) {
    if (!key || !b64) return null;
    try {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const iv = bytes.slice(0, 12), ct = bytes.slice(12);
      const pt = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
      return new TextDecoder().decode(pt);
    } catch { return null; }
  },
  clearKey(orgCode: string, pin: string) {
    this._keyCache.delete(orgCode + ":" + pin);
  }
};

let _cryptoKey: any = null;
export const setCryptoKey = (k: any) => { _cryptoKey = k; };
export const clearCryptoKey = () => { _cryptoKey = null; };

export const dpNoise = (sensitivity = 1, epsilon = DP_EPSILON) => {
  const u = Math.random() - 0.5;
  return (sensitivity / epsilon) * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
};
export const dpCount = (trueCount: number) => Math.max(0, Math.round(trueCount + dpNoise(1)));
export const dpPct = (truePct: number) => Math.min(100, Math.max(0, Math.round(truePct + dpNoise(5))));

export const AuditLog = {
  _log: [] as any[],
  record(action: string, detail = "", role = "") {
    this._log.unshift({ ts: new Date().toISOString(), action, detail, role, id: Math.random().toString(36).slice(2, 8) });
    if (this._log.length > 100) this._log.pop();
  },
  getLog() { return [...this._log]; },
  clear() { this._log = []; }
};

export const ZeroTrust = {
  lastActivity: Date.now(),
  TIMEOUT_MS: 30 * 60 * 1000,
  touch() { this.lastActivity = Date.now(); },
  isExpired() { return (Date.now() - this.lastActivity) > this.TIMEOUT_MS; },
  validateAction(session: any, permission: string) {
    if (!session) return false;
    if (this.isExpired()) return false;
    this.touch();
    const ok = can(session.systemRole, permission);
    AuditLog.record(ok ? "ACCESS_GRANTED" : "ACCESS_DENIED", permission, session.systemRole);
    return ok;
  }
};

// 使用標準 localStorage 取代 window.storage
export const stor = {
  async get(k: string) {
    if (typeof window === "undefined") return null;
    try {
      const val = localStorage.getItem(k);
      if (!val) return null;
      if (_cryptoKey && val.startsWith('"ENC:')) {
        const b64 = JSON.parse(val).slice(4);
        const pt = await CryptoEngine.decrypt(_cryptoKey, b64);
        return pt ? JSON.parse(pt) : null;
      }
      return JSON.parse(val);
    } catch { return null; }
  },
  async set(k: string, v: any) {
    if (typeof window === "undefined") return;
    try {
      let payload;
      if (_cryptoKey) {
        const ct = await CryptoEngine.encrypt(_cryptoKey, JSON.stringify(v));
        payload = ct ? JSON.stringify("ENC:" + ct) : JSON.stringify(v);
      } else {
        payload = JSON.stringify(v);
      }
      localStorage.setItem(k, payload);
    } catch {}
  },
  async del(k: string) {
    if (typeof window === "undefined") return;
    localStorage.removeItem(k);
  }
};

export const DB = {
  saveSession: (s: any) => stor.set("s", s),
  loadSession: () => stor.get("s"),
  clearSession: () => stor.del("s"),
  saveMemProfile: (uid: string, p: any) => stor.set("mem_" + uid, p),
  loadMemProfile: (uid: string) => stor.get("mem_" + uid),
  saveReport: async (r: any) => { let a = await stor.get("rpts"); if (!Array.isArray(a)) a = []; a.unshift(r); if (a.length > 60) a = a.slice(0, 60); await stor.set("rpts", a); },
  loadReports: async () => { const r = await stor.get("rpts"); return Array.isArray(r) ? r : []; },
  saveOrgRec: async (code: string, rec: any) => {
    const k = "org_" + code.replace(/\W/g, "_");
    let a = await stor.get(k); if (!Array.isArray(a)) a = [];
    const deId = {
      sScore: rec.sScore, sKey: rec.sLevel?.key, pScore: rec.pScore, pKey: rec.pLevel?.key, wScore: rec.wScore,
      dept: rec.profile?.dept || "", painLocs: rec.profile?.painLocations || [], ts: rec.ts
    };
    a.unshift(deId); if (a.length > 500) a = a.slice(0, 500);
    await stor.set(k, a);
    AuditLog.record("ORG_DATA_SUBMITTED", "de-identified record saved", code);
  },
  loadOrgRecs: async (code: string) => { const r = await stor.get("org_" + code.replace(/\W/g, "_")); return Array.isArray(r) ? r : []; },
  getCreds: (code: string) => stor.get("cred_" + code.replace(/\W/g, "_")),
  setCreds: (code: string, v: any) => stor.set("cred_" + code.replace(/\W/g, "_"), v),
  getOKR: (code: string) => stor.get("okr_" + code.replace(/\W/g, "_")),
  setOKR: (code: string, v: any) => stor.set("okr_" + code.replace(/\W/g, "_"), v),
  getAppts: (code: string, svc: string) => stor.get("appt_" + code.replace(/\W/g, "_") + "_" + svc),
  setAppts: (code: string, svc: string, v: any) => stor.set("appt_" + code.replace(/\W/g, "_") + "_" + svc, v),
};