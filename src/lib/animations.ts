// Minimal, low-tone animation utilities for the booking flow

export const animationVariants = {
  // Fade in with slight upward movement
  fadeInUp: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: 'easeOut' }
  },
  
  // Fade in with slight scale
  fadeInScale: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  
  // Slide in from right (for step transitions)
  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.35, ease: 'easeOut' }
  },
  
  // Slide in from left
  slideInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.35, ease: 'easeOut' }
  },
  
  // Stagger children animation
  staggerContainer: {
    animate: {
      transition: {
        staggerChildren: 0.08
      }
    }
  },
  
  // Subtle pulse for loading states
  pulse: {
    animate: {
      scale: [1, 1.02, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  }
};

// CSS classes for animations (using Tailwind + custom CSS)
export const animationClasses = {
  fadeInUp: 'animate-fade-in-up',
  fadeInScale: 'animate-fade-in-scale',
  slideInRight: 'animate-slide-in-right',
  slideInLeft: 'animate-slide-in-left',
  stagger: 'animate-stagger',
  float: 'animate-float',
  shimmer: 'animate-shimmer'
};

