"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const extract_1 = require("./routes/extract");
const googleRoutes_1 = __importDefault(require("./routes/googleRoutes/googleRoutes"));
const app = (0, express_1.default)();
// Trust reverse proxies (Vercel/Render/Fly/etc.)
app.set("trust proxy", 1);
// Security headers (sane defaults; keep frameguard off if you embed)
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: false,
}));
// Rate limit (adjust to taste)
app.use((0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 120, // 120 req/min/IP
    standardHeaders: true,
    legacyHeaders: false,
}));
// CORS (permissive; optionally replace "*" with process.env.ALLOW_ORIGIN)
app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
}));
app.use(express_1.default.json({ limit: "25mb" }));
// Health
app.get("/api/healthz", (_req, res) => res.json({ ok: true }));
// Simple request log (dev only)
if (process.env.NODE_ENV !== "production") {
    app.use((req, _res, next) => {
        console.log(`[srv] ${req.method} ${req.url}`);
        next();
    });
}
// Routes
app.use("/api/extract", extract_1.router); // your extractor
app.use("/api/google", googleRoutes_1.default); // Google Calendar integration
// Not found
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
// Start
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
});
exports.default = app; // helps some platforms/tools
//# sourceMappingURL=server.js.map