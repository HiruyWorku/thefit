import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WardrobeRoute } from "./WardrobeRoute.jsx";
import { AuthProvider } from "./AuthProvider.jsx";
import { PwaControls } from "./PwaControls.jsx";
import LandingPage from "./landingpage.jsx";
import "./styles.css";
import "./auth.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<WardrobeRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PwaControls />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
