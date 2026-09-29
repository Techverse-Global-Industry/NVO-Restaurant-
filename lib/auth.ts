import { cookies } from "next/headers";
import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { db } from "./db";
import type { Staff } from "./types";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function staff(): Promise<Staff | null> {
  const token = (await cookies()).get("nvo_staff")?.value;
  if (!token) return null;
  return (
    (db()
      .prepare(
        "SELECT staff.id,staff.email,staff.role FROM sessions JOIN staff ON staff.id=sessions.staff_id WHERE token=? AND expires>?",
      )
      .get(digest(token), Date.now()) as Staff) || null
  );
}
export async function customer(create = false) {
  const jar = await cookies();
  let id = jar.get("nvo_customer")?.value;
  if (id && !/^[a-f0-9]{48}$/.test(id)) id = undefined;
  if (!id && create) {
    id = randomBytes(24).toString("hex");
    jar.set("nvo_customer", id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.SECURE_COOKIES === "true",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  }
  return id ? digest(id) : null;
}
export function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  const hash = scryptSync(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}
export async function login(id: string) {
  const token = randomBytes(32).toString("hex");
  db().prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  db()
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(digest(token), id, Date.now() + 1000 * 60 * 60 * 12);
  (await cookies()).set("nvo_staff", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.SECURE_COOKIES === "true",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get("nvo_staff")?.value;
  if (token)
    db().prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
  jar.delete("nvo_staff");
}
export function limit(key: string, max = 30, windowMs = 60000) {
  const c = db();
  const row = c
    .prepare("SELECT count,reset FROM rate_limits WHERE key=?")
    .get(key) as { count: number; reset: number } | undefined;
  if (!row || row.reset < Date.now()) {
    c.prepare("INSERT OR REPLACE INTO rate_limits VALUES(?,?,?)").run(
      key,
      1,
      Date.now() + windowMs,
    );
    return;
  }
  if (row.count >= max)
    throw new Error("Too many attempts. Please wait a moment.");
  c.prepare("UPDATE rate_limits SET count=count+1 WHERE key=?").run(key);
}
