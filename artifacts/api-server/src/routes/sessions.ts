import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";
import { db, sessionsTable, feedbackTable, usersTable } from "@workspace/db";
import { analyzeAudioFile } from "../lib/audioAnalysis";
import {
  calculateXpEarned,
  awardXpAndUpdateStreak,
  seedBadges,
} from "../lib/gamification";

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4",
      "audio/webm", "audio/flac", "audio/m4a", "video/webm",
      "application/octet-stream",
    ];
    if (
      allowedMimeTypes.includes(file.mimetype) ||
      file.originalname.match(/\.(mp3|wav|ogg|m4a|webm|flac|mp4)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported audio format"));
    }
  },
});

router.post("/sessions/upload", upload.single("audio"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No audio file provided" });
    return;
  }

  const rawUserId = Array.isArray(req.body.userId) ? req.body.userId[0] : req.body.userId;
  if (!rawUserId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const rawTopic = Array.isArray(req.body.topic) ? req.body.topic[0] : (req.body.topic ?? null);
  // Parse duration from client if provided (more accurate than file size estimate)
  const rawDuration = Array.isArray(req.body.durationSeconds) ? req.body.durationSeconds[0] : req.body.durationSeconds;
  const clientDuration = rawDuration ? parseFloat(rawDuration) : undefined;

  const [session] = await db
    .insert(sessionsTable)
    .values({
      userId: rawUserId,
      audioPath: req.file.path,
      status: "uploaded",
      topicUsed: rawTopic ?? null,
      // Store actual duration from client if provided
      durationSeconds: clientDuration ?? null,
    })
    .returning();

  req.log.info({ sessionId: session.id, userId: rawUserId }, "Audio uploaded");

  res.status(201).json({
    sessionId: session.id,
    userId: session.userId,
    audioPath: session.audioPath,
    status: session.status,
    createdAt: session.createdAt,
  });
});

router.post("/sessions/:sessionId/analyze", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const sessionId = parseInt(rawId, 10);
  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await db
    .update(sessionsTable)
    .set({ status: "analyzing" })
    .where(eq(sessionsTable.id, session.id));

  req.log.info({ sessionId: session.id }, "Starting analysis");

  // Use stored durationSeconds if available (more accurate from client)
  const result = await analyzeAudioFile(session.audioPath, session.durationSeconds ?? undefined);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.userId, session.userId),
        eq(sessionsTable.status, "analyzed"),
      ),
    );
  const totalSessions = (countResult?.count ?? 0) + 1;

  await seedBadges();

  let xpResult: Awaited<ReturnType<typeof awardXpAndUpdateStreak>> | null = null;
  const isDemoUser = session.userId === "demo-user";

  if (!isDemoUser) {
    const [userExists] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, session.userId));

    if (userExists) {
      const xpEarned = calculateXpEarned(result.scores.overallScore, 0);
      xpResult = await awardXpAndUpdateStreak(session.userId, xpEarned, {
        overallScore: result.scores.overallScore,
        fluencyScore: result.scores.fluencyScore,
        vocabularyScore: result.scores.vocabularyScore,
        confidenceScore: result.scores.confidenceScore,
        totalSessions,
      });

      await db
        .update(sessionsTable)
        .set({ xpEarned })
        .where(eq(sessionsTable.id, session.id));
    }
  }

  const [updated] = await db
    .update(sessionsTable)
    .set({
      transcript: result.transcript,
      fluencyScore: result.scores.fluencyScore,
      pauseScore: result.scores.pauseScore,
      vocabularyScore: result.scores.vocabularyScore,
      confidenceScore: result.scores.confidenceScore,
      overallScore: result.scores.overallScore,
      wordsPerMinute: result.scores.wordsPerMinute,
      uniqueWordRatio: result.scores.uniqueWordRatio,
      fillerWordCount: result.scores.fillerWordCount,
      totalWords: result.scores.totalWords,
      durationSeconds: result.scores.durationSeconds,
      status: "analyzed",
      analyzedAt: new Date(),
    })
    .where(eq(sessionsTable.id, session.id))
    .returning();

  const [existingFeedback] = await db
    .select()
    .from(feedbackTable)
    .where(eq(feedbackTable.sessionId, session.id));

  if (existingFeedback) {
    await db
      .update(feedbackTable)
      .set({
        feedback: result.feedback,
        strengths: result.strengths,
        improvements: result.improvements,
        fillerWords: result.scores.fillerWords,
      })
      .where(eq(feedbackTable.sessionId, session.id));
  } else {
    await db.insert(feedbackTable).values({
      sessionId: session.id,
      feedback: result.feedback,
      strengths: result.strengths,
      improvements: result.improvements,
      fillerWords: result.scores.fillerWords,
    });
  }

  req.log.info({ sessionId: session.id }, "Analysis complete");

  res.json({
    sessionId: updated.id,
    transcript: result.transcript,
    scores: result.scores,
    feedback: result.feedback,
    strengths: result.strengths,
    improvements: result.improvements,
    status: "analyzed",
    analyzedAt: updated.analyzedAt,
    xpEarned: xpResult ? calculateXpEarned(result.scores.overallScore, 0) : 0,
    newBadges: xpResult?.newBadges?.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      earnedAt: null,
    })) ?? [],
    newLevel: xpResult?.newLevel ?? null,
  });
});

router.get("/sessions", async (req, res): Promise<void> => {
  const userId = String(req.query.userId ?? "");
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  const limit = Math.min(parseInt(String(req.query.limit ?? "10"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, userId));

  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, userId))
    .orderBy(desc(sessionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ sessions, total: countResult?.count ?? 0 });
});

router.get("/sessions/:sessionId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const sessionId = parseInt(rawId, 10);
  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const [fb] = await db
    .select()
    .from(feedbackTable)
    .where(eq(feedbackTable.sessionId, session.id));

  res.json({
    session,
    feedback: fb?.feedback ?? null,
    strengths: fb?.strengths ?? [],
    improvements: fb?.improvements ?? [],
    scores:
      session.overallScore != null
        ? {
            fluencyScore: session.fluencyScore,
            pauseScore: session.pauseScore,
            vocabularyScore: session.vocabularyScore,
            confidenceScore: session.confidenceScore ?? 0,
            overallScore: session.overallScore,
            wordsPerMinute: session.wordsPerMinute,
            uniqueWordRatio: session.uniqueWordRatio,
            fillerWordCount: session.fillerWordCount ?? 0,
            fillerWords: fb?.fillerWords ?? [],
            totalWords: session.totalWords,
            durationSeconds: session.durationSeconds,
          }
        : null,
  });
});

export default router;
