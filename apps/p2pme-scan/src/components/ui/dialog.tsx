import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50",
        "bg-black/60 backdrop-blur-sm",
        "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        "data-[ending-style]:transition-opacity data-[starting-style]:transition-opacity",
        "data-[ending-style]:duration-150 data-[starting-style]:duration-150",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <DialogPrimitive.Popup
          className={cn(
            "pointer-events-auto relative w-full max-w-lg",
            "bg-card border border-border rounded-2xl shadow-lg",
            "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[starting-style]:scale-95",
            "data-[ending-style]:transition-all data-[starting-style]:transition-all",
            "data-[ending-style]:duration-150 data-[starting-style]:duration-150",
            className
          )}
          {...props}
        >
          <div className="max-h-[85vh] overflow-y-auto p-6">
            <DialogPrimitive.Viewport>
              {children}
            </DialogPrimitive.Viewport>
          </div>
        </DialogPrimitive.Popup>
      </div>
    </DialogPortal>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function DialogClose({ className, ...props }: DialogPrimitive.Close.Props) {
  return (
    <DialogPrimitive.Close
      className={cn(
        "absolute top-3 right-3 size-8 inline-flex items-center justify-center rounded-full",
        "bg-muted text-muted-foreground hover:text-foreground cursor-pointer",
        "border-none text-base font-semibold leading-none",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
}
