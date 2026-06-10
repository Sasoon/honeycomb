import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';

import Header from './components/Header.tsx';
import MobileSidebar from './components/MobileSidebar.tsx';

const WaxleGame = lazy(() => import('./pages/WaxleGame.tsx'));
const DailyChallenge = lazy(() => import('./pages/DailyChallenge.tsx'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.tsx'));
const HowToPlay = lazy(() => import('./pages/HowToPlay.tsx'));

const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center py-16">
    <div className="w-8 h-8 rounded-full border-[3px] border-secondary/30 border-t-amber animate-spin" aria-label="Loading" />
  </div>
);

function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const closeMenu = () => setIsSidebarOpen(false);

  return (
    <div className="h-screen flex flex-col">
      <Header toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <MobileSidebar isOpen={isSidebarOpen} onClose={closeMenu} />
      <Toaster
        position="top-center"
        containerStyle={{ top: 78 }}
        toastOptions={{
          duration: 2200,
          style: {
            background: 'var(--bg-primary, #fff)',
            color: 'var(--text-primary, #1f2937)',
            borderRadius: '0.75rem',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            fontWeight: 500,
            fontSize: '0.875rem',
          },
          success: { iconTheme: { primary: '#d97706', secondary: '#fff' } },
        }}
      />
      <main className="flex-1 w-full mx-auto flex flex-col">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<WaxleGame />} />
            <Route path="/classic" element={<WaxleGame />} />
            <Route path="/daily" element={<DailyChallenge />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/how-to-play" element={<HowToPlay />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
