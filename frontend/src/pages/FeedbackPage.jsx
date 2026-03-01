import { useCallback, useEffect, useRef, useState } from "react";

import { PageHeader } from "../components/common/page-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { apiGet, apiPost } from "../lib/http";

const SWIPE_THRESHOLD = 110;
const PREFETCH_BATCH_SIZE = 20;
const PREFETCH_LOW_WATERMARK = 5;

export function FeedbackPage() {
  const [queue, setQueue] = useState([]);
  const [status, setStatus] = useState("Loading...");
  const [dragX, setDragX] = useState(0);
  const [votes, setVotes] = useState(0);
  const [prefetching, setPrefetching] = useState(false);
  const dragStartRef = useRef(null);
  const prefetchRef = useRef(false);

  const refillQueue = useCallback(async () => {
    if (prefetchRef.current) return;
    prefetchRef.current = true;
    setPrefetching(true);
    try {
      const data = await apiGet(`/api/v1/words/random?count=${PREFETCH_BATCH_SIZE}`);
      const nextRows = Array.isArray(data.results) ? data.results : [];
      setQueue((prev) => {
        const existing = new Set(prev.map((row) => row.id));
        const deduped = nextRows.filter((row) => row && !existing.has(row.id));
        return [...prev, ...deduped];
      });
      setStatus("Swipe right for good, left for bad.");
    } catch (err) {
      setStatus(String(err));
    } finally {
      prefetchRef.current = false;
      setPrefetching(false);
    }
  }, []);

  useEffect(() => {
    refillQueue();
  }, [refillQueue]);

  useEffect(() => {
    if (queue.length === 0) {
      setStatus("Loading word cache...");
      refillQueue();
      return;
    }
    if (queue.length <= PREFETCH_LOW_WATERMARK) {
      refillQueue();
    }
  }, [queue.length, refillQueue]);

  const word = queue[0] || null;

  async function submit(verdict) {
    if (!word) return;
    setStatus("Saving feedback...");
    try {
      await apiPost("/api/v1/feedback", { word: word.id, verdict, comment: "" });
      setVotes((prev) => prev + 1);
      setStatus(verdict === "good" ? "Marked good." : "Marked bad.");
      setQueue((prev) => prev.slice(1));
      setDragX(0);
    } catch (err) {
      setStatus(String(err));
    }
  }

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "ArrowRight") submit("good");
      if (event.key === "ArrowLeft") submit("bad");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [word]);

  function onPointerDown(event) {
    dragStartRef.current = event.clientX;
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function onPointerMove(event) {
    if (dragStartRef.current === null) return;
    setDragX(event.clientX - dragStartRef.current);
  }

  function onPointerUp() {
    if (dragX > SWIPE_THRESHOLD) {
      submit("good");
      return;
    }
    if (dragX < -SWIPE_THRESHOLD) {
      submit("bad");
      return;
    }
    setDragX(0);
    dragStartRef.current = null;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Swipe Feedback"
        description="Quick playtest loop for quality signals. Keyboard: left and right arrows."
        secondaryActions={
          <>
            <Badge className="py-1 text-sm">Session votes: {votes}</Badge>
            <Badge className="py-1 text-sm">Cache: {queue.length}</Badge>
            {prefetching ? <Badge className="py-1 text-sm">Prefetching...</Badge> : null}
          </>
        }
      />

      <Card className="overflow-hidden">
        <CardContent className="space-y-4 pt-4">
          <div className="mx-auto w-full max-w-lg">
            <div
              className="flex h-[420px] select-none items-center justify-center rounded-3xl border border-border bg-gradient-to-br from-white to-slate-50 p-6 text-center shadow-md"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                transform: `translateX(${dragX}px) rotate(${dragX / 18}deg)`,
                transition: dragStartRef.current === null ? "transform 220ms ease" : "none",
                touchAction: "pan-y",
              }}
            >
              {word ? (
                <div className="space-y-3">
                  <div className="text-4xl font-semibold tracking-tight">{word.word}</div>
                  <div className="flex flex-wrap justify-center gap-2 text-xs">
                    {word.word_type ? <Badge>{word.word_type}</Badge> : null}
                    {word.category ? <Badge>{word.category}</Badge> : null}
                    {word.collection ? <Badge>{word.collection}</Badge> : null}
                    {word.difficulty ? <Badge>{word.difficulty}</Badge> : null}
                  </div>
                  {word.hint ? <div className="text-sm text-muted-foreground">Hint: {word.hint}</div> : null}
                </div>
              ) : (
                <div>No word available.</div>
              )}
            </div>
          </div>

          <div className="mx-auto flex max-w-md justify-center gap-3">
            <Button variant="destructive" className="flex-1" onClick={() => submit("bad")}>Bad</Button>
            <Button className="flex-1" onClick={() => submit("good")}>Good</Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">{status}</div>
        </CardContent>
      </Card>
    </div>
  );
}
