import type { BarChartContent, StatusIndicator } from '@/types'

interface BarChartRendererProps {
  content: BarChartContent
}

function getBarColor(status?: StatusIndicator): string {
  switch (status) {
    case 'error':
      return 'bg-red-500'
    case 'warning':
      return 'bg-yellow-500'
    case 'ok':
      return 'bg-green-500'
    default:
      return 'bg-blue-500'
  }
}

function getBarBackground(status?: StatusIndicator): string {
  switch (status) {
    case 'error':
      return 'bg-red-500/20'
    case 'warning':
      return 'bg-yellow-500/20'
    case 'ok':
      return 'bg-green-500/20'
    default:
      return 'bg-muted/30'
  }
}

export function BarChartRenderer({ content }: BarChartRendererProps) {
  if (!content.data || content.data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No data to display
      </div>
    )
  }

  const { data, unit, orientation = 'horizontal', title } = content

  // Calculate max value for percentage calculation
  const maxValue = Math.max(...data.map(bar => bar.max ?? bar.value))

  if (orientation === 'vertical') {
    return (
      <div className="space-y-4">
        {title && (
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
        )}
        <div className="flex items-end justify-around gap-4 h-48 px-4">
          {data.map((bar, index) => {
            const percentage = maxValue > 0 ? (bar.value / (bar.max ?? maxValue)) * 100 : 0
            const barColor = getBarColor(bar.status)
            const barBg = getBarBackground(bar.status)

            return (
              <div key={index} className="flex flex-col items-center gap-2 flex-1 max-w-24">
                <span className="text-xs text-muted-foreground">
                  {bar.value}{unit ? ` ${unit}` : ''}
                </span>
                <div className={`w-full rounded-t-sm ${barBg} relative flex-1`}>
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-t-sm ${barColor} transition-all duration-300`}
                    style={{ height: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground text-center truncate w-full" title={bar.label}>
                  {bar.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Horizontal (default)
  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      )}
      <div className="space-y-3">
        {data.map((bar, index) => {
          const percentage = maxValue > 0 ? (bar.value / (bar.max ?? maxValue)) * 100 : 0
          const barColor = getBarColor(bar.status)
          const barBg = getBarBackground(bar.status)

          return (
            <div key={index} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate" title={bar.label}>
                  {bar.label}
                </span>
                <span className="text-foreground font-medium ml-2">
                  {bar.value}{unit ? ` ${unit}` : ''}
                  {bar.max !== undefined && (
                    <span className="text-muted-foreground font-normal">
                      {' / '}{bar.max}{unit ? ` ${unit}` : ''}
                    </span>
                  )}
                </span>
              </div>
              <div className={`h-4 rounded-sm ${barBg} relative overflow-hidden`}>
                <div
                  className={`absolute top-0 left-0 h-full rounded-sm ${barColor} transition-all duration-300`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
