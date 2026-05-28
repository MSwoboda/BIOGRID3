import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function formatDate(dateString: string | number) {
  if (!dateString) return "Unknown Date";
  
  if (typeof dateString === 'number') {
    return new Date(dateString).toLocaleDateString();
  }

  // OpenFDA dates are often YYYYMMDD string format
  if (dateString.length === 8 && !dateString.includes("-")) {
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  
  return new Date(dateString).toLocaleDateString();
}
