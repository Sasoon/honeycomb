import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-amber hover:bg-amber-dark text-white hover:shadow-lg hover:shadow-amber/20",
        secondary: "bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 text-text-primary hover:shadow-lg hover:shadow-secondary/10",
        outline: "border border-secondary/20 bg-transparent hover:bg-secondary/5 text-text-primary hover:border-secondary/30",
        ghost: "hover:bg-secondary/10 text-text-primary",
        destructive: "bg-accent hover:bg-accent-dark text-white hover:shadow-lg hover:shadow-accent/20",
        success: "bg-success hover:bg-success-dark text-white hover:shadow-lg hover:shadow-success/20",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
        gameControl: "h-[40px] w-[40px] sm:h-10 sm:w-[120px] px-1 sm:px-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }