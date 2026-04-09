import { useRoute } from "wouter";
import { useGetSession, useGetSessionFeedback } from "@workspace/api-client-react";
import { format } from "date-fns";
import {
  ArrowLeft, Loader2, RefreshCw, Volume2, Mic,
  CheckCircle, AlertCircle, Star, Zap
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreGauge } from "@/components/score-gauge";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function SessionDetail() {
  const [matched, params] = useRoute("/sessions/:id");
  const rawId = params?.id ?? "";
  const sessionId = parseInt(rawId, 10);

  const { data, isLoading: isLoadingSession, refetch, isError } = useGetSession(sessionId, {
    query: {
      enabled: !!rawId && !isNaN(sessionId),
      refetchInterval: (query) => {
        const d = query.state.data as { session?: { status?: string } } | undefined;
        return d?.session?.status === "analyzing" ? 3000 : false;
      },
    },
  });

  const session = data?.session;
  const feedbackText = data?.feedback;
  const strengths = data?.strengths;
  const improvements = data?.improvements;

  const { data: feedbackDetail, isLoading: isLoadingFeedback } = useGetSessionFeedback(sessionId, {
    query: {
      enabled: !!rawId && !isNaN(sessionId) && session?.status === "analyzed",
    },
  });

  if (!matched) return null;

  if (isLoadingSession) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-500">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Session not found</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/sessions"><ArrowLeft className="mr-2 h-4 w-4" />Back to History</Link>
        </Button>
      </div>
    );
  }

  const gauges = [
    { label: "Overall", score: session.overallScore, colorClass: "text-primary" },
    { label: "Fluency", score: session.fluencyScore, colorClass: "text-[hsl(var(--chart-1))]" },
    { label: "Confidence", score: session.confidenceScore, colorClass: "text-[hsl(var(--chart-4))]" },
    { label: "Vocabulary", score: session.vocabularyScore, colorClass: "text-[hsl(var(--chart-3))]" },
  ];

  const fillerWords = feedbackDetail?.scores?.fillerWords;
  const transcript = feedbackDetail?.transcript ?? session.transcript;

  return (
    <div className="space-y-6 pb-10 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href="/sessions"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Session — {format(new Date(session.createdAt), "MMM d, yyyy · h:mm a")}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {session.durationSeconds ? `${Math.round(session.durationSeconds)}s` : ""}
            {session.wordsPerMinute ? ` · ${Math.round(session.wordsPerMinute)} WPM` : ""}
            {session.topicUsed ? ` · 📝 ${session.topicUsed}` : ""}
          </p>
        </div>
        {session.xpEarned && (
          <div className="ml-auto flex items-center gap-1 text-[hsl(35_90%_55%)] font-bold">
            <Zap size={16} />
            +{session.xpEarned} XP
          </div>
        )}
      </div>

      {/* Analysis in progress */}
      {session.status === "analyzing" && (
        <Card className="border-primary/30 bg-primary/5 shadow-sm">
          <CardContent className="py-6 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-base font-semibold">Analyzing your session…</p>
            <p className="text-muted-foreground text-sm">Our AI is reviewing your speech. This usually takes 15–30 seconds.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="mt-2 gap-2">
              <RefreshCw size={14} />Check Status
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Score Gauges */}
      {session.status === "analyzed" && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {gauges.map((g) => (
                <ScoreGauge
                  key={g.label}
                  score={g.score}
                  label={g.label}
                  colorClass={g.colorClass}
                  size="md"
                />
              ))}
            </div>

            <Separator className="my-5" />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              {[
                { label: "Words", value: session.totalWords?.toString() },
                { label: "WPM", value: session.wordsPerMinute ? Math.round(session.wordsPerMinute).toString() : undefined },
                { label: "Fillers", value: session.fillerWordCount?.toString() },
                { label: "Vocab Ratio", value: session.uniqueWordRatio ? `${Math.round(session.uniqueWordRatio * 100)}%` : undefined },
              ].map((s) => (
                <div key={s.label} className="bg-secondary/50 rounded-lg py-3 px-2">
                  <div className="text-xl font-bold">{s.value ?? "—"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      {session.status === "analyzed" && (feedbackText || isLoadingFeedback) && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-[hsl(35_90%_55%)]" />
              AI Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoadingFeedback ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ) : (
              <>
                {feedbackText && <p className="text-sm leading-relaxed">{feedbackText}</p>}

                {strengths && strengths.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[hsl(var(--chart-2))] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CheckCircle size={12} />Strengths
                    </h4>
                    <ul className="space-y-1.5">
                      {strengths.map((s, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--chart-2))] mt-1.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {improvements && improvements.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[hsl(var(--chart-4))] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertCircle size={12} />Areas to Improve
                    </h4>
                    <ul className="space-y-1.5">
                      {improvements.map((s, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--chart-4))] mt-1.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {fillerWords && fillerWords.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Filler Words Detected
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {fillerWords.map((fw, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{fw}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      {transcript && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="w-4 h-4 text-primary" />
              Transcript
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {transcript}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Uploaded status */}
      {session.status === "uploaded" && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
            <Mic className="w-10 h-10 text-muted-foreground opacity-50" />
            <h3 className="font-semibold">Session uploaded</h3>
            <p className="text-sm text-muted-foreground">Analysis has not started yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
