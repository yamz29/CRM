/**
 * Helpers puros de nomenclatura para SharePoint, sin dependencias de MSAL
 * (browser) ni de Graph. Vive aparte de `lib/sharepoint.ts` para poder usarse
 * tanto en cliente como en servidor sin arrastrar `@azure/msal-browser`.
 */

/** Sanitiza un string para usarlo como nombre de carpeta/archivo en SharePoint */
export function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*#%&{}~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 128)
}
