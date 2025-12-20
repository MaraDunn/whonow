import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Profile } from "@/types/profile";

interface EmployeeDirectorySectionProps {
  members: Profile[];
  isSelected: boolean;
  onSelect: () => void;
}

export function EmployeeDirectorySection({
  members,
  isSelected,
  onSelect,
}: EmployeeDirectorySectionProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        {!isCollapsed && "Team Directory"}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    onClick={onSelect}
                    isActive={isSelected}
                    className="w-full"
                  >
                    <Users className="h-4 w-4" />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-left">All Team Members</span>
                        <span className="text-xs opacity-70">{members.length}</span>
                      </>
                    )}
                  </SidebarMenuButton>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">
                    <p>Team Directory ({members.length})</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </SidebarMenuItem>

          {/* Show mini avatars of team members when not collapsed */}
          {!isCollapsed && members.length > 0 && (
            <div className="px-2 py-1">
              <div className="flex -space-x-2 overflow-hidden">
                {members.slice(0, 5).map((member) => (
                  <Avatar key={member.id} className="h-6 w-6 border-2 border-background">
                    <AvatarImage src={member.avatarUrl} alt={member.fullName} />
                    <AvatarFallback className="text-[10px]">
                      {member.fullName
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "?"}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {members.length > 5 && (
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-[10px] font-medium border-2 border-background">
                    +{members.length - 5}
                  </div>
                )}
              </div>
            </div>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
