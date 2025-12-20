import { useState, useCallback } from "react";

interface ParsedContact {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
}

export function useFileContacts() {
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const parseVCF = (content: string): ParsedContact[] => {
    const contacts: ParsedContact[] = [];
    const vcards = content.split(/(?=BEGIN:VCARD)/gi).filter(Boolean);

    for (const vcard of vcards) {
      if (!vcard.includes("BEGIN:VCARD")) continue;

      const lines = vcard.split(/\r?\n/);
      let name = "";
      let email = "";
      let phone = "";
      let company = "";
      let role = "";

      for (const line of lines) {
        const upperLine = line.toUpperCase();
        
        // Full Name
        if (upperLine.startsWith("FN:") || upperLine.startsWith("FN;")) {
          name = line.substring(line.indexOf(":") + 1).trim();
        }
        // Email
        else if (upperLine.startsWith("EMAIL:") || upperLine.startsWith("EMAIL;")) {
          if (!email) {
            email = line.substring(line.indexOf(":") + 1).trim();
          }
        }
        // Phone
        else if (upperLine.startsWith("TEL:") || upperLine.startsWith("TEL;")) {
          if (!phone) {
            phone = line.substring(line.indexOf(":") + 1).trim();
          }
        }
        // Organization
        else if (upperLine.startsWith("ORG:") || upperLine.startsWith("ORG;")) {
          const orgValue = line.substring(line.indexOf(":") + 1).trim();
          company = orgValue.split(";")[0].trim();
        }
        // Title/Role
        else if (upperLine.startsWith("TITLE:") || upperLine.startsWith("TITLE;")) {
          role = line.substring(line.indexOf(":") + 1).trim();
        }
        // Fallback to N field if FN is missing
        else if (!name && (upperLine.startsWith("N:") || upperLine.startsWith("N;"))) {
          const nValue = line.substring(line.indexOf(":") + 1).trim();
          const parts = nValue.split(";");
          const lastName = parts[0] || "";
          const firstName = parts[1] || "";
          name = `${firstName} ${lastName}`.trim();
        }
      }

      if (name) {
        contacts.push({ name, email, phone, company, role });
      }
    }

    return contacts;
  };

  const parseCSV = (content: string): ParsedContact[] => {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    // Parse header row
    const headerLine = lines[0];
    const headers = parseCSVRow(headerLine).map(h => h.toLowerCase().trim());

    // Find column indices for common field names
    const nameIdx = findColumnIndex(headers, ["name", "full name", "fullname", "display name", "displayname", "contact name"]);
    const firstNameIdx = findColumnIndex(headers, ["first name", "firstname", "given name", "givenname"]);
    const lastNameIdx = findColumnIndex(headers, ["last name", "lastname", "surname", "family name", "familyname"]);
    const emailIdx = findColumnIndex(headers, ["email", "e-mail", "email address", "primary email"]);
    const phoneIdx = findColumnIndex(headers, ["phone", "telephone", "mobile", "cell", "phone number", "mobile phone", "primary phone"]);
    const companyIdx = findColumnIndex(headers, ["company", "organization", "org", "employer", "company name"]);
    const roleIdx = findColumnIndex(headers, ["role", "title", "job title", "job", "position", "job role"]);

    const contacts: ParsedContact[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVRow(lines[i]);
      if (values.length === 0) continue;

      let name = "";
      if (nameIdx !== -1) {
        name = values[nameIdx]?.trim() || "";
      } else if (firstNameIdx !== -1 || lastNameIdx !== -1) {
        const firstName = firstNameIdx !== -1 ? values[firstNameIdx]?.trim() || "" : "";
        const lastName = lastNameIdx !== -1 ? values[lastNameIdx]?.trim() || "" : "";
        name = `${firstName} ${lastName}`.trim();
      }

      if (!name) continue;

      contacts.push({
        name,
        email: emailIdx !== -1 ? values[emailIdx]?.trim() || "" : "",
        phone: phoneIdx !== -1 ? values[phoneIdx]?.trim() || "" : "",
        company: companyIdx !== -1 ? values[companyIdx]?.trim() || "" : "",
        role: roleIdx !== -1 ? values[roleIdx]?.trim() || "" : "",
      });
    }

    return contacts;
  };

  const parseCSVRow = (row: string): string[] => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);

    return values;
  };

  const findColumnIndex = (headers: string[], possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const idx = headers.indexOf(name);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const handleFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const content = await file.text();
      const extension = file.name.toLowerCase().split(".").pop();

      let parsed: ParsedContact[] = [];

      if (extension === "vcf" || extension === "vcard") {
        parsed = parseVCF(content);
      } else if (extension === "csv") {
        parsed = parseCSV(content);
      } else {
        throw new Error("Unsupported file format. Please use .vcf or .csv files.");
      }

      if (parsed.length === 0) {
        throw new Error("No valid contacts found in the file.");
      }

      setContacts(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
      setContacts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearContacts = useCallback(() => {
    setContacts([]);
    setFileName(null);
    setError(null);
  }, []);

  return {
    contacts,
    isLoading,
    error,
    fileName,
    handleFile,
    clearContacts,
  };
}
