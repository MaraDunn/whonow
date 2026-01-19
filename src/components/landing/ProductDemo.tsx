import { useState, useEffect } from "react";
import { Search, Mail, Phone, Building2, Briefcase, Clock, Star, Folder, Plus, ChevronDown, MapPin } from "lucide-react";
import { WhoNowLogo } from "@/components/WhoNowLogo";

// Company-based query results
const companyContacts = [
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

// Time-based query results (recent meetings)
const timeBasedContacts = [
  {
    name: "Michael Torres",
    role: "Senior Developer",
    company: "Cloud Systems",
    email: "m.torres@cloudsystems.com",
    phone: "+1 (555) 456-7890",
    lastContacted: "Yesterday",
    meetingTime: "Met 2 days ago",
    isClient: true,
    folder: { name: "Engineering", color: "#3b82f6" },
  },
  {
    name: "Jessica Kim",
    role: "Design Director",
    company: "Creative Agency",
    email: "j.kim@creativeagency.com",
    phone: "+1 (555) 567-8901",
    lastContacted: "3 days ago",
    meetingTime: "Met last week",
    isClient: true,
    folder: { name: "Design", color: "#8b5cf6" },
  },
  {
    name: "Robert Chen",
    role: "Marketing Manager",
    company: "Growth Labs",
    email: "r.chen@growthlabs.com",
    phone: "+1 (555) 678-9012",
    lastContacted: "5 days ago",
    meetingTime: "Met last week",
    isClient: false,
    folder: { name: "Marketing", color: "#ec4899" },
  },
];

// Location-based query results
const locationContacts = [
  {
    name: "Amanda Foster",
    role: "Regional Manager",
    company: "West Coast Operations",
    email: "a.foster@westcoastops.com",
    phone: "+1 (415) 555-0123",
    lastContacted: "1 week ago",
    location: "San Francisco, CA",
    isClient: true,
    folder: { name: "Operations", color: "#06b6d4" },
  },
  {
    name: "James Liu",
    role: "Software Engineer",
    company: "TechStart SF",
    email: "j.liu@techstartsf.com",
    phone: "+1 (415) 555-0234",
    lastContacted: "4 days ago",
    location: "San Francisco, CA",
    isClient: false,
    folder: { name: "Engineering", color: "#3b82f6" },
  },
  {
    name: "Maria Garcia",
    role: "Product Lead",
    company: "Bay Area Innovations",
    email: "m.garcia@bayareainnovations.com",
    phone: "+1 (415) 555-0345",
    lastContacted: "2 weeks ago",
    location: "San Francisco, CA",
    isClient: true,
    folder: { name: "Product", color: "#10b981" },
  },
];

const searchQueries = [
  "who do I know at TechCorp",
  "who did I meet with last week",
  "contacts in San Francisco",
];

const getContactsForQuery = (queryIndex: number) => {
  switch (queryIndex) {
    case 0: // Company query
      return companyContacts;
    case 1: // Time-based query
      return timeBasedContacts;
    case 2: // Location query
      return locationContacts;
    default:
      return companyContacts;
  }
};

export const ProductDemo = () => {
  const [currentQuery, setCurrentQuery] = useState("");
  const [queryIndex, setQueryIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [currentContacts, setCurrentContacts] = useState(companyContacts);

  useEffect(() => {
    const query = searchQueries[queryIndex];
    let charIndex = 0;

    if (isTyping) {
      const typingInterval = setInterval(() => {
        if (charIndex <= query.length) {
          setCurrentQuery(query.slice(0, charIndex));
          charIndex++;
        } else {
          clearInterval(typingInterval);
          // Update contacts for current query
          setCurrentContacts(getContactsForQuery(queryIndex));
          setShowResults(true);
          setTimeout(() => {
            setIsTyping(false);
          }, 2000);
        }
      }, 80);

      return () => clearInterval(typingInterval);
    } else {
      // Reset and move to next query
      const resetTimeout = setTimeout(() => {
        setShowResults(false);
        setCurrentQuery("");
        const nextIndex = (queryIndex + 1) % searchQueries.length;
        setQueryIndex(nextIndex);
        setCurrentContacts(getContactsForQuery(nextIndex));
        setIsTyping(true);
      }, 500);

      return () => clearTimeout(resetTimeout);
    }
  }, [queryIndex, isTyping]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <section id="demo" className="py-24 sm:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            See it in action
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Lightning-fast natural language search across your entire organization. Find experts, teams, and contacts in seconds.
          </p>
        </div>

        {/* Demo container */}
        <div className="max-w-6xl mx-auto">
          <div className="relative bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
            {/* Browser chrome */}
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

            {/* App content */}
            <div className="bg-background min-h-[500px] flex">
              {/* Sidebar */}
              <div className="w-64 border-r border-border bg-muted/20 p-4 hidden md:block">
                <div className="mb-6">
                  <WhoNowLogo size="sm" showText={true} />
                </div>
                <div className="space-y-1">
                  <div className="px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium text-sm">
                    All Contacts
                  </div>
                  <div className="px-3 py-2 rounded-lg text-muted-foreground text-sm hover:bg-muted/50 transition-colors cursor-pointer">
                    Engineering
                  </div>
                  <div className="px-3 py-2 rounded-lg text-muted-foreground text-sm hover:bg-muted/50 transition-colors cursor-pointer">
                    Design
                  </div>
                  <div className="px-3 py-2 rounded-lg text-muted-foreground text-sm hover:bg-muted/50 transition-colors cursor-pointer">
                    Product
                  </div>
                </div>
              </div>

              {/* Main content */}
              <div className="flex-1 p-6 sm:p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                    <WhoNowLogo size="sm" showText={true} />
                    <div className="border-l border-border pl-4 hidden lg:block">
                      <p className="text-sm text-muted-foreground">
                        {currentContacts.length} contacts
                      </p>
                    </div>
                  </div>
                  <button className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-opacity shadow-lg gradient-hero text-primary-foreground hover:opacity-90 shadow-primary/20">
                    <Plus className="h-4 w-4" />
                    <span>Add Contact</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </button>
                </div>

                {/* Search bar */}
                <div className="relative mb-8 group">
                  <div className="absolute inset-0 rounded-2xl gradient-hero opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500" />
                  <div className="relative flex items-center">
                    <Search className="absolute left-5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
                    <div className="w-full h-14 pl-14 pr-24 rounded-2xl border border-border bg-card text-foreground shadow-search focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all duration-200 flex items-center">
                      <span className="text-base">{currentQuery}</span>
                      <span className="w-0.5 h-6 bg-primary animate-pulse ml-0.5" />
                    </div>
                    <div className="absolute right-4 flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-xs font-medium">
                      <span>⌘</span>
                      <span>K</span>
                    </div>
                  </div>
                </div>

                {/* Results */}
                <div className={`grid md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-300 ${showResults ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                  {currentContacts.map((contact, index) => (
                    <div
                      key={contact.name}
                      className="group relative p-6 rounded-2xl border border-border bg-card gradient-card shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all duration-300 cursor-pointer animate-slide-up"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      {/* Folder badge */}
                      <div className="h-7 mb-1">
                        <div 
                          className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-secondary/80 w-fit"
                          style={{ 
                            borderLeft: `3px solid ${contact.folder.color}`,
                          }}
                        >
                          <Folder className="h-3 w-3 text-secondary-foreground" />
                          <span className="text-secondary-foreground">{contact.folder.name}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
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
                            {contact.isClient && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-medium">
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
                                  <span className="text-xs text-muted-foreground">
                                    {contact.meetingTime}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    {contact.location}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                          {!contact.meetingTime && !contact.location && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {contact.lastContacted}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2.5">
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors group/email"
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary group-hover/email:bg-primary/10 transition-colors">
                              <Mail className="h-4 w-4 text-secondary-foreground group-hover/email:text-primary" />
                            </div>
                            <span className="truncate hover:underline">{contact.email}</span>
                          </a>
                        )}

                        {contact.phone && (
                          <a
                            href={`tel:${contact.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors group/phone"
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary group-hover/phone:bg-primary/10 transition-colors">
                              <Phone className="h-4 w-4 text-secondary-foreground group-hover/phone:text-primary" />
                            </div>
                            <span className="hover:underline">{contact.phone}</span>
                          </a>
                        )}

                        <div className="flex items-center gap-3 text-sm text-foreground">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
                            <Building2 className="h-4 w-4 text-secondary-foreground" />
                          </div>
                          <span className="truncate">{contact.company}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
