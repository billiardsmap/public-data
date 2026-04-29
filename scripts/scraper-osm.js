const fs = require('fs');
const path = require('path');
const https = require('https');

// The Overpass QL query
// Fetches all nodes, ways, and relations in the US tagged with sport=billiards
const query = `
[out:json][timeout:90];
area["ISO3166-1"="US"][admin_level=2]->.searchArea;
(
  node["sport"="billiards"](area.searchArea);
  way["sport"="billiards"](area.searchArea);
  relation["sport"="billiards"](area.searchArea);
);
out center;
`;

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Helper to safely format slugs
function generateSlug(name, city, state) {
  const base = `${name} ${city || ''} ${state || ''}`.trim();
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

console.log("🚀 Initializing OpenStreetMap (OSM) Scraper...");
console.log("📡 Querying Overpass API for all 'sport=billiards' tags in the US...");

const req = https.request(OVERPASS_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'User-Agent': 'BilliardsMapNationalRegistry/1.0 (kb907alaska@github.com)'
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error(`❌ Overpass API Error: ${res.statusCode}`);
      console.error(body);
      process.exit(1);
    }

    try {
      const data = JSON.parse(body);
      console.log(`✅ Fetched ${data.elements.length} billiard locations from OSM!`);

      const statesMap = new Map();
      let unassigned = [];

      data.elements.forEach(el => {
        const tags = el.tags || {};
        // If it doesn't have a name, we skip it or mark it as unnamed for moderation
        if (!tags.name) return;

        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        const stateStr = tags['addr:state'] || '';
        const cityStr = tags['addr:city'] || '';
        
        const room = {
          id: `osm-${el.id}`,
          business_name: tags.name,
          slug: generateSlug(tags.name, cityStr, stateStr),
          street_address: tags['addr:street'] ? `${tags['addr:housenumber'] || ''} ${tags['addr:street']}`.trim() : '',
          city: cityStr,
          state: stateStr,
          zip: tags['addr:postcode'] || '',
          latitude: lat,
          longitude: lon,
          phone: tags.phone || tags['contact:phone'] || '',
          website: tags.website || tags['contact:website'] || '',
          table_count: tags['billiards:pool'] ? parseInt(tags['billiards:pool'], 10) : null,
          verified_status: "partial_verified",
          source_attribution: ["OpenStreetMap"],
          // Seed missing fields with blanks to match schema
          owner_operator: "",
          hours: {},
          table_types: {},
          cloth_type: "",
          league_types: [],
          tournament_frequency: "",
          photo_gallery: [],
          primary_hero_image: "/images/hero-table.jpg",
          room_description: tags.description || `Mapped billiard location via OpenStreetMap.`,
        };

        if (stateStr && stateStr.length === 2) {
          // It's a standard state code (e.g., TX, CA)
          const s = stateStr.toLowerCase();
          if (!statesMap.has(s)) statesMap.set(s, []);
          statesMap.get(s).push(room);
        } else if (stateStr && stateStr.length > 2) {
          // Full state name or weird data
          const s = stateStr.toLowerCase().replace(/\s+/g, '-');
          if (!statesMap.has(s)) statesMap.set(s, []);
          statesMap.get(s).push(room);
        } else {
          // Missing state tag, requires geocoding resolution later
          unassigned.push(room);
        }
      });

      // Write State Files
      const statesDir = path.join(__dirname, '../rooms/states');
      if (!fs.existsSync(statesDir)) fs.mkdirSync(statesDir, { recursive: true });

      let totalSaved = 0;
      for (const [state, rooms] of statesMap.entries()) {
        const filePath = path.join(statesDir, `${state}.json`);
        let existing = [];
        if (fs.existsSync(filePath)) {
          existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        
        // Merge without duplicates (using OSM ID as key)
        const existingIds = new Set(existing.map(r => r.id));
        const newRooms = rooms.filter(r => !existingIds.has(r.id));
        
        if (newRooms.length > 0) {
          const merged = [...existing, ...newRooms];
          fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
          console.log(`📁 Saved ${newRooms.length} new rooms to states/${state}.json`);
          totalSaved += newRooms.length;
        }
      }

      // Write Unassigned Files (to be picked up by geocoder later)
      if (unassigned.length > 0) {
        const unassignedPath = path.join(__dirname, '../rooms/states/unassigned-osm.json');
        let existingUnassigned = [];
        if (fs.existsSync(unassignedPath)) {
          existingUnassigned = JSON.parse(fs.readFileSync(unassignedPath, 'utf8'));
        }
        const existingIds = new Set(existingUnassigned.map(r => r.id));
        const newUnassigned = unassigned.filter(r => !existingIds.has(r.id));
        
        if (newUnassigned.length > 0) {
          fs.writeFileSync(unassignedPath, JSON.stringify([...existingUnassigned, ...newUnassigned], null, 2));
          console.log(`📁 Saved ${newUnassigned.length} rooms to states/unassigned-osm.json (Requires Geocoding)`);
          totalSaved += newUnassigned.length;
        }
      }

      console.log(`🎉 OSM Scraper Complete! Total new venues seeded: ${totalSaved}`);

    } catch (err) {
      console.error("❌ Failed to parse OSM data:", err);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ HTTP Request Error: ${e.message}`);
});

req.write('data=' + encodeURIComponent(query));
req.end();
