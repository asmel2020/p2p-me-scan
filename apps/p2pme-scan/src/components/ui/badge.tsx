import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap border border-transparent",
  {
    variants: {
      variant: {
        default:
          "bg-primary/15 text-primary border-primary/20",
        success:
          "bg-success/20 text-success border-success/25",
        warning:
          "bg-warning/20 text-warning border-warning/25",
        destructive:
          "bg-destructive/20 text-destructive border-destructive/25",
        outline:
          "bg-transparent text-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
