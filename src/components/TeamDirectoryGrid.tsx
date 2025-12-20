import { Mail, Phone, Briefcase } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Profile } from "@/types/profile";

interface TeamDirectoryGridProps {
  members: Profile[];
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {members.map((member) => (
        <Card key={member.id} className="overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={member.avatarUrl} alt={member.fullName} />
                <AvatarFallback className="text-lg">
                  {member.fullName
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{member.fullName || "No name"}</h3>
                {member.role && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {member.role}
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {member.email && (
                <a
                  href={`mailto:${member.email}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{member.email}</span>
                </a>
              )}
              {member.phone && (
                <a
                  href={`tel:${member.phone}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  <span className="truncate">{member.phone}</span>
                </a>
              )}
              {member.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
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