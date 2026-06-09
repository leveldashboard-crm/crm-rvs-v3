/**
 * ============================================================================
 * BB CONCIERGE MAILER — GOOGLE APPS SCRIPT BACKEND
 * ============================================================================
 * Separate Apps Script for the Concierge Mailer module.
 * Handles: email sending with Drive attachments, draft management,
 * delegate PDF file indexing, and send history logging.
 *
 * Deploy as Web App:
 *   - Execute as: Me
 *   - Who has access: Anyone (the shared secret authenticates callers)
 *
 * SETUP:
 *   1. Create a new Google Apps Script project
 *   2. Paste this entire file as Code.gs
 *   3. Set API_SHARED_SECRET to a strong random string
 *   4. Configure FOLDERS_CONFIG with your Drive folder IDs
 *   5. Configure SHEET_ID with your log spreadsheet ID
 *   6. Deploy as Web App → Execute as Me → Anyone
 *   7. Copy the /exec URL → paste in CRM Settings → Mailer Web App URL
 *   8. Set the same secret in CRM Settings → Shared Secret Key
 * ============================================================================
 */

// ─── CONFIGURATION (Edit these values before deploying) ─────────────────────
var CONFIG = {
  // REQUIRED: Must match CRM Settings → Mailer Shared Secret
  API_SHARED_SECRET: "your-shared-secret-here",

  // REQUIRED: Google Spreadsheet ID for logging sent emails and storing drafts
  // Create a Google Sheet and paste its ID here
  SHEET_ID: "your-google-sheet-id-here",

  // Sheet tab names
  LOG_SHEET_NAME: "Send Log",
  DRAFTS_SHEET_NAME: "Drafts",
  INDEX_SHEET_NAME: "File Index",

  // Drive Folder IDs for delegate PDFs (set these to your actual folder IDs)
  FOLDERS: {
    letter: "",      // Invitation Letters folder ID
    card: "",        // Invitation Cards folder ID
    itinerary: "",   // Travel Itineraries folder ID
    voucher: ""      // Hotel Vouchers folder ID
  }
};

// ─── Entry Points ─────────────────────────────────────────────────────────────
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

// ─── Request Router ───────────────────────────────────────────────────────────
function handleRequest(e) {
  try {
    var body = {};

    // Parse POST body
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        body = e.parameter || {};
      }
    } else if (e && e.parameter) {
      body = e.parameter;
    }

    // Validate shared secret
    var secret = body.secret || "";
    if (secret !== CONFIG.API_SHARED_SECRET) {
      return jsonResponse({ success: false, error: "Invalid credentials: shared secret mismatch." });
    }

    var fn = body.fn || "";
    var args = body.args || [];

    // Route function calls
    switch (fn) {
      case "getFolderConfig":
        return jsonResponse(getFolderConfig());
      case "buildIndex":
        return jsonResponse(buildIndex());
      case "matchDelegates":
        return jsonResponse(matchDelegates(args[0] || []));
      case "rematchOne":
        return jsonResponse(rematchOne(args[0] || {}));
      case "getDrafts":
        return jsonResponse(getDrafts());
      case "saveDraft":
        return jsonResponse(saveDraft(args[0] || {}));
      case "deleteDraft":
        return jsonResponse(deleteDraft(args[0] || ""));
      case "sendOne":
        return jsonResponse(sendOne(args[0] || {}));
      case "getSendLog":
        return jsonResponse(getSendLog());
      case "searchDriveFiles":
        return jsonResponse(searchDriveFiles(args[0] || ""));
      case "getSheetUrl":
        return jsonResponse(getSheetUrl());
      default:
        return jsonResponse({ success: false, error: "Unknown function: " + fn });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: "Server error: " + String(err) });
  }
}

// ─── JSON Response Helper ─────────────────────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Sheet Helpers ────────────────────────────────────────────────────────────
function getOrCreateSheet(sheetName) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function getSheetUrl() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    return { success: true, result: ss.getUrl() };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── Folder Configuration & File Indexing ────────────────────────────────────

/**
 * Returns folder configuration and file counts for each document type.
 */
