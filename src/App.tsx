import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useState, lazy, Suspense } from 'react';

import Header from './components/Header.tsx';

const TetrisGame = lazy(() => import('./pages/TetrisGame.tsx'));
const DailyChallenge = lazy(() => import('./pages/DailyChallenge.tsx'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.tsx'));
const Stats = lazy(() => import('./pages/Stats.tsx'));
const HowToPlay = lazy(() => import('./pages/HowToPlay.tsx'));

function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  
  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };
  
  const openMenu = () => setIsSidebarOpen(true);
  const closeMenu = () => setIsSidebarOpen(false);
  
  // Hide footer on main tetris game for full SPA experience
  const showFooter = location.pathname !== '/';
  
  return (
    <div className="h-screen flex flex-col">
      <Header toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <main className="flex-1 w-full mx-auto flex flex-col">
        <Suspense fallback={<div className="p-4">Loading…</div>}>
          <Routes>
            <Route path="/" element={
              <TetrisGame 
                isSidebarOpen={isSidebarOpen} 
                openMenu={openMenu}
                closeMenu={closeMenu}
              />
            } />
            <Route path="/daily" element={<DailyChallenge />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/how-to-play" element={<HowToPlay />} />
          </Routes>
        </Suspense>
      </main>
      {showFooter && (
        <footer className="p-4 sm:p-6 text-center text-sm text-gray-600">
          © {new Date().getFullYear()} Honeycomb Tetris - A Tetris-Style Word Game
        </footer>
      )}
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
