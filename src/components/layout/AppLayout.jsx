import React, { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import AccountMenu from "@/components/layout/AccountMenu";
import MiniPlayer from "@/components/layout/MiniPlayer";
import ContextHeader from "@/components/layout/ContextHeader";
import GlobalDropZone from "@/components/GlobalDropZone";
import ErrorBoundary from "@/components/ErrorBoundary";
import PulseBackground from "@/components/pulse/PulseBackground";
import PageLoader from "@/components/layout/PageLoader";

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PulseBackground />
      <div className="pointer-events-none fixed inset-0 studio-ambient" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 studio-grid" aria-hidden="true" />

      <Sidebar />
      <AccountMenu />
      <div className="relative md:pl-64">
        <ContextHeader />
        <main className="mx-auto max-w-[1440px] px-4 pb-40 pt-16 sm:px-6 md:pb-28 md:pt-6 lg:px-8">
          <div key={location.pathname} className="page-enter">
            {/* Cheia repornește protecția la fiecare schimbare de pagină. */}
            <ErrorBoundary key={location.pathname}>
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <MiniPlayer />
      <BottomNav />
      <GlobalDropZone />
    </div>
  );
}