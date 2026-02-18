// CONFIGURATION
const GITHUB_CONFIG = {
  OWNER: "your-github-username",    // REPLACE THIS
  REPO: "amity-booking-system",     // REPLACE THIS
  TOKEN_PROPERTY: "GITHUB_TOKEN",   // Name of Script Property storing the token
  BRANCH: "main"
};

// COLUMN MAPPING (Adjust based on your Form)
// Array indices are 0-based (Column A = 0, B = 1...)
const COL = {
  TIMESTAMP: 0,
  DATE: 1,
  SLOT: 2,
  LOCATION: 3,
  CLUB: 4,
  EVENT: 5,
  TRANS_ID: 6,   // Created by setupSheet()
  STATUS: 7      // Created by setupSheet()
};

/**
 * Run this ONCE to create necessary columns in the Sheet.
 */
function setupSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const lastCol = sheet.getLastColumn();
  
  // Check if headers exist, if not, create them
  const headers = sheet.getRange(1, 1, 1, lastCol + 2).getValues()[0];
  
  if (headers[COL.TRANS_ID] !== "Transaction ID") {
    sheet.getRange(1, COL.TRANS_ID + 1).setValue("Transaction ID");
  }
  if (headers[COL.STATUS] !== "Sync Status") {
    sheet.getRange(1, COL.STATUS + 1).setValue("Sync Status");
  }
}

/**
 * Main Trigger Function: Runs every minute.
 */
function syncBatchToGitHub() {
  const lock = LockService.getScriptLock();
  // Try to grab lock to prevent overlapping runs
  if (!lock.tryLock(30000)) return; 

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) return; // No data

    // Get all data (including status columns)
    const dataRange = sheet.getRange(2, 1, lastRow - 1, COL.STATUS + 1);
    const data = dataRange.getValues();
    
    const batch = [];
    const rowsToUpdate = [];

    // 1. Scan for unsynced rows
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const status = row[COL.STATUS];
      
      // If status is empty, it needs processing
      if (!status || status === "") {
        // Generate UUID if missing
        let transId = row[COL.TRANS_ID];
        if (!transId) {
          transId = Utilities.getUuid();
          // Write UUID back to sheet immediately so we have a record
          sheet.getRange(i + 2, COL.TRANS_ID + 1).setValue(transId);
        }

        batch.push({
          transaction_id: transId,
          date: formatDate(row[COL.DATE]), // Ensure YYYY-MM-DD
          slot: row[COL.SLOT],
          location_id: row[COL.LOCATION],
          club: row[COL.CLUB],
          event: row[COL.EVENT],
          timestamp: row[COL.TIMESTAMP]
        });
        
        rowsToUpdate.push(i + 2); // Store 1-based row index
      }
    }

    if (batch.length === 0) {
      console.log("No new bookings to sync.");
      return;
    }

    // 2. Send Batch to GitHub
    console.log(`Sending batch of ${batch.length} bookings...`);
    const success = sendToGitHub(batch);

    // 3. Update Sheet Status based on result
    const statusValue = success ? "SYNCED" : "FAILED";
    rowsToUpdate.forEach(rowIndex => {
      sheet.getRange(rowIndex, COL.STATUS + 1).setValue(statusValue);
      // Optional: Add timestamp of sync
      // sheet.getRange(rowIndex, COL.STATUS + 2).setValue(new Date()); 
    });

  } catch (e) {
    console.error("Critical Sync Error:", e);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: Send payload to GitHub Repository Dispatch
 */
function sendToGitHub(batchData) {
  const token = PropertiesService.getScriptProperties().getProperty(GITHUB_CONFIG.TOKEN_PROPERTY);
  
  if (!token) {
    throw new Error("GITHUB_TOKEN missing in Script Properties");
  }

  const url = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/dispatches`;
  
  const payload = {
    event_type: "batch_booking",
    client_payload: {
      batch: batchData
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

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();

  if (code >= 200 && code < 300) {
    return true;
  } else {
    console.error(`GitHub API Error (${code}): ${response.getContentText()}`);
    return false;
  }
}

/**
 * Helper: Format Date object to YYYY-MM-DD
 */
function formatDate(dateObj) {
  if (!dateObj) return "";
  if (typeof dateObj === "string") return dateObj; // Already string?
  try {
    return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
  } catch (e) {
    return dateObj.toString();
  }
}