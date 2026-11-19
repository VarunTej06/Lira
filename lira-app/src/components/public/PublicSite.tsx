import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PublicLayout } from './PublicLayout';

const LandingPage = lazy(() => import('./LandingPage'));
const AuthPage = lazy(() => import('./AuthPage'));
const GetStartedPage = lazy(() => import('./GetStartedPage'));
const LegalPage = lazy(() => import('./LegalPage'));
const ComingSoonPage = lazy(() => import('./ComingSoonPage'));

/** The tab title of each public address. The legal pages set their own from their text. */
const PUBLIC_TITLES: Readonly<Record<string, string>> = {
  '/': 'Liraspaces',
  '/login': 'Log in to continue · Liraspaces',
  '/signup': 'Get started · Liraspaces',
  '/coming-soon': 'Coming soon · Liraspaces',
};

/** The public pages of the hosted edition: landing, log in, sign up, the legal pages, and the coming-soon page. */
export function PublicSite() {
  const { pathname } = useLocation();
  useEffect(() => { if (PUBLIC_TITLES[pathname]) document.title = PUBLIC_TITLES[pathname]; }, [pathname]);
  return (
    <PublicLayout>
      <Suspense fallback={<p role="status" className="p-10 text-lira-muted">Loading</p>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<GetStartedPage />} />
          <Route path="/terms" element={<LegalPage doc="terms" />} />
          <Route path="/privacy" element={<LegalPage doc="privacy" />} />
          <Route path="/notice" element={<LegalPage doc="notice" />} />
          <Route path="/coming-soon" element={<ComingSoonPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </PublicLayout>
  );
}
