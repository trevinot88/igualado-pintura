import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
          {children}
        </main>
      </div>
    </Providers>
  );
}
