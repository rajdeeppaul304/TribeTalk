import { Router } from "express";
import {
    createChannel,
    deleteChannel,
    editChannel,
    getChannelInfo
} from "../Controllers/Channel.controller.js";
import { verifyJWT } from "../Middlewares/Auth.middleware.js";
import { verifyChannelAccess } from "../Middlewares/ChannelAccess.middleware.js";
import { validate } from "../Middlewares/Validate.middleware.js";
import { channelIdParamsSchema, createChannelSchema, updateChannelSchema } from "../Validation/schemas.js";

const router = Router();

// Apply auth to all channel routes
router.use(verifyJWT);

// Create channel (no channel ID yet; server ID & permissions verified in service)
router.route("/create-channel").post(validate(createChannelSchema), createChannel);

// Protected channel operations requiring channel access verification
router.get("/channel-info/:id", validate(channelIdParamsSchema), verifyChannelAccess, getChannelInfo);
router.patch("/edit-channel/:id", validate(updateChannelSchema), verifyChannelAccess, editChannel);
router.delete("/delete-channel/:id", validate(channelIdParamsSchema), verifyChannelAccess, deleteChannel);

export default router;
