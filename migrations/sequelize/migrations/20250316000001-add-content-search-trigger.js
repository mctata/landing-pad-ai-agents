'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // First ensure the contents table has the tsvector column
    await queryInterface.sequelize.query(`
      ALTER TABLE contents 
      ADD COLUMN IF NOT EXISTS search_vector tsvector;
    `);
    
    // Create GIN index for the search_vector
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS contents_search_vector_idx ON contents USING GIN(search_vector);
    `);
    
    // Create function to update the search vector
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_content_search_vector()
      RETURNS TRIGGER AS $$
      DECLARE
        content_text TEXT;
      BEGIN
        -- Extract text from JSONB content field
        IF NEW.content IS NULL THEN
          content_text := '';
        ELSIF jsonb_typeof(NEW.content) = 'string' THEN
          content_text := NEW.content::TEXT;
        ELSIF jsonb_typeof(NEW.content) = 'object' THEN
          -- Try to extract text fields commonly used in our content structure
          content_text := '';
          
          -- Append body field if it exists
          IF NEW.content ? 'body' THEN
            IF jsonb_typeof(NEW.content->'body') = 'string' THEN
              content_text := content_text || ' ' || (NEW.content->>'body');
            END IF;
          END IF;
          
          -- Append text field if it exists
          IF NEW.content ? 'text' THEN
            IF jsonb_typeof(NEW.content->'text') = 'string' THEN
              content_text := content_text || ' ' || (NEW.content->>'text');
            END IF;
          END IF;
          
          -- Append description field if it exists
          IF NEW.content ? 'description' THEN
            IF jsonb_typeof(NEW.content->'description') = 'string' THEN
              content_text := content_text || ' ' || (NEW.content->>'description');
            END IF;
          END IF;
        ELSE
          content_text := '';
        END IF;
        
        -- Combine all searchable text
        NEW.search_vector := to_tsvector('english', 
          coalesce(NEW.title, '') || ' ' || 
          content_text || ' ' || 
          coalesce(NEW.meta_description, '') || ' ' || 
          array_to_string(NEW.keywords, ' ') || ' ' || 
          array_to_string(NEW.categories, ' ') || ' ' || 
          array_to_string(NEW.tags, ' ')
        );
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create trigger to update search vector on insert or update
    await queryInterface.sequelize.query(`
      CREATE TRIGGER content_search_vector_update
      BEFORE INSERT OR UPDATE ON contents
      FOR EACH ROW
      EXECUTE FUNCTION update_content_search_vector();
    `);
    
    // Update existing content records to populate search_vector
    await queryInterface.sequelize.query(`
      UPDATE contents 
      SET title = title 
      WHERE search_vector IS NULL;
    `);
  },

  async down (queryInterface, Sequelize) {
    // Drop trigger and function
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS content_search_vector_update ON contents;
      DROP FUNCTION IF EXISTS update_content_search_vector();
    `);
    
    // Remove search_vector column
    await queryInterface.sequelize.query(`
      ALTER TABLE contents DROP COLUMN IF EXISTS search_vector;
    `);
  }
};