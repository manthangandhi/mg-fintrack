// FinTrack Apps Script — paste into Extensions → Apps Script
// Keep your existing SHEET_ID. Deploy → New deployment → Web app
// Execute as: Me · Who has access: Anyone
const SHEET_ID = 'PASTE_YOUR_SHEET_ID';

function doGet(e){
  const p=e.parameter;
  const ss=SpreadsheetApp.openById(SHEET_ID);
  if(p.action==='read'){
    const sh=ss.getSheetByName(p.tab);
    if(!sh) return j({error:'Tab not found: '+p.tab});
    return j({data:sh.getDataRange().getValues()});
  }
  if(p.action==='append'){
    const sh=ss.getSheetByName(p.tab);
    if(!sh) return j({error:'Tab not found: '+p.tab});
    sh.appendRow(JSON.parse(p.row));
    return j({ok:true});
  }
  if(p.action==='upsertByName'){
    const sh=ss.getSheetByName(p.tab);
    if(!sh) return j({error:'Tab not found: '+p.tab});
    const row=JSON.parse(p.row);
    const key=String(p.key||row[0]||'').trim().toLowerCase();
    const data=sh.getDataRange().getValues();
    for(let i=1;i<data.length;i++){
      if(String(data[i][0]||'').trim().toLowerCase()===key){
        const width=Math.max(row.length, data[i].length, sh.getLastColumn());
        const padded=row.slice();
        while(padded.length<width) padded.push('');
        sh.getRange(i+1,1,1,padded.length).setValues([padded]);
        return j({ok:true, updated:true});
      }
    }
    sh.appendRow(row);
    return j({ok:true, updated:false});
  }
  if(p.action==='upsertConfig'){
    const sh=ss.getSheetByName('Config');
    const key=p.key, val=p.value;
    const data=sh.getDataRange().getValues();
    for(let i=1;i<data.length;i++){
      if(data[i][0]===key){ sh.getRange(i+1,2).setValue(val); return j({ok:true}); }
    }
    sh.appendRow([key,val]);
    return j({ok:true});
  }
  return j({error:'unknown'});
}
function doPost(e){return doGet(e);}
function j(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
