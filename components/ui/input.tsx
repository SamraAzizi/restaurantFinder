import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-foreground/60 selection:bg-primary selection:text-primary-foreground h-12 w-full min-w-0 rounded-[6px] border-2 border-border bg-card px-4 text-base font-medium neo-shadow-sm outline-none file:inline-flex file:h-8 file:border-0 file:bg-transparent file:px-3 file:text-sm file:font-bold disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }