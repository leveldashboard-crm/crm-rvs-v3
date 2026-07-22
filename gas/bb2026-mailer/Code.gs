/**
 * ============================================================================
 * BHARAT BUILDCON 2026 — DELEGATE EMAIL SYSTEM
 * Google Apps Script Web App · Code.gs
 * ============================================================================
 * Deployed under: Sending Gmail Account
 * Sheet/Drive access: Sending account's own Drive (initialise creates sheet here)
 *
 * Actions (via doPost JSON):
 *   ping · initialise · getConfig · updateConfig
 *   getDelegates · addDelegate · importCSV
 *   uploadItinerary · uploadVouchers
 *   sendMode1 · sendMode2
 *   getTemplate · saveTemplate
 * ============================================================================
 */

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

var BB = {
  PARENT_FOLDER:   'BB2026_Mailer',
  SHEET_NAME:      'BB2026_Delegates',
  DELEGATES_TAB:   'Delegates',
  SEND_LOG_TAB:    'SendLog',
  CONFIG_TAB:      'Config',
  TEMPLATE_FILE:   'email_template.html',
  ITINERARY_BASE:  'itinerary',
  PROP_FOLDER_ID:  'BB_FOLDER_ID',
  PROP_SHEET_ID:   'BB_SHEET_ID',
};

// Delegate column order (0-based array index = column A offset)
var DC = {
  ID:           0,   // A  delegate_id
  PREFIX:       1,   // B  prefix
  FIRST_NAME:   2,   // C  first_name
  LAST_NAME:    3,   // D  last_name
  EMAIL:        4,   // E  email
  ORG:          5,   // F  organisation
  VOUCHER_ID:   6,   // G  voucher_file_id
  VOUCHER_OK:   7,   // H  voucher_matched
  STATUS1:      8,   // I  send_status_mode1
  STATUS2:      9,   // J  send_status_mode2
  SENT_AT:      10,  // K  last_sent_at
};

var DELEGATE_HEADERS = [
  'delegate_id','prefix','first_name','last_name','email',
  'organisation','voucher_file_id','voucher_matched',
  'send_status_mode1','send_status_mode2','last_sent_at',
];

var DEFAULT_CFG = {
  SENDER_EMAIL:       '',
  ITINERARY_FILE_ID:  '',
  VOUCHER_FOLDER_ID:  '',
  SHEET_ID:           '',
  MODE1_BODY_FOOTER:  'We look forward to welcoming you at Bharat Buildcon 2026.\n\nWarm regards,\nBharat Buildcon Organising Committee',
  MODE2_SUBJECT:      'Bharat Buildcon 2026 — Important Update',
};

// ─── ENTRY POINTS ─────────────────────────────────────────────────────────────

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('index');
  return t.evaluate()
    .setTitle('BB2026 Delegate Email System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport','width=device-width,initial-scale=1');
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch(x) { body = e.parameter || {}; }
    } else if (e && e.parameter) {
      body = e.parameter;
    }
    var action  = body.action  || '';
    var payload = body.payload || body;
    if (!action) return jr({ success:false, error:'action required' });
    return jr(route(action, payload));
  } catch(err) {
    return jr({ success:false, error:String(err) });
  }
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────

function route(action, p) {
  switch (action) {
    case 'ping':           return { success:true, data:'pong' };
    case 'initialise':     return doInitialise(p);
    case 'getConfig':      return doGetConfig(p);
    case 'updateConfig':   return doUpdateConfig(p);
    case 'getDelegates':   return doGetDelegates(p);
    case 'addDelegate':    return doAddDelegate(p);
    case 'importCSV':      return doImportCSV(p);
    case 'uploadItinerary':return doUploadItinerary(p);
    case 'uploadVouchers': return doUploadVouchers(p);
    case 'sendMode1':      return doSendMode1(p);
    case 'sendMode2':      return doSendMode2(p);
    case 'getTemplate':    return doGetTemplate(p);
    case 'saveTemplate':   return doSaveTemplate(p);
    default: return { success:false, error:'Unknown action: '+action };
  }
}

