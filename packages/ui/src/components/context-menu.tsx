"use client";

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";

// Only the root and the trigger. A context menu's popup and items are the plain menu's, so a
// DropdownMenuContent placed inside the root opens at the pointer.
function ContextMenu({ ...props }: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger({ ...props }: ContextMenuPrimitive.Trigger.Props) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />;
}

export { ContextMenu, ContextMenuTrigger };
