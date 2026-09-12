// scripts/email.ts —— Resend 發信 + PUBLIC_BASE_URL（confirm/unsubscribe link 用）
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const envPath = new URL("../.env", import.meta.url);
if (process.env.NODE_ENV !== "production") dotenv.config({ path: fileURLToPath(envPath) });

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? "http://localhost:5000").replace(/\/$/, "");
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY 未設定");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`resend HTTP ${res.status}: ${body.slice(0, 500)}`);
  }
}