import { Router } from "express";
import { asyncHandler, createError } from "../middleware/errorHandler";
import { logAudit } from "../middleware/audit";

export const notificationsRouter: Router = Router();

// POST /api/notifications/send — Send QR via Email/SMS/LINE
notificationsRouter.post(
  "/send",
  asyncHandler(async (req, res) => {
    const { type, registrationId, template } = req.body;

    if (!type || !registrationId) {
      throw createError(400, "type and registrationId are required");
    }

    // TODO: Implement actual sending logic with adapters
    // For now, return a mock response
    let result = { status: "sent", channel: type, registrationId };

    switch (type) {
      case "email":
        // Would use Nodemailer here
        console.log(`[EMAIL] Sending QR to registration ${registrationId}`);
        break;
      case "sms":
        // Would use SMS adapter (Twilio, ThaiSMS, etc.)
        console.log(`[SMS] Sending QR to registration ${registrationId}`);
        break;
      case "line":
        // Would use LINE Messaging API
        console.log(`[LINE] Sending QR to registration ${registrationId}`);
        break;
      default:
        throw createError(400, `Unknown notification type: ${type}`);
    }

    await logAudit({
      entityType: "Notification",
      entityId: registrationId,
      action: "NOTIFICATION_SENT",
      newData: { type, template, status: "sent" },
    });

    res.json({ success: true, data: result });
  })
);

// POST /api/notifications/bulk — Send bulk notifications
notificationsRouter.post(
  "/bulk",
  asyncHandler(async (req, res) => {
    const { type, eventId, filter } = req.body;

    if (!type || !eventId) {
      throw createError(400, "type and eventId are required");
    }

    // TODO: Implement bulk sending with queue
    console.log(`[BULK ${type.toUpperCase()}] Sending to event ${eventId}`, filter);

    await logAudit({
      entityType: "Notification",
      entityId: eventId,
      action: "NOTIFICATION_SENT",
      newData: { type, eventId, filter, bulk: true },
    });

    res.json({
      success: true,
      data: {
        status: "queued",
        message: `Bulk ${type} notifications queued for event ${eventId}`,
      },
    });
  })
);
