import type { Card, StatusIndicator } from '@/types'

interface CardRendererProps {
  content: Card[]
}

function getStatusStyles(status?: StatusIndicator): string {
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

export function CardRenderer({ content }: CardRendererProps) {
  if (!content || content.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No items to display
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {content.map((card) => (
        <div
          key={card.id}
          className={`rounded-lg border border-border bg-muted/30 p-4 hover:bg-muted/50 transition-colors ${getStatusStyles(card.status)}`}
        >
          <h3 className="font-medium text-foreground mb-1">{card.title}</h3>
          {card.description && (
            <p className="text-sm text-muted-foreground mb-3">{card.description}</p>
          )}
          {card.tags && card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {card.tags.map((tag, index) => (
                <span
                  key={`${card.id}-tag-${index}`}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/20 text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
