import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './lib/auth';

// Eagerly loaded (small, common pages)
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AcceptInvite from './pages/AcceptInvite';
import Dashboard from './pages/Dashboard';

// Lazy loaded (heavy pages)
const Users = lazy(() => import('./pages/Users'));
const SocialAccounts = lazy(() => import('./pages/SocialAccounts'));
const MediaLibrary = lazy(() => import('./pages/MediaLibrary'));
const Posts = lazy(() => import('./pages/Posts'));
const PostEditor = lazy(() => import('./pages/PostEditor'));
const Calendar = lazy(() => import('./pages/Calendar'));
const AIGenerate = lazy(() => import('./pages/AIGenerate'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Admin = lazy(() => import('./pages/Admin'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function Home() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    window.location.replace('/landing.html');
    return null;
  }

  return <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/invite" element={<AcceptInvite />} />

        {/* Authenticated routes */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/users"
            element={
              <ProtectedRoute roles={['OWNER', 'ADMIN']}>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="/social-accounts"
            element={
              <ProtectedRoute roles={['OWNER', 'ADMIN']}>
                <SocialAccounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/media"
            element={
              <ProtectedRoute roles={['OWNER', 'ADMIN', 'EDITOR']}>
                <MediaLibrary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/posts"
            element={
              <ProtectedRoute roles={['OWNER', 'ADMIN', 'EDITOR']}>
                <Posts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/posts/new"
            element={
              <ProtectedRoute roles={['OWNER', 'ADMIN', 'EDITOR']}>
                <PostEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/posts/:id/edit"
            element={
              <ProtectedRoute roles={['OWNER', 'ADMIN', 'EDITOR']}>
                <PostEditor />
              </ProtectedRoute>
            }
          />
          <Route path="/calendar" element={<Calendar />} />
          <Route
            path="/ai"
            element={
              <ProtectedRoute roles={['OWNER', 'ADMIN', 'EDITOR']}>
                <AIGenerate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/approvals"
            element={
              <ProtectedRoute roles={['OWNER', 'ADMIN', 'APPROVER']}>
                <Approvals />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute roles={['OWNER', 'ADMIN', 'EDITOR']}>
                <Inbox />
              </ProtectedRoute>
            }
          />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
