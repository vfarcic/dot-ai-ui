interface LoadingSpinnerProps {
  message?: string
  subMessage?: string
}

export function LoadingSpinner({
  message = 'Generating visualization',
  subMessage = 'This may take a minute or two for complex queries...',
}: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      {/* Spinner */}
      <div className="relative">
        <div className="w-12 h-12 border-4 border-muted rounded-full" />
        <div className="absolute top-0 left-0 w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>

      {/* Messages */}
      <div className="text-center">
        <div className="text-foreground font-medium">{message}</div>
        <div className="text-muted-foreground text-sm mt-1">{subMessage}</div>
      </div>

      {/* Pulsing dots to show activity */}
      <div className="flex gap-1 mt-2">
        <div className="w-2 h-2 bg-brand rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-brand rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-brand rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}
