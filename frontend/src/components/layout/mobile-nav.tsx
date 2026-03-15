"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  CalendarDays,
  UtensilsCrossed,
  User,
} from "lucide-react";

const mobileItems = [
  { href: "/", label: "首页", icon: LayoutDashboard },
  { href: "/chat", label: "AI问答", icon: MessageSquare },
  { href: "/academic/schedule", label: "课表", icon: CalendarDays },
  { href: "/food/canteen", label: "食堂", icon: UtensilsCrossed },
  { href: "/settings", label: "我的", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-white/90 backdrop-blur-lg dark:bg-gray-950/90 md:hidden">
      <div className="mx-auto flex max-w-md">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-[#C41230]"
                  : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                isActive && "bg-[#C41230]/10"
              )}>
                <Icon className={cn("h-[18px] w-[18px]", isActive && "text-[#C41230]")} />
              </div>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
