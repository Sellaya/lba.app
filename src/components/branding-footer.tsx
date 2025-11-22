import Link from 'next/link';

export function BrandingFooter() {
  return (
    <footer className="py-6 text-center text-muted-foreground text-sm font-body border-t border-border/50 mt-auto">
      <p>
        © 2025 Looks by Anum | Product by{' '}
        <Link 
          href="https://www.instagram.com/sellayadigital" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-primary hover:underline transition-colors font-medium"
        >
          Sellaya
        </Link>
      </p>
    </footer>
  );
}












