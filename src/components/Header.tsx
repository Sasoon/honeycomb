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
  };
  
  return (
    <header className="bg-primary py-4 px-3 shadow-md sticky top-0 z-40">
      <div>
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
            <span className="hidden md:inline">WAXLE</span>
            </Link>
          </div>
          
          {/* Center/Right - Navigation links only on desktop */}
          <div className="flex items-center">
            <Link to="/" className="text-white text-xl font-bold md:hidden">WAXLE</Link>
            <nav className="hidden md:flex flex-wrap justify-center gap-2 ml-6">
              <Link 
                to="/classic" 
                className={`${isActive('/classic') || isActive('/') 
                  ? 'bg-amber text-white' 
                  : 'text-white hover:bg-primary-light/70'} px-3 py-2 rounded-lg`}
              >
                Classic
              </Link>
              <Link 
                to="/daily" 
                className={`${isActive('/daily') 
                  ? 'bg-amber text-white' 
                  : 'text-white hover:bg-primary-light/70'} px-3 py-2 rounded-lg`}
              >
                Daily
              </Link>
              <Link 
                to="/leaderboard" 
                className={`${isActive('/leaderboard') 
                  ? 'bg-amber text-white' 
                  : 'text-white hover:bg-primary-light/70'} px-3 py-2 rounded-lg`}
              >
                Leaderboard
              </Link>
              <Link 
                to="/how-to-play" 
                className={`${isActive('/how-to-play') 
                  ? 'bg-amber text-white' 
                  : 'text-white hover:bg-primary-light/70'} px-3 py-2 rounded-lg`}
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