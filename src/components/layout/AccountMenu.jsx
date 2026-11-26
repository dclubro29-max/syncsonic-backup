import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Palette, ShieldCheck, Ticket, UserRound } from "lucide-react";

/** Singurul avatar al aplicației. Meniul scurt duce la cont, cod și aspect. */
export default function AccountMenu() {
  const { user, logout } = useAuth();
  const initial = (user?.full_name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="fixed right-3 top-3 z-40 md:right-5 md:top-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full border-border/70 bg-card/90 shadow-panel backdrop-blur-xl"
            aria-label={user ? "Meniul contului" : "Conectare și cont"}
            title={user ? "Cont" : "Conectare"}
          >
            {user ? (
              <span className="font-heading text-sm font-semibold text-primary">{initial}</span>
            ) : (
              <UserRound className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {user ? user.full_name || user.email : "Mod local"}
            </span>
            <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">
              {user ? user.email : "Fără cont, datele rămân pe device."}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {user ? (
            <DropdownMenuItem asChild>
              <Link to="/account" className="gap-2">
                <UserRound className="h-4 w-4" />
                Cont
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <Link to="/login" className="gap-2">
                <UserRound className="h-4 w-4" />
                Conectează-te
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to="/activate" className="gap-2">
              <Ticket className="h-4 w-4" />
              Activează un cod
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/appearance" className="gap-2">
              <Palette className="h-4 w-4" />
              Aspect
            </Link>
          </DropdownMenuItem>
          {user?.role === "admin" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/admin/campaigns" className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Campanii și coduri
                </Link>
              </DropdownMenuItem>
            </>
          ) : null}
          {user ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void logout("/")} className="gap-2">
                <LogOut className="h-4 w-4" />
                Deconectare
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
