import { Link, useLocation } from 'react-router-dom';
import { useRef, useEffect } from 'react';

type MobileSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const MobileSidebar = ({ isOpen, onClose }: MobileSidebarProps) => {
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  const isActive = (path: string) => location.pathname === path;
  
  // Handle clicking outside the sidebar to close it on mobile
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Only do this on mobile screens
      if (window.innerWidth < 768) {
        // Get the header element
        const headerElement = document.querySelector('header');
        
        // Skip if click is in the header (where the X button is)
        if (headerElement && headerElement.contains(event.target as Node)) {
          return;
        }
        
        if (
          sidebarRef.current && 
          isOpen && 
          !sidebarRef.current.contains(event.target as Node)
        ) {
          onClose();
        }
      }
    }

    // Attach the event listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Clean up the event listener
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle touch swipes for mobile sidebar
  useEffect(() => {
    let touchStartX = 0;
    let touchEndX = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      touchEndX = e.touches[0].clientX;
    };
    
    const handleTouchEnd = () => {
      // Swipe left to close sidebar
      if (touchStartX - touchEndX > 100 && isOpen) {
        onClose();
      }
    };
    
    if (window.innerWidth < 768) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true } as AddEventListenerOptions);
      document.addEventListener('touchmove', handleTouchMove, { passive: true } as AddEventListenerOptions);
      document.addEventListener('touchend', handleTouchEnd, { passive: true } as AddEventListenerOptions);
      
      return () => {
        document.removeEventListener('touchstart', handleTouchStart as any);
        document.removeEventListener('touchmove', handleTouchMove as any);
        document.removeEventListener('touchend', handleTouchEnd as any);
      };
    }
  }, [isOpen, onClose]);
  
  return (
    <>
      {/* Backdrop overlay when menu is open */}
      <div 
        className={`fixed inset-0 bg-black z-40 md:hidden transition-all duration-300 ease-in-out pointer-events-none
          ${isOpen ? 'bg-opacity-30 pointer-events-auto' : 'bg-opacity-0'}`}
        style={{ top: 'var(--header-height)' }}
        onClick={isOpen ? onClose : undefined}
      />
      
      <div 
        ref={sidebarRef}
        className={`mobile-sidebar transition-all duration-300 ease-in-out 
          ${isOpen ? 'w-64' : 'w-0'} 
          bg-white shadow-md z-50 
          fixed
          left-0
          flex flex-col overflow-hidden md:hidden`}
        style={{
          top: 'var(--header-height)',
          height: 'calc(100% - var(--header-height))'
        }}
      >
        {/* Sidebar content */}
        <div className={`${isOpen ? 'flex' : 'hidden'} flex-col h-full py-4 px-3 overflow-y-auto`}>
        {/* Mobile navigation menu */}
        <div className="block">
          <nav className="flex flex-col space-y-2">
            <Link 
              to="/classic" 
              className={`${isActive('/classic') || isActive('/') 
                ? 'bg-primary text-white' 
                : 'text-primary hover:bg-highlight'} px-3 py-2 rounded-lg`}
              onClick={onClose}
            >
              Classic
            </Link>
            <Link 
              to="/daily" 
              className={`${isActive('/daily') 
                ? 'bg-primary text-white' 
                : 'text-primary hover:bg-highlight'} px-3 py-2 rounded-lg`}
              onClick={onClose}
            >
              Daily
            </Link>
            <Link 
              to="/leaderboard" 
              className={`${isActive('/leaderboard') 
                ? 'bg-primary text-white' 
                : 'text-primary hover:bg-highlight'} px-3 py-2 rounded-lg`}
              onClick={onClose}
            >
              Leaderboard
            </Link>
            <Link 
              to="/how-to-play" 
              className={`${isActive('/how-to-play') 
                ? 'bg-primary text-white' 
                : 'text-primary hover:bg-highlight'} px-3 py-2 rounded-lg`}
              onClick={onClose}
            >
              Tutorial
            </Link>
          </nav>
        </div>
      </div>
    </div>
    </>
  );
};

export default MobileSidebar;