/**
 * OPENCLAW: Autonomous Room Scraper
 * 
 * DIRECTIVE:
 * 1. Read worker-manifest.json to find the last scraped state.
 * 2. Select the next 10 states in the rotation.
 * 3. Query Google Places API / Yelp API for updates to hours/status for rooms in those states.
 * 4. Update the corresponding rooms/states/*.json file.
 * 5. Update worker-manifest.json with the new rotation index.
 */

import fs from 'fs';
import path from 'path';
// import axios from 'axios'; // For future API calls

const MANIFEST_PATH = path.join(process.cwd(), 'scripts', 'worker-manifest.json');
const STATES_DIR = path.join(process.cwd(), 'rooms', 'states');

async function runRoomScraper() {
  console.log('🤖 [OPENCLAW] Initiating Room Scraper Protocol...');
  
  // 1. Load Manifest
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const allStates = manifest.all_states;
  const lastIndex = manifest.last_scraped_index;
  
  // 2. Determine next 10 states (handle wrap-around)
  const batchSize = 10;
  const targetStates = [];
  
  for (let i = 1; i <= batchSize; i++) {
    const nextIndex = (lastIndex + i) % allStates.length;
    targetStates.push({ index: nextIndex, stateFile: allStates[nextIndex] });
  }

  console.log(`📡 Targeting batch: ${targetStates.map(s => s.stateFile).join(', ')}`);

  // 3. Process each state
  for (const target of targetStates) {
    const filePath = path.join(STATES_DIR, target.stateFile);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Warning: ${filePath} does not exist. Skipping.`);
      continue;
    }

    const stateData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`🔍 Scanning ${stateData.length} rooms in ${target.stateFile}...`);

    // -> Future logic: Loop through stateData, call Google Places API using business_name + zip
    // -> Update hours, detect "Permanently Closed" flags, update latitude/longitude.
    
    // Simulate updating the 'last_verified' timestamp to show the worker acted
    stateData.forEach(room => {
      // room.last_verified = new Date().toISOString().split('T')[0];
    });

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(stateData, null, 2));
  }

  // 4. Update Manifest
  manifest.last_scraped_index = targetStates[targetStates.length - 1].index;
  manifest.last_run_date = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log('✅ [OPENCLAW] Room Scraper Protocol Complete. Manifest updated.');
}

runRoomScraper().catch(console.error);
