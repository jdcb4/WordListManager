import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import "./index.css";
import { AppShell } from "./components/common/app-shell";
import { LandingPage } from "./pages/LandingPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { ManagePage } from "./pages/ManagePage";
import { ManageStagingPage } from "./pages/ManageStagingPage";
import { ManageValidationPage } from "./pages/ManageValidationPage";
import { ManageFeedbackPage } from "./pages/ManageFeedbackPage";
import { ManageAiPage } from "./pages/ManageAiPage";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppShell>
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
          <Route path="/manage/ai" element={<ManageAiPage />} />
          <Route path="/manage/ai/" element={<ManageAiPage />} />
          <Route path="/manage/feedback" element={<ManageFeedbackPage />} />
          <Route path="/manage/feedback/" element={<ManageFeedbackPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  </React.StrictMode>
);
