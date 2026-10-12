// Extracted verbatim from the single-file map: registry CSV/JSON converters and best-effort live fetchers.
function convertFecScheduleA(rows){
  const agg={}; rows.forEach(r=>{ const k=r.contributor_name+'|'+r.committee_name; agg[k]=(agg[k]||0)+(+r.contribution_receipt_amount||0); agg[k+'|emp']=r.contributor_employer||''; });
  const nodes=[], edges=[]; const seen=new Set();
  Object.keys(agg).filter(k=>!k.endsWith('|emp')).forEach(k=>{ const [c,cm]=k.split('|'); const amt=agg[k];
    if(!seen.has(c)){ seen.add(c); nodes.push({name:c, category:'economic', sector:'Individuals & dynasties', branch:'Private', dm:agg[k+'|emp'], power:Math.min(6,amountWeight(amt)+1), tier:3, industry:'FEC contributors', description:'FEC-reported contributor'}); }
    if(!seen.has(cm)){ seen.add(cm); nodes.push({name:cm, category:'political', sector:'Politics', branch:'Private', dm:'FEC committee', power:Math.min(6,amountWeight(amt)+1), tier:3, industry:'Parties & PACs', description:'FEC-registered committee'}); }
    edges.push({from:c, to:cm, type:'F', weight:amountWeight(amt), note:'$'+Math.round(amt).toLocaleString()+' (FEC Schedule A)'}); });
  return {label:'FEC Schedule A', payload:{nodes,edges}};
}
function convertFecScheduleB(rows){
  const agg={}; rows.forEach(r=>{ const k=r.committee_name+'|'+r.recipient_name; agg[k]=(agg[k]||0)+(+r.disbursement_amount||0); });
  const nodes=[], edges=[], seen=new Set();
  Object.keys(agg).forEach(k=>{ const [cm,rc]=k.split('|'); const amt=agg[k];
    [cm,rc].forEach(x=>{ if(!seen.has(x)){ seen.add(x); nodes.push({name:x, category:'political', sector:'Politics', branch:'Private', dm:'FEC filer', power:Math.min(6,amountWeight(amt)+1), tier:3, industry:'Parties & PACs', description:'FEC-reported'}); } });
    edges.push({from:cm, to:rc, type:'F', weight:amountWeight(amt), note:'$'+Math.round(amt).toLocaleString()+' (FEC Schedule B)'}); });
  return {label:'FEC Schedule B', payload:{nodes,edges}};
}
function convertUSAspending(rows){
  const agg={}; rows.forEach(r=>{ const ag=r.awarding_agency_name||r.awarding_agency; const k=ag+'|'+r.recipient_name; agg[k]=(agg[k]||0)+(+(r.total_obligated_amount||r.award_amount||r.federal_action_obligation||r.amount)||0); });
  const nodes=[], edges=[], seen=new Set();
  Object.keys(agg).forEach(k=>{ const [ag,rc]=k.split('|'); const amt=agg[k];
    if(!seen.has(rc)){ seen.add(rc); nodes.push({name:rc, category:'economic', sector:'Business', branch:'Private', dm:'Federal contractor / grantee', power:Math.min(6,amountWeight(amt)+1), tier:3, industry:'Government contractors', description:'USAspending recipient'}); }
    if(!seen.has(ag)){ seen.add(ag); nodes.push({name:ag, category:'economic', sector:'Government', branch:'Executive', dm:'Awarding agency', power:4, tier:2, industry:'Federal agencies', description:'USAspending awarding agency'}); }
    edges.push({from:ag, to:rc, type:'F', weight:amountWeight(amt), note:'$'+Math.round(amt).toLocaleString()+' obligated (USAspending)'}); });
  return {label:'USAspending', payload:{nodes,edges}};
}
function convertLobbying(rows){
  const agg={}; rows.forEach(r=>{ const k=r.client_name+'|'+r.registrant_name; agg[k]=(agg[k]||0)+(+(r.income||r.expenses||r.amount)||0); });
  const nodes=[], edges=[], seen=new Set();
  Object.keys(agg).forEach(k=>{ const [cl,rg]=k.split('|'); const amt=agg[k];
    if(!seen.has(cl)){ seen.add(cl); nodes.push({name:cl, category:'economic', sector:'Business', branch:'Private', dm:'Lobbying client', power:Math.min(6,amountWeight(amt)+1), tier:3, industry:'Other business', description:'Senate LDA client'}); }
    if(!seen.has(rg)){ seen.add(rg); nodes.push({name:rg, category:'political', sector:'Business', branch:'Private', dm:'Registered lobbying firm', power:3, tier:4, industry:'Lobbyists', description:'Senate LDA registrant'}); }
    edges.push({from:cl, to:rg, type:'F', weight:amountWeight(amt), note:'$'+Math.round(amt).toLocaleString()+' lobbying (LDA)'}); edges.push({from:rg, to:'congress', type:'I', weight:Math.max(1,amountWeight(amt)-1), note:'Lobbying for '+cl}); });
  return {label:'Lobbying (LDA)', payload:{nodes,edges}};
}
const LS_CAT={1:'C',2:'I',3:'I',4:'I',5:'F',6:'F',7:'I',8:'I',9:'I',10:'C',11:'C',12:'I'};
function convertLittleSis(j){
  const ents={}; (j.included||[]).forEach(x=>{ ents[x.id]=x.attributes||x; });
  const nodes=[], edges=[], seen=new Set();
  const addEnt=(id,name,att)=>{ const nm=name||(ents[id]&&ents[id].name)||('LittleSis entity '+id); if(!seen.has(nm)){ seen.add(nm); const isOrg=(att&&att.primary_ext)==='Org'; nodes.push({name:nm, category:isOrg?'economic':'political', sector:isOrg?'Business':'Individuals & dynasties', branch:'Private', dm:(att&&att.blurb)||'', power:3, tier:4, industry:'LittleSis import', description:(att&&att.blurb)||'Imported from LittleSis'}); } return nm; };
  j.data.forEach(x=>{ const a=x.attributes||x;
    if(a.entity1_id!==undefined){ const n1=addEnt(a.entity1_id,a.entity1_name||null,ents[a.entity1_id]), n2=addEnt(a.entity2_id,a.entity2_name||null,ents[a.entity2_id]);
      const cat=LS_CAT[a.category_id]||'I'; const rev=(a.category_id===1||a.category_id===3); // position/membership: org controls/hosts person
      edges.push({from:rev?n2:n1, to:rev?n1:n2, type:cat, weight:a.amount?amountWeight(a.amount):2, note:(a.description1||a.description||'LittleSis')+(a.amount?' $'+Math.round(a.amount).toLocaleString():'')}); }
    else if(a.name){ addEnt(x.id,a.name,a); }
  });
  return {label:'LittleSis', payload:{nodes,edges}};
}
function convertLittleSisCSV(rows){ return convertLittleSis({data:rows.map(r=>({attributes:{entity1_id:r.entity1_id, entity2_id:r.entity2_id, entity1_name:r.entity1||r.entity1_name, entity2_name:r.entity2||r.entity2_name, category_id:+r.category_id||12, description1:r.description1||r.description, amount:r.amount}}))}); }


