import React from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "@/lib/nav";

export default function BottomNav() {
  const primary = NAV_ITEMS.filter((item) => item.mobile);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <nav aria-label="Navigare principală" className="flex items-stretch border-t border-border/70 bg-card/95 pb-safe backdrop-blur-xl">
        {primary.map(({ to, short, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute top-0 h-0.5 w-8 rounded-full transition-opacity ${
                    isActive ? "bg-primary opacity-100" : "opacity-0"
                  }`}
                  aria-hidden="true"
                />
                <Icon className="h-5 w-5" />
                {short}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}