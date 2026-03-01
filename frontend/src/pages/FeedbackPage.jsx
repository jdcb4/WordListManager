import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { apiGet, apiPost } from "../lib/http";

export function FeedbackPage() {
  const [word, setWord] = useState(null);
  const [status, setStatus] = useState("Loading...");
  const [dragX, setDragX] = useState(0);
  const dragStartRef = useRef(null);

  const loadWord = useCallback(async () => {
    setStatus("Loading next word...");
    try {
      const data = await apiGet("/api/v1/words/random?count=1");
      const nextWord = (data.results || [])[0] || null;
      setWord(nextWord);
      setStatus(nextWord ? "Swipe right for good, left for bad." : "No active words.");
      setDragX(0);
    } catch (err) {
      setStatus(String(err));
    }
  }, []);

  useEffect(() => {
    loadWord();
  }, [loadWord]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "ArrowRight") submit("good");
      if (event.key === "ArrowLeft") submit("bad");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [word]);

  async function submit(verdict) {
    if (!word) return;
    setStatus("Saving feedback...");
    try {
      await apiPost("/api/v1/feedback", { word: word.id, verdict, comment: "" });
      setStatus(verdict === "good" ? "Marked good." : "Marked bad.");
      await loadWord();
    } catch (err) {
      setStatus(String(err));
    }
  }

  function onPointerDown(event) {
    dragStartRef.current = event.clientX;
  }

  function onPointerMove(event) {
    if (dragStartRef.current === null) return;
    setDragX(event.clientX - dragStartRef.current);
  }

  function onPointerUp() {
    const threshold = 110;
    if (dragX > threshold) {
      submit("good");
      return;
    }
    if (dragX < -threshold) {
      submit("bad");
      return;
    }
    setDragX(0);
    dragStartRef.current = null;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Swipe Feedback</CardTitle>
        <div className="text-sm text-muted-foreground">
          Swipe or use arrow keys: left = bad, right = good.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="mx-auto flex h-80 max-w-md select-none items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-white to-slate-50 p-6 text-center shadow-sm"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
            transition: dragStartRef.current === null ? "transform 0.2s ease" : "none",
          }}
        >
          {word ? (
            <div>
              <div className="text-4xl font-bold tracking-tight">{word.word}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {[word.word_type, word.category, word.collection].filter(Boolean).join(" | ")}
              </div>
              <div className="mt-2 text-sm">{word.hint || ""}</div>
            </div>
          ) : (
            <div>No word available.</div>
          )}
        </div>
        <div className="flex justify-center gap-3">
          <Button variant="destructive" onClick={() => submit("bad")}>Bad (Left)</Button>
          <Button onClick={() => submit("good")}>Good (Right)</Button>
        </div>
        <div className="text-center text-sm text-muted-foreground">{status}</div>
      </CardContent>
    </Card>
  );
}
