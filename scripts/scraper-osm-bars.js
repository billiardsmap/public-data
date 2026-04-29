import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The Overpass QL query
// Fetches bars/pubs in the US tagged with pool_table=yes or billiards=yes
const query = `
[out:json][timeout:90];
area["ISO3166-1"="US"][admin_level=2]->.searchArea;
(
  node["amenity"="bar"]["pool_table"="yes"](area.searchArea);
  node["amenity"="pub"]["pool_table"="yes"](area.searchArea);
  node["amenity"="bar"]["billiards"="yes"](area.searchArea);
  node["amenity"="pub"]["billiards"="yes"](area.searchArea);
  way["amenity"="bar"]["pool_table"="yes"](area.searchArea);
  way["amenity"="pub"]["pool_table"="yes"](area.searchArea);
);
out center;
`;

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function generateSlug(name, city, state) {
  const base = `${name} ${city || ''} ${state || ''}`.trim();
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

console.log("🚀 Initializing OpenStreetMap (OSM) Bar Box Scraper...");
console.log("📡 Querying Overpass API for dive bars and pubs with 'pool_table=yes'...");

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
      console.log(`✅ Fetched ${data.elements.length} bar box locations from OSM!`);

      const statesMap = new Map();
      let unassigned = [];

      data.elements.forEach(el => {
        const tags = el.tags || {};
        if (!tags.name) return;

        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        const stateStr = tags['addr:state'] || '';
        const cityStr = tags['addr:city'] || '';
        
        const room = {
          id: `osm-bar-${el.id}`,
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
          table_count: 1, // Assume 1 bar box by default for pubs
          verified_status: "partial_verified",
          source_attribution: ["OpenStreetMap_BarBox"],
          owner_operator: "",
          hours: {},
          table_types: {
             "bar_tables": 1
          },
          cloth_type: "",
          league_types: [],
          tournament_frequency: "",
          photo_gallery: [],
          primary_hero_image: "/images/hero-table.jpg",
          room_description: tags.description || `Local bar or pub mapped with pool tables via OpenStreetMap.`,
        };

        if (stateStr && stateStr.length === 2) {
          const s = stateStr.toLowerCase();
          if (!statesMap.has(s)) statesMap.set(s, []);
          statesMap.get(s).push(room);
        } else if (stateStr && stateStr.length > 2) {
          const s = stateStr.toLowerCase().replace(/\s+/g, '-');
          if (!statesMap.has(s)) statesMap.set(s, []);
          statesMap.get(s).push(room);
        } else {
          unassigned.push(room);
        }
      });

      const statesDir = path.join(__dirname, '../rooms/states');
      if (!fs.existsSync(statesDir)) fs.mkdirSync(statesDir, { recursive: true });

      let totalSaved = 0;
      for (const [state, rooms] of statesMap.entries()) {
        const filePath = path.join(statesDir, `${state}.json`);
        let existing = [];
        if (fs.existsSync(filePath)) {
          existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        
        const existingIds = new Set(existing.map(r => r.id));
        const newRooms = rooms.filter(r => !existingIds.has(r.id));
        
        if (newRooms.length > 0) {
          const merged = [...existing, ...newRooms];
          fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
          console.log(`📁 Saved ${newRooms.length} new bar boxes to states/${state}.json`);
          totalSaved += newRooms.length;
        }
      }

      if (unassigned.length > 0) {
        const unassignedPath = path.join(__dirname, '../rooms/states/unassigned-osm-bars.json');
        let existingUnassigned = [];
        if (fs.existsSync(unassignedPath)) {
          existingUnassigned = JSON.parse(fs.readFileSync(unassignedPath, 'utf8'));
        }
        const existingIds = new Set(existingUnassigned.map(r => r.id));
        const newUnassigned = unassigned.filter(r => !existingIds.has(r.id));
        
        if (newUnassigned.length > 0) {
          fs.writeFileSync(unassignedPath, JSON.stringify([...existingUnassigned, ...newUnassigned], null, 2));
          console.log(`📁 Saved ${newUnassigned.length} bars to states/unassigned-osm-bars.json (Requires Geocoding)`);
          totalSaved += newUnassigned.length;
        }
      }

      console.log(`🎉 OSM Bar Box Scraper Complete! Total new venues seeded: ${totalSaved}`);

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
