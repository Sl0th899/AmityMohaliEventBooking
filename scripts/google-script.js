/**
 * GOOGLE APPS SCRIPT
 * ------------------
 * INSTRUCTIONS:
 * 1. Create a Google Form with: Date, Slot, Location ID, Club Name, Event Name.
 * 2. Open Script Editor (Extensions > Apps Script).
 * 3. Paste this code.
 * 4. Go to Project Settings > Script Properties.
 * 5. Add Property: 'GITHUB_TOKEN' -> Value: 'your_classic_pat_token'.
 * 6. Triggers: Add a trigger for 'onSubmit' -> 'From form' -> 'On form submit'.
 */

function onSubmit(e) {
  // =========================================================================
  // CONFIGURATION
  // =========================================================================
  const CONFIG = {
    OWNER: "your-github-username",    // TODO: Update this
    REPO: "amity-booking-system",     // TODO: Update this
    BRANCH: "main"
  };

  // Retrieve token securely
  const GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");

  if (!GITHUB_TOKEN) {
    Logger.log("ERROR: GITHUB_TOKEN is not set in Script Properties.");
    return;
  }

  // =========================================================================
  // DATA EXTRACTION
  // =========================================================================
  // We use a robust way to map questions by title rather than index.
  // NOTE: Your Google Form Question Titles must match these keywords loosely.
  
  const response = e.response;
  const itemResponses = response.getItemResponses();
  const formData = {};

  itemResponses.forEach(itemResponse => {
    const title = itemResponse.getItem().getTitle().toLowerCase();
    const answer = itemResponse.getResponse();

    if (title.includes("date")) formData.date = answer; // Expecting YYYY-MM-DD
    else if (title.includes("slot")) formData.slot = answer;
    else if (title.includes("location")) formData.location_id = answer;
    else if (title.includes("club")) formData.club = answer;
    else if (title.includes("event")) formData.event = answer;
  });

  // =========================================================================
  // PAYLOAD CONSTRUCTION
  // =========================================================================
  
  // 1. Generate Transaction ID (UUID) for Idempotency
  // This ensures if the script accidentally runs twice, the GitHub Action knows it's the same request.
  const transactionId = Utilities.getUuid();

  // 2. Build the Payload
  const payload = {
    event_type: "new_booking",
    client_payload: {
      transaction_id: transactionId,
      date: formData.date,
      slot: formData.slot,
      location_id: formData.location_id,
      club: formData.club,
      event: formData.event,
      timestamp: new Date().toISOString()
    }
  };

  Logger.log("Prepared Payload: " + JSON.stringify(payload));

  // =========================================================================
  // SEND TO GITHUB
  // =========================================================================
  const url = `https://api.github.com/repos/${CONFIG.OWNER}/${CONFIG.REPO}/dispatches`;
  
  const options = {
    method: "post",
    headers: {
      "Authorization": "token " + GITHUB_TOKEN,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log("SUCCESS: Dispatch sent. Code: " + responseCode);
    } else {
      Logger.log("FAILURE: GitHub API Error. Code: " + responseCode);
      Logger.log("Response: " + responseBody);
      // Optional: Email admin on failure
      // MailApp.sendEmail("admin@amity.edu", "Booking Script Failed", responseBody);
    }
  } catch (err) {
    Logger.log("EXCEPTION: Request failed completely.");
    Logger.log(err.toString());
  }
}