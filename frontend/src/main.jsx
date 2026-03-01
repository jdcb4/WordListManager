import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";

import "./index.css";
import { LandingPage } from "./pages/LandingPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { ManagePage } from "./pages/ManagePage";
import { ManageStagingPage } from "./pages/ManageStagingPage";
import { ManageValidationPage } from "./pages/ManageValidationPage";
import { ManageFeedbackPage } from "./pages/ManageFeedbackPage";

function AppShell() {
  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white/80 p-4 shadow-sm backdrop-blur">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WordListManager</h1>
          <p className="text-sm text-muted-foreground">React-first interface (Django admin unchanged)</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link className="rounded-full border border-border bg-white px-3 py-1" to="/">Home</Link>
          <Link className="rounded-full border border-border bg-white px-3 py-1" to="/feedback">Play Feedback</Link>
          <a className="rounded-full border border-border bg-white px-3 py-1" href="/manage/">Manage</a>
          <a className="rounded-full border border-border bg-white px-3 py-1" href="/manage/staging/">Staging</a>
          <a className="rounded-full border border-border bg-white px-3 py-1" href="/manage/validation/">Validation</a>
          <a className="rounded-full border border-border bg-white px-3 py-1" href="/manage/feedback/">Feedback Mod</a>
          <a className="rounded-full border border-border bg-white px-3 py-1" href="/admin/">Admin</a>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/landing/" element={<LandingPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/feedback/" element={<FeedbackPage />} />
        <Route path="/feedback/swipe" element={<FeedbackPage />} />
        <Route path="/feedback/swipe/" element={<FeedbackPage />} />
        <Route path="/manage" element={<ManagePage />} />
        <Route path="/manage/" element={<ManagePage />} />
        <Route path="/manage/staging" element={<ManageStagingPage />} />
        <Route path="/manage/staging/" element={<ManageStagingPage />} />
        <Route path="/manage/validation" element={<ManageValidationPage />} />
        <Route path="/manage/validation/" element={<ManageValidationPage />} />
        <Route path="/manage/feedback" element={<ManageFeedbackPage />} />
        <Route path="/manage/feedback/" element={<ManageFeedbackPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  </React.StrictMode>
);
