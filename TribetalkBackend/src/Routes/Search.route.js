import { Router } from "express";
import { verifyJWT } from "../Middlewares/Auth.middleware.js";
import { validate } from "../Middlewares/Validate.middleware.js";
import { searchMessagesSchema } from "../Validation/schemas.js";
import { searchMessageContent } from "../Controllers/Search.controller.js";

const router = Router();
router.get("/messages", verifyJWT, validate(searchMessagesSchema), searchMessageContent);
export default router;
