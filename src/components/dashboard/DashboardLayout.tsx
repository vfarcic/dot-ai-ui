import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardSidebar } from './DashboardSidebar'
import { NamespaceSelector } from './NamespaceSelector'
import { ResourceList } from './ResourceList'

export function DashboardLayout() {
  const [selectedKind, setSelectedKind] = useState<string | null>(null)
  const [selectedApiGroup, setSelectedApiGroup] = useState<string | null>(null)
  const [selectedNamespace, setSelectedNamespace] = useState('All Namespaces')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleSelectKind = (kind: string, apiGroup: string) => {
    setSelectedKind(kind)
    setSelectedApiGroup(apiGroup)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-header-bg border-b border-border px-3 sm:px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity"
          >
            <img
              src="/logo.jpeg"
              alt="DevOps AI Toolkit"
              className="h-7 sm:h-8 w-auto rounded"
            />
            <span className="text-xs sm:text-sm font-medium text-primary">
              DevOps AI Toolkit
            </span>
          </Link>
          <span className="text-border">|</span>
          <span className="text-sm font-medium text-foreground">Dashboard</span>
        </div>
        <NamespaceSelector
          value={selectedNamespace}
          onChange={setSelectedNamespace}
        />
      </header>

      {/* Main content with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <DashboardSidebar
          selectedKind={selectedKind}
          selectedApiGroup={selectedApiGroup}
          onSelectKind={handleSelectKind}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Content area */}
        <main className="flex-1 overflow-auto">
          {selectedKind ? (
            <>
              {/* Content header */}
              <div className="border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-semibold text-foreground">
                      {selectedKind}
                      {selectedApiGroup && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          ({selectedApiGroup})
                        </span>
                      )}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {selectedNamespace === 'All Namespaces'
                        ? 'Showing resources across all namespaces'
                        : `Showing resources in ${selectedNamespace}`}
                    </p>
                  </div>

                  {/* AI Actions placeholder - will be functional later */}
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-not-allowed opacity-50"
                      disabled
                      title="Coming soon: Ask AI about these resources"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Query
                    </button>
                    <button
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-not-allowed opacity-50"
                      disabled
                      title="Coming soon: AI-powered remediation"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                        />
                      </svg>
                      Remediate
                    </button>
                  </div>
                </div>
              </div>

              {/* Resource list */}
              <div className="p-6">
                <div className="bg-muted/30 border border-border rounded-lg overflow-hidden">
                  <ResourceList kind={selectedKind} namespace={selectedNamespace} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <svg
                  className="w-16 h-16 mx-auto mb-4 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <p className="text-lg">Select a resource type from the sidebar</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
