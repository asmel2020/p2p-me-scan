---
name: manage-dialogs-zustand
description: Managing Multiple Dialogs using Zustand & controlled Dialog Components
licence: MIT
metadata:
  author: danny gonzalez
  version: 1.0.0
---

# Skill: Managing Multiple Dialogs using Zustand & controlled Dialog Components

This guide explains how to implement a clean, decoupled, and performance-optimized pattern for managing multiple dialogs (modals) within a page or feature area using **Zustand** and **controlled Dialog components**.

---

## Why Use This Pattern?

- **Decoupled Markup**: The main page code doesn't get cluttered with heavy dialog HTML and logic.
- **Centralized State**: Opening/closing, resetting context, and checking which dialog is open is handled by a simple store.
- **Controlled Modals**: Dialogs are controlled programmatically (`open={isOpen}`), preventing issues with uncontrolled components.
- **No Redundant Triggers**: We avoid using `<DialogTrigger>` inside individual dialogs, preventing unwanted DOM elements.

---

## Step 1: Create the Feature Store (`stores/use-[feature].ts`)

Define the store that will manage:

1. The currently open dialog identifier (`open`).
2. The context or parameters passed to the active dialog (`currentRow`).

```typescript
import { create } from "zustand";

// 1. Define the possible dialog types (identifiers)
type DialogType = "delete" | "detail" | "edit" | "example-params";

// 2. Define the payload structure for parameterized dialogs
export interface ParamsExampleParams {
  title: string;
  description: string;
}

interface FeatureState {
  open: DialogType | null;
  currentRow: ParamsExampleParams | null;
  setOpen: (open: DialogType | null) => void;
  setCurrentRow: (row: ParamsExampleParams | null) => void;
}

export const useFeatureStore = create<FeatureState>((set) => ({
  open: null,
  currentRow: null,
  setOpen: (open) =>
    set((state) => ({ open: state.open === open ? null : open })),
  setCurrentRow: (currentRow) => set({ currentRow }),
}));
```

---

## Step 2: Create the Controlled Dialog Component

Build each dialog as a controlled component using the Shadcn/Base-UI Dialog wrappers.

- **Crucial Rule**: Since they are controlled, **do not** include `<DialogTrigger>` in the component!

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ParamsExampleParams } from "../stores/use-[feature]";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRow?: ParamsExampleParams | null; // Optional if no parameters are needed
}

export const ExampleParamsDialog = ({
  open,
  onOpenChange,
  currentRow,
}: Props) => {
  if (!currentRow) return null; // Prevent crashes when data hasn't loaded yet

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{currentRow.title}</DialogTitle>
          <DialogDescription>{currentRow.description}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
```

---

## Step 3: Create the Dialog Orchestrator (`components/dialog.tsx`)

Create a single wrapper component that checks the store's state and renders the appropriate dialog. This keeps the root page layout clean.

```tsx
import { useFeatureStore } from "../stores/use-[feature]";
import { ExampleDialog } from "./example-dialog";
import { ExampleParamsDialog } from "./example-params-dialog";

export const Dialog = () => {
  const { open, setOpen, currentRow, setCurrentRow } = useFeatureStore();

  const handleClose = () => {
    setCurrentRow(null);
    setOpen(null);
  };

  return (
    <>
      {/* 1. Simple Non-Parameterized Dialog */}
      <ExampleDialog open={open === "delete"} onOpenChange={handleClose} />

      {/* 2. Parameter-Dependent Dialog */}
      {open === "example-params" && currentRow && (
        <ExampleParamsDialog
          open={open === "example-params"}
          onOpenChange={handleClose}
          currentRow={currentRow}
        />
      )}
    </>
  );
};
```

---

## Step 4: Add the Orchestrator to the Page (`page.tsx`)

Render the single `<Dialog />` orchestrator at the bottom of your page.

```tsx
import { Dialog } from "./components/dialog";
import { useFeatureStore } from "./stores/use-[feature]";

export default function Page() {
  const store = useFeatureStore();

  return (
    <div>
      {/* Triggers */}
      <button onClick={() => store.setOpen("delete")}>
        Open Delete Dialog
      </button>

      <button
        onClick={() => {
          store.setCurrentRow({
            title: "Dynamic Alert",
            description: "This dialog received custom data from Zustand store!",
          });
          store.setOpen("example-params");
        }}
      >
        Open Parameterized Dialog
      </button>

      {/* Renders all Dialog overlays */}
      <Dialog />
    </div>
  );
}
```
