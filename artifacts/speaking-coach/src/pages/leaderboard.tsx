import { useGetLeaderboard, useGetUserStats } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth";
import { Trophy, Zap, Star, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function Leaderboard() {
  const { currentUserId, isAuthenticated } = useAuth();
  const { data, isLoading } = useGetLeaderboard({ limit: 20 });
  const { data: myStats } = useGetUserStats(currentUserId, {
    query: { enabled: isAuthenticated },
  });

  const entries = data?.entries ?? [];

  function getRankStyle(rank: number) {
    if (rank === 1) return "bg-[hsl(35_90%_55%)] text-white shadow-md";
    if (rank === 2) return "bg-[hsl(220_15%_65%)] text-white shadow-sm";
    if (rank === 3) return "bg-[hsl(25_70%_50%)] text-white shadow-sm";
    return "bg-secondary text-muted-foreground";
  }

  function getRankLabel(rank: number): string {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return String(rank);
  }

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[hsl(35_90%_55%)]/15 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-[hsl(35_90%_55%)]" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground mt-0.5">Top speakers ranked by XP and level</p>
        </div>
      </div>

      {/* My Rank */}
      {isAuthenticated && myStats && (
        <Card className="border-primary/30 bg-primary/5 shadow-sm">
          <CardContent className="py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold shrink-0">
              ME
            </div>
            <div className="flex-1">
              <p className="font-semibold">Your stats</p>
              <p className="text-xs text-muted-foreground">Level {myStats.level} · {myStats.levelName}</p>
            </div>
            <div className="text-right flex items-center gap-3">
              <div className="flex items-center gap-1 font-bold text-[hsl(35_90%_55%)]">
                <Zap size={14} />
                {myStats.xp} XP
              </div>
              {myStats.currentStreak > 0 && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Flame size={13} className="text-[hsl(var(--chart-1))]" />
                  {myStats.currentStreak}d
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 3 podium */}
      {!isLoading && entries.length >= 3 && (
        <div className="grid grid-cols-3 gap-2 items-end">
          {[entries[1], entries[0], entries[2]].map((entry, podiumIdx) => {
            if (!entry) return <div key={podiumIdx} />;
            const heights = ["h-28", "h-36", "h-24"];
            const ranks = [2, 1, 3];
            const rank = ranks[podiumIdx];
            return (
              <Card
                key={entry.userId}
                className={cn(
                  "flex flex-col items-center justify-end pb-4 pt-3 text-center border-border/60 shadow-sm transition-all",
                  heights[podiumIdx],
                  rank === 1 && "border-[hsl(35_90%_55%)]/50 bg-[hsl(35_90%_55%)]/5 shadow-md",
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-1.5",
                    getRankStyle(rank),
                  )}
                >
                  {getRankLabel(rank)}
                </div>
                <p className="font-bold text-sm truncate max-w-full px-2">{entry.username}</p>
                <div className="flex items-center gap-1 text-xs font-semibold text-[hsl(35_90%_55%)]">
                  <Zap size={10} />
                  {entry.xp}
                </div>
                <p className="text-xs text-muted-foreground">Lv {entry.level}</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Rankings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-4">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          ) : entries.length > 0 ? (
            <div className="divide-y divide-border">
              {entries.map((entry) => (
                <div
                  key={entry.userId}
                  className={cn(
                    "flex items-center gap-4 px-5 py-3 transition-colors",
                    entry.rank <= 3 ? "bg-[hsl(35_90%_55%)]/3 hover:bg-[hsl(35_90%_55%)]/6" : "hover:bg-secondary/40",
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                      getRankStyle(entry.rank),
                    )}
                  >
                    {getRankLabel(entry.rank)}
                  </div>

                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-bold shrink-0">
                    {entry.username.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{entry.username}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Star size={10} />
                        Lv {entry.level} · {entry.levelName}
                      </span>
                      {entry.currentStreak > 0 && (
                        <span className="flex items-center gap-0.5 text-[hsl(var(--chart-1))]">
                          <Flame size={10} />
                          {entry.currentStreak}d
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm font-bold text-[hsl(35_90%_55%)]">
                      <Zap size={13} />
                      {entry.xp.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground text-sm">
              <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
              No ranked users yet. Be the first!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
