import { readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Auto-Discovery Service Registry for Stripe Webhook Events
 * Automatically detects and imports all services from the services directory
 */

interface ServiceRegistry {
  [key: string]: any;
}

class StripeServiceRegistry {
  private services: ServiceRegistry = {};
  private servicesPath = '../app/features/stripe/services';

  /**
   * Auto-discover all service files in the services directory
   */
  private discoverServices(): string[] {
    try {
      const servicesDir = join(__dirname, this.servicesPath);
      const files = readdirSync(servicesDir);

      return files
        .filter((file) => {
          const filePath = join(servicesDir, file);
          const stat = statSync(filePath);
          return (
            stat.isFile() &&
            file.endsWith('.ts') &&
            !file.includes('.test.') &&
            !file.includes('.spec.')
          );
        })
        .map((file) => file.replace('.ts', ''));
    } catch (error) {
      console.warn('[ServiceRegistry] Could not discover services:', error);
      return [];
    }
  }

  /**
   * Get a service instance, importing it if not already loaded
   */
  async getService<T>(serviceName: string): Promise<T> {
    if (!this.services[serviceName]) {
      try {
        const module = await import(`${this.servicesPath}/${serviceName}`);
        const ServiceClass = Object.values(module)[0] as new () => T;
        this.services[serviceName] = new ServiceClass();
        console.log(`✅ [ServiceRegistry] Loaded service: ${serviceName}`);
      } catch (error) {
        console.error(
          `[ServiceRegistry] Failed to load service ${serviceName}:`,
          error,
        );
        throw error;
      }
    }
    return this.services[serviceName] as T;
  }

  /**
   * Auto-generate service getters based on discovered services
   */
  private generateServiceGetters(): void {
    const discoveredServices = this.discoverServices();

    discoveredServices.forEach((serviceName) => {
      const methodName = `get${this.capitalizeFirst(serviceName)}`;

      // Add dynamic method to the class
      (this as any)[methodName] = async (): Promise<any> => {
        return this.getService(serviceName);
      };
    });

    console.log(
      `🔧 [ServiceRegistry] Auto-generated getters for services: ${discoveredServices.join(', ')}`,
    );
  }

  /**
   * Capitalize first letter of string
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Get all available service names
   */
  getAvailableServices(): string[] {
    return this.discoverServices();
  }

  /**
   * Initialize the registry
   */
  initialize(): void {
    this.generateServiceGetters();
  }
}

// Export singleton instance
export const serviceRegistry = new StripeServiceRegistry();
