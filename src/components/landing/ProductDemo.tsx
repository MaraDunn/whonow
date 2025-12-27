import { useState, useEffect } from "react";
import { Search, Mail, Phone, Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const demoContacts = [
  {
    name: "Sarah Chen",
    role: "Engineering Lead",
    company: "Product Team",
    email: "sarah.chen@company.com",
    avatar: null,
    tags: ["React", "TypeScript", "Team Lead"],
  },
  {
    name: "Marcus Johnson",
    role: "Senior Designer",
    company: "Design Team",
    email: "m.johnson@company.com",
    avatar: null,
    tags: ["Figma", "UI/UX", "Brand"],
  },
  {
    name: "Emily Rodriguez",
    role: "Product Manager",
    company: "Product Team",
    email: "e.rodriguez@company.com",
    avatar: null,
    tags: ["Strategy", "Roadmap", "Analytics"],
  },
];

const searchQueries = [
  "React developer",
  "design team",
  "product manager",
];

export const ProductDemo = () => {
  const [currentQuery, setCurrentQuery] = useState("");
  const [queryIndex, setQueryIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [showResults, setShowResults] = useState(false);

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
        setQueryIndex((prev) => (prev + 1) % searchQueries.length);
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
    <section id="demo" className="py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            See it in action
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Lightning-fast search across your entire organization. Find experts, teams, and contacts in seconds.
          </p>
        </div>

        {/* Demo container */}
        <div className="max-w-4xl mx-auto">
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
            <div className="p-6 sm:p-8 bg-background min-h-[400px]">
              {/* Search bar */}
              <div className="relative mb-8">
                <div className="relative bg-card rounded-xl shadow-search border border-border overflow-hidden">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <div className="w-full h-14 pl-12 pr-4 flex items-center text-lg">
                    <span className="text-foreground">{currentQuery}</span>
                    <span className="w-0.5 h-6 bg-primary animate-pulse ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className={`space-y-4 transition-all duration-300 ${showResults ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                {demoContacts.map((contact, index) => (
                  <div
                    key={contact.name}
                    className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:shadow-card-hover transition-shadow cursor-pointer"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={contact.avatar || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-foreground">{contact.name}</h4>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{contact.role}</span>
                        <span className="text-border">•</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {contact.company}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {contact.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs rounded-full bg-accent text-accent-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
