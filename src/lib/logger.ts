/**
 * Centralized logging utility
 * Replaces console.log with environment-aware logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    console.info(`[INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }

  /**
   * Log WhatsApp-related messages
   */
  whatsapp(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`[WhatsApp] ${message}`, ...args);
    }
  }

  /**
   * Log email-related messages
   */
  email(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`[Email] ${message}`, ...args);
    }
  }

  /**
   * Log scheduling-related messages
   */
  schedule(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`[Schedule] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();

