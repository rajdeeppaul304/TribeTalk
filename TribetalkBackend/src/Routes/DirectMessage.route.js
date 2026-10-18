import { Router } from "express";
import { verifyJWT } from "../Middlewares/Auth.middleware.js";
import { validate } from "../Middlewares/Validate.middleware.js";
import * as controller from "../Controllers/DirectMessage.controller.js";
import { conversationIdSchema, createConversationSchema, directMessageSchema } from "../Validation/schemas.js";

const router = Router();
router.use(verifyJWT);
router.get("/conversations", controller.listConversations);
router.post("/conversations", validate(createConversationSchema), controller.createConversation);
router.get("/conversations/:id/messages", validate(conversationIdSchema), controller.listMessages);
router.post("/conversations/:id/messages", validate(directMessageSchema), controller.sendMessage);
export default router;
