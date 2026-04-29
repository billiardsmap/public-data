const fs = require('fs');
const path = require('path');

// A simple mock validator script that would run in Github Actions
console.log("Starting Data Validation and Deduplication Pipeline...");

const VERIFIED_INDEX_PATH = path.join(__dirname, '../rooms/verified-index.json');

try {
  const data = JSON.parse(fs.readFileSync(VERIFIED_INDEX_PATH, 'utf8'));
  console.log(`Loaded ${data.length} rooms from verified index.`);

  let errors = 0;
  const slugs = new Set();

  data.forEach((room, index) => {
    // 1. Schema Validation (mocked)
    if (!room.id || !room.slug || !room.business_name || !room.city || !room.state) {
      console.error(`[ERROR] Room at index ${index} is missing required schema fields.`);
      errors++;
    }

    // 2. Duplicate Detection (Slug/Name)
    if (slugs.has(room.slug)) {
      console.error(`[ERROR] Duplicate slug detected: ${room.slug}`);
      errors++;
    }
    slugs.add(room.slug);

    // 3. Trust Verification
    if (!room.source_attribution || room.source_attribution.length === 0) {
      console.warn(`[WARNING] Room ${room.slug} has no source attribution.`);
    }
  });

  if (errors > 0) {
    console.error(`Validation failed with ${errors} errors.`);
    process.exit(1);
  } else {
    console.log("Validation passed. Data is clean and ready for deployment.");
    process.exit(0);
  }

} catch (err) {
  console.error("Failed to read verified index:", err);
  process.exit(1);
}
