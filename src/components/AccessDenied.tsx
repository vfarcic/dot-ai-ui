export function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center max-w-md px-4">
        <div className="text-destructive mb-4 flex justify-center opacity-80">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-2">Access Denied</h2>

        <p className="text-sm text-muted-foreground">
          You don't have permission to view this page. Contact your administrator if you need access.
        </p>
      </div>
    </div>
  )
}
