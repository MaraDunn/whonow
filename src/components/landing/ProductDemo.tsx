import { useState, useEffect, useCallback } from "react";
import { Search, Mail, Phone, Building2, Briefcase, Clock, Star, Folder, Plus, ChevronDown, MapPin, Users, Menu } from "lucide-react";
import { WhoNowLogo } from "@/components/WhoNowLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Demo sidebar structure matching the platform: Contact Directory, Client Directory, Team Directory
const DEMO_FOLDERS = [
  { name: "Engineering", color: "#3b82f6", count: 12 },
  { name: "Design", color: "#8b5cf6", count: 8 },
  { name: "Product", color: "#10b981", count: 5 },
] as const;

type DemoContact = {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  lastContacted: string;
  isClient?: boolean;
  folder: { name: string; color: string };
  meetingTime?: string;
  location?: string;
};

// "I need a new logo" — capability/skill search → designers and brand creatives
const logoSearchContacts: DemoContact[] = [
  {
    name: "Jordan Blake",
    role: "Brand & Visual Designer",
    company: "Pixel Craft Studio",
    email: "jordan@pixelcraft.io",
    phone: "+1 (555) 120-4500",
    lastContacted: "3 days ago",
    isClient: true,
    folder: { name: "Design", color: "#8b5cf6" },
  },
  {
    name: "Sam Rivera",
    role: "Creative Director",
    company: "Lemon & Lime Agency",
    email: "sam@lemonlime.agency",
    phone: "+1 (555) 230-5600",
    lastContacted: "1 week ago",
    isClient: true,
    folder: { name: "Design", color: "#8b5cf6" },
  },
  {
    name: "Alex Kim",
    role: "Logo & Identity Designer",
    company: "Mark & Matter",
    email: "alex@markandmatter.com",
    phone: "+1 (555) 340-6700",
    lastContacted: "2 weeks ago",
    isClient: true,
    folder: { name: "Design", color: "#8b5cf6" },
  },
];

// "Who did I meet at the conference last week" — time/event-based search
const conferenceSearchContacts: DemoContact[] = [
  {
    name: "Priya Sharma",
    role: "Head of Partnerships",
    company: "Summit Ventures",
    email: "priya@summitventures.co",
    phone: "+1 (555) 450-7800",
    lastContacted: "5 days ago",
    meetingTime: "Met at Conf 2025",
    isClient: false,
    folder: { name: "Partnerships", color: "#06b6d4" },
  },
  {
    name: "Marcus Webb",
    role: "CTO",
    company: "Flow Technologies",
    email: "marcus@flowtech.io",
    phone: "+1 (555) 560-8900",
    lastContacted: "4 days ago",
    meetingTime: "Met at Conf 2025",
    isClient: true,
    folder: { name: "Engineering", color: "#3b82f6" },
  },
  {
    name: "Elena Vos",
    role: "Product Lead",
    company: "NextLayer",
    email: "elena@nextlayer.com",
    phone: "+1 (555) 670-9010",
    lastContacted: "6 days ago",
    meetingTime: "Met at Conf 2025",
    isClient: false,
    folder: { name: "Product", color: "#10b981" },
  },
];

// Client-management focus: contacts with client status highlighted
const clientManagementContacts: DemoContact[] = [
  {
    name: "Sarah Chen",
    role: "Engineering Lead",
    company: "TechCorp",
    email: "sarah.chen@techcorp.com",
    phone: "+1 (555) 123-4567",
    lastContacted: "2 days ago",
    isClient: true,
    folder: { name: "Engineering", color: "#3b82f6" },
  },
  {
    name: "David Park",
    role: "VP of Product",
    company: "TechCorp",
    email: "d.park@techcorp.com",
    phone: "+1 (555) 234-5678",
    lastContacted: "1 week ago",
    isClient: true,
    folder: { name: "Product", color: "#10b981" },
  },
  {
    name: "Lisa Wang",
    role: "Head of Sales",
    company: "TechCorp",
    email: "l.wang@techcorp.com",
    phone: "+1 (555) 345-6789",
    lastContacted: "3 days ago",
    isClient: false,
    folder: { name: "Sales", color: "#f59e0b" },
  },
];

