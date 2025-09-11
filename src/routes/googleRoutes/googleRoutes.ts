// src/routes/google.routes.ts
import { Router } from "express";
import { createEventCtrl, listUpcomingCtrl } from "../../controller/googleCal/googleCalendar.controller";

const router = Router();

// Create an event on Google Calendar
router.post("/events", createEventCtrl);

// Optional: list next events to verify token works
router.get("/events/upcoming", listUpcomingCtrl);

export default router;