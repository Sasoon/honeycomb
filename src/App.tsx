import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, lazy, Suspense } from 'react';

import Header from './components/Header.tsx';
import MobileSidebar from './components/MobileSidebar.tsx';

const TetrisGame = lazy(() => import('./pages/TetrisGame.tsx'));
const DailyChallenge = lazy(() => import('./pages/DailyChallenge.tsx'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.tsx'));
const Stats = lazy(() => import('./pages/Stats.tsx'));
const HowToPlay = lazy(() => import('./pages/HowToPlay.tsx'));

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
      <main className="flex-1 w-full mx-auto flex flex-col">
        <Suspense fallback={<div className="p-4">Loading…</div>}>
          <Routes>
            <Route path="/" element={<TetrisGame />} />
            <Route path="/daily" element={<DailyChallenge />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/stats" element={<Stats />} />
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
