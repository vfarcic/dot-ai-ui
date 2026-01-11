import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export interface SelectedResource {
  kind: string
  apiVersion: string
  namespace?: string
  name: string
}

interface ActionSelectionContextType {
  selectedItems: SelectedResource[]
  addItem: (item: SelectedResource) => void
  removeItem: (item: SelectedResource) => void
  toggleItem: (item: SelectedResource) => void
  clearSelection: () => void
  isSelected: (item: SelectedResource) => boolean
}

const ActionSelectionContext = createContext<ActionSelectionContextType | null>(null)

export function ActionSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedItems, setSelectedItems] = useState<SelectedResource[]>([])
  const location = useLocation()

  // Clear selection when navigating or changing filters (pathname or search params)
  useEffect(() => {
    setSelectedItems([])
  }, [location.pathname, location.search])

  const addItem = useCallback((item: SelectedResource) => {
    setSelectedItems((prev) => {
      // Don't add duplicates
      const exists = prev.some(
        (i) => i.kind === item.kind && i.name === item.name && i.namespace === item.namespace
      )
      if (exists) return prev
      return [...prev, item]
    })
  }, [])

  const removeItem = useCallback((item: SelectedResource) => {
    setSelectedItems((prev) =>
      prev.filter(
        (i) => !(i.kind === item.kind && i.name === item.name && i.namespace === item.namespace)
      )
    )
  }, [])

  const toggleItem = useCallback((item: SelectedResource) => {
    setSelectedItems((prev) => {
      const exists = prev.some(
        (i) => i.kind === item.kind && i.name === item.name && i.namespace === item.namespace
      )
      if (exists) {
        return prev.filter(
          (i) => !(i.kind === item.kind && i.name === item.name && i.namespace === item.namespace)
        )
      }
      return [...prev, item]
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedItems([])
  }, [])

  const isSelected = useCallback(
    (item: SelectedResource) => {
      return selectedItems.some(
        (i) => i.kind === item.kind && i.name === item.name && i.namespace === item.namespace
      )
    },
    [selectedItems]
  )

  return (
    <ActionSelectionContext.Provider
      value={{ selectedItems, addItem, removeItem, toggleItem, clearSelection, isSelected }}
    >
      {children}
    </ActionSelectionContext.Provider>
  )
}

export function useActionSelection() {
  const context = useContext(ActionSelectionContext)
  if (!context) {
    throw new Error('useActionSelection must be used within an ActionSelectionProvider')
  }
  return context
}
