import { useState } from "react";
import { Building2, Users, ArrowRight, User } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";

interface CompanySetupDialogProps {
  open: boolean;
  onCreateCompany: (name: string) => void;
  onJoinCompany: (inviteCode: string) => void;
  onSkipCompanySetup: () => void;
}

export function CompanySetupDialog({
  open,
  onCreateCompany,
  onJoinCompany,
  onSkipCompanySetup,
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

  const handleSkip = async () => {
    setIsSubmitting(true);
    await onSkipCompanySetup();
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome! Let's get you set up</DialogTitle>
          <DialogDescription>
            Join a company to collaborate with your team, or continue as an individual user.
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

        <div className="relative my-4">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
            or
          </span>
        </div>

        <Button
          variant="outline"
          onClick={handleSkip}
          disabled={isSubmitting}
          className="w-full"
        >
          <User className="h-4 w-4 mr-2" />
          Continue as Individual
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          You can join or create a company later from settings
        </p>
      </DialogContent>
    </Dialog>
  );
}
