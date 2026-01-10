import type { TableContent, StatusIndicator } from '@/types'

interface TableRendererProps {
  content: TableContent
}

function getRowStatusStyles(status?: StatusIndicator | null): string {
  switch (status) {
    case 'error':
      return 'border-l-4 border-l-red-500 bg-red-500/10'
    case 'warning':
      return 'border-l-4 border-l-yellow-500 bg-yellow-500/10'
    case 'ok':
      return 'border-l-4 border-l-green-500 bg-green-500/10'
    default:
      return ''
  }
}

export function TableRenderer({ content }: TableRendererProps) {
  if (!content.headers || content.headers.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No table data to display
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            {content.headers.map((header, index) => (
              <th
                key={`header-${index}`}
                className="px-4 py-3 text-left font-medium text-foreground whitespace-nowrap"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.rows.map((row, rowIndex) => {
            const rowStatus = content.rowStatuses?.[rowIndex]
            const statusStyles = getRowStatusStyles(rowStatus)
            return (
              <tr
                key={`row-${rowIndex}`}
                className={`border-b border-border last:border-b-0 ${
                  rowIndex % 2 === 1 && !rowStatus ? 'bg-muted/20' : ''
                } hover:bg-muted/30 transition-colors ${statusStyles}`}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`cell-${rowIndex}-${cellIndex}`}
                    className="px-4 py-3 text-muted-foreground"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      {content.rows.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No rows to display
        </div>
      )}
    </div>
  )
}
