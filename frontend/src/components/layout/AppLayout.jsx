import { Outlet } from "react-router-dom";

import MobileNav from "./MobileNav.jsx";
import Sidebar from "./Sidebar.jsx";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <MobileNav />
      <main className="md:pl-64">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
