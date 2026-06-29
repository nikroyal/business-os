/**
 * Centralized API URL builder utility.
 * Sanitizes base URLs and paths to prevent double-slash (//) errors.
 */
export function buildApiUrl(path: string): string {
  const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
  
  // Remove trailing slashes from base URL
  let baseUrl = envUrl.trim();
  while (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  // Remove leading slashes from the path
  let cleanPath = path.trim();
  while (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.slice(1);
  }
  
  // If the base URL is empty or matches root relative `/`, return single-slashed relative path
  if (!baseUrl || baseUrl === '') {
    return `/${cleanPath}`;
  }
  
  return `${baseUrl}/${cleanPath}`;
}
