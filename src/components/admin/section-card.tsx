'use client';

import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
}

export function SectionCard({ 
  title, 
  description, 
  children, 
  className,
  headerActions 
}: SectionCardProps) {
  return (
    <Card className={cn('rounded-xl border border-border shadow-sm bg-white', className)}>
      <CardHeader className="pb-3 md:pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base md:text-lg font-semibold">{title}</CardTitle>
            {description && (
              <p className="text-xs md:text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}







