'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { OrgProvider } from '@/contexts/OrgContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { ToastProvider } from '@/components/ui/Toast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OrgProvider>
        <ToastProvider>
          <div className="min-h-screen bg-slate-50">
            <Sidebar />
            <div className="md:pl-64">
              <Header />
              <main className="p-4 md:p-6 pb-24 md:pb-6">
                {children}
              </main>
            </div>
            <MobileNav />
          </div>
        </ToastProvider>
      </OrgProvider>
    </AuthProvider>
  );
}
