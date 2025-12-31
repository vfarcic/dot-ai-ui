import { Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-header-bg border-b border-border">
        <div className="px-4 py-2 flex items-center gap-3">
          <img src="/logo.jpeg" alt="DevOps AI Toolkit" className="h-8 w-auto rounded" />
          <span className="text-sm font-medium text-primary">DevOps AI Toolkit</span>
        </div>
      </header>
      <main className="px-4 py-4">
        <Outlet />
      </main>
    </div>
  )
}
