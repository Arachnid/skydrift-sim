/**
 * Time formatting utilities
 * 
 * This file contains functions to format time values for display in the UI.
 * Internal simulation time is stored in milliseconds, where 1000ms = 1 day.
 * 
 * For display purposes, we use the following units:
 * - 1 year = 365 days (0-indexed)
 * - 1 month = 73 days (uniformly, 1-indexed)
 * - 1 day = 24 hours (1-indexed)
 */

/**
 * Convert simulation time to a formatted string in the format yyyy-mm-dd
 * with optional 'h' suffix for hours
 * 
 * @param timestamp Simulation time in milliseconds
 * @param includeHours Whether to include hours in the output (default: true)
 * @returns Formatted time string
 */
export function formatTime(timestamp: number, includeHours: boolean = true): string {
  // Convert from milliseconds to days
  const totalDays = timestamp / 1000;
  
  // Calculate years, months, days
  const years = Math.floor(totalDays / 365); // Years are 0-indexed
  const remainingDaysAfterYears = totalDays % 365;
  
  const months = Math.floor(remainingDaysAfterYears / 73) + 1; // Months are 1-indexed
  const days = Math.floor(remainingDaysAfterYears % 73) + 1; // Days are 1-indexed
  
  // Calculate hours (fractional part of days)
  const hours = Math.floor((totalDays % 1) * 24);
  
  // Format the string in yyyy-mm-dd format
  // Ensure months and days have leading zeros if needed
  const formattedYear = years.toString().padStart(4, '0');
  const formattedMonth = months.toString().padStart(2, '0');
  const formattedDay = days.toString().padStart(2, '0');
  
  let result = `${formattedYear}-${formattedMonth}-${formattedDay}`;
  
  // Add hours suffix if requested and if there are hours
  if (includeHours && hours > 0) {
    result += ` ${hours}h`;
  }
  
  return result;
}

/**
 * Parse a date string in yyyy-mm-dd [h]h format back to simulation time (milliseconds)
 * 
 * @param dateString A date string in the format yyyy-mm-dd with optional hours suffix
 * @returns Simulation time in milliseconds, or null if the format is invalid
 */
export function parseTimeString(dateString: string): number | null {
  // Regular expression to match yyyy-mm-dd with optional hours
  const dateRegex = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d+)h)?$/;
  const match = dateString.match(dateRegex);
  
  if (!match) {
    return null;
  }
  
  // Extract components
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hours = match[4] ? parseInt(match[4], 10) : 0;
  
  // Validate ranges
  if (year < 0 || month < 1 || month > 5 || day < 1 || day > 73 || hours < 0 || hours >= 24) {
    return null;
  }
  
  // Convert to total days
  // Year is 0-indexed for calculation
  const daysFromYears = year * 365;
  
  // Month is 1-indexed, so subtract 1 to get 0-indexed for calculation
  const daysFromMonths = (month - 1) * 73;
  
  // Day is 1-indexed, so subtract 1 to get 0-indexed for calculation
  const daysFromDays = (day - 1);
  
  // Hours as a fraction of a day
  const daysFromHours = hours / 24;
  
  // Calculate total days
  const totalDays = daysFromYears + daysFromMonths + daysFromDays + daysFromHours;
  
  // Convert to milliseconds (1 day = 1000ms in the simulation)
  return totalDays * 1000;
}

/**
 * Format a duration (in days) to a readable string
 * 
 * @param duration Duration in days
 * @returns Formatted duration string
 */
export function formatDuration(duration: number): string {
  if (duration < 1/24) {
    // Less than an hour
    const minutes = Math.round(duration * 24 * 60);
    return `${minutes} minutes`;
  } else if (duration < 1) {
    // Less than a day
    const hours = Math.round(duration * 24);
    return `${hours} hours`;
  } else if (duration < 73) {
    // Less than a month
    return `${duration.toFixed(1)} days`;
  } else if (duration < 365) {
    // Less than a year
    const months = Math.floor(duration / 73);
    const days = Math.round(duration % 73);
    return `${months} month${months !== 1 ? 's' : ''}, ${days} days`;
  } else {
    // More than a year
    const years = Math.floor(duration / 365);
    const remainingDays = duration % 365;
    const months = Math.floor(remainingDays / 73);
    const days = Math.round(remainingDays % 73);
    
    let result = `${years} year${years !== 1 ? 's' : ''}`;
    if (months > 0) {
      result += `, ${months} month${months !== 1 ? 's' : ''}`;
    }
    if (days > 0) {
      result += `, ${days} day${days !== 1 ? 's' : ''}`;
    }
    return result;
  }
} 