const fs = require('fs');
const path = require('path');
const https = require('https');

console.log("🚀 Initializing National Truth Engine — Daily Intelligence Worker");
console.log("===================================================================");
console.log("This worker evaluates the Verification Score of the registry based on high-trust source volatility.\n");

// Path to our master state data
const statesDir = path.join(__dirname, '../rooms/states');
const stateFiles = fs.existsSync(statesDir) ? fs.readdirSync(statesDir).filter(f => f.endsWith('.json')) : [];

let totalRoomsProcessed = 0;
let scoreAdjustments = 0;
let flagsRaised = 0;

console.log(`📡 Scanning ${stateFiles.length} state repositories...`);

stateFiles.forEach(file => {
  const filePath = path.join(statesDir, file);
  const rooms = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let modified = false;

  rooms.forEach(room => {
    totalRoomsProcessed++;
    let originalScore = room.verification_score || 50;
    let score = originalScore;
    let newFlags = [];

    // 1. Check for dead websites
    if (room.website && !room.website.includes('http')) {
       score -= 10;
       newFlags.push('Invalid or missing website URL structure.');
    }

    // 2. Check for missing phone numbers (loss of stable contact)
    if (!room.phone) {
       score -= 15;
       newFlags.push('No verifiable phone number attached.');
    }

    // 3. Stale Data Check (If we haven't verified in 180 days)
    if (room.last_verified) {
      const daysSince = (new Date() - new Date(room.last_verified)) / (1000 * 60 * 60 * 24);
      if (daysSince > 180) {
        score -= 20;
        newFlags.push('Data is over 180 days old. Needs re-verification.');
      }
    }

    // 4. Source Density Bonus
    if (room.verification_sources && room.verification_sources.length >= 3) {
      // Small bump for multi-source consensus
      score = Math.min(100, score + 5);
    }

    // Assign new score bounds
    score = Math.max(0, Math.min(100, score));

    // Calculate dynamic status based on Truth Engine algorithm
    let newStatus = 'unverified';
    if (score >= 90) newStatus = 'verified';
    else if (score >= 70) newStatus = 'strong_confidence';
    else if (score >= 50) newStatus = 'partial_verified';
    else newStatus = 'needs_review';

    if (score !== originalScore || newStatus !== room.verified_status) {
      room.verification_score = score;
      room.verified_status = newStatus;
      if (newFlags.length > 0 && !room.review_required) {
        room.review_required = true;
      }
      modified = true;
      scoreAdjustments++;
      flagsRaised += newFlags.length;
      
      console.log(`⚠️ Alert: ${room.business_name} (${room.state})`);
      console.log(`   Score shifted: ${originalScore} -> ${score} [${newStatus}]`);
      newFlags.forEach(f => console.log(`   - ${f}`));
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(rooms, null, 2));
  }
});

console.log("\n===================================================================");
console.log(`✅ Intelligence Run Complete.`);
console.log(`   Total Venues Scanned: ${totalRoomsProcessed}`);
console.log(`   Score Adjustments Made: ${scoreAdjustments}`);
console.log(`   Flags Raised for Manual Review: ${flagsRaised}`);
