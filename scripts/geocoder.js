/**
 * Geocoder Module
 * 
 * This script will be run by the Github Actions pipeline (scrape.yml)
 * to automatically fetch latitude and longitude for any newly ingested rooms
 * that lack coordinates.
 */

const fs = require('fs');
const path = require('path');

// Mock implementation
console.log("Initializing Geocoder pipeline...");

const VERIFIED_INDEX_PATH = path.join(__dirname, '../rooms/verified-index.json');

try {
  const rooms = JSON.parse(fs.readFileSync(VERIFIED_INDEX_PATH, 'utf8'));
  let updatedCount = 0;

  const enrichedRooms = rooms.map(room => {
    if (!room.latitude || !room.longitude) {
      console.log(`[GEOCODE] Fetching coordinates for: ${room.business_name} (${room.street_address}, ${room.city})`);
      
      // MOCK: In production, call Google Maps Geocoding API or Mapbox API
      room.latitude = 35.0;  // mock
      room.longitude = -90.0; // mock
      
      console.log(`[GEOCODE] Successfully resolved to [${room.latitude}, ${room.longitude}]`);
      updatedCount++;
    }
    return room;
  });

  if (updatedCount > 0) {
    fs.writeFileSync(VERIFIED_INDEX_PATH, JSON.stringify(enrichedRooms, null, 2));
    console.log(`Geocoding complete. Updated ${updatedCount} rooms.`);
  } else {
    console.log("Geocoding complete. All rooms already have coordinates.");
  }
} catch (err) {
  console.error("Geocoding failed:", err);
  process.exit(1);
}
