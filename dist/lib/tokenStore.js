"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readGoogleTokens = readGoogleTokens;
exports.writeGoogleTokens = writeGoogleTokens;
// src/lib/tokenStore.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const FILE = process.env.TOKEN_STORE || path_1.default.resolve(".tokens/google.json");
function readGoogleTokens() {
    try {
        const raw = fs_1.default.readFileSync(FILE, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function writeGoogleTokens(tokens) {
    fs_1.default.mkdirSync(path_1.default.dirname(FILE), { recursive: true });
    fs_1.default.writeFileSync(FILE, JSON.stringify(tokens, null, 2));
}
//# sourceMappingURL=tokenStore.js.map