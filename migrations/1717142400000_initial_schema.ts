import { MigrationBuilder } from 'node-pg-migrate';
import type { ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create users table
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    created_at: { 
      type: 'timestamp with time zone', 
      default: pgm.func('current_timestamp') 
    },
  });

  // Create fridge_items table
  pgm.createTable('fridge_items', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { 
      type: 'uuid', 
      notNull: true, 
      references: 'users(id)', 
      onDelete: 'CASCADE' 
    },
    name: { type: 'varchar(255)', notNull: true },
    category: { type: 'varchar(50)', notNull: true },
    added_date: { type: 'timestamp with time zone', notNull: true },
    expiry_date: { type: 'timestamp with time zone', notNull: true },
  });

  // Create saved_recipes table
  pgm.createTable('saved_recipes', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { 
      type: 'uuid', 
      notNull: true, 
      references: 'users(id)', 
      onDelete: 'CASCADE' 
    },
    title: { type: 'varchar(255)', notNull: true },
    description: { type: 'text', notNull: true },
    ingredients_used: { type: 'text[]', notNull: true },
    instructions: { type: 'text[]', notNull: true },
    difficulty: { type: 'varchar(50)', notNull: true },
    saved_at: { 
      type: 'timestamp with time zone', 
      default: pgm.func('current_timestamp') 
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('saved_recipes');
  pgm.dropTable('fridge_items');
  pgm.dropTable('users');
}
