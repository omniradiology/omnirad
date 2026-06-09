"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/setup');
    const isSettingsPage = pathname?.startsWith('/settings');

    if (isAuthPage) {
        return (
            <main className="flex-1 w-full h-full overflow-auto bg-bg-secondary">
                {children}
            </main>
        );
    }

    if (isSettingsPage) {
        return (
            <main className="flex-1 w-full h-full overflow-hidden bg-bg-primary">
                {children}
            </main>
        );
    }

    return (
        <>
            <Header />
            <div className="hidden md:block z-50">
                <Sidebar />
            </div>
            <main className="flex-1 md:ml-20 h-full overflow-auto relative w-full">
                {children}
            </main>
        </>
    );
}
