import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "@/lib/utils"

function Select<Value, Multiple extends boolean | undefined = false>({
  ...props
}: SelectPrimitive.Root.Props<Value, Multiple>) {
  return <SelectPrimitive.Root {...props} />
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "group/select-trigger",
        "flex h-8 w-full items-center justify-between gap-2",
        "rounded-lg border border-border bg-background px-2.5 py-1.5",
        "text-sm text-foreground whitespace-nowrap",
        "outline-none cursor-pointer select-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "aria-expanded:border-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
    </SelectPrimitive.Trigger>
  )
}

function SelectValue({
  className,
  ...props
}: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      className={cn("flex-1 text-left truncate", className)}
      {...props}
    />
  )
}

function SelectIcon({
  className,
  ...props
}: SelectPrimitive.Icon.Props) {
  return (
    <SelectPrimitive.Icon
      className={cn(
        "text-muted-foreground group-data-[open]/select-trigger:rotate-180 transition-transform",
        className
      )}
      {...props}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </SelectPrimitive.Icon>
  )
}

function SelectContent({
  className,
  children,
  ...props
}: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Backdrop />
      <SelectPrimitive.Positioner>
        <SelectPrimitive.Popup
          className={cn(
            "z-50 min-w-[var(--anchor-width)]",
            "bg-card border border-border rounded-xl shadow-lg",
            "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[starting-style]:scale-95",
            "data-[ending-style]:transition-all data-[starting-style]:transition-all",
            "data-[ending-style]:duration-100 data-[starting-style]:duration-100",
            "origin-[var(--transform-origin)]",
            className
          )}
          {...props}
        >
          <SelectPrimitive.List>
            {children}
          </SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "group/select-item",
        "flex items-center gap-2 px-2.5 py-1.5 text-sm cursor-pointer select-none",
        "text-foreground",
        "outline-none",
        "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator
        className={cn(
          "inline-flex items-center justify-center size-4 shrink-0",
          "invisible group-data-[selected]/select-item:visible",
          "text-primary"
        )}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectGroup({
  ...props
}: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group {...props} />
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      className={cn("px-2.5 py-1 text-xs font-semibold text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
}
