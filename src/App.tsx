import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Contests from "./pages/Contests";
import ContestDetail from "./pages/ContestDetail";
import Quiz from "./pages/Quiz";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Certificate from "./pages/Certificate";

const queryClient = new QueryClient();

const RecoveryAwareIndex = () => {
  const location = useLocation();
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(location.search);

  const hasRecoveryHash = hashParams.get("type") === "recovery" && !!hashParams.get("access_token");
  const hasRecoveryQuery =
    queryParams.get("type") === "recovery" &&
    (!!queryParams.get("code") || !!queryParams.get("token_hash") || !!queryParams.get("access_token"));

  if (hasRecoveryHash || hasRecoveryQuery) {
    return <Navigate to={`/reset-password${location.search}${location.hash}`} replace />;
  }

  return <Index />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RecoveryAwareIndex />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/signup" element={<Auth />} />
          <Route path="/auth/reset" element={<Auth />} />
          <Route path="/reset-password" element={<Auth />} />
          <Route path="/contests" element={<Contests />} />
          <Route path="/contest/:id" element={<ContestDetail />} />
          <Route path="/quiz/:id" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/profile/:userId" element={<Profile />} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/certificate/:code" element={<Certificate />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
