import { homedir, platform } from 'node:os';
import { join } from 'node:path';

/**
 * Resolve the default database path using platform-appropriate directories.
 *
 * - macOS: ~/Library/Application Support/pennyllm/usage.db
 * - Windows: %APPDATA%/pennyllm/usage.db
 * - Linux/other: $XDG_DATA_HOME/pennyllm/usage.db (fallback ~/.local/share)
 */
export function getDefaultDbPath(): string {
  const home = homedir();
  const os = platform();

  if (os === 'darwin') {
    return join(home, 'Library', 'Application Support', 'pennyllm', 'usage.db');
  }

  if (os === 'win32') {
    const appData = process.env['APPDATA'] ?? join(home, 'AppData', 'Roaming');
    return join(appData, 'pennyllm', 'usage.db');
  }

  // Linux and other platforms: XDG_DATA_HOME
  const xdgDataHome = process.env['XDG_DATA_HOME'] ?? join(home, '.local', 'share');
  return join(xdgDataHome, 'pennyllm', 'usage.db');
}