const FEC_KEY='DEMO_KEY';
async function fetchFEC(n){
  busy('FEC: searching committees for “'+n.n+'”…');
  const q=encodeURIComponent(n.n.replace(/\(.*?\)/g,'').split('&')[0].trim());
  const cm=await getJSON(`https://api.open.fec.gov/v1/committees/?api_key=${FEC_KEY}&q=${q}&per_page=3&sort=-last_file_date`);
  const rows=[];
  if(cm.results&&cm.results.length){
    const c=cm.results[0]; busy('FEC: top contributors to '+c.name+'…');
    const sa=await getJSON(`https://api.open.fec.gov/v1/schedules/schedule_a/?api_key=${FEC_KEY}&committee_id=${c.committee_id}&sort=-contribution_receipt_amount&per_page=40&two_year_transaction_period=2026&two_year_transaction_period=2024`);
    (sa.results||[]).forEach(r=>rows.push({contributor_name:r.contributor_name, committee_name:n.n, contribution_receipt_amount:r.contribution_receipt_amount, contributor_employer:r.contributor_employer}));
  } else {
    busy('FEC: contributions from “'+n.n+'”…');
    const sa=await getJSON(`https://api.open.fec.gov/v1/schedules/schedule_a/?api_key=${FEC_KEY}&contributor_name=${q}&sort=-contribution_receipt_amount&per_page=40&two_year_transaction_period=2026&two_year_transaction_period=2024`);
    (sa.results||[]).forEach(r=>rows.push({contributor_name:n.n, committee_name:r.committee&&r.committee.name||r.committee_id, contribution_receipt_amount:r.contribution_receipt_amount, contributor_employer:''}));
  }
  if(!rows.length) throw new Error('no FEC records matched');
  const conv=convertFecScheduleA(rows); ingest(conv.payload,'FEC · '+n.n);
}
async function fetchUSAspending(n){
  busy('USAspending: awards to “'+n.n+'”…');
  const body={filters:{recipient_search_text:[n.n.replace(/\(.*?\)/g,'').split('&')[0].trim()], time_period:[{start_date:'2024-10-01',end_date:'2026-09-30'}]}, category:'awarding_agency', limit:15, page:1};
  const j=await getJSON('https://api.usaspending.gov/api/v2/search/spending_by_category/awarding_agency/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const rows=(j.results||[]).map(r=>({awarding_agency_name:r.name, recipient_name:n.n, total_obligated_amount:r.amount}));
  if(!rows.length) throw new Error('no awards found');
  const conv=convertUSAspending(rows); ingest(conv.payload,'USAspending · '+n.n);
}
async function fetchLittleSis(n){
  busy('LittleSis: searching “'+n.n+'”…');
  const s=await getJSON('https://littlesis.org/api/entities/search?q='+encodeURIComponent(n.n.replace(/\(.*?\)/g,'').split('&')[0].trim()));
  if(!s.data||!s.data.length) throw new Error('no LittleSis entity');
  const id=s.data[0].id; busy('LittleSis: relationships of '+s.data[0].attributes.name+'…');
  const rel=await getJSON(`https://littlesis.org/api/entities/${id}/relationships?page=1`);
  const conn=await getJSON(`https://littlesis.org/api/entities/${id}/connections?page=1`);
  const ents={}; (conn.data||[]).forEach(x=>{ ents[x.id]=x.attributes; }); ents[id]=s.data[0].attributes;
  const j={data:(rel.data||[]).map(x=>{ const a=Object.assign({},x.attributes); a.entity1_name=(ents[a.entity1_id]||{}).name; a.entity2_name=(ents[a.entity2_id]||{}).name; return {attributes:a}; }), included:Object.keys(ents).map(k=>({id:+k, attributes:ents[k]}))};
  const conv=convertLittleSis(j); conv.payload.nodes.forEach(x=>{ if(normName(x.name)===normName(s.data[0].attributes.name)) x.aliases=n.n; }); ingest(conv.payload,'LittleSis · '+n.n);
}
async function fetchLDA(n){
  busy('Senate LDA: lobbying filings for “'+n.n+'”…');
  const j=await getJSON('https://lda.senate.gov/api/v1/filings/?filing_year=2025&client_name='+encodeURIComponent(n.n.replace(/\(.*?\)/g,'').split('&')[0].trim())+'&page_size=25');
  const rows=(j.results||[]).map(r=>({client_name:n.n, registrant_name:r.registrant&&r.registrant.name, income:r.income||r.expenses||0}));
  if(!rows.length) throw new Error('no filings');
  const conv=convertLobbying(rows); ingest(conv.payload,'LDA · '+n.n);
}
