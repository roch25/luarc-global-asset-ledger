import { Sidebar } from '@/app/components/layout/Sidebar'

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="bg-background flex min-h-screen flex-col lg:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
