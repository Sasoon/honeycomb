import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, lazy, Suspense } from 'react';

import Header from './components/Header.tsx';

const Game = lazy(() => import('./pages/Game.tsx'));
const TetrisGame = lazy(() => import('./pages/TetrisGame.tsx'));
const DailyChallenge = lazy(() => import('./pages/DailyChallenge.tsx'));
const Stats = lazy(() => import('./pages/Stats.tsx'));
const HowToPlay = lazy(() => import('./pages/HowToPlay.tsx'));

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };
  
  const openMenu = () => setIsSidebarOpen(true);
  const closeMenu = () => setIsSidebarOpen(false);
  
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <main className="flex-1 w-full mx-auto">
          <Suspense fallback={<div className="p-4">Loading…</div>}>
            <Routes>
              <Route path="/" element={
                <Game 
                  isSidebarOpen={isSidebarOpen} 
                  openMenu={openMenu}
                  closeMenu={closeMenu}
                />
              } />
              <Route path="/tetris" element={
                <TetrisGame 
                  isSidebarOpen={isSidebarOpen} 
                  openMenu={openMenu}
                  closeMenu={closeMenu}
                />
              } />
              <Route path="/daily" element={<DailyChallenge />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/how-to-play" element={<HowToPlay />} />
            </Routes>
          </Suspense>
        </main>
        <footer className="p-4 sm:p-6 text-center text-sm text-gray-600">
          © {new Date().getFullYear()} Honeycomb - A Word-Building Puzzle Game
        </footer>
      </div>
    </Router>
  );
}

export default App;
