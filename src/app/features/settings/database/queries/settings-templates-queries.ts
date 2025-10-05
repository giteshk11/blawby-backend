import { eq, and } from 'drizzle-orm';
import { db } from '@/database';
import { settingsTemplates } from '../schema';

// Settings Templates Queries
export class SettingsTemplatesQueries {
  // Get default settings template
  static async getDefaultTemplate(
    type: 'user' | 'organization',
    category: string,
  ) {
    const [template] = await db
      .select()
      .from(settingsTemplates)
      .where(
        and(
          eq(settingsTemplates.type, type),
          eq(settingsTemplates.category, category),
          eq(settingsTemplates.isDefault, true),
        ),
      )
      .limit(1);

    return template;
  }

  // Get all templates for a type
  static async getTemplatesByType(type: 'user' | 'organization') {
    return await db
      .select()
      .from(settingsTemplates)
      .where(eq(settingsTemplates.type, type));
  }

  // Get template by ID
  static async getTemplateById(templateId: string) {
    const [template] = await db
      .select()
      .from(settingsTemplates)
      .where(eq(settingsTemplates.id, templateId))
      .limit(1);

    return template;
  }

  // Create new template
  static async createTemplate(
    name: string,
    type: 'user' | 'organization',
    category: string,
    settings: any,
    isDefault = false,
  ) {
    const [template] = await db
      .insert(settingsTemplates)
      .values({
        name,
        type,
        category,
        settings,
        isDefault,
      })
      .returning();

    return template;
  }

  // Update template
  static async updateTemplate(
    templateId: string,
    updates: {
      name?: string;
      settings?: any;
      isDefault?: boolean;
    },
  ) {
    const [template] = await db
      .update(settingsTemplates)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(settingsTemplates.id, templateId))
      .returning();

    return template;
  }

  // Delete template
  static async deleteTemplate(templateId: string) {
    await db
      .delete(settingsTemplates)
      .where(eq(settingsTemplates.id, templateId));
  }

  // Set template as default
  static async setDefaultTemplate(templateId: string) {
    // First, unset all other defaults for the same type and category
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    await db
      .update(settingsTemplates)
      .set({ isDefault: false })
      .where(
        and(
          eq(settingsTemplates.type, template.type),
          eq(settingsTemplates.category, template.category),
        ),
      );

    // Then set this template as default
    const [updated] = await db
      .update(settingsTemplates)
      .set({ isDefault: true })
      .where(eq(settingsTemplates.id, templateId))
      .returning();

    return updated;
  }

  // Get all templates
  static async getAllTemplates(limit = 100, offset = 0) {
    return await db
      .select()
      .from(settingsTemplates)
      .limit(limit)
      .offset(offset);
  }

  // Get templates by category
  static async getTemplatesByCategory(
    type: 'user' | 'organization',
    category: string,
  ) {
    return await db
      .select()
      .from(settingsTemplates)
      .where(
        and(
          eq(settingsTemplates.type, type),
          eq(settingsTemplates.category, category),
        ),
      );
  }

  // Check if template exists
  static async templateExists(
    type: 'user' | 'organization',
    category: string,
    name: string,
  ): Promise<boolean> {
    const [template] = await db
      .select({ id: settingsTemplates.id })
      .from(settingsTemplates)
      .where(
        and(
          eq(settingsTemplates.type, type),
          eq(settingsTemplates.category, category),
          eq(settingsTemplates.name, name),
        ),
      )
      .limit(1);

    return !!template;
  }
}
