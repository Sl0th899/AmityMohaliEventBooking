/**
 * ------------------------------------------------------------------
 * AMITY EVENT BOOKING - PRODUCTION SYNC SCRIPT
 * ------------------------------------------------------------------
 * Instructions:
 * 1. Paste this into Extensions > Apps Script in your Google Sheet.
 * 2. Go to Project Settings (Gear Icon) > Script Properties.
 * 3. Add a property: 
 * Property: GITHUB_TOKEN
 * Value: (Your Fine-Grained GitHub PAT)
 * 4. Run the 'setupSheet' function ONCE to create the header columns.
 * 5. Set a Trigger: syncBatchToGitHub -> Time-driven -> Every minute.
 * ------------------------------------------------------------------
 */

// 1. CONFIGURATION
const CONFIG = {
  OWNER: "your-github-username", // REPLACE THIS
  REPO: "amity-booking-system",  // REPLACE THIS
  SHEET_NAME: "Form Responses 1" // Default Google Form sheet name
};

// 2. COLUMN MAPPING
// Adjust these indices to match your Google Sheet columns (A=0, B=1, etc.)
// Standard Google Form order usually matches this:
const COL = {
  TIMESTAMP: 0, // Column A
  DATE: 1,      // Column B
  SLOT: 2,      // Column C
  LOCATION: 3,  // Column D
  CLUB: 4,      // Column E
  EVENT: 5,     // Column F
  // These two are helper columns we will create:
  TRANS_ID: 6,  // Column G (Transaction ID)
  STATUS: 7     // Column H (Sync Status)
};

/**
 * SETUP FUNCTION
 * Run this once manually to add the necessary header columns.
 */
function setupSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    console.error(`Sheet "${CONFIG.SHEET_NAME}" not found. Check the name at the bottom tab.`);
    return;
  }
  
  // Set Headers for the helper columns
  sheet.getRange(1, COL.TRANS_ID + 1).setValue("Transaction ID");
  sheet.getRange(1, COL.STATUS + 1).setValue("Sync Status");
  console.log("Headers set successfully.");
}

/**
 * MAIN TRIGGER FUNCTION
 * This is what the Time-Driven Trigger runs every minute.
 */
function syncBatchToGitHub() {
  // 1. Concurrency Lock: Prevent double-execution if the previous run is slow
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Wait 30s for lock
  } catch (e) {
    console.log('Could not obtain lock, skipping run.');
    return;
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) {
      console.log("No data in sheet.");
      return; 
    }

    // Get all data range (Start Row 2, Col 1, down to Last Row, across to Status Col)
    // We add +1 to column index because getRange is 1-based
    const dataRange = sheet.getRange(2, 1, lastRow - 1, COL.STATUS + 1);
    const data = dataRange.getValues();
    
    const batchPayload = [];
    const rowIndicesToUpdate = [];

    // 2. Scan Rows
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const status = row[COL.STATUS];
      const rowNum = i + 2; // Actual sheet row number (1-based, +1 for header)

      // Only process if NOT synced and NOT failed
      if (status !== "SYNCED" && status !== "FAILED") {
        
        // Basic validation: skip empty rows
        if (!row[COL.DATE] || !row[COL.SLOT]) continue;

        // A. Handle Transaction ID (Idempotency)
        let transId = row[COL.TRANS_ID];
        if (!transId || transId === "") {
          transId = Utilities.getUuid();
          sheet.getRange(rowNum, COL.TRANS_ID + 1).setValue(transId);
        }
        batchPayload.push({
          transaction_id: transId,
          date: formatDate(row[COL.DATE]), // Ensure string YYYY-MM-DD
          slot: row[COL.SLOT],
          location_id: row[COL.LOCATION],
          club: row[COL.CLUB],
          event: row[COL.EVENT],
          timestamp: new Date().toISOString()
        });
        
        rowIndicesToUpdate.push(rowNum);
      }
    }
    if (batchPayload.length > 0) {
      console.log(`Sending batch of ${batchPayload.length} bookings...`);
      const success = sendToGitHub(batchPayload);

      const newStatus = success ? "SYNCED" : "FAILED";
      
      rowIndicesToUpdate.forEach(r => {
        sheet.getRange(r, COL.STATUS + 1).setValue(newStatus);
      });
      
      console.log(`Batch processing finished. Status: ${newStatus}`);
    } else {
      console.log("No pending bookings found.");
    }

  } catch (err) {
    console.error("Critical Error in syncBatchToGitHub:", err);
  } finally {
    lock.releaseLock();
  }
}

function sendToGitHub(batch) {
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  
  if (!token) {
    console.error("ERROR: GITHUB_TOKEN not found in Script Properties.");
    return false;
  }

  const url = `https://api.github.com/repos/${CONFIG.OWNER}/${CONFIG.REPO}/dispatches`;
  
  const payload = {
    event_type: "batch_booking",
    client_payload: {
      batch: batch
    }
  };

  const options = {
    method: "post",
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    
    if (code >= 200 && code < 300) {
      return true;
    } else {
      console.error(`GitHub API Failed [${code}]: ${response.getContentText()}`);
      return false;
    }
  } catch (e) {
    console.error("Network Error:", e);
    return false;
  }
}
function formatDate(dateObj) {
  if (dateObj instanceof Date) {
    return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  try {
    const d = new Date(dateObj);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
  } catch (e) {
    console.error("Date conversion failed: " + dateObj);
  }
  return dateObj;
}