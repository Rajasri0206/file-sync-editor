import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Mic, Square, Play, Pause, RotateCcw, Upload, Loader2,
  Wand2, ChevronRight, AlertCircle, CheckCircle2, RefreshCw
} from "lucide-react";
import { useGetDailyTopic, useUploadAudio, useAnalyzeSession } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type RecordState = "idle" | "recording" | "paused" | "done" | "uploading" | "analyzing";

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function RecordSession() {
  const { currentUserId } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: topicData, refetch: refetchTopic } = useGetDailyTopic();

  const [state, setState] = useState<RecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [useTopic, setUseTopic] = useState(true);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const uploadMutation = useUploadAudio();
  const analyzeMutation = useAnalyzeSession();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState("done");
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(100);
      startTimeRef.current = Date.now() - elapsed;
      setState("recording");

      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 100);
    } catch {
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record sessions.",
        variant: "destructive",
      });
    }
  }

  function pauseRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setState("paused");
    }
  }

  function resumeRecording() {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      startTimeRef.current = Date.now() - elapsed;
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 100);
      setState("recording");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  function resetRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setElapsed(0);
    setState("idle");
    setAnalyzeProgress(0);
  }

  async function handleUploadAndAnalyze() {
    if (!audioBlob) return;

    setState("uploading");
    setAnalyzeProgress(10);

    try {
      const file = new File([audioBlob], "recording.webm", { type: "audio/webm" });

      const uploadRes = await uploadMutation.mutateAsync({
        data: {
          audio: file,
          userId: currentUserId,
          topic: useTopic && topicData?.topic ? topicData.topic : undefined,
        },
      });

      setAnalyzeProgress(40);
      setState("analyzing");

      const analyzeInterval = setInterval(() => {
        setAnalyzeProgress((p) => Math.min(p + 3, 90));
      }, 500);

      await analyzeMutation.mutateAsync({ sessionId: uploadRes.sessionId });

      clearInterval(analyzeInterval);
      setAnalyzeProgress(100);

      toast({
        title: "Analysis complete!",
        description: "Your speaking session has been analyzed.",
      });

      setTimeout(() => navigate(`/sessions/${uploadRes.sessionId}`), 1000);
    } catch (err: any) {
      setState("done");
      setAnalyzeProgress(0);
      toast({
        title: "Upload failed",
        description: err?.message ?? "Could not process your session.",
        variant: "destructive",
      });
    }
  }

  const isProcessing = state === "uploading" || state === "analyzing";

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Session</h1>
        <p className="text-muted-foreground mt-1">Record and get instant AI feedback on your speaking.</p>
      </div>

      {/* Daily Topic */}
      {topicData?.topic && (
        <Card className={cn("border-border/60 shadow-sm transition-all", useTopic && "border-primary/40 bg-primary/5")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Wand2 className="h-3.5 w-3.5" />
                Today's Topic
              </CardTitle>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => refetchTopic()}
                  title="Get new topic"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  disabled={state !== "idle"}
                >
                  <RefreshCw size={14} />
                </button>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useTopic}
                    onChange={(e) => setUseTopic(e.target.checked)}
                    disabled={state !== "idle"}
                    className="rounded"
                  />
                  Use this topic
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-base font-medium leading-relaxed">{topicData.topic}</p>
            {topicData.tips && topicData.tips.length > 0 && (
              <ul className="mt-2 space-y-1">
                {topicData.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                    <ChevronRight className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recorder */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-6">
          {/* Timer */}
          <div className="relative flex items-center justify-center">
            <div
              className={cn(
                "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300",
                state === "recording"
                  ? "bg-destructive/10 ring-4 ring-destructive/30 ring-offset-4"
                  : state === "done"
                  ? "bg-[hsl(var(--chart-2))]/10 ring-4 ring-[hsl(var(--chart-2))]/30 ring-offset-4"
                  : "bg-muted ring-4 ring-muted ring-offset-4",
              )}
            >
              {state === "recording" && (
                <div className="absolute w-full h-full rounded-full bg-destructive/10 animate-ping opacity-50" />
              )}
              <span className="relative z-10 text-3xl font-mono font-bold tracking-wider">
                {formatTime(elapsed)}
              </span>
            </div>
          </div>

          {/* Status label */}
          <div className="flex items-center gap-2">
            {state === "recording" && (
              <Badge variant="destructive" className="gap-1 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Recording
              </Badge>
            )}
            {state === "paused" && <Badge variant="secondary">Paused</Badge>}
            {state === "done" && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 size={12} />
                Ready to submit
              </Badge>
            )}
            {state === "idle" && <Badge variant="outline">Ready to record</Badge>}
            {isProcessing && <Badge variant="secondary" className="gap-1">
              <Loader2 size={12} className="animate-spin" />
              {state === "uploading" ? "Uploading..." : "Analyzing..."}
            </Badge>}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {state === "idle" && (
              <Button
                size="lg"
                onClick={startRecording}
                className="rounded-full px-8 gap-2 bg-destructive hover:bg-destructive/90"
              >
                <Mic className="h-5 w-5" />
                Start Recording
              </Button>
            )}

            {state === "recording" && (
              <>
                <Button size="icon" variant="outline" onClick={pauseRecording} className="rounded-full h-12 w-12">
                  <Pause className="h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={stopRecording}
                  className="rounded-full px-8 gap-2 border-destructive text-destructive hover:bg-destructive hover:text-white"
                >
                  <Square className="h-5 w-5" />
                  Stop
                </Button>
              </>
            )}

            {state === "paused" && (
              <>
                <Button size="icon" variant="outline" onClick={resumeRecording} className="rounded-full h-12 w-12">
                  <Play className="h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={stopRecording}
                  className="rounded-full px-8 gap-2 border-destructive text-destructive hover:bg-destructive hover:text-white"
                >
                  <Square className="h-5 w-5" />
                  Stop & Save
                </Button>
              </>
            )}

            {state === "done" && (
              <>
                <Button size="icon" variant="ghost" onClick={resetRecording} className="rounded-full h-10 w-10" title="Record again">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  onClick={handleUploadAndAnalyze}
                  className="rounded-full px-8 gap-2"
                >
                  <Upload className="h-5 w-5" />
                  Submit & Analyze
                </Button>
              </>
            )}

            {isProcessing && (
              <Button size="lg" disabled className="rounded-full px-8 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {state === "uploading" ? "Uploading..." : "Analyzing with AI..."}
              </Button>
            )}
          </div>

          {/* Audio playback */}
          {audioUrl && state === "done" && (
            <div className="w-full max-w-sm">
              <p className="text-xs text-muted-foreground mb-1.5 text-center">Preview recording</p>
              <audio src={audioUrl} controls className="w-full rounded-lg h-10" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Progress */}
      {isProcessing && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="py-5">
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {state === "uploading" ? "Uploading audio..." : "AI is analyzing your speech..."}
              </span>
              <span className="text-muted-foreground">{analyzeProgress}%</span>
            </div>
            <Progress value={analyzeProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {analyzeProgress < 40
                ? "Uploading recording..."
                : analyzeProgress < 70
                ? "Transcribing with Whisper..."
                : analyzeProgress < 90
                ? "Generating feedback..."
                : "Wrapping up..."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      {state === "idle" && (
        <Card className="border-border/60 shadow-sm bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Tips for best results
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1.5">
            <p>• Speak clearly and at a natural pace</p>
            <p>• Aim for 1–5 minutes for detailed feedback</p>
            <p>• Minimize background noise</p>
            <p>• Use the daily topic for structured practice</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