// ─── INITIALISE ───────────────────────────────────────────────────────────────

function doInitialise(p) {
  try {
    var lock = LockService.getScriptLock();
    lock.tryLock(15000);
    try {
      // 1. Parent folder
      var folder     = getOrCreateFolder(BB.PARENT_FOLDER, null);
      var folderId   = folder.getId();

      // 2. Spreadsheet
      var sheetId = ScriptProperties().getProperty(BB.PROP_SHEET_ID) || '';
      var ss      = null;
      if (sheetId) { try { ss = SpreadsheetApp.openById(sheetId); } catch(x){ ss=null; } }
      if (!ss) {
        ss = SpreadsheetApp.create(BB.SHEET_NAME);
        sheetId = ss.getId();
        var ssFile = DriveApp.getFileById(sheetId);
        folder.addFile(ssFile);
        DriveApp.getRootFolder().removeFile(ssFile);
      }

      // Remove default "Sheet1" if it exists and is empty
      var defaultSheet = ss.getSheetByName('Sheet1');
      if (defaultSheet && ss.getNumSheets() > 1) {
        try { ss.deleteSheet(defaultSheet); } catch(x){}
      }

      // 3. Ensure tabs
      ensureDelegatesTab(ss);
      ensureSendLogTab(ss);
      ensureConfigTab(ss);

      // 4. Voucher subfolder
      var voucherFolder   = getOrCreateFolder('Vouchers', folder);
      var voucherFolderId = voucherFolder.getId();

      // 5. Persist config values
      setConfigValues(ss, {
        SHEET_ID:         sheetId,
        VOUCHER_FOLDER_ID:voucherFolderId,
      });

      // 6. Email template
      ensureEmailTemplate(folder);

      // 7. Script properties
      ScriptProperties().setProperty(BB.PROP_FOLDER_ID, folderId);
      ScriptProperties().setProperty(BB.PROP_SHEET_ID,  sheetId);

      return {
        success: true,
        data: {
          sheetId:        sheetId,
          folderId:       folderId,
          voucherFolderId:voucherFolderId,
          sheetUrl:       'https://docs.google.com/spreadsheets/d/'+sheetId+'/edit',
          folderUrl:      'https://drive.google.com/drive/folders/'+folderId,
        }
      };
    } finally { lock.releaseLock(); }
  } catch(err) {
    return { success:false, error:'Initialise failed: '+String(err) };
  }
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────

function doGetConfig(p) {
  try {
    var ss    = openSheet(p && p.sheetId);
    var sheet = ss.getSheetByName(BB.CONFIG_TAB);
    if (!sheet) return { success:true, data:copyObj(DEFAULT_CFG) };
    var data = sheet.getDataRange().getValues();
    var cfg  = {};
    for (var i=1;i<data.length;i++){
      var k=String(data[i][0]).trim(), v=String(data[i][1]).trim();
      if (k) cfg[k]=v;
    }
    return { success:true, data:cfg };
  } catch(err){ return { success:false, error:String(err) }; }
}

function doUpdateConfig(p) {
  try {
    if (!p || !p.updates) return { success:false, error:'updates required' };
    var ss = openSheet(p.sheetId);
    setConfigValues(ss, p.updates);
    if (p.updates.SHEET_ID) ScriptProperties().setProperty(BB.PROP_SHEET_ID, p.updates.SHEET_ID);
    return { success:true, data:'Config updated' };
  } catch(err){ return { success:false, error:String(err) }; }
}

function readConfig(ss) {
  var sheet = ss.getSheetByName(BB.CONFIG_TAB);
  if (!sheet) return copyObj(DEFAULT_CFG);
  var data = sheet.getDataRange().getValues();
  var cfg  = copyObj(DEFAULT_CFG);
  for (var i=1;i<data.length;i++){
    var k=String(data[i][0]).trim(), v=String(data[i][1]).trim();
    if (k) cfg[k]=v;
  }
  return cfg;
}

function setConfigValues(ss, kvMap) {
  var sheet = ss.getSheetByName(BB.CONFIG_TAB);
  if (!sheet) sheet = ensureConfigTab(ss);
  var data = sheet.getDataRange().getValues();
  var idx  = {};
  for (var i=1;i<data.length;i++) idx[String(data[i][0]).trim()] = i+1;
  Object.keys(kvMap).forEach(function(k){
    var v = kvMap[k];
    if (idx[k]) {
      sheet.getRange(idx[k],2).setValue(v);
    } else {
      var r = sheet.getLastRow()+1;
      sheet.getRange(r,1,1,2).setValues([[k,v]]);
      idx[k]=r;
    }
  });
}

function getConfigVal(key) {
  try {
    var sheetId = ScriptProperties().getProperty(BB.PROP_SHEET_ID)||'';
    if (!sheetId) return '';
    var ss    = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(BB.CONFIG_TAB);
    if (!sheet) return '';
    var data  = sheet.getDataRange().getValues();
    for (var i=1;i<data.length;i++){
      if (String(data[i][0]).trim()===key) return String(data[i][1]).trim();
    }
    return '';
  } catch(e){ return ''; }
}

// ─── DELEGATES ────────────────────────────────────────────────────────────────

function doGetDelegates(p) {
  try {
    var ss    = openSheet(p && p.sheetId);
    var sheet = ss.getSheetByName(BB.DELEGATES_TAB);
    if (!sheet) return { success:true, data:[] };
    var lr = sheet.getLastRow();
    if (lr < 2) return { success:true, data:[] };
    var data = sheet.getRange(2,1,lr-1,DELEGATE_HEADERS.length).getValues();
    var out  = data.map(function(row,i){
      var obj = {};
      DELEGATE_HEADERS.forEach(function(h,c){ obj[h]=row[c]; });
      obj._row = i+2;
      return obj;
    }).filter(function(d){ return d.delegate_id || d.email; });
    return { success:true, data:out };
  } catch(err){ return { success:false, error:String(err) }; }
}

function doAddDelegate(p) {
  try {
    if (!p.email) return { success:false, error:'email required' };
    var ss    = openSheet(p.sheetId);
    var sheet = ensureDelegatesTab(ss);
    var dup   = findRowByEmail(sheet, p.email);
    if (dup)  return { success:false, error:'Email already exists (row '+dup+')' };
    var id    = 'D'+Date.now();
    sheet.appendRow([id, p.prefix||'', p.first_name||'', p.last_name||'',
                     p.email, p.organisation||'', '','FALSE','','','']);
    return { success:true, data:{ delegate_id:id } };
  } catch(err){ return { success:false, error:String(err) }; }
}

function doImportCSV(p) {
  try {
    var rows = p.rows;
    if (!rows || !rows.length) return { success:false, error:'No rows provided' };
    var ss      = openSheet(p.sheetId);
    var sheet   = ensureDelegatesTab(ss);
    var imported=0, skipped=0, skippedList=[];
    rows.forEach(function(d,i){
      if (!d.email){ skipped++; return; }
      if (findRowByEmail(sheet, d.email)){ skipped++; skippedList.push(d.email); return; }
      var id = 'D'+Date.now()+'_'+i;
      sheet.appendRow([id, d.prefix||'', d.first_name||'', d.last_name||'',
                       d.email, d.organisation||'', '','FALSE','','','']);
      imported++;
    });
    return { success:true, data:{ imported:imported, skipped:skipped, skippedEmails:skippedList } };
  } catch(err){ return { success:false, error:String(err) }; }
}

function findRowByEmail(sheet, email) {
  var lr = sheet.getLastRow();
  if (lr<2) return null;
  var emails = sheet.getRange(2, DC.EMAIL+1, lr-1, 1).getValues();
  for (var i=0;i<emails.length;i++){
    if (String(emails[i][0]).toLowerCase().trim()===email.toLowerCase().trim()) return i+2;
  }
  return null;
}

// ─── UPLOAD ITINERARY ─────────────────────────────────────────────────────────

function doUploadItinerary(p) {
  try {
    if (!p.base64Data) return { success:false, error:'base64Data required' };
    var folderId = ScriptProperties().getProperty(BB.PROP_FOLDER_ID)||'';
    if (!folderId) return { success:false, error:'Not initialised. Run Initialise first.' };
    var folder   = DriveApp.getFolderById(folderId);

    // Determine file extension
    var orig = p.fileName || 'itinerary.pdf';
    var ext  = orig.split('.').pop().toLowerCase() || 'pdf';
    var name = BB.ITINERARY_BASE+'.'+ext;

    // Trash old itinerary
    var oldId = getConfigVal('ITINERARY_FILE_ID');
    if (oldId) { try{ DriveApp.getFileById(oldId).setTrashed(true); }catch(x){} }

    // Upload
    var blob = Utilities.newBlob(Utilities.base64Decode(p.base64Data), p.mimeType||'application/pdf', name);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();

    // Persist
    var ss = openSheet(p.sheetId);
    setConfigValues(ss, { ITINERARY_FILE_ID:fileId });

    return { success:true, data:{ fileId:fileId, fileName:name,
      viewUrl:'https://drive.google.com/file/d/'+fileId+'/view' } };
  } catch(err){ return { success:false, error:String(err) }; }
}

// ─── UPLOAD VOUCHERS ──────────────────────────────────────────────────────────

function doUploadVouchers(p) {
  try {
    var vFolderId = getConfigVal('VOUCHER_FOLDER_ID');
    if (!vFolderId) return { success:false, error:'Voucher folder not configured. Run Initialise first.' };
    var vFolder = DriveApp.getFolderById(vFolderId);

    var ss    = openSheet(p.sheetId);
    var sheet = ss.getSheetByName(BB.DELEGATES_TAB);
    if (!sheet) return { success:false, error:'Delegates tab not found' };

    // Load delegate full names for matching
    var lr = sheet.getLastRow();
    var delegates = [];
    if (lr>=2) {
      var data = sheet.getRange(2,1,lr-1,DELEGATE_HEADERS.length).getValues();
      data.forEach(function(row,i){
        var full = [row[DC.PREFIX],row[DC.FIRST_NAME],row[DC.LAST_NAME]]
                    .map(function(v){return String(v).trim();}).filter(Boolean).join(' ');
        delegates.push({ row:i+2, fullName:full });
      });
    }

    var files    = p.files||[];
    var matched=[], unmatched=[], totalUploaded=0;

    files.forEach(function(f){
      try {
        var blob = Utilities.newBlob(Utilities.base64Decode(f.base64Data), f.mimeType||'application/pdf', f.fileName);
        var file = vFolder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        var fileId = file.getId();
        totalUploaded++;

        // Strip extension for matching
        var nameNoExt = f.fileName.replace(/\.[^.]+$/,'').trim();
        var hit = null;
        for (var i=0;i<delegates.length;i++){
          if (delegates[i].fullName.toLowerCase()===nameNoExt.toLowerCase()){ hit=delegates[i]; break; }
        }

        if (hit) {
          sheet.getRange(hit.row, DC.VOUCHER_ID+1).setValue(fileId);
          sheet.getRange(hit.row, DC.VOUCHER_OK+1).setValue('TRUE');
          matched.push({ fileName:f.fileName, delegate:hit.fullName });
        } else {
          unmatched.push({ fileName:f.fileName, nameUsed:nameNoExt });
        }
      } catch(fe){
        unmatched.push({ fileName:f.fileName, error:String(fe) });
      }
    });

    return { success:true, data:{
      totalUploaded:totalUploaded,
      matchedCount:matched.length, matched:matched,
      unmatchedCount:unmatched.length, unmatched:unmatched,
    }};
  } catch(err){ return { success:false, error:String(err) }; }
}

// ─── SEND MODE 1 (Attachment) ─────────────────────────────────────────────────

function doSendMode1(p) {
  try {
    var ss  = openSheet(p.sheetId);
    var cfg = readConfig(ss);

    if (!cfg.ITINERARY_FILE_ID) return { success:false, error:'Itinerary not uploaded. Please upload the itinerary file first.' };
    var delegateIds = p.delegateIds||[];
    if (!delegateIds.length) return { success:false, error:'No delegates selected' };

    var sheet    = ss.getSheetByName(BB.DELEGATES_TAB);
    var logSheet = ensureSendLogTab(ss);
    var lr       = sheet.getLastRow();
    if (lr<2) return { success:false, error:'No delegates in sheet' };
    var data = sheet.getRange(2,1,lr-1,DELEGATE_HEADERS.length).getValues();

    // Fetch itinerary blob once
    var itinBlob = DriveApp.getFileById(cfg.ITINERARY_FILE_ID).getBlob();

    var result = { sent:0, failed:0, skipped:0, errors:[] };

    data.forEach(function(row,idx){
      var did = String(row[DC.ID]).trim();
      if (delegateIds.indexOf(did)===-1) return;

      var sheetRow = idx+2;
      var vOk      = String(row[DC.VOUCHER_OK]).trim().toUpperCase();
      if (vOk!=='TRUE'){ result.skipped++; return; }

      var prefix    = String(row[DC.PREFIX]).trim();
      var firstName = String(row[DC.FIRST_NAME]).trim();
      var lastName  = String(row[DC.LAST_NAME]).trim();
      var email     = String(row[DC.EMAIL]).trim();
      var voucherFid= String(row[DC.VOUCHER_ID]).trim();
      var fullName  = [prefix,firstName,lastName].filter(Boolean).join(' ');

      try {
        var voucherBlob = DriveApp.getFileById(voucherFid).getBlob();
        var htmlBody    = buildMode1Html(prefix,firstName,lastName,cfg.MODE1_BODY_FOOTER||'');

        GmailApp.sendEmail(email, 'Bharat Buildcon 2026 — Your Travel Documents', '', {
          htmlBody:    htmlBody,
          attachments: [itinBlob, voucherBlob],
          name:        'Bharat Buildcon 2026',
        });

        sheet.getRange(sheetRow, DC.STATUS1+1).setValue('Sent');
        sheet.getRange(sheetRow, DC.SENT_AT+1).setValue(new Date().toISOString());
        logSheet.appendRow([new Date().toISOString(), did, fullName, email, 'Mode1','Sent','']);
        result.sent++;
      } catch(se){
        var em = String(se);
        sheet.getRange(sheetRow, DC.STATUS1+1).setValue('Failed');
        logSheet.appendRow([new Date().toISOString(), did, fullName, email, 'Mode1','Failed',em]);
        result.failed++;
        result.errors.push({ name:fullName, email:email, error:em });
      }
    });

    return { success:true, data:result };
  } catch(err){ return { success:false, error:String(err) }; }
}

function buildMode1Html(prefix, first, last, footer) {
  var full = [prefix,first,last].filter(Boolean).join(' ');
  return [
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#fff">',
    '<div style="background:linear-gradient(135deg,#1a3a6b,#0d7a5f);padding:28px 32px;border-radius:8px 8px 0 0;text-align:center">',
    '<h1 style="color:#fff;font-size:22px;margin:0">Bharat Buildcon 2026</h1>',
    '</div>',
    '<div style="padding:28px 32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px">',
    '<p style="font-size:16px;line-height:1.6;color:#222">Dear <strong>'+he(full)+'</strong>,</p>',
    '<p style="font-size:15px;line-height:1.7;color:#333">Please find attached your <strong>travel itinerary</strong> and <strong>hotel voucher</strong> for Bharat Buildcon 2026.</p>',
    footer ? '<p style="font-size:14px;line-height:1.7;color:#444;white-space:pre-line">'+he(footer)+'</p>' : '',
    '<p style="font-size:12px;color:#aaa;margin-top:32px;border-top:1px solid #eee;padding-top:12px">',
    'This is an automated email from the Bharat Buildcon 2026 Organising Committee.',
    '</p>',
    '</div></div>',
  ].join('');
}

// ─── SEND MODE 2 (HTML Template) ──────────────────────────────────────────────

function doSendMode2(p) {
  try {
    var ss  = openSheet(p.sheetId);
    var cfg = readConfig(ss);

    var subject  = cfg.MODE2_SUBJECT || DEFAULT_CFG.MODE2_SUBJECT;
    var template = getEmailTemplate();
    if (!template) return { success:false, error:'Email template not found. Run Initialise or save a template.' };

    var delegateIds = p.delegateIds||[];
    if (!delegateIds.length) return { success:false, error:'No delegates selected' };

    var sheet    = ss.getSheetByName(BB.DELEGATES_TAB);
    var logSheet = ensureSendLogTab(ss);
    var lr       = sheet.getLastRow();
    if (lr<2) return { success:false, error:'No delegates in sheet' };
    var data = sheet.getRange(2,1,lr-1,DELEGATE_HEADERS.length).getValues();

    var result = { sent:0, failed:0, errors:[] };

    data.forEach(function(row,idx){
      var did = String(row[DC.ID]).trim();
      if (delegateIds.indexOf(did)===-1) return;

      var sheetRow = idx+2;
      var prefix    = String(row[DC.PREFIX]).trim();
      var firstName = String(row[DC.FIRST_NAME]).trim();
      var lastName  = String(row[DC.LAST_NAME]).trim();
      var email     = String(row[DC.EMAIL]).trim();
      var org       = String(row[DC.ORG]).trim();
      var fullName  = [prefix,firstName,lastName].filter(Boolean).join(' ');

      try {
        var html = template
          .replace(/\{\{prefix\}\}/g,     prefix)
          .replace(/\{\{first_name\}\}/g, firstName)
          .replace(/\{\{last_name\}\}/g,  lastName)
          .replace(/\{\{full_name\}\}/g,  fullName)
          .replace(/\{\{email\}\}/g,      email)
          .replace(/\{\{organisation\}\}/g,org);

        GmailApp.sendEmail(email, subject, '', {
          htmlBody: html,
          name:     'Bharat Buildcon 2026',
        });

        sheet.getRange(sheetRow, DC.STATUS2+1).setValue('Sent');
        sheet.getRange(sheetRow, DC.SENT_AT+1).setValue(new Date().toISOString());
        logSheet.appendRow([new Date().toISOString(), did, fullName, email, 'Mode2','Sent','']);
        result.sent++;
      } catch(se){
        var em=String(se);
        sheet.getRange(sheetRow, DC.STATUS2+1).setValue('Failed');
        logSheet.appendRow([new Date().toISOString(), did, fullName, email, 'Mode2','Failed',em]);
        result.failed++;
        result.errors.push({ name:fullName, email:email, error:em });
      }
    });

    return { success:true, data:result };
  } catch(err){ return { success:false, error:String(err) }; }
}

// ─── EMAIL TEMPLATE ───────────────────────────────────────────────────────────

function getEmailTemplate() {
  try {
    var fid = ScriptProperties().getProperty(BB.PROP_FOLDER_ID)||'';
    if (!fid) return null;
    var it = DriveApp.getFolderById(fid).getFilesByName(BB.TEMPLATE_FILE);
    return it.hasNext() ? it.next().getBlob().getDataAsString() : null;
  } catch(e){ return null; }
}

function doGetTemplate(p) {
  var t = getEmailTemplate();
  return t ? { success:true, data:t } : { success:false, error:'Template not found' };
}

function doSaveTemplate(p) {
  try {
    if (!p.html) return { success:false, error:'html required' };
    var fid = ScriptProperties().getProperty(BB.PROP_FOLDER_ID)||'';
    if (!fid) return { success:false, error:'Not initialised' };
    var folder = DriveApp.getFolderById(fid);
    var it = folder.getFilesByName(BB.TEMPLATE_FILE);
    while(it.hasNext()) it.next().setTrashed(true);
    folder.createFile(BB.TEMPLATE_FILE, p.html, 'text/html');
    return { success:true, data:'Template saved' };
  } catch(err){ return { success:false, error:String(err) }; }
}

function ensureEmailTemplate(folder) {
  var it = folder.getFilesByName(BB.TEMPLATE_FILE);
  if (!it.hasNext()) folder.createFile(BB.TEMPLATE_FILE, defaultTemplate(), 'text/html');
}

function defaultTemplate() {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8">',
    '<style>',
    'body{margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif}',
    '.wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}',
    '.hdr{background:linear-gradient(135deg,#1a3a6b 0%,#0d7a5f 100%);padding:40px 32px;text-align:center}',
    '.hdr h1{color:#fff;font-size:26px;margin:0 0 6px}',
    '.hdr p{color:rgba(255,255,255,.75);font-size:13px;margin:0}',
    '.body{padding:36px 32px}',
    '.body p{font-size:15px;line-height:1.75;color:#333;margin:0 0 16px}',
    '.btn{display:inline-block;padding:12px 28px;background:#1a3a6b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold}',
    '.ftr{padding:20px 32px;background:#f9f9f9;border-top:1px solid #eee;text-align:center;font-size:12px;color:#999}',
    '</style></head><body>',
    '<div class="wrap">',
    '  <div class="hdr">',
    '    <h1>Bharat Buildcon 2026</h1>',
    '    <p>International Delegate Conference · New Delhi</p>',
    '  </div>',
    '  <div class="body">',
    '    <p>Dear <strong>{{prefix}} {{first_name}} {{last_name}}</strong>,</p>',
    '    <p>We are delighted to welcome you to <strong>Bharat Buildcon 2026</strong>, India\'s premier international trade and construction event.</p>',
    '    <p>[Add your full message here — edit this file directly in Google Drive]</p>',
    '    <p>We look forward to your participation.</p>',
    '    <p style="margin-top:28px">Warm regards,<br><strong>Bharat Buildcon Organising Committee</strong></p>',
    '  </div>',
    '  <div class="ftr">Bharat Buildcon 2026 · New Delhi, India</div>',
    '</div>',
    '</body></html>',
  ].join('\n');
}

