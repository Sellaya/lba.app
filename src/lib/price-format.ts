/**
 * Format price with comma separators for thousands
 * Example: 1000 -> "1,000.00", 1234.56 -> "1,234.56"
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

