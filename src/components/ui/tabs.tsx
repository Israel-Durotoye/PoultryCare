import React, { createContext, useContext } from 'react'

interface TabsContextProps {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextProps | null>(null)

export function Tabs({
  value,
  onValueChange,
  className = '',
  children,
  ...props
}: {
  value: string
  onValueChange: (value: string) => void
  className?: string
  children: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function TabsList({
  className = '',
  children,
  ...props
}: {
  className?: string
  children: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>) {
  const isGrid = className.includes('grid')
  const baseClasses = isGrid
    ? 'items-center'
    : 'inline-flex items-center justify-center'
  return (
    <div
      className={`${baseClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  className = '',
  children,
  ...props
}: {
  value: string
  className?: string
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabsTrigger must be used within Tabs')
  
  const isActive = context.value === value
  
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? 'active' : 'inactive'}
      onClick={() => context.onValueChange(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap cursor-pointer transition-all focus:outline-none ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  className = '',
  children,
  ...props
}: {
  value: string
  className?: string
  children: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabsContent must be used within Tabs')
  
  if (context.value !== value) return null
  
  return (
    <div
      role="tabpanel"
      className={`focus:outline-none ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
