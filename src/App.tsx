import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from 'react';

import Header from './components/Header.tsx';
import Game from './pages/Game.tsx';
import TetrisGame from './pages/TetrisGame.tsx';
import DailyChallenge from './pages/DailyChallenge.tsx';
import Stats from './pages/Stats.tsx';
import HowToPlay from './pages/HowToPlay.tsx';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const toggleSidebar = () => {
    const newState = !isSidebarOpen;
    console.log(`Toggling sidebar from ${isSidebarOpen} to ${newState}`);
    setIsSidebarOpen(newState);
  };
  
  const openMenu = () => setIsSidebarOpen(true);
  const closeMenu = () => setIsSidebarOpen(false);
  
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <main className="flex-1 w-full mx-auto">
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
        </main>
        <footer className="p-4 sm:p-6 text-center text-sm text-gray-600">
          © {new Date().getFullYear()} Honeycomb - A Word-Building Puzzle Game
        </footer>
      </div>
    </Router>
  );
}

export default App;
