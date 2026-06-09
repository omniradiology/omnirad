"use client"

import { Menu, Activity } from 'lucide-react';
import { Button } from '@/components/ui/basic';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
    return (
        <header className="h-16 border-b border-border-primary bg-bg-surface flex items-center px-4 justify-between md:hidden">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={onMenuClick} className="text-text-primary">
                    <Menu className="h-6 w-6" />
                </Button>
                <div className="flex items-center gap-2 text-primary">
                    <Activity className="h-6 w-6" />
                    <span className="text-lg font-bold text-text-heading tracking-tight">OmniRad</span>
                </div>
            </div>
        </header>
    );
}
