import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset } from "@/components/ui/sidebar";
import { SentinelNavbar } from "@/components/sentinel-navbar";

export default function RunLoading() {
  return (
    <SidebarInset className="h-dvh overflow-hidden flex flex-col">
      <SentinelNavbar breadcrumbs={[{ label: "…" }]} />
      <main className="flex-1 flex flex-col gap-5 p-6 overflow-hidden min-h-0">
        <Skeleton className="h-12 w-full shrink-0" />
        <div className="flex-1 grid grid-cols-12 gap-5 min-h-0">
          <Skeleton className="col-span-3 h-full" />
          <Skeleton className="col-span-6 h-full" />
          <div className="col-span-3 flex flex-col gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      </main>
    </SidebarInset>
  );
}