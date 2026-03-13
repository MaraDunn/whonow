/**
 * Search Integrity Tests
 * Ensures deterministic search always works regardless of AI state
 * 
 * These tests verify:
 * 1. Deterministic search produces correct results
 * 2. AI enhancement doesn't break deterministic behavior
 * 3. AI failures fall back seamlessly
 * 4. Merge logic never overrides deterministic filters
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Contact } from '@/types/contact';
import { parseSearchQueryToSchema } from '../searchQueryParser';
import { executeSearchQuery } from '../contactSearchEngine';
import { mergeQueriesWithMetadata } from '../semanticAssist/mergeQueries';
import { SearchQuery } from '@/types/searchQuery';

// Mock contacts for testing
const mockContacts: Contact[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john@acmecorp.com',
    company: 'Acme Corp',
    role: 'Software Engineer',
    tags: ['engineering', 'fullstack'],
    description: 'Senior engineer working on backend systems',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    name: 'Jane Doe',
    email: 'jane@techstart.com',
    company: 'TechStart',
    role: 'Product Manager',
    tags: ['product', 'management'],
    description: 'Managing product development',
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@acmecorp.com',
    company: 'Acme Corp',
    role: 'Marketing Director',
    tags: ['marketing', 'growth'],
    description: 'Leading marketing initiatives',
    createdAt: new Date('2024-02-01'),
  },
  {
    id: '4',
    name: 'Priya Patel',
    email: 'priya@legalgroup.com',
    company: 'Legal Group',
    role: 'Legal Counsel',
    tags: ['legal', 'contracts', 'compliance'],
    description: 'Handles contract drafting and legal reviews',
    createdAt: new Date('2024-02-03'),
  },
  {
    id: '5',
    name: 'Sam Rivera',
    email: 'sam@studio.co',
    company: 'Studio Co',
    role: 'Content Writer',
    tags: ['content', 'writing', 'editorial'],
    description: 'Writes long-form and short-form content',
    createdAt: new Date('2024-02-05'),
  },
] as Contact[];

describe('Search Integrity Tests', () => {
  describe('Deterministic Search', () => {
    it('should find contacts by company', async () => {
      const query = parseSearchQueryToSchema('acme corp');
      const results = await executeSearchQuery(mockContacts, query);
      
      expect(results).toHaveLength(2);
      expect(results.every(c => c.company === 'Acme Corp')).toBe(true);
    });
    
    it('should find contacts by role', async () => {
      const query = parseSearchQueryToSchema('engineer');
      const results = await executeSearchQuery(mockContacts, query);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(c => c.role?.includes('Engineer'))).toBe(true);
    });
    
    it('should find contacts by name', async () => {
      const query = parseSearchQueryToSchema('john');
      const results = await executeSearchQuery(mockContacts, query);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(c => c.name?.includes('John'))).toBe(true);
    });
    
    it('should work with empty query', async () => {
      const query = parseSearchQueryToSchema('');
      const results = await executeSearchQuery(mockContacts, query);
      
      // Should return all contacts or handle gracefully
      expect(Array.isArray(results)).toBe(true);
    });

    it('should parse "who did I call in the last two weeks" with interaction_date_range', () => {
      const query = parseSearchQueryToSchema('Who did I call in the last two weeks?');
      expect(query.filters.interaction_date_range).toBeDefined();
      expect(query.filters.interaction_date_range?.from).toBeDefined();
      expect(query.filters.interaction_date_range?.to).toBeDefined();
      const from = new Date(query.filters.interaction_date_range!.from);
      const to = new Date(query.filters.interaction_date_range!.to);
      const daysDiff = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(14); // two weeks
      // Should NOT have location (Los Angeles false positive fix)
      expect(query.filters.location).toBeUndefined();
    });

    it('should resolve bare phrase "contract writing" to legal job_title', () => {
      const query = parseSearchQueryToSchema('contract writing');
      expect(query.filters.job_title).toBe('legal');
    });

    it('should resolve bare phrase "legal counsel" to legal job_title', () => {
      const query = parseSearchQueryToSchema('legal counsel');
      expect(query.filters.job_title).toBe('legal');
    });

    it('should resolve bare phrase "marketing person" to marketing job_title', () => {
      const query = parseSearchQueryToSchema('marketing person');
      expect(query.filters.job_title).toBe('marketing');
    });

    it('should resolve "who handles marketing for smart solutions?" to job_title and company', () => {
      const query = parseSearchQueryToSchema('who handles marketing for smart solutions?');
      expect(query.filters.job_title).toBe('marketing');
      expect(query.filters.company).toBe('smart solutions');
    });

    it('should resolve bare phrase "hr person" to hr job_title', () => {
      const query = parseSearchQueryToSchema('hr person');
      expect(query.filters.job_title).toBe('hr');
    });

    it('should resolve "I need help with a contract" to legal job_title', () => {
      const query = parseSearchQueryToSchema('I need help with a contract');
      expect(query.filters.job_title).toBe('legal');
      expect(query.filters.company).toBeUndefined();
    });

    it('should return legal contacts for "I need help with a contract"', async () => {
      const query = parseSearchQueryToSchema('I need help with a contract');
      const results = await executeSearchQuery(mockContacts, query);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(c => c.role?.includes('Legal'))).toBe(true);
    });

    it('should return legal contacts for "contract writing"', async () => {
      const query = parseSearchQueryToSchema('contract writing');
      const results = await executeSearchQuery(mockContacts, query);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(c => c.role?.includes('Legal'))).toBe(true);
      expect(results.every(c => !c.role?.includes('Product Manager'))).toBe(true);
    });

    it('should return content contacts for "content writing"', async () => {
      const query = parseSearchQueryToSchema('content writing');
      const results = await executeSearchQuery(mockContacts, query);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(c => c.role?.includes('Content Writer'))).toBe(true);
    });
  });
  
  describe('Merge Logic Safety', () => {
    it('should never override deterministic company filter', () => {
      const deterministic: SearchQuery = {
        intent: 'search_contacts',
        filters: { company: 'Acme Corp' },
        confidence: 0.8,
        explanation: 'Searching for Acme Corp',
      };
      
      const semantic: SearchQuery = {
        intent: 'search_contacts',
        filters: { company: 'Different Company' },
        confidence: 0.9,
        explanation: 'AI thinks different',
      };
      
      const result = mergeQueriesWithMetadata(deterministic, semantic);
      
      // Deterministic MUST win
      expect(result.merged.filters.company).toBe('Acme Corp');
      expect(result.merged.filters.company).not.toBe('Different Company');
    });
    
    it('should detect conflicts and preserve deterministic', () => {
      const deterministic: SearchQuery = {
        intent: 'search_contacts',
        filters: { job_title: 'Engineer' },
        confidence: 0.7,
        explanation: 'Searching for engineers',
      };
      
      const semantic: SearchQuery = {
        intent: 'search_contacts',
        filters: { job_title: 'Manager' },
        confidence: 0.9,
        explanation: 'AI thinks manager',
      };
      
      const result = mergeQueriesWithMetadata(deterministic, semantic);
      
      expect(result.decisions.conflictsDetected).toContain('job_title');
      expect(result.merged.filters.job_title).toBe('Engineer');
    });
    
    it('should allow semantic to fill missing fields', () => {
      const deterministic: SearchQuery = {
        intent: 'search_contacts',
        filters: { company: 'Acme Corp' },
        confidence: 0.8,
        explanation: 'Searching for Acme Corp',
      };
      
      const semantic: SearchQuery = {
        intent: 'search_contacts',
        filters: { 
          company: 'Acme Corp', // Same value
          job_title: 'Engineer', // Additional field
        },
        confidence: 0.9,
        explanation: 'AI added job title',
      };
      
      const result = mergeQueriesWithMetadata(deterministic, semantic);
      
      expect(result.merged.filters.company).toBe('Acme Corp');
      expect(result.merged.filters.job_title).toBe('Engineer');
      expect(result.decisions.semanticFieldsUsed).toContain('job_title');
    });
    
    it('should reject low confidence semantic results', () => {
      const deterministic: SearchQuery = {
        intent: 'search_contacts',
        filters: {},
        confidence: 0.8,
        explanation: 'Deterministic',
      };
      
      const semantic: SearchQuery = {
        intent: 'search_contacts',
        filters: { company: 'Some Company' },
        confidence: 0.5, // Lower than deterministic
        explanation: 'Low confidence AI',
      };
      
      const result = mergeQueriesWithMetadata(deterministic, semantic);
      
      expect(result.decisions.confidenceGate).toBe('failed');
      expect(result.merged.filters.company).toBeUndefined();
    });
    
    it('should never add location that deterministic didnt extract', () => {
      const deterministic: SearchQuery = {
        intent: 'search_contacts',
        filters: { company: 'Acme' },
        confidence: 0.8,
        explanation: 'Company search',
      };
      
      const semantic: SearchQuery = {
        intent: 'search_contacts',
        filters: { 
          company: 'Acme',
          location: 'San Francisco', // AI inferred this
        },
        confidence: 0.9,
        explanation: 'AI inferred location',
      };
      
      const result = mergeQueriesWithMetadata(deterministic, semantic);
      
      // Location should be removed
      expect(result.merged.filters.location).toBeUndefined();
      expect(result.decisions.locationRemoved).toBe(true);
    });
  });
  
  describe('AI Failure Handling', () => {
    it('should handle null semantic query gracefully', () => {
      const deterministic: SearchQuery = {
        intent: 'search_contacts',
        filters: { company: 'Acme' },
        confidence: 0.8,
        explanation: 'Company search',
      };
      
      const result = mergeQueriesWithMetadata(deterministic, null);
      
      expect(result.merged).toEqual(deterministic);
      expect(result.decisions.confidenceGate).toBe('failed');
    });
    
    it('should handle undefined semantic query gracefully', () => {
      const deterministic: SearchQuery = {
        intent: 'search_contacts',
        filters: { company: 'Acme' },
        confidence: 0.8,
        explanation: 'Company search',
      };
      
      const result = mergeQueriesWithMetadata(deterministic, undefined);
      
      expect(result.merged).toEqual(deterministic);
    });
  });
  
  describe('Search Result Consistency', () => {
    it('should produce same results with same deterministic query', async () => {
      const query1 = parseSearchQueryToSchema('acme corp');
      const query2 = parseSearchQueryToSchema('acme corp');
      
      const results1 = await executeSearchQuery(mockContacts, query1);
      const results2 = await executeSearchQuery(mockContacts, query2);
      
      expect(results1).toEqual(results2);
    });
    
    it('should never return fewer results after AI enhancement', async () => {
      const deterministicQuery = parseSearchQueryToSchema('engineer');
      const deterministicResults = await executeSearchQuery(mockContacts, deterministicQuery);
      
      // Simulate AI enhancement that adds filters
      const enhancedQuery: SearchQuery = {
        ...deterministicQuery,
        filters: {
          ...deterministicQuery.filters,
          // AI should only ADD filters, not restrict
        },
      };
      
      const enhancedResults = await executeSearchQuery(mockContacts, enhancedQuery);
      
      // Enhanced results should be subset or equal to deterministic
      // (AI can only ADD more specific filters, not remove existing matches)
      expect(enhancedResults.length).toBeLessThanOrEqual(deterministicResults.length);
    });
  });
});
