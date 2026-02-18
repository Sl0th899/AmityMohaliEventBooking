/**
 * Triggers when Google Form is submitted.
 * Sends payload to GitHub Repository Dispatch.
 */
function onSubmit(e) {
  // 1. Configuration
  const OWNER = "your-github-username"; // REPLACE
  const REPO = "amity-booking-system";  // REPLACE
  const GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");

  if (!GITHUB_TOKEN) {
    console.error("GITHUB_TOKEN is missing in Script Properties");
    return;
  }

  // 2. Extract Responses (Adjust indices based on your Form order)
  const responses = e.response.getItemResponses();
  const formData = {};
  
  // Mapping Form Question Titles to JSON keys
  // Ensure your Google Form questions match these titles exactly or adjust logic
  responses.forEach(r => {
    const title = r.getItem().getTitle().toLowerCase();
    const answer = r.getResponse();
    
    if (title.includes("date")) formData.date = answer; // Format matches YYYY-MM-DD in form
    else if (title.includes("slot")) formData.slot = answer;
    else if (title.includes("location")) formData.location_id = answer;
    else if (title.includes("club")) formData.club = answer;
    else if (title.includes("event")) formData.event = answer;
  });

  // 3. Construct Payload
  const payload = {
    event_type: "new_booking",
    client_payload: {
      date: formData.date,
      slot: formData.slot,
      location_id: formData.location_id,
      club: formData.club,
      event: formData.event,
      timestamp: new Date().toISOString()
    }
  };

  // 4. Send to GitHub
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/dispatches`;
  
  const options = {
    method: "post",
    headers: {
      "Authorization": `token ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // To handle errors gracefully
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    
    if (code >= 200 && code < 300) {
      console.log("Success: Dispatch sent to GitHub.");
    } else {
      console.error("Error: GitHub API returned " + code + " " + response.getContentText());
    }
  } catch (err) {
    console.error("Exception: " + err.toString());
  }
}