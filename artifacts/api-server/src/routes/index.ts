import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import sessionsRouter from "./sessions";
import feedbackRouter from "./feedback";
import ttsRouter from "./tts";
import topicsRouter from "./topics";
import progressRouter from "./progress";
import gamificationRouter from "./gamification";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(sessionsRouter);
router.use(feedbackRouter);
router.use(ttsRouter);
router.use(topicsRouter);
router.use(progressRouter);
router.use(gamificationRouter);

export default router;