function getFolderConfig() {
  try {
    var folders = {};
    var counts = {};

    var types = ["letter", "card", "itinerary", "voucher"];
    for (var i = 0; i < types.length; i++) {
      var type = types[i];
      var folderId = CONFIG.FOLDERS[type];
      if (folderId) {
        try {
          var folder = DriveApp.getFolderById(folderId);
          folders[type] = folderId;
          // Count files in index sheet
          counts[type] = countIndexedFiles(type);
        } catch (e) {
          // Folder not accessible or doesn't exist
          folders[type] = null;
          counts[type] = 0;
        }
      } else {
        folders[type] = null;
        counts[type] = 0;
      }
    }

    return { success: true, folders: folders, counts: counts };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

function countIndexedFiles(type) {
  try {
    var sheet = getOrCreateSheet(CONFIG.INDEX_SHEET_NAME);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return 0;
    var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    var count = 0;
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === type.toLowerCase()) {
        count++;
      }
    }
    return count;
  } catch (e) {
    return 0;
  }
}

/**
 * Rebuilds the file index by scanning all configured Drive folders.
 */
function buildIndex() {
  try {
    var sheet = getOrCreateSheet(CONFIG.INDEX_SHEET_NAME);

    // Clear existing index
    sheet.clearContents();
    var headers = ["Type", "FileName", "FileId", "FileUrl", "NameNormalized"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1a73e8").setFontColor("#ffffff");

    var rows = [];
    var types = ["letter", "card", "itinerary", "voucher"];

    for (var i = 0; i < types.length; i++) {
      var type = types[i];
      var folderId = CONFIG.FOLDERS[type];
      if (!folderId) continue;

      try {
        var folder = DriveApp.getFolderById(folderId);
        var files = folder.getFiles();
        while (files.hasNext()) {
          var file = files.next();
          var name = file.getName();
          rows.push([
            type,
            name,
            file.getId(),
            "https://drive.google.com/file/d/" + file.getId() + "/view?usp=sharing",
            normalizeName(name)
          ]);
        }
        // Also scan subfolders (one level deep)
        var subfolders = folder.getFolders();
        while (subfolders.hasNext()) {
          var subfolder = subfolders.next();
          var subfiles = subfolder.getFiles();
          while (subfiles.hasNext()) {
            var subfile = subfiles.next();
            var subname = subfile.getName();
            rows.push([
              type,
              subname,
              subfile.getId(),
              "https://drive.google.com/file/d/" + subfile.getId() + "/view?usp=sharing",
              normalizeName(subname)
            ]);
          }
        }
      } catch (folderErr) {
        // Skip inaccessible folders
      }
    }

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    }

    return { success: true, indexed: rows.length };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Normalizes a name for fuzzy matching.
 * Strips file extension, removes non-alphanumeric chars, lowercases.
 */
function normalizeName(name) {
  // Remove extension
  var n = name.replace(/\.[a-zA-Z0-9]{2,5}$/, "");
  // Remove non-word chars and lowercase
  n = n.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return n;
}

/**
 * Reads the index sheet into memory.
 */
function readIndex() {
  var sheet = getOrCreateSheet(CONFIG.INDEX_SHEET_NAME);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var index = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (!row[1]) continue; // Skip empty rows
    index.push({
      type: String(row[0]),
      fileName: String(row[1]),
      fileId: String(row[2]),
      fileUrl: String(row[3]),
      nameNormalized: String(row[4])
    });
  }
  return index;
}

// ─── Delegate Matching Engine ─────────────────────────────────────────────────

/**
 * Matches a list of delegates against the indexed Drive files.
 * Returns match results with file links for each document type.
 */
function matchDelegates(delegates) {
  try {
    var index = readIndex();

    var results = [];
    for (var i = 0; i < delegates.length; i++) {
      var delegate = delegates[i];
      var result = matchSingleDelegate(delegate, index);
      results.push(result);
    }

    return { success: true, result: results };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Re-matches a single delegate against the current index.
 */
function rematchOne(delegate) {
  try {
    var index = readIndex();
    var result = matchSingleDelegate(delegate, index);
    return { success: true, result: result };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Core matching logic for a single delegate.
 */
function matchSingleDelegate(delegate, index) {
  var fullName = delegate.full_name || delegate.fullName || "";
  var firstName = delegate.first_name || delegate.firstName || "";
  var lastName = delegate.last_name || delegate.lastName || "";
  var email = delegate.participant_email || delegate.email || "";
  var rowIndex = delegate.rowIndex !== undefined ? delegate.rowIndex : 0;

  // Build normalized search terms
  var normFull = normalizeName(fullName);
  var normFirst = normalizeName(firstName);
  var normLast = normalizeName(lastName);

  // Combine for search
  var searchTerms = [];
  if (normFull) searchTerms.push(normFull);
  if (normFirst && normLast) searchTerms.push(normFirst + " " + normLast);
  if (normLast && normFirst) searchTerms.push(normLast + " " + normFirst);
  if (normFirst) searchTerms.push(normFirst);
  if (normLast) searchTerms.push(normLast);

  var matchResult = {
    rowIndex: rowIndex,
    fullName: fullName,
    email: email,
    citizenship: delegate.passport_country || delegate.citizenship || "",
    country: delegate.country_name || delegate.country || "",
    company: delegate.company_name || delegate.company || "",
    designation: delegate.designation || "",
    region: delegate.region || "",
    title: delegate.title || "",
    firstName: firstName,
    lastName: lastName,
    hasEmail: !!(email),
    hasManualOverride: false,
    confidence: "none",
    letter: null,
    hasLetter: false,
    card: null,
    hasCard: false,
    itinerary: null,
    hasItinerary: false,
    voucher: null,
    hasVoucher: false
  };

  var types = ["letter", "card", "itinerary", "voucher"];
  for (var t = 0; t < types.length; t++) {
    var type = types[t];
    var typeFiles = index.filter(function(f) { return f.type === type; });

    var bestMatch = null;
    var bestConfidence = "none";

    // Exact match first
    for (var f = 0; f < typeFiles.length; f++) {
      var file = typeFiles[f];
      var norm = file.nameNormalized;

      for (var s = 0; s < searchTerms.length; s++) {
        var term = searchTerms[s];
        if (!term) continue;

        if (norm === term) {
          bestMatch = file;
          bestConfidence = "exact";
          break;
        }
      }
      if (bestConfidence === "exact") break;
    }

    // Name-contains match
    if (!bestMatch) {
      for (var f = 0; f < typeFiles.length; f++) {
        var file = typeFiles[f];
        var norm = file.nameNormalized;

        for (var s = 0; s < searchTerms.length; s++) {
          var term = searchTerms[s];
          if (!term || term.length < 3) continue;

          if (norm.indexOf(term) !== -1 || term.indexOf(norm) !== -1) {
            if (!bestMatch) {
              bestMatch = file;
              bestConfidence = "name";
            }
          }
        }
      }
    }

    // Fuzzy: last name only
    if (!bestMatch && normLast && normLast.length >= 3) {
      for (var f = 0; f < typeFiles.length; f++) {
        var file = typeFiles[f];
        if (file.nameNormalized.indexOf(normLast) !== -1) {
          bestMatch = file;
          bestConfidence = "fuzzy";
          break;
        }
      }
    }

    if (bestMatch) {
      var link = { fileId: bestMatch.fileId, fileName: bestMatch.fileName, fileUrl: bestMatch.fileUrl };
      matchResult[type] = link;
      matchResult["has" + type.charAt(0).toUpperCase() + type.slice(1)] = true;
      if (bestMatch.confidence !== "exact") {
        matchResult.confidence = bestConfidence;
      } else if (matchResult.confidence !== "exact") {
        matchResult.confidence = "exact";
      }
    }
  }

  // Set overall confidence
  if (matchResult.hasLetter || matchResult.hasCard || matchResult.hasItinerary || matchResult.hasVoucher) {
    if (matchResult.confidence === "none") matchResult.confidence = "fuzzy";
  }

  return matchResult;
}

// ─── Draft Management ─────────────────────────────────────────────────────────

function ensureDraftSheetHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1 || sheet.getLastRow() < 1) {
    var headers = ["ID", "Name", "Subject", "HtmlBody", "PlainBody", "CC", "BCC", "Created", "Modified"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1a73e8").setFontColor("#ffffff");
  }
}

/**
 * Returns all saved drafts.
 */
function getDrafts() {
  try {
    var sheet = getOrCreateSheet(CONFIG.DRAFTS_SHEET_NAME);
    ensureDraftSheetHeaders(sheet);

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, result: [] };

    var data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
    var drafts = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      drafts.push({
        id: String(row[0]),
        name: String(row[1]),
        subject: String(row[2]),
        htmlBody: String(row[3]),
        plainBody: String(row[4]),
        cc: String(row[5]),
        bcc: String(row[6]),
        created: String(row[7]),
        modified: String(row[8])
      });
    }

    return { success: true, result: drafts };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Creates or updates a draft.
 */
function saveDraft(draft) {
  try {
    var sheet = getOrCreateSheet(CONFIG.DRAFTS_SHEET_NAME);
    ensureDraftSheetHeaders(sheet);

    var id = draft.id || Utilities.getUuid();
    var now = new Date().toISOString();
    var name = draft.name || "Draft " + now.slice(0, 10);
    var subject = draft.subject || "";
    var htmlBody = draft.htmlBody || "";
    var plainBody = draft.plainBody || "";
    var cc = draft.cc || "";
    var bcc = draft.bcc || "";

    // Check if draft with this ID already exists
    var lastRow = sheet.getLastRow();
    var existingRow = -1;

    if (lastRow >= 2) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === id) {
          existingRow = i + 2;
          break;
        }
      }
    }

    var rowData = [[id, name, subject, htmlBody, plainBody, cc, bcc, now, now]];

    if (existingRow > 0) {
      // Preserve created date
      var createdDate = sheet.getRange(existingRow, 8).getValue();
      rowData[0][7] = createdDate;
      sheet.getRange(existingRow, 1, 1, 9).setValues(rowData);
    } else {
      sheet.appendRow(rowData[0]);
    }

    return { success: true, result: { id: id, name: name } };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Deletes a draft by ID.
 */
function deleteDraft(draftId) {
  try {
    var sheet = getOrCreateSheet(CONFIG.DRAFTS_SHEET_NAME);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true };

    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === String(draftId)) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }

    return { success: false, error: "Draft not found" };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── Email Sending ────────────────────────────────────────────────────────────

/**
 * Sends a personalised email to a single delegate with optional Drive attachments.
 * Also supports base64-encoded custom attachments (uploaded directly from browser).
 */
function sendOne(payload) {
  try {
    var toEmail = payload.toEmail || "";
    var recipientName = payload.recipientName || "";
    var subject = payload.subject || "Message from BB Concierge";
    var htmlBody = payload.htmlBody || "";
    var plainBody = payload.plainBody || htmlBody.replace(/<[^>]+>/g, "");
    var cc = payload.cc || "";
    var bcc = payload.bcc || "";
    var draftName = payload.draftName || "Concierge Draft";

    if (!toEmail) {
      return { success: false, error: "Recipient email is required" };
    }

    // Build attachments array
    var attachments = [];
    var attachmentNames = [];

    // Drive file attachments
    var driveAttachmentTypes = [
      { send: "sendLetter",    fileId: "letterFileId",    label: "Letter" },
      { send: "sendCard",      fileId: "cardFileId",      label: "Card" },
      { send: "sendItinerary", fileId: "itineraryFileId", label: "Itinerary" },
      { send: "sendVoucher",   fileId: "voucherFileId",   label: "Voucher" }
    ];

    for (var i = 0; i < driveAttachmentTypes.length; i++) {
      var att = driveAttachmentTypes[i];
      if (payload[att.send] && payload[att.fileId]) {
        try {
          var file = DriveApp.getFileById(payload[att.fileId]);
          attachments.push(file.getBlob());
          attachmentNames.push(att.label);
        } catch (fileErr) {
          Logger.log("Could not attach " + att.label + " file: " + String(fileErr));
        }
      }
    }

    // Custom base64 attachments (uploaded by user from browser)
    if (Array.isArray(payload.customAttachments)) {
      for (var j = 0; j < payload.customAttachments.length; j++) {
        var customAtt = payload.customAttachments[j];
        if (customAtt && customAtt.base64Data && customAtt.fileName && customAtt.mimeType) {
          try {
            var blob = Utilities.newBlob(
              Utilities.base64Decode(customAtt.base64Data),
              customAtt.mimeType,
              customAtt.fileName
            );
            attachments.push(blob);
            attachmentNames.push(customAtt.fileName);
          } catch (blobErr) {
            Logger.log("Could not process custom attachment " + customAtt.fileName + ": " + String(blobErr));
          }
        }
      }
    }

    // Build email options
    var emailOptions = {
      to: toEmail,
      subject: subject,
      htmlBody: htmlBody,
      body: plainBody
    };

    if (cc) emailOptions.cc = cc;
    if (bcc) emailOptions.bcc = bcc;
    if (attachments.length > 0) emailOptions.attachments = attachments;

    // Send email
    GmailApp.sendEmail(toEmail, subject, plainBody, {
      htmlBody: htmlBody,
      cc: cc || undefined,
      bcc: bcc || undefined,
      attachments: attachments.length > 0 ? attachments : undefined
    });

    // Log to Send Log sheet
    logSend({
      timestamp: new Date().toISOString(),
      recipient: recipientName,
      email: toEmail,
      subject: subject,
      draft: draftName,
      letter: !!(payload.sendLetter && payload.letterFileId),
      card: !!(payload.sendCard && payload.cardFileId),
      itinerary: !!(payload.sendItinerary && payload.itineraryFileId),
      voucher: !!(payload.sendVoucher && payload.voucherFileId),
      customAttachments: attachmentNames.join(", "),
      status: "success",
      error: ""
    });

    return { success: true };
  } catch (e) {
    // Log error
    try {
      logSend({
        timestamp: new Date().toISOString(),
        recipient: payload.recipientName || "",
        email: payload.toEmail || "",
        subject: payload.subject || "",
        draft: payload.draftName || "",
        letter: false, card: false, itinerary: false, voucher: false,
        customAttachments: "",
        status: "error",
        error: String(e)
      });
    } catch (logErr) {}

    return { success: false, error: String(e) };
  }
}

// ─── Send Log ─────────────────────────────────────────────────────────────────

function ensureLogSheetHeaders(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) {
    var headers = ["Timestamp", "Recipient", "Email", "Subject", "Draft", "Letter", "Card", "Itinerary", "Voucher", "Custom Attachments", "Status", "Error"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1a73e8").setFontColor("#ffffff");
  }
}

function logSend(data) {
  var sheet = getOrCreateSheet(CONFIG.LOG_SHEET_NAME);
  ensureLogSheetHeaders(sheet);
  sheet.appendRow([
    data.timestamp,
    data.recipient,
    data.email,
    data.subject,
    data.draft,
    data.letter ? "Yes" : "No",
    data.card ? "Yes" : "No",
    data.itinerary ? "Yes" : "No",
    data.voucher ? "Yes" : "No",
    data.customAttachments || "",
    data.status,
    data.error || ""
  ]);
}

/**
 * Returns the most recent 200 send log entries.
 */
function getSendLog() {
  try {
    var sheet = getOrCreateSheet(CONFIG.LOG_SHEET_NAME);
    ensureLogSheetHeaders(sheet);

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, result: [] };

    var startRow = Math.max(2, lastRow - 199);
    var numRows = lastRow - startRow + 1;
    var data = sheet.getRange(startRow, 1, numRows, 12).getValues();

    var logs = [];
    for (var i = data.length - 1; i >= 0; i--) {
      var row = data[i];
      logs.push({
        sentOn: String(row[0]),
        timestamp: String(row[0]),
        recipient: String(row[1]),
        email: String(row[2]),
        subject: String(row[3]),
        draft: String(row[4]),
        letter: String(row[5]) === "Yes",
        card: String(row[6]) === "Yes",
        itinerary: String(row[7]) === "Yes",
        voucher: String(row[8]) === "Yes",
        customAttachments: String(row[9]),
        status: String(row[10]),
        error: String(row[11])
      });
    }

    return { success: true, result: logs };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── Drive File Search ────────────────────────────────────────────────────────

/**
 * Searches the index for files matching a query term.
 */
function searchDriveFiles(query) {
  try {
    var index = readIndex();
    var norm = normalizeName(query);

    var results = [];
    for (var i = 0; i < index.length; i++) {
      var file = index[i];
      if (file.nameNormalized.indexOf(norm) !== -1 || norm.indexOf(file.nameNormalized) !== -1) {
        results.push({
          type: file.type,
          fileName: file.fileName,
          fileId: file.fileId,
          fileUrl: file.fileUrl
        });
        if (results.length >= 20) break;
      }
    }

    return { success: true, result: results };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
