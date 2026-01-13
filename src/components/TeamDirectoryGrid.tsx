import { Mail, Phone, Briefcase } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Contact } from "@/types/contact";

interface TeamDirectoryGridProps {
  members: Contact[];
}

export function TeamDirectoryGrid({ members }: TeamDirectoryGridProps) {
  if (members.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <Briefcase className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No team members yet</h3>
        <p className="text-muted-foreground text-sm">
          Invite others to join your company using the invite code in settings.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      {members.map((member) => (
        <Card key={member.id} className="overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0">
                <AvatarImage src={member.avatar} alt={member.name} />
                <AvatarFallback className="text-base sm:text-lg">
                  {member.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate text-sm sm:text-base">{member.name || "No name"}</h3>
                {member.role && (
                  <Badge variant="secondary" className="mt-1 text-xs truncate max-w-full">
                    {member.role}
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-3 sm:mt-4 space-y-2">
              {member.email && (
                <a
                  href={`mailto:${member.email}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-w-0"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate min-w-0">{member.email}</span>
                </a>
              )}
              {member.phone && (
                <a
                  href={`tel:${member.phone}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-w-0"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  <span className="truncate min-w-0">{member.phone}</span>
                </a>
              )}
              {member.description && (
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-2">
                  {member.description}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}