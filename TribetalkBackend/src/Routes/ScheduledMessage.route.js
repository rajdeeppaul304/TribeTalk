import { Router } from "express";
import { verifyJWT } from "../Middlewares/Auth.middleware.js";
import { validate } from "../Middlewares/Validate.middleware.js";
import * as controller from "../Controllers/ScheduledMessage.controller.js";
import { cancelScheduledMessageSchema, listScheduledMessagesSchema, scheduleMessageSchema } from "../Validation/schemas.js";

const router = Router();
router.use(verifyJWT);
router.post("/", validate(scheduleMessageSchema), controller.scheduleMessage);
router.get("/:channelId", validate(listScheduledMessagesSchema), controller.listScheduledMessages);
router.delete("/:id", validate(cancelScheduledMessageSchema), controller.cancelScheduledMessage);
export default router;
