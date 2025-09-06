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
    <header 
      className="bg-accent-light backdrop-blur-sm py-4 px-4 shadow-lg shadow-secondary/10 sticky top-0 z-40 border-accent/20 transition-[background-color,box-shadow,border-color] duration-300 ease-in-out"
      style={{ height: 'var(--header-height)' }}
    >
      <div className="max-w-7xl mx-auto h-full">
        <div className="flex justify-between items-center relative h-full">
          {/* Left side - Hamburger on mobile */}
          <div className="flex items-center space-x-4">
            {/* Modern hamburger menu button */}
            <button 
              className={cn(
                "p-2 text-white md:hidden rounded-xl transition-[background-color,transform] duration-200",
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
          </div>
          
          {/* Animated WAXLE logo - slides smoothly from right (mobile) to left (desktop) */}
          <Link 
            to="/" 
            className="waxle-logo text-white font-bold flex items-center hover:opacity-90 absolute left-full md:left-0 transform -translate-x-full md:translate-x-0 transition-[left,transform,font-size] duration-500 ease-in-out text-xl md:text-2xl z-10"
            style={{
              willChange: 'left, transform, font-size'
            }}
          >
            WAXLE
          </Link>
          
          {/* Right - Navigation */}
          <div className="flex items-center space-x-6">
            
            {/* Desktop navigation with modern nav pills and chained slide animation */}
            <nav className="hidden md:flex items-center space-x-1 h-full">
              <div 
                className="nav-link-chain flex items-center h-full"
                style={{
                  animationDelay: '50ms'
                }}
              >
                <Link 
                  to="/classic" 
                  className={cn(
                    "px-4 py-2 rounded-xl font-medium transition-[background-color,color,transform] duration-200 text-sm",
                    isActive('/classic') || isActive('/') 
                      ? 'bg-accent-dark text-white shadow-lg shadow-accent/20' 
                      : 'text-white hover:text-white hover:bg-accent-dark/50'
                  )}
                >
                  Classic
                </Link>
              </div>
              <div 
                className="nav-link-chain flex items-center h-full"
                style={{
                  animationDelay: '100ms'
                }}
              >
                <Link 
                  to="/daily" 
                  className={cn(
                    "px-4 py-2 rounded-xl font-medium transition-[background-color,color,transform] duration-200 text-sm",
                    isActive('/daily')
                      ? 'bg-accent-dark text-white shadow-lg shadow-accent/20' 
                      : 'text-white hover:text-white hover:bg-accent-dark/50'
                  )}
                >
                  Daily
                </Link>
              </div>
              <div 
                className="nav-link-chain flex items-center h-full"
                style={{
                  animationDelay: '150ms'
                }}
              >
                <Link 
                  to="/leaderboard" 
                  className={cn(
                    "px-4 py-2 rounded-xl font-medium transition-[background-color,color,transform] duration-200 text-sm",
                    isActive('/leaderboard')
                      ? 'bg-accent-dark text-white shadow-lg shadow-accent/20' 
                      : 'text-white hover:text-white hover:bg-accent-dark/50'
                  )}
                >
                  Leaderboard
                </Link>
              </div>
              <div 
                className="nav-link-chain flex items-center h-full"
                style={{
                  animationDelay: '200ms'
                }}
              >
                <Link 
                  to="/how-to-play" 
                  className={cn(
                    "px-4 py-2 rounded-xl font-medium transition-[background-color,color,transform] duration-200 text-sm",
                    isActive('/how-to-play')
                      ? 'bg-accent-dark text-white shadow-lg shadow-accent/20' 
                      : 'text-white hover:text-white hover:bg-accent-dark/50'
                  )}
                >
                  Tutorial
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 