// ─── SHEET STRUCTURE HELPERS ──────────────────────────────────────────────────

function ensureDelegatesTab(ss) {
  var s = ss.getSheetByName(BB.DELEGATES_TAB);
  if (!s) {
    s = ss.insertSheet(BB.DELEGATES_TAB);
    s.getRange(1,1,1,DELEGATE_HEADERS.length).setValues([DELEGATE_HEADERS])
      .setFontWeight('bold').setBackground('#1a73e8').setFontColor('#ffffff');
    s.setFrozenRows(1);
    s.setColumnWidths(1, DELEGATE_HEADERS.length, 140);
  }
  return s;
}

function ensureSendLogTab(ss) {
  var s = ss.getSheetByName(BB.SEND_LOG_TAB);
  if (!s) {
    s = ss.insertSheet(BB.SEND_LOG_TAB);
    var h = ['timestamp','delegate_id','name','email','mode','status','error_message'];
    s.getRange(1,1,1,h.length).setValues([h])
      .setFontWeight('bold').setBackground('#0d7a5f').setFontColor('#ffffff');
    s.setFrozenRows(1);
  }
  return s;
}

function ensureConfigTab(ss) {
  var s = ss.getSheetByName(BB.CONFIG_TAB);
  if (!s) {
    s = ss.insertSheet(BB.CONFIG_TAB);
    s.getRange(1,1,1,2).setValues([['key','value']])
      .setFontWeight('bold').setBackground('#fbbc04');
    var rows = Object.keys(DEFAULT_CFG).map(function(k){ return [k, DEFAULT_CFG[k]]; });
    s.getRange(2,1,rows.length,2).setValues(rows);
    s.setColumnWidth(1,220);
    s.setColumnWidth(2,420);
  }
  return s;
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function openSheet(sheetId) {
  var id = sheetId || ScriptProperties().getProperty(BB.PROP_SHEET_ID) || '';
  if (!id) throw new Error('SHEET_ID not set. Run Initialise first.');
  return SpreadsheetApp.openById(id);
}

function getOrCreateFolder(name, parent) {
  var it = parent ? parent.getFoldersByName(name) : DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

function ScriptProperties() { return PropertiesService.getScriptProperties(); }

function copyObj(o) {
  var r={};
  Object.keys(o).forEach(function(k){ r[k]=o[k]; });
  return r;
}

function he(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function jr(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