// Company directory — internal contacts by responsibility; filter shows "who handles X"
// None are clients (internal team directory)
const directoryAllContacts: DemoContact[] = [
  {
    name: "Taylor Morgan",
    role: "Accounts Payable Manager",
    company: "Finance",
    email: "taylor.morgan@company.com",
    phone: "+1 (555) 200-1000",
    lastContacted: "1 day ago",
    isClient: false,
    folder: { name: "Finance", color: "#059669" },
  },
  {
    name: "Jamie Chen",
    role: "Vendor Invoicing Lead",
    company: "Finance",
    email: "j.chen@company.com",
    phone: "+1 (555) 200-1001",
    lastContacted: "2 days ago",
    isClient: false,
    folder: { name: "Finance", color: "#059669" },
  },
  {
    name: "Morgan Reese",
    role: "Finance Operations",
    company: "Finance",
    email: "m.reese@company.com",
    phone: "+1 (555) 200-1002",
    lastContacted: "3 days ago",
    isClient: false,
    folder: { name: "Finance", color: "#059669" },
  },
  {
    name: "Jordan Blake",
    role: "Brand & Visual Designer",
    company: "Design",
    email: "jordan.blake@company.com",
    phone: "+1 (555) 200-2000",
    lastContacted: "1 week ago",
    isClient: false,
    folder: { name: "Design", color: "#8b5cf6" },
  },
  {
    name: "Sam Rivera",
    role: "Creative Director",
    company: "Design",
    email: "sam.rivera@company.com",
    phone: "+1 (555) 200-2001",
    lastContacted: "4 days ago",
    isClient: false,
    folder: { name: "Design", color: "#8b5cf6" },
  },
  {
    name: "Alex Kim",
    role: "Software Engineer",
    company: "Engineering",
    email: "alex.kim@company.com",
    phone: "+1 (555) 200-3000",
    lastContacted: "5 days ago",
    isClient: false,
    folder: { name: "Engineering", color: "#3b82f6" },
  },
];

const SEARCH_QUERIES = ["I need a new logo", "Who did I meet at the conference last week"];
const DIRECTORY_FILTER_TYPING = "Who handles vendor invoicing";
const DIRECTORY_FILTER_FOLDER = "Finance"; // show contacts matching this when directory query is "invoicing"
const TYPING_MS = 57; // ~10% slower than 52
const RESULTS_HOLD_MS = 2860; // 2600 * 1.1
const TRANSITION_MS = 418; // 380 * 1.1
const CLIENT_PHASE_HOLD_MS = 2860; // 2600 * 1.1
const DIRECTORY_RESULTS_HOLD_MS = 2860; // 2600 * 1.1

type DemoPhase = 0 | 1 | 2 | 3; // 0,1 = search demos; 2 = clients; 3 = directory

