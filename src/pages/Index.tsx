import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { ContactGrid } from "@/components/ContactGrid";
import { Header } from "@/components/Header";
import { sampleContacts } from "@/data/contacts";
import { useActionSearch } from "@/hooks/useActionSearch";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { contacts: filteredContacts, action, searchTerm } = useActionSearch(sampleContacts, searchQuery);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Header contactCount={filteredContacts.length} />
        
        <div className="mb-10">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Try 'email sarah' or 'call marketing'..."
          />
        </div>

        {searchQuery && (
          <div className="mb-6 animate-fade-in">
            <p className="text-sm text-muted-foreground">
              {action ? (
                <>
                  Ready to <span className="font-medium text-primary">{action}</span>
                  {searchTerm && (
                    <> • {filteredContacts.length} result{filteredContacts.length !== 1 ? "s" : ""} for "<span className="font-medium text-foreground">{searchTerm}</span>"</>
                  )}
                </>
              ) : (
                <>
                  Showing {filteredContacts.length} result{filteredContacts.length !== 1 ? "s" : ""} for{" "}
                  <span className="font-medium text-foreground">"{searchQuery}"</span>
                </>
              )}
            </p>
          </div>
        )}

        <ContactGrid contacts={filteredContacts} searchQuery={searchQuery} action={action} />
      </div>
    </div>
  );
};

export default Index;
