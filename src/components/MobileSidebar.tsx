import { Link, useLocation } from 'react-router-dom';
import { useRef, useEffect } from 'react';
import { cn } from '../lib/utils';

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
      {/* Fixed backdrop - only show when menu is open */}
      {isOpen && (
        <div 
          className={cn(
            "fixed inset-0 z-40 md:hidden",
            "backdrop-blur-sm bg-black/40 transition-opacity duration-300"
          )}
          style={{ top: 'var(--header-height)' }}
          onClick={onClose}
        />
      )}
      
      {/* Modern sliding sidebar - hidden when closed */}
      <div 
        ref={sidebarRef}
        className={cn(
          "mobile-sidebar transition-all duration-300 ease-out",
          "bg-bg-primary/95 backdrop-blur-xl shadow-2xl shadow-secondary/20", 
          "fixed left-0 flex flex-col overflow-hidden md:hidden z-50",
          "border-r border-secondary/20",
          isOpen ? "w-80 block" : "w-0 hidden"
        )}
        style={{
          top: 'var(--header-height)',
          height: 'calc(100% - var(--header-height))'
        }}
      >
        {/* Sidebar content - only render when open */}
        {isOpen && (
          <div className="flex flex-col h-full py-6 px-4 overflow-y-auto">
            {/* Navigation with modern styling */}
            <nav className="flex flex-col space-y-3">
            <Link 
              to="/classic" 
              className={cn(
                "px-4 py-3 rounded-xl font-medium transition-all duration-200",
                "flex items-center space-x-3",
                isActive('/classic') || isActive('/') 
                  ? 'bg-amber text-white shadow-lg shadow-amber/20' 
                  : 'text-text-primary hover:bg-secondary/10 hover:text-text-primary'
              )}
              onClick={onClose}
            >
              <span>🎯</span>
              <span>Classic</span>
            </Link>
            <Link 
              to="/daily" 
              className={cn(
                "px-4 py-3 rounded-xl font-medium transition-all duration-200",
                "flex items-center space-x-3",
                isActive('/daily')
                  ? 'bg-amber text-white shadow-lg shadow-amber/20' 
                  : 'text-text-primary hover:bg-secondary/10 hover:text-text-primary'
              )}
              onClick={onClose}
            >
              <span>📅</span>
              <span>Daily</span>
            </Link>
            <Link 
              to="/leaderboard" 
              className={cn(
                "px-4 py-3 rounded-xl font-medium transition-all duration-200",
                "flex items-center space-x-3",
                isActive('/leaderboard')
                  ? 'bg-amber text-white shadow-lg shadow-amber/20' 
                  : 'text-text-primary hover:bg-secondary/10 hover:text-text-primary'
              )}
              onClick={onClose}
            >
              <span>🏆</span>
              <span>Leaderboard</span>
            </Link>
            <Link 
              to="/how-to-play" 
              className={cn(
                "px-4 py-3 rounded-xl font-medium transition-all duration-200",
                "flex items-center space-x-3",
                isActive('/how-to-play')
                  ? 'bg-amber text-white shadow-lg shadow-amber/20' 
                  : 'text-text-primary hover:bg-secondary/10 hover:text-text-primary'
              )}
              onClick={onClose}
            >
              <span>❓</span>
              <span>Tutorial</span>
            </Link>
          </nav>
          
          {/* Bottom spacer */}
          <div className="flex-1" />
          
          {/* Optional footer content */}
          <div className="pt-6 border-t border-secondary/20">
            <p className="text-xs text-text-muted text-center">
              Swipe left to close
            </p>
          </div>
        </div>
        )}
      </div>
    </>
  );
};

export default MobileSidebar;