export const ProductDemo = () => {
  const [phase, setPhase] = useState<DemoPhase>(0);
  const [searchChars, setSearchChars] = useState(0);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [directoryChars, setDirectoryChars] = useState(0);
  const [showDirectoryResults, setShowDirectoryResults] = useState(false);

  const getInitials = useCallback((name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }, []);

  // Phase timers and typing
  useEffect(() => {
    if (phase === 0 || phase === 1) {
      const query = SEARCH_QUERIES[phase];
      if (showSearchResults) {
        const t = setTimeout(() => {
          setShowSearchResults(false);
          setSearchChars(0);
          setPhase(((phase + 1) % 4) as DemoPhase);
        }, RESULTS_HOLD_MS + TRANSITION_MS);
        return () => clearTimeout(t);
      }
      if (searchChars <= query.length) {
        const id = setInterval(() => {
          setSearchChars((c) => {
            if (c >= query.length) {
              clearInterval(id);
              setShowSearchResults(true);
              return c;
            }
            return c + 1;
          });
        }, TYPING_MS);
        return () => clearInterval(id);
      }
    }
    if (phase === 2) {
      const t = setTimeout(() => {
        setPhase(3);
        setDirectoryChars(0);
        setShowDirectoryResults(false);
      }, CLIENT_PHASE_HOLD_MS);
      return () => clearTimeout(t);
    }
    if (phase === 3) {
      if (showDirectoryResults) {
        const t = setTimeout(() => {
          setShowDirectoryResults(false);
          setDirectoryChars(0);
          setPhase(0);
          setSearchChars(0);
          setShowSearchResults(false);
        }, DIRECTORY_RESULTS_HOLD_MS + TRANSITION_MS);
        return () => clearTimeout(t);
      }
      if (directoryChars <= DIRECTORY_FILTER_TYPING.length) {
        const id = setInterval(() => {
          setDirectoryChars((c) => {
            if (c >= DIRECTORY_FILTER_TYPING.length) {
              clearInterval(id);
              setShowDirectoryResults(true);
              return c;
            }
            return c + 1;
          });
        }, TYPING_MS);
        return () => clearInterval(id);
      }
    }
  }, [phase, searchChars, showSearchResults, directoryChars, showDirectoryResults]);

  const currentSearchQuery = phase <= 1 ? SEARCH_QUERIES[phase].slice(0, searchChars) : "";
  const searchContacts = phase === 0 ? logoSearchContacts : conferenceSearchContacts;
  const directoryFilter = DIRECTORY_FILTER_TYPING.slice(0, directoryChars);
  const directoryFilteredContacts = showDirectoryResults
    ? directoryAllContacts.filter((c) => c.folder.name === DIRECTORY_FILTER_FOLDER)
    : directoryAllContacts;
  const showSearchView = phase <= 1;
  const showClientView = phase === 2;
  const showDirectoryView = phase === 3;

  const renderContactCard = (contact: DemoContact, index: number, highlightClient?: boolean) => (
    <div
      key={`${contact.name}-${contact.company}`}
      className="group relative flex flex-col h-full min-w-0 p-6 rounded-2xl border border-border bg-card gradient-card shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all duration-300 cursor-pointer animate-slide-up"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Top section: variable height */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="h-7 mb-1 shrink-0">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-secondary/80 w-fit"
            style={{ borderLeft: `3px solid ${contact.folder.color}` }}
          >
            <Folder className="h-3 w-3 text-secondary-foreground" />
            <span className="text-secondary-foreground">{contact.folder.name}</span>
          </div>
        </div>
        <div className="flex items-start gap-4 shrink-0">
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 rounded-xl gradient-hero flex items-center justify-center text-primary-foreground font-display font-semibold text-lg group-hover:scale-105 transition-transform duration-300">
              {getInitials(contact.name)}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-card" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-semibold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                {contact.name}
              </h3>
              {(contact.isClient ?? false) && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                    highlightClient ? "bg-amber-500/20 text-amber-700 ring-1 ring-amber-500/40" : "bg-amber-500/10 text-amber-600"
                  }`}
                >
                  <Star className="h-3 w-3 fill-current" />
                  Client
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Briefcase className="h-3.5 w-3.5" />
              {contact.role}
            </p>
            {(contact.meetingTime || contact.location) && (
              <div className="flex items-center gap-1.5 mt-1">
                {contact.meetingTime ? (
                  <>
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{contact.meetingTime}</span>
                  </>
                ) : (
                  <>
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{contact.location}</span>
                  </>
                )}
              </div>
            )}
            {!contact.meetingTime && !contact.location && (
              <div className="flex items-center gap-1.5 mt-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{contact.lastContacted}</span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 space-y-2.5 min-w-0">
          {contact.email && (
            <div className="flex items-center gap-3 text-sm text-foreground min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary shrink-0">
                <Mail className="h-4 w-4 text-secondary-foreground" />
              </div>
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-3 text-sm text-foreground min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary shrink-0">
                <Phone className="h-4 w-4 text-secondary-foreground" />
              </div>
              <span className="truncate">{contact.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm text-foreground min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary shrink-0">
              <Building2 className="h-4 w-4 text-secondary-foreground" />
            </div>
            <span className="truncate">{contact.company}</span>
          </div>
        </div>
      </div>

      {/* Client / Contacted buttons — fixed footer, same width and placement on every card */}
      <div className="mt-3 pt-3 border-t border-border w-full shrink-0 flex gap-2">
        <Button
          variant={contact.isClient ? "default" : "outline"}
          size="sm"
          className={cn(
            "flex-1 min-w-0 basis-0 text-xs h-8 px-2 justify-center pointer-events-none",
            contact.isClient && "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
          )}
          type="button"
        >
          <Star className={cn("h-3 w-3 mr-1.5 flex-shrink-0", contact.isClient && "fill-current")} />
          <span className="truncate text-center">Client</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 min-w-0 basis-0 text-xs h-8 px-3 justify-center pointer-events-none"
          type="button"
        >
          <Clock className="h-3 w-3 mr-1.5 flex-shrink-0" />
          <span className="truncate text-center">Contacted</span>
        </Button>
      </div>
    </div>
  );

  const contactsForView =
    showSearchView && showSearchResults
      ? searchContacts
      : showClientView
        ? clientManagementContacts
        : showDirectoryView
          ? directoryFilteredContacts
          : [];

  return (
    <section id="demo" className="py-24 sm:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            See it in action
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Natural language search, client management, and a searchable company directory — all in one place.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="relative bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-background/80 rounded-md px-3 py-1 text-sm text-muted-foreground text-center max-w-xs mx-auto">
                  app.whonow.com
                </div>
              </div>
            </div>

            <div className="bg-background min-h-[500px] flex">
              {/* Demo sidebar — matches platform: Contact Directory, Client Directory, Team Directory */}
              <aside className="w-64 border-r border-border bg-sidebar text-sidebar-foreground hidden md:flex flex-col shrink-0">
                <div className="flex flex-col gap-2 p-2" data-sidebar="header">
                  <div className="flex items-center gap-2 px-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7 pointer-events-none" aria-hidden>
                      <Menu className="h-4 w-4" />
                    </Button>
                    <WhoNowLogo size="sm" showText={false} className="shrink-0" />
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto py-2">
                  {/* Contact Directory */}
                  <div className="relative flex w-full min-w-0 flex-col px-2">
                    <div className="flex h-8 shrink-0 items-center gap-1.5 px-2">
                      <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
                      <span className="text-xs font-medium text-sidebar-foreground/70">Contact Directory</span>
                    </div>
                    <div className="mt-1 flex w-full min-w-0 flex-col gap-1">
                      <div
                        className={cn(
                          "flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm",
                          showSearchView
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Users className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate text-left">All Contacts</span>
                        <span className="text-xs opacity-70 shrink-0">25</span>
                      </div>
                      {DEMO_FOLDERS.map((f) => (
                        <div
                          key={f.name}
                          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        >
                          <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: f.color }} />
                          <span className="flex-1 truncate text-left">{f.name}</span>
                          <span className="text-xs opacity-70 shrink-0">{f.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mx-2 w-auto border-t border-sidebar-border" />

                  {/* Client Directory */}
                  <div className="relative flex w-full min-w-0 flex-col px-2">
                    <div className="flex h-8 shrink-0 items-center gap-1.5 px-2">
                      <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
                      <span className="text-xs font-medium text-sidebar-foreground/70">Client Directory</span>
                    </div>
                    <div className="mt-1 flex w-full min-w-0 flex-col gap-1">
                      <div
                        className={cn(
                          "flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm",
                          showClientView
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Briefcase className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate text-left">All Clients</span>
                        <span className="text-xs opacity-70 shrink-0">7</span>
                      </div>
                    </div>
                  </div>

                  <div className="mx-2 w-auto border-t border-sidebar-border" />

                  {/* Team Directory (Company directory) */}
                  <div className="relative flex w-full min-w-0 flex-col px-2">
                    <div className="flex h-8 shrink-0 items-center gap-1.5 px-2">
                      <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
                      <span className="text-xs font-medium text-sidebar-foreground/70">Team Directory</span>
                    </div>
                    <div className="mt-1 flex w-full min-w-0 flex-col gap-1">
                      <div
                        className={cn(
                          "flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm",
                          showDirectoryView
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate text-left">All Team Members</span>
                        <span className="text-xs opacity-70 shrink-0">48</span>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>

              <div className="flex-1 p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <WhoNowLogo size="sm" showText={true} />
                    {showClientView && (
                      <div className="border-l border-border pl-4 flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-medium text-foreground">Client management</span>
                      </div>
                    )}
                    {showDirectoryView && (
                      <div className="border-l border-border pl-4 flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Company directory</span>
                      </div>
                    )}
                    {showSearchView && (
                      <div className="border-l border-border pl-4 hidden lg:block">
                        <p className="text-sm text-muted-foreground">
                          {showSearchResults ? `${searchContacts.length} contacts` : "Search contacts"}
                        </p>
                      </div>
                    )}
                  </div>
                  <button className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-opacity shadow-lg gradient-hero text-primary-foreground hover:opacity-90 shadow-primary/20">
                    <Plus className="h-4 w-4" />
                    <span>Add Contact</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </button>
                </div>

                {/* Search bar — shown in search phases and client phase for consistency */}
                {(showSearchView || showClientView) && (
                  <div className="relative mb-8 group">
                    <div className="absolute inset-0 rounded-2xl gradient-hero opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500" />
                    <div className="relative flex items-center">
                      <Search className="absolute left-5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
                      <div className="w-full h-14 pl-14 pr-24 rounded-2xl border border-border bg-card text-foreground shadow-search focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all duration-200 flex items-center">
                        {showSearchView ? (
                          <>
                            <span className="text-base">{currentSearchQuery}</span>
                            <span className="w-0.5 h-6 bg-primary animate-pulse ml-0.5" />
                          </>
                        ) : (
                          <span className="text-base text-muted-foreground">Search contacts</span>
                        )}
                      </div>
                      <div className="absolute right-4 flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-xs font-medium">
                        <span>⌘</span>
                        <span>K</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Client callout (client phase) */}
                {showClientView && (
                  <p className="text-sm text-muted-foreground -mt-4 mb-6">
                    Mark key contacts as clients to track relationships at a glance.
                  </p>
                )}

                {/* Directory search (directory phase) */}
                {showDirectoryView && (
                  <div className="relative mb-8 group">
                    <div className="relative flex items-center">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <div className="w-full h-14 pl-14 pr-4 rounded-2xl border border-border bg-card text-foreground flex items-center">
                        <span className="text-base">{directoryFilter}</span>
                        <span className="w-0.5 h-6 bg-primary animate-pulse ml-0.5" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Find internal contacts by responsibility — who handles what.</p>
                  </div>
                )}

                {/* Results grid — visible during directory phase from start for live-updating effect */}
                <div
                  className={`grid md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-300 ${
                    (showSearchView && showSearchResults) || showClientView || showDirectoryView
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-4"
                  }`}
                >
                  {contactsForView.map((contact, index) =>
                    renderContactCard(contact, index, showClientView)
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
