import { useState } from "react";
import { Building2, Users, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CompanySetupDialogProps {
  open: boolean;
  onCreateCompany: (name: string) => void;
  onJoinCompany: (inviteCode: string) => void;
}

export function CompanySetupDialog({
  open,
  onCreateCompany,
  onJoinCompany,
}: CompanySetupDialogProps) {
  const [companyName, setCompanyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!companyName.trim()) return;
    setIsSubmitting(true);
    await onCreateCompany(companyName.trim());
    setIsSubmitting(false);
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setIsSubmitting(true);
    await onJoinCompany(inviteCode.trim());
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome! Let's get you set up</DialogTitle>
          <DialogDescription>
            Create a new company or join an existing one to start managing contacts.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="create" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Create Company
            </TabsTrigger>
            <TabsTrigger value="join" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Join Company
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                placeholder="Acme Inc"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              You'll be the admin and can invite others with an invite code.
            </p>
            <Button
              onClick={handleCreate}
              disabled={!companyName.trim() || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  Creating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Create Company
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="join" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="invite-code">Invite Code</Label>
              <Input
                id="invite-code"
                placeholder="Enter invite code..."
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Ask your company admin for the invite code to join.
            </p>
            <Button
              onClick={handleJoin}
              disabled={!inviteCode.trim() || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  Joining...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Join Company
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
