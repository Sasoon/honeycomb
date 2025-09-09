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
  
  // Set CSS custom property for header height on mount (more efficient than state)
  useEffect(() => {
    const updateHeaderHeight = () => {
      const headerElement = document.querySelector('header');
      if (headerElement) {
        const height = headerElement.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };
    
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  }, []);
  
  // Consolidated event handling for better performance (touch + click outside)
  useEffect(() => {
    if (!isOpen || window.innerWidth >= 768) return;
    
    let touchStartX = 0;
    let touchEndX = 0;
    
    const handleClickOutside = (event: MouseEvent) => {
      const headerElement = document.querySelector('header');
      
      // Skip if click is in the header (where the toggle button is)
      if (headerElement && headerElement.contains(event.target as Node)) {
        return;
      }
      
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    function handleTouchStart(e: TouchEvent) {
      touchStartX = e.touches[0].clientX;
    }
    
    function handleTouchMove(e: TouchEvent) {
      touchEndX = e.touches[0].clientX;
    }
    
    function handleTouchEnd() {
      // Swipe left to close sidebar (100px threshold)
      if (touchStartX - touchEndX > 100) {
        onClose();
      }
    }
    
    // Add all event listeners
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      // Cleanup all listeners
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, onClose]);
  
  return (
    <>
      {/* CSS-only animated backdrop */}
      <div 
        className={cn(
          "mobile-sidebar-backdrop md:hidden",
          isOpen && "show"
        )}
        style={{ top: 'var(--header-height, 68px)' }}
        onClick={onClose}
      />
      
      {/* CSS-only animated sliding sidebar with glass effect */}
      <div 
        ref={sidebarRef}
        className={cn(
          "mobile-sidebar md:hidden flex flex-col overflow-hidden",
          "bg-bg-primary/95 backdrop-blur-sm",
          "shadow-xl shadow-secondary/20",
          "border-r border-secondary/20",
          isOpen && "show"
        )}
        style={{
          top: 'var(--header-height, 68px)',
          height: 'calc(100vh - var(--header-height, 68px))'
        }}
      >
        {/* Sidebar content with CSS animations */}
        <div className="mobile-sidebar-content flex flex-col h-full py-6 px-4 overflow-y-auto">
          {/* Navigation with staggered CSS animations */}
          <nav className="flex flex-col space-y-3">
            {[
              { to: '/classic', label: 'Classic', isActive: isActive('/classic') || isActive('/') },
              { to: '/daily', label: 'Daily', isActive: isActive('/daily') },
              { to: '/leaderboard', label: 'Leaderboard', isActive: isActive('/leaderboard') },
              { to: '/how-to-play', label: 'Tutorial', isActive: isActive('/how-to-play') }
            ].map((item) => (
              <div key={item.to} className="mobile-sidebar-nav-item">
                <Link 
                  to={item.to} 
                  className={cn(
                    "px-4 py-3 rounded-xl font-medium transition-standard",
                    "flex items-center space-x-3 relative group",
                    "border border-transparent",
                    item.isActive
                      ? 'bg-accent-dark text-white shadow-lg shadow-accent/20'
                      : cn(
                          'text-text-primary',
                          'hover:bg-gradient-to-r hover:from-secondary/5 hover:via-secondary/10 hover:to-secondary/5',
                          'hover:border-secondary/20 hover:shadow-lg hover:shadow-secondary/10',
                          'hover:text-text-primary hover:scale-[1.02]',
                          'active:scale-[0.98] active:shadow-sm'
                        )
                  )}
                  onClick={onClose}
                >
                  <span className={cn(
                    "transition-standard relative z-10",
                    item.isActive && "drop-shadow-sm font-semibold",
                    !item.isActive && "group-hover:translate-x-0.5"
                  )}>
                    {item.label}
                  </span>
                </Link>
              </div>
            ))}
          </nav>
          
          {/* Bottom spacer */}
          <div className="flex-1" />
          
          {/* Footer content with CSS animation */}
          <div className="mobile-sidebar-footer pt-6 border-t border-secondary/20">
            <p className="text-xs text-text-muted text-center">
              Swipe left to close
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileSidebar;