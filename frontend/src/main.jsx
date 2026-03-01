import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";

import "./index.css";
import { LandingPage } from "./pages/LandingPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { ManagePage } from "./pages/ManagePage";

function AppShell() {
  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Word List React Frontend</h1>
        <nav className="flex gap-2 text-sm">
          <Link className="rounded border border-border bg-white px-3 py-1" to="/landing">Landing</Link>
          <Link className="rounded border border-border bg-white px-3 py-1" to="/feedback">Feedback</Link>
          <Link className="rounded border border-border bg-white px-3 py-1" to="/manage">Manage</Link>
          <a className="rounded border border-border bg-white px-3 py-1" href="/manage/">Django UI</a>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/manage" element={<ManagePage />} />
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
