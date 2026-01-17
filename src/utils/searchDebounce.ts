/**
 * Search Debounce Utility
 * Provides debouncing for search queries to improve performance
 */

/**
 * Create a debounced version of a function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Debounce search query with configurable delay
 */
export function debounceSearch(
  query: string,
  delay: number = 300
): Promise<string> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(query);
    }, delay);

    // Return cleanup function
    return () => clearTimeout(timeout);
  });
}
