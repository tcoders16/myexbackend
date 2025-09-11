"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const extract_1 = require("./routes/extract");
const googleRoutes_1 = __importDefault(require("./routes/googleRoutes/googleRoutes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
    maxAge: 600, // cache preflight for 10 minutes
}));
app.use(express_1.default.json({ limit: "25mb" }));
app.get("/api/healthz", (_req, res) => res.json({ ok: true }));
app.use((req, _res, next) => {
    console.log(`[srv] ${req.method} ${req.url}`);
    next();
});
// Routes
app.use("/api/extract", extract_1.router); // rules-only
app.use("/api/google", googleRoutes_1.default); // Google Calendar integration
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map