/**
 * OPENCLAW: Verification & Scoring Engine
 * 
 * DIRECTIVE:
 * 1. Read all JSON files in the repository.
 * 2. Validate strict schema compliance (e.g., table_types must equal table_count).
 * 3. Auto-calculate the 'verification_score' for each room.
 * 4. Flag anomalies or corrupt entries for human review.
 */

import fs from 'fs';
import path from 'path';

const STATES_DIR = path.join(process.cwd(), 'rooms', 'states');

function calculateTrustScore(room) {
  let score = 50; // Base score
  
  // +10 for having granular table types
  if (room.table_types && Object.values(room.table_types).some(v => v > 0)) {
    score += 15;
    
    // Safety check: Do the table types sum up to the total count?
    const sum = Object.values(room.table_types).reduce((a, b) => a + b, 0);
    if (sum !== room.table_count && room.table_count > 0) {
      console.warn(`⚠️ [ANOMALY] ${room.slug}: table_count (${room.table_count}) != sum of types (${sum})`);
      score -= 20; // Penalize for bad math
    }
  }

  // +10 for photos
  if (room.photo_gallery && room.photo_gallery.length > 0) score += 10;
  
  // +10 for having verified leagues
  if (room.league_types && room.league_types.length > 0) score += 10;
  
  // +15 for multiple verification sources
  if (room.verification_sources && room.verification_sources.length > 1) score += 15;

  return Math.min(score, 100); // Cap at 100
}

async function runDataVerifier() {
  console.log('🤖 [OPENCLAW] Initiating Data Verification Engine...');
  
  const stateFiles = fs.readdirSync(STATES_DIR).filter(f => f.endsWith('.json'));
  let totalRoomsVerified = 0;
  let totalAnomalies = 0;

  for (const file of stateFiles) {
    const filePath = path.join(STATES_DIR, file);
    let stateData;
    try {
      stateData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.error(`❌ [ERROR] Failed to parse ${file}: JSON is invalid!`);
      continue;
    }

    let modified = false;

    stateData.forEach(room => {
      const oldScore = room.verification_score;
      const newScore = calculateTrustScore(room);
      
      if (oldScore !== newScore) {
        room.verification_score = newScore;
        modified = true;
      }
      
      if (newScore < 50) {
        totalAnomalies++;
      }
      
      totalRoomsVerified++;
    });

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(stateData, null, 2));
    }
  }

  console.log(`✅ [OPENCLAW] Verification Complete.`);
  console.log(`📊 Stats: ${totalRoomsVerified} rooms verified. ${totalAnomalies} low-trust anomalies detected.`);
}

runDataVerifier().catch(console.error);
