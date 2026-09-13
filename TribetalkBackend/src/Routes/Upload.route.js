import { Router } from "express";
import { verifyJWT } from "../Middlewares/Auth.middleware.js";
import { uploadSingleImage } from "../Middlewares/Upload.middleware.js";
import { uploadImageFile } from "../Controllers/Upload.controller.js";

const router = Router();

router.post("/image", verifyJWT, uploadSingleImage, uploadImageFile);

export default router;
