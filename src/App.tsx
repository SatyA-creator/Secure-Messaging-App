import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import { AcceptInvitation } from './pages/AcceptInvitation';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

const queryClient = new QueryClient();

// Use MemoryRouter on native (file:// origin) — BrowserRouter on web/PWA
const AppRouter = Capacitor.isNativePlatform() ? MemoryRouter : BrowserRouter;

const App = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Android hardware/gesture back button
    const backHandler = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else CapApp.exitApp();
    });

    // Reconnect WebSocket when app resumes from background
    const resumeHandler = CapApp.addListener('resume', () => {
      console.log('[App] resumed from background');
    });

    return () => {
      backHandler.then(h => h.remove());
      resumeHandler.then(h => h.remove());
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRouter>
            <Routes>
              <Route path="/accept-invitation/:token" element={<AcceptInvitation />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/" element={<Index />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
