"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/google.routes.ts
const express_1 = require("express");
const googleCalendar_controller_1 = require("../../controller/googleCal/googleCalendar.controller");
const router = (0, express_1.Router)();
// Create an event on Google Calendar
router.post("/events", googleCalendar_controller_1.createEventCtrl);
// Optional: list next events to verify token works
router.get("/events/upcoming", googleCalendar_controller_1.listUpcomingCtrl);
exports.default = router;
//# sourceMappingURL=googleRoutes.js.map