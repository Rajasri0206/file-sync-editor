import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable, feedbackTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/feedback/:sessionId", async (req, res): Promise<void> => {
  const sessionId = parseInt(req.params.sessionId, 10);
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
    .where(eq(feedbackTable.sessionId, sessionId));

  if (!fb) {
    res.status(404).json({ error: "Feedback not found. Please analyze the session first." });
    return;
  }

  res.json({
    sessionId: session.id,
    feedback: fb.feedback,
    strengths: fb.strengths ?? [],
    improvements: fb.improvements ?? [],
    scores: {
      fluencyScore: session.fluencyScore ?? 0,
      pauseScore: session.pauseScore ?? 0,
      vocabularyScore: session.vocabularyScore ?? 0,
      confidenceScore: session.confidenceScore ?? 0,
      overallScore: session.overallScore ?? 0,
      wordsPerMinute: session.wordsPerMinute ?? 0,
      uniqueWordRatio: session.uniqueWordRatio ?? 0,
      fillerWordCount: session.fillerWordCount ?? 0,
      fillerWords: fb.fillerWords ?? [],
      totalWords: session.totalWords ?? 0,
      durationSeconds: session.durationSeconds ?? 0,
    },
    transcript: session.transcript ?? "",
    createdAt: fb.createdAt,
  });
});

export default router;
