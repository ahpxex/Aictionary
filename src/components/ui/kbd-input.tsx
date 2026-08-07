import * as React from "react"

import { cn } from "@/lib/utils"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { formatShortcut, shortcutFromEvent } from "@/shared/lib/shortcuts"

interface KbdInputProps extends Omit<React.ComponentProps<"input">, "onKeyDown" | "onChange"> {
  value?: string
  onChange?: (value: string) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
}

function KbdInput({ className, value = "", onChange, onKeyDown, ...props }: KbdInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault()

    // Null while only modifiers are held, so a half-typed chord never
    // overwrites the existing binding.
    const shortcut = shortcutFromEvent(event)
    if (shortcut) {
      onChange?.(shortcut)
    }

    // Call custom onKeyDown if provided
    onKeyDown?.(event)
  }

  // Parse the value and render as kbd elements. The stored form is portable
  // ("Mod+Shift+K"); what is shown is what this platform actually presses.
  const renderKbds = () => {
    const keys = formatShortcut(value)
    if (keys.length === 0) {
      return null
    }

    return (
      <KbdGroup className="gap-1">
        {keys.map((key, index) => (
          <Kbd key={index}>{key}</Kbd>
        ))}
      </KbdGroup>
    )
  }

  return (
    <div className="relative">
      {/* Visual kbd display */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center px-3",
          value && value.trim() !== "" ? "opacity-100" : "opacity-0"
        )}
      >
        {renderKbds()}
      </div>

      {/* Actual input (hidden text) */}
      <input
        ref={inputRef}
        type="text"
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          // Hide the text cursor and text content when value exists
          value && value.trim() !== "" && "text-transparent caret-transparent",
          className
        )}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        {...props}
      />
    </div>
  )
}

export { KbdInput }
