import { useState } from "react";
import { X, Plus, RotateCcw, Sun, Moon, Monitor, Palette, Tags, Building2, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keywords: string[];
  onAddKeyword: (keyword: string) => void;
  onRemoveKeyword: (keyword: string) => void;
  onResetKeywords: () => void;
  isCompanyKeywords?: boolean;
  canEditKeywords?: boolean;
}

export function SettingsDialog({
  open,
  onOpenChange,
  keywords,
  onAddKeyword,
  onRemoveKeyword,
  onResetKeywords,
  isCompanyKeywords = false,
  canEditKeywords = true,
}: SettingsDialogProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { profile, company, isAdmin } = useProfile(user?.id);

  const handleAddKeyword = () => {
    if (newKeyword.trim()) {
      onAddKeyword(newKeyword);
      setNewKeyword("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="keywords" className="flex items-center gap-2">
              <Tags className="h-4 w-4" />
              <span className="hidden sm:inline">Keywords</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            {/* General Tab */}
            <TabsContent value="general" className="space-y-6 mt-0">
              <div className="space-y-4">
                <Label className="text-base font-medium">Appearance</Label>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred theme for the app.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("light")}
                    className="flex-1"
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Light
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                    className="flex-1"
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Dark
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("system")}
                    className="flex-1"
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    System
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Keywords Tab */}
            <TabsContent value="keywords" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-medium">Preset Keywords</Label>
                  {isCompanyKeywords && (
                    <Badge variant="outline" className="text-xs">Company</Badge>
                  )}
                </div>
                {canEditKeywords && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onResetKeywords}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground">
                {isCompanyKeywords 
                  ? canEditKeywords 
                    ? "As an admin, you can manage keywords for everyone in your company."
                    : "These keywords are managed by your company admin."
                  : "These keywords will appear as quick-select options when creating or editing contacts."
                }
              </p>

              {canEditKeywords && (
                <div className="flex gap-2">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a new keyword..."
                    className="flex-1"
                  />
                  <Button onClick={handleAddKeyword} size="icon" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg min-h-[100px]">
                {keywords.length === 0 ? (
                  <p className="text-sm text-muted-foreground w-full text-center py-4">
                    No keywords yet. {canEditKeywords ? "Add some above!" : "Ask your admin to add some."}
                  </p>
                ) : (
                  keywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="secondary"
                      className={canEditKeywords 
                        ? "cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                        : ""
                      }
                      onClick={canEditKeywords ? () => onRemoveKeyword(keyword) : undefined}
                    >
                      {keyword}
                      {canEditKeywords && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  ))
                )}
              </div>
              
              {canEditKeywords && (
                <p className="text-xs text-muted-foreground">
                  Click on a keyword to remove it.
                </p>
              )}
            </TabsContent>

            {/* Account Tab */}
            <TabsContent value="account" className="space-y-6 mt-0">
              {/* User Info */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Account</Label>
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-sm font-medium">{profile?.fullName || "No name set"}</p>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                </div>
              </div>

              <Separator />

              {/* Company Info */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Organization</Label>
                {company ? (
                  <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{company.name}</p>
                      {isAdmin && (
                        <Badge variant="secondary">Admin</Badge>
                      )}
                    </div>
                    {isAdmin && company.inviteCode && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Invite Code</p>
                        <code className="text-sm bg-background px-2 py-1 rounded">
                          {company.inviteCode}
                        </code>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      You're using the app as an individual. Company features are available when you join or create an organization.
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Sign Out */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end pt-4 border-t border-border mt-4">
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
