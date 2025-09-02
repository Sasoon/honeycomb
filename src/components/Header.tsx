import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';

type HeaderProps = {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
};

const Header = ({ toggleSidebar, isSidebarOpen }: HeaderProps) => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  const handleMenuClick = (e: React.MouseEvent) => {
    // Stop event propagation to prevent click outside from triggering
    e.stopPropagation();
    toggleSidebar();
  };
  
  return (
    <header className="bg-accent-light backdrop-blur-sm py-4 px-4 shadow-lg shadow-secondary/10 sticky top-0 z-40 border-accent/20">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          {/* Left side - Hamburger on mobile/tablet, Logo on desktop */}
          <div className="flex items-center space-x-4">
            {/* Modern hamburger menu button */}
            <button 
              className={cn(
                "p-2 text-white md:hidden rounded-xl transition-all duration-200",
                "hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30",
                "active:scale-95"
              )}
              onClick={handleMenuClick}
              aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
            >
              {isSidebarOpen ? (
                <X size={20} />
              ) : (
                <Menu size={20} />
              )}
            </button>
            
            {/* Logo */}
            <Link 
              to="/" 
              className="text-white text-2xl font-bold flex items-center hover:opacity-90 transition-opacity"
            >
              <span className="hidden md:inline">WAXLE</span>
            </Link>
          </div>
          
          {/* Center/Right - Navigation */}
          <div className="flex items-center space-x-6">
            {/* Mobile logo */}
            <Link 
              to="/" 
              className="text-white text-xl font-bold md:hidden hover:opacity-90 transition-opacity"
            >
              WAXLE
            </Link>
            
            {/* Desktop navigation with modern nav pills */}
            <nav className="hidden md:flex items-center space-x-1">
              <Link 
                to="/classic" 
                className={cn(
                  "px-4 py-2 rounded-xl font-medium transition-all duration-200 text-sm",
                  isActive('/classic') || isActive('/') 
                    ? 'bg-accent-dark text-white shadow-lg shadow-accent/20' 
                    : 'text-white hover:text-white hover:bg-accent-dark/50'
                )}
              >
                Classic
              </Link>
              <Link 
                to="/daily" 
                className={cn(
                  "px-4 py-2 rounded-xl font-medium transition-all duration-200 text-sm",
                  isActive('/daily')
                    ? 'bg-accent-dark text-white shadow-lg shadow-accent/20' 
                    : 'text-white hover:text-white hover:bg-accent-dark/50'
                )}
              >
                Daily
              </Link>
              <Link 
                to="/leaderboard" 
                className={cn(
                  "px-4 py-2 rounded-xl font-medium transition-all duration-200 text-sm",
                  isActive('/leaderboard')
                    ? 'bg-accent-dark text-white shadow-lg shadow-accent/20' 
                    : 'text-white hover:text-white hover:bg-accent-dark/50'
                )}
              >
                Leaderboard
              </Link>
              <Link 
                to="/how-to-play" 
                className={cn(
                  "px-4 py-2 rounded-xl font-medium transition-all duration-200 text-sm",
                  isActive('/how-to-play')
                    ? 'bg-accent-dark text-white shadow-lg shadow-accent/20' 
                    : 'text-white hover:text-white hover:bg-accent-dark/50'
                )}
              >
                Tutorial
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 