import { Link, Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-header-bg border-b border-border">
        <Link to="/" className="px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity">
          <img src="/logo.jpeg" alt="DevOps AI Toolkit" className="h-7 sm:h-8 w-auto rounded" />
          <span className="text-xs sm:text-sm font-medium text-primary">DevOps AI Toolkit</span>
        </Link>
      </header>
      <main className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <Outlet />
      </main>
    </div>
  )
}
