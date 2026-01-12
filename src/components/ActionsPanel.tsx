/**
 * Actions Panel for workflow execution choices
 * Shows buttons for user to choose how to proceed
 */

import type { ExecutionChoice } from '@/api/remediate'

interface ActionsPanelProps {
  choices: ExecutionChoice[]
  onSelect: (choiceId: number) => void
  isLoading?: boolean
  disabled?: boolean
  hint?: string
}

function getButtonStyles(index: number, disabled?: boolean): string {
  const base = 'px-4 py-2 rounded-md text-sm font-medium transition-colors'

  if (disabled) {
    return `${base} bg-muted text-muted-foreground cursor-not-allowed opacity-50`
  }

  // First button is primary
  if (index === 0) {
    return `${base} bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer`
  }

  // Secondary buttons
  return `${base} bg-muted text-foreground hover:bg-muted/80 border border-border cursor-pointer`
}

export function ActionsPanel({ choices, onSelect, isLoading, disabled, hint }: ActionsPanelProps) {
  if (!choices || choices.length === 0) return null

  return (
    <div className="mt-4 p-4 rounded-lg border border-border bg-muted/20">
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {choices.map((choice, index) => (
            <button
              key={choice.id}
              onClick={() => onSelect(choice.id)}
              disabled={isLoading || disabled}
              className={getButtonStyles(index, isLoading || disabled)}
            >
              <div className="flex items-center justify-center gap-2">
                {isLoading && index === 0 && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                <span>{choice.label}</span>
              </div>
            </button>
          ))}
        </div>
        {hint && (
          <div className="text-xs text-muted-foreground">
            {hint}
          </div>
        )}
      </div>
    </div>
  )
}
