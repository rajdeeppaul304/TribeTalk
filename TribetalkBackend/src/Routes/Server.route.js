import { Router } from "express";
import { 
    createServer,
    deleteServer,
    listServers,
    editServer,
    getServerInfo,
    joinServer, createInvite, listInvites, revokeInvite, setMemberRole, removeMember, listAuditLogs
} from "../Controllers/Server.controller.js";
import { verifyJWT } from "../Middlewares/Auth.middleware.js";
import { validate } from "../Middlewares/Validate.middleware.js";
import { createServerSchema, joinServerSchema, serverIdParamsSchema, updateServerSchema, createInviteSchema, inviteIdParamsSchema, memberRoleSchema, memberIdParamsSchema } from "../Validation/schemas.js";

const router = Router();

// All server routes require authentication
router.use(verifyJWT);

router.route("/create-server").post(validate(createServerSchema), createServer);
router.route("/list-all-server").get(listServers);
router.patch("/edit-server/:id", validate(updateServerSchema), editServer);
router.delete("/delete-server/:id", validate(serverIdParamsSchema), deleteServer);

router.get("/single-server/:id", validate(serverIdParamsSchema), getServerInfo);
router.post("/join-server/:id", validate(joinServerSchema), joinServer);
router.route("/:id/invites").get(validate(serverIdParamsSchema), listInvites).post(validate(createInviteSchema), createInvite);
router.delete("/:id/invites/:inviteId", validate(inviteIdParamsSchema), revokeInvite);
router.patch("/:id/members/:memberId/role", validate(memberRoleSchema), setMemberRole);
router.delete("/:id/members/:memberId", validate(memberIdParamsSchema), removeMember);
router.get("/:id/audit-logs", validate(serverIdParamsSchema), listAuditLogs);

export default router;
