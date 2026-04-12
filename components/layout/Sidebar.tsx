"use client"

import Image from 'next/image';
import { FileText, LayoutDashboard, Settings, User, Users, Clock, LogOut, Server, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="fixed left-0 top-0 h-screen w-20 bg-bg-surface border-r border-border-primary flex flex-col items-center py-6 z-50 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
      <div className="mb-8 relative w-16 h-16">
        <Image
          src="/logo.svg"
          alt="OpenRad Logo"
          fill
          className="object-contain"
          priority
        />
      </div>

      <nav className="flex-1 flex flex-col gap-3 w-full px-3">
        <NavItem
          href="/"
          icon={LayoutDashboard}
          label="Dashboard"
          isActive={pathname === '/'}
        />
        <NavItem
          href="/patients"
          icon={Users}
          label="Patients"
          isActive={pathname.startsWith('/patients')}
        />
        <NavItem
          href="/reports"
          icon={FileText}
          label="Reports"
          isActive={pathname.startsWith('/reports')}
        />
        <NavItem
          href="/history"
          icon={Clock}
          label="History"
          isActive={pathname.startsWith('/history')}
        />
        <NavItem
          href="/pacs"
          icon={Server}
          label="PACS Browser"
          isActive={pathname.startsWith('/pacs')}
        />
        <NavItem
          href="/copilot"
          icon={MessageSquare}
          label="AI Copilot"
          isActive={pathname.startsWith('/copilot')}
        />
        <div className="flex-1" /> {/* Spacer */}
        <NavItem
          href="/settings"
          icon={Settings}
          label="Settings"
          isActive={pathname.startsWith('/settings')}
        />
        <NavItem
          href="/profile"
          icon={User}
          label="Profile"
          isActive={pathname.startsWith('/profile')}
        />
      </nav>

      <div className="mt-4 pb-4 px-3 w-full">
        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
          }}
          className="relative group flex w-full items-center justify-center p-3 rounded-xl transition-all duration-300 ease-out text-text-muted hover:bg-red-500/10 hover:text-red-500 hover:scale-105"
          title="Logout"
        >
          <LogOut size={22} className="transition-transform duration-300 group-hover:stroke-[2.5px]" />
          <span className="absolute left-16 bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 shadow-xl z-50 whitespace-nowrap">
            Logout
            <span className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45"></span>
          </span>
        </button>
      </div>
    </aside>
  );
}

function NavItem({ href, icon: Icon, label, isActive }: { href: string; icon: any; label: string; isActive?: boolean }) {
  return (
    <Link
      href={href}
      className={`
        relative group flex items-center justify-center p-3 rounded-xl transition-all duration-300 ease-out
        ${isActive
          ? 'bg-primary text-white shadow-md shadow-primary/25 scale-105'
          : 'text-text-muted hover:bg-primary/10 hover:text-primary hover:scale-105'
        }
      `}
      title={label}
    >
      <Icon size={22} className={`transition-transform duration-300 ${isActive ? 'stroke-[2.5px]' : 'group-hover:stroke-[2.5px]'}`} />

      {/* Tooltip Label */}
      <span className="absolute left-16 bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 shadow-xl z-50 whitespace-nowrap">
        {label}
        {/* Little arrow pointing left */}
        <span className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45"></span>
      </span>
    </Link>
  );
}
