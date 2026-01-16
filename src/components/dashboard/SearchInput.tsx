import { useState, useEffect, useRef, useCallback } from 'react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
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

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search resources...',
  className = '',
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local value when external value changes
  // Also cancel any pending debounce to prevent stale timers
  useEffect(() => {
    setLocalValue(value)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [value])

  // Debounced onChange
  const handleChange = useCallback((newValue: string) => {
    setLocalValue(newValue)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      onChange(newValue)
    }, 300)
  }, [onChange])

  // Keyboard shortcut: Cmd/Ctrl + K to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      // Escape to clear and blur
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        handleChange('')
        inputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleChange])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const handleClear = () => {
    handleChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={`relative ${className}`}>
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
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
  )
}
