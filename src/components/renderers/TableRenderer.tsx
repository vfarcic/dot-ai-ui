import type { TableContent } from '@/types'

interface TableRendererProps {
  content: TableContent
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
          {content.rows.map((row, rowIndex) => (
            <tr
              key={`row-${rowIndex}`}
              className={`border-b border-border last:border-b-0 ${
                rowIndex % 2 === 1 ? 'bg-muted/20' : ''
              } hover:bg-muted/30 transition-colors`}
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
          ))}
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
