import { Link, useLocation } from 'react-router-dom';

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
    console.log(`Menu button clicked, sidebar should be ${!isSidebarOpen}`);
  };
  
  return (
    <header className="bg-honeycomb p-4 sm:p-5 shadow-md sticky top-0 z-40">
      <div className="container mx-auto">
        <div className="flex justify-between items-center">
          {/* Left side - Hamburger on mobile/tablet, Logo on desktop */}
          <div className="flex items-center">
            {/* Hamburger menu for mobile/tablet - transforms to X when open */}
            <button 
              className="text-white mr-4 md:hidden focus:outline-none"
              onClick={handleMenuClick}
              aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
            >
              {isSidebarOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              )}
            </button>
            
            {/* Logo always visible */}
            <Link to="/" className="text-white text-2xl font-bold flex items-center">
              🍯 <span className="hidden md:inline">Honeycomb</span>
            </Link>
          </div>
          
          {/* Center/Right - Navigation links only on desktop */}
          <div className="flex items-center">
            <span className="text-white text-xl font-bold md:hidden">Honeycomb</span>
            <nav className="hidden md:flex flex-wrap justify-center gap-2 ml-6">
              <Link 
                to="/" 
                className={`px-3 py-2 rounded-lg ${isActive('/') 
                  ? 'bg-honeycomb-dark text-white' 
                  : 'text-white hover:bg-honeycomb-dark/70'}`}
              >
                Play
              </Link>
              <Link 
                to="/daily" 
                className={`px-3 py-2 rounded-lg ${isActive('/daily') 
                  ? 'bg-honeycomb-dark text-white' 
                  : 'text-white hover:bg-honeycomb-dark/70'}`}
              >
                Daily
              </Link>
              <Link 
                to="/stats" 
                className={`px-3 py-2 rounded-lg ${isActive('/stats') 
                  ? 'bg-honeycomb-dark text-white' 
                  : 'text-white hover:bg-honeycomb-dark/70'}`}
              >
                Stats
              </Link>
              <Link 
                to="/how-to-play" 
                className={`px-3 py-2 rounded-lg ${isActive('/how-to-play') 
                  ? 'bg-honeycomb-dark text-white' 
                  : 'text-white hover:bg-honeycomb-dark/70'}`}
              >
                How to Play
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 