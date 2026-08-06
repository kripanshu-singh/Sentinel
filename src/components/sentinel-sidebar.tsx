"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  ScrollText,
  Settings,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Agent Runs", href: "/runs", icon: Bot },
  { label: "Procurement Logs", href: "/logs", icon: ScrollText },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function SentinelSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      {/* Header with logo & title */}
      <SidebarHeader className="py-6 px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <ShieldCheck className="size-4 text-primary-foreground" />
          </div>
          {state === "expanded" && (
            <div className="flex flex-col min-w-0 transition-opacity duration-200">
              <span className="text-sm font-semibold text-primary leading-none truncate">
                Sentinel
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5 truncate">
                Enterprise Admin
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Navigation items */}
      <SidebarContent className="px-2">
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={item.label}
                  render={<Link href={item.href} />}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary/5 text-primary font-semibold border-l-2 border-primary rounded-l-none"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer CTA */}
      <SidebarFooter className="p-4">
        {state === "expanded" ? (
          <Link
            href="/"
            className={cn(buttonVariants({ size: "sm" }), "w-full gap-2")}
          >
            <Plus className="size-4" />
            New Goal
          </Link>
        ) : (
          <SidebarMenuButton
            tooltip="New Goal"
            render={<Link href="/" />}
            className="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 hover:text-primary-foreground transition-colors mx-auto"
          >
            <Plus className="size-4 shrink-0" />
          </SidebarMenuButton>
        )}
      </SidebarFooter>

      {/* Interactive collapse rail handler */}
      <SidebarRail />
    </Sidebar>
  );
}
