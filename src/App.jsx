import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Outlet } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { SkinProvider } from '@/lib/SkinContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
// Add page imports here
import { DjProvider } from '@/lib/djContext';
import AppLayout from '@/components/layout/AppLayout';
import PageLoader from '@/components/layout/PageLoader';
import Playback from './pages/Playback';
import Account from './pages/Account';
import Login from './pages/Login';
import WorkerLogin from '@/components/WorkerLogin';
import { workerPreview } from '@/api/workerClient';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Mfa from './pages/Mfa';
import Activate from './pages/Activate';
import CalibratePhone from './pages/CalibratePhone';
import PendingCodePreserver from '@/components/premium/PendingCodePreserver';

// Playerul pornește imediat; mixajul, biblioteca și uneltele se descarcă la intrare.
const Mixer = lazy(() => import('./pages/Mixer'));
const Library = lazy(() => import('./pages/Library'));
const Speakers = lazy(() => import('./pages/Speakers'));
const Appearance = lazy(() => import('./pages/Appearance'));
const More = lazy(() => import('./pages/More'));
const Start = lazy(() => import('./pages/Start'));
const Party = lazy(() => import('./pages/Party'));
const Movie = lazy(() => import('./pages/Movie'));
const TvPage = lazy(() => import('./pages/Tv'));
const Discover = lazy(() => import('./pages/Discover'));
const MyMixes = lazy(() => import('./pages/MyMixes'));
const Learn = lazy(() => import('./pages/Learn'));
const Remote = lazy(() => import('./pages/Remote'));
const Premium = lazy(() => import('./pages/Premium'));
const AdminCampaigns = lazy(() => import('./pages/AdminCampaigns'));
const PremiumCards = lazy(() => import('./pages/PremiumCards'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Add your page Route elements here */}
      <Route path="/login" element={workerPreview ? <WorkerLogin /> : <Login />} />
      {workerPreview && <Route path="/admin-sign-in" element={<WorkerLogin />} />}
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/mfa" element={<Mfa />} />
      {/* Telefonul de calibrare nu intră în motorul audio al gazdei. */}
      <Route path="/calibrate" element={<CalibratePhone />} />
      {/*
        Motorul audio persistent stă deasupra ambelor ramuri: navigarea între
        mixer și modul Party nu oprește muzica.
      */}
      <Route
        element={
          <DjProvider>
            <Outlet />
          </DjProvider>
        }
      >
        <Route element={<AppLayout />}>
          <Route path="/" element={<Playback />} />
          <Route path="/mixer" element={<Mixer />} />
          <Route path="/appearance" element={<Appearance />} />
          <Route path="/more" element={<More />} />
          <Route path="/start" element={<Start />} />
          <Route path="/library" element={<Library />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/speakers" element={<Speakers />} />
          <Route path="/movie" element={<Movie />} />
          <Route path="/tv" element={<TvPage />} />
          <Route path="/mixes" element={<MyMixes />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/account" element={<Account />} />
          <Route path="/remote" element={<Remote />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/admin/campaigns" element={<AdminCampaigns />} />
        </Route>
        <Route path="/activate" element={<Activate />} />
        <Route
          path="/admin/cards/:batchId"
          element={<Suspense fallback={<PageLoader />}><PremiumCards /></Suspense>}
        />
        <Route path="/party" element={<Suspense fallback={<PageLoader />}><Party /></Suspense>} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <SkinProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <PendingCodePreserver />
            <ErrorBoundary>
              <AuthenticatedApp />
            </ErrorBoundary>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </SkinProvider>
    </AuthProvider>
  )
}

export default App
