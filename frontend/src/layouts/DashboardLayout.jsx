import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

export default function DashboardLayout({
  children,
  currentTab,
  onSelectTab,
  autoReplyEnabled,
  pollingInterval,
  onToggleAutomation,
  onRefresh,
  onSyncReviews,
  isRefreshing,
  isSyncing,
  businessName,
  adminUser,
  onLogout
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#f6f9fc] overflow-hidden font-sans">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        autoReplyEnabled={autoReplyEnabled}
        pollingInterval={pollingInterval}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          autoReplyEnabled={autoReplyEnabled}
          onToggleAutomation={onToggleAutomation}
          onRefresh={onRefresh}
          onSyncReviews={onSyncReviews}
          isRefreshing={isRefreshing}
          isSyncing={isSyncing}
          businessName={businessName}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          adminUser={adminUser}
          onLogout={onLogout}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 xl:p-7">
          <div className="max-w-[1440px] mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
