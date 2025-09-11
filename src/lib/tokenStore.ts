// src/lib/tokenStore.ts
import fs from "fs";
import path from "path";

const FILE = process.env.TOKEN_STORE || path.resolve(".tokens/google.json");

type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
};

export function readGoogleTokens(): GoogleTokens | null {
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeGoogleTokens(tokens: GoogleTokens) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(tokens, null, 2));
}