import React from "react";
import { Users } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";

interface DroppableAllContactsProps {
  isSelected: boolean;
  totalContacts: number;
  onClick: () => void;
  showTrash: boolean;
  collapsed?: boolean;
  tooltip?: string;
}

export const DroppableAllContacts = React.forwardRef<HTMLButtonElement, DroppableAllContactsProps>(
  ({
    isSelected,
    totalContacts,
    onClick,
    showTrash,
    collapsed = false,
    tooltip,
  }, ref) => {
    const isActive = isSelected && !showTrash;

    if (collapsed) {
      return (
        <SidebarMenuButton
          ref={ref}
          onClick={onClick}
          isActive={isActive}
          tooltip={tooltip}
          className="w-full"
          data-onboarding-all-contacts
        >
          <Users className="h-4 w-4 shrink-0" />
        </SidebarMenuButton>
      );
    }

    return (
      <SidebarMenuButton
        ref={ref}
        onClick={onClick}
        isActive={isActive}
        className="w-full min-w-0"
        data-onboarding-all-contacts
      >
        <Users className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left min-w-0 truncate">All Contacts</span>
        <span className="text-xs opacity-70 shrink-0">
          {totalContacts}
        </span>
      </SidebarMenuButton>
    );
  }
);

DroppableAllContacts.displayName = "DroppableAllContacts";
