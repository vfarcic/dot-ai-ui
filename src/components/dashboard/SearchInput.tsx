import { useState, useEffect, useRef, useCallback } from 'react'
import type { SearchScope } from '../../api/knowledge'

interface SearchInputProps {
  value: string
  onSubmit: (value: string) => void
  scope: SearchScope
  onScopeChange: (scope: SearchScope) => void
  placeholder?: string
  className?: string
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  )
}

function ClearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  )
}

const SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: 'both', label: 'Both' },
  { value: 'resources', label: 'Resources' },
  { value: 'knowledge', label: 'Knowledge' },
]

export function SearchInput({
  value,
  onSubmit,
  scope,
  onScopeChange,
  placeholder = 'Search resources & knowledge...',
  className = '',
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync local value when external value changes (e.g., URL navigation)
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleSubmit = useCallback(() => {
    onSubmit(localValue.trim())
  }, [localValue, onSubmit])

  const handleClear = useCallback(() => {
    setLocalValue('')
    onSubmit('')
    inputRef.current?.focus()
  }, [onSubmit])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Keyboard shortcut: Cmd/Ctrl + K to focus, Escape to clear
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        handleClear()
        inputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleClear])

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Scope selector */}
      <select
        value={scope}
        onChange={(e) => onScopeChange(e.target.value as SearchScope)}
        className="shrink-0 bg-muted border border-border rounded-md px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
        aria-label="Search scope"
      >
        {SCOPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Search input */}
      <div className="relative flex-1">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-1.5 text-sm bg-muted/50 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
        />
        {localValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <ClearIcon className="w-4 h-4" />
          </button>
        )}
        {!localValue && (
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground bg-muted rounded border border-border">
            <span className="text-[10px]">⌘</span>K
          </kbd>
        )}
      </div>

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!localValue.trim()}
        className="shrink-0 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        aria-label="Search"
      >
        <SearchIcon className="w-4 h-4" />
      </button>
    </div>
  )
}
