import * as React from "react"

import { cn } from "@/lib/utils"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

interface KbdInputProps extends Omit<React.ComponentProps<"input">, "onKeyDown" | "onChange"> {
  value?: string
  onChange?: (value: string) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
}

function KbdInput({ className, value = "", onChange, onKeyDown, ...props }: KbdInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault()

    const keys: string[] = []

    // Add modifiers
    if (event.ctrlKey || event.metaKey) {
      keys.push("Mod")
    }
    if (event.shiftKey && event.key !== "Shift") {
      keys.push("Shift")
    }
    if (event.altKey && event.key !== "Alt") {
      keys.push("Alt")
    }

    // Add the main key (if it's not a modifier)
    const key = event.key
    if (!["Control", "Meta", "Shift", "Alt"].includes(key)) {
      // Format the key name
      let formattedKey = key
      if (key === " ") {
        formattedKey = "Space"
      } else if (key.length === 1) {
        formattedKey = key.toUpperCase()
      } else {
        // Capitalize first letter for keys like "Enter", "Escape", etc.
        formattedKey = key.charAt(0).toUpperCase() + key.slice(1)
      }
      keys.push(formattedKey)
    }

    // Only update if we have a complete shortcut
    if (keys.length > 0 && !["Shift", "Alt", "Mod"].includes(keys[keys.length - 1])) {
      const shortcut = keys.join("+")
      onChange?.(shortcut)
    }

    // Call custom onKeyDown if provided
    onKeyDown?.(event)
  }

  // Parse the value and render as kbd elements
  const renderKbds = () => {
    if (!value || value.trim() === "") {
      return null
    }

    const keys = value.split("+")
    return (
      <KbdGroup className="gap-1">
        {keys.map((key, index) => (
          <Kbd key={index}>{key === " " || key === "" ? "Space" : key}</Kbd>
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
