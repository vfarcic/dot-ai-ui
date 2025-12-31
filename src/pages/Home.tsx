export function Home() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] sm:min-h-[60vh]">
      <div className="text-center max-w-lg px-2 sm:px-4">
        <div className="mb-4 sm:mb-6 flex justify-center">
          <svg
            className="w-12 h-12 sm:w-16 sm:h-16 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            />
          </svg>
        </div>

        <h1 className="text-xl sm:text-2xl font-semibold text-foreground mb-2 sm:mb-3">
          Visualization Companion
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
          This site renders visualizations for{' '}
          <a
            href="https://devopstoolkit.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            DevOps AI Toolkit MCP
          </a>{' '}
          tool responses. It displays diagrams, tables, code blocks, and other
          rich content that text-based terminals cannot show.
        </p>

        <div className="bg-muted/50 border border-border rounded-lg p-3 sm:p-4 text-left">
          <h2 className="text-sm font-medium text-foreground mb-2">
            How to use
          </h2>
          <ol className="text-xs sm:text-sm text-muted-foreground space-y-2">
            <li className="flex gap-2">
              <span className="text-primary font-medium flex-shrink-0">1.</span>
              <span>Use DevOps AI Toolkit MCP from your preferred client (Claude Code, Cursor, etc.)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-medium flex-shrink-0">2.</span>
              <span>The MCP response will include a visualization URL</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-medium flex-shrink-0">3.</span>
              <span>Open that URL to see the visual representation</span>
            </li>
          </ol>
        </div>

        <p className="text-xs text-muted-foreground mt-4 sm:mt-6">
          Visualization URLs are temporary and tied to specific query sessions.
        </p>
      </div>
    </div>
  )
}
