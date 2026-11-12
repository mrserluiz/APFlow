import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAnalytics, isSupported } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js';
import { browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-functions.js';

const firebaseConfig={
 apiKey:'AIzaSyCoRrH2gCwMvqPgFNEWpr8vlEAgNyOdWfc',
 authDomain:'apflow-clinic.firebaseapp.com',
 projectId:'apflow-clinic',
 storageBucket:'apflow-clinic.firebasestorage.app',
 messagingSenderId:'223616211892',
 appId:'1:223616211892:web:bbfb97508736e49da630e1',
 measurementId:'G-PTJEZ10EFM'
};
const firebaseApp=initializeApp(firebaseConfig);
const db=getFirestore(firebaseApp);
const auth=getAuth(firebaseApp);
const functions=getFunctions(firebaseApp,'southamerica-east1');
const adminUpdateUserAccess=httpsCallable(functions,'adminUpdateUserAccess');
const accessCodeHash='aa856b786ce69faea3a86585ad904714bf6e3ff66ac9c5e139b1396e5dc7bebe';
isSupported().then(supported=>{if(supported)getAnalytics(firebaseApp)}).catch(()=>{});

let reports=[];
let requestPatientPool=[];
let patientDirectoryPool=[];
let activePatientRecord=null;
let patientRecordNotesDirty=false;
let selectPatientAfterRegistration=false;
let therapists=[];
let appointments=[];let stopAppointments=null;
let agendaMode=null;let moveSource=null;let selectedAgendaAppointment=null;let pendingScheduleAction=null;let pendingChargeAppointment=null;let appointmentContext='agendar';
const defaultAuthorizationPortals=[{id:'orizon-brasil',name:'Orizon Brasil',url:'https://www.orizonbrasil.com.br/acesso-restrito.html',iconUrl:'',openMode:'internal',active:true,order:1,isDefault:true}];
let portals=[...defaultAuthorizationPortals];let portalsConnected=false;let currentUserIsAdmin=false;let currentUserRole='equipe';let adminFunctionsEnabled=true;let currentPortalUrl='';let activeClinicalReport=null;let pendingClinicalStart=null;
const defaultProfessionals=[
 {id:'vanessa',name:'Dra. Vanessa',profession:'Fisioterapeuta',scheduleGroup:'Cinesio Manhã',agendaColumns:5,isDefault:true},
 {id:'camila',name:'Dra. Camila',profession:'Fisioterapeuta',scheduleGroup:'Cinesio Manhã',agendaColumns:5,isDefault:true},
 {id:'tamires',name:'Dra. Tamires',profession:'Fisioterapeuta',scheduleGroup:'Eletro Manhã',agendaColumns:4,isDefault:true},
 {id:'fernanda',name:'Dra. Fernanda',profession:'Fisioterapeuta',scheduleGroup:'Eletro Manhã',agendaColumns:4,isDefault:true},
 {id:'nadia',name:'Dra. Nadia',profession:'Fisioterapeuta',scheduleGroup:'Eletro Manhã',agendaColumns:4,isDefault:true},
 {id:'mirian',name:'Dra. Mirian',profession:'Fisioterapeuta',scheduleGroup:'Cinesio Tarde',agendaColumns:5,isDefault:true},
 {id:'julliane',name:'Dr.(a) Disponível',profession:'Fisioterapeuta',scheduleGroup:'Cinesio Tarde',agendaColumns:5,isDefault:true},
 {id:'alex',name:'Dr. Alex',profession:'Fisioterapeuta',scheduleGroup:'Eletro Tarde',agendaColumns:4,isDefault:true},
 {id:'larissa',name:'Dr. Alan',profession:'Fisioterapeuta',scheduleGroup:'Eletro Tarde',agendaColumns:4,isDefault:true},
 {id:'marcia',name:'Dra. Marcia',profession:'Fisioterapeuta',scheduleGroup:'Eletro Tarde',agendaColumns:4,isDefault:true}
];
const professionalNameAliases={
 'Dra. Julliane':'Dr.(a) Disponível',
 'Dra. Larissa':'Dr. Alan'
};
function currentProfessionalName(name){return professionalNameAliases[name]||name}
function professionalStoredNames(name){
 const legacy=Object.entries(professionalNameAliases).filter(([,current])=>current===name).map(([old])=>old);
 return[name,...legacy]
}
let selectedDate=new Date();
let calendarMonth=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);
const agendaSlots={manha:['08:00','08:40','09:20','10:00','10:40','11:20'],tarde:['13:00','13:40','14:20','15:00','15:40','16:20','17:00','17:40','18:20']};
const roles=['Admin','Financeiro','Gerente','Atendente','Fisioterapeuta','Médico','Enfermagem','Técnico'];
const colors={aguardando:'#c88313',confeccao:'#377ea7',pronto:'#2f8a68',entregue:'#6d7d86'};
const labels={aguardando:'Aguardando',confeccao:'Em confecção',pronto:'Pronto',entregue:'Entregue'};
const lists={aguardando:document.querySelector('#waitingList'),confeccao:document.querySelector('#draftList'),pronto:document.querySelector('#readyList'),entregue:document.querySelector('#deliveredList')};
const filters={search:document.querySelector('#searchInput'),therapist:document.querySelector('#therapistFilter'),agreement:document.querySelector('#agreementFilter')};
const agreementOptions=[
 'ABET','AFRESP','AMIL','AMIL FISIOFIT','APATEJ (ASS. PAULISTA DOS TÉCNICOS JUDICIÁRIOS)','APEOESP',
 'BRADESCO FISIOTERAPIA','BRADESCO SAÚDE - OPERADOR','BRADESCO TRAUMATO-ORTOPEDIA','CAASP','CAIXA SEGUROS SAÚDE',
 'CAREPLUS','CASSI','CLASSES LABORIOSAS','CLUBE DE DESCONTO ANCHIETA','CRUZ AZUL','DIX AMICO','DONA SAÚDE','DPVAT',
 'FISIOFIT/IAMSPE','GAMA SAÚDE','GOLDEN CROSS','GOLDEN LIFE SAÚDE','IAMSPE','IMASF','IMESC','ITAÚ SAÚDE',
 'MAPFRE SAÚDE','MEDIAL SAÚDE','MEDISERVICE','MEDLINE ASSISTÊNCIA MÉDICA','MULTICARE','NIPOMED','NOTREDAME INTERMÉDICA',
 'OMINT',{value:'Particular',label:'PARTICULAR'},'PARTICULAR CONVÊNIO','PARTICULAR IAMSPE','PLASMMET','PLENA ASSISTENCIAL',
 'PORTO SEGURO','POSTAL SAÚDE','PREV SAÚDE','PRODESP','SABESP','SANTA AMÁLIA','SAÚDE ABAS JUSTIÇA DO TRABALHO',
 'SAÚDE CAIXA','SEGURO SAÚDE - CAT','SEPACO','SEPACO FISIO','SERMA ASSISTÊNCIA MÉDICA','SERPRO','SOMPO SAÚDE',
 'STARMED','SUL AMÉRICA','TEMPO SAÚDE','UNIMED CNU','VALE SAÚDE SEMPRE','VRSAÚDE','VERITAS INSURANCE BPO','VIVEST',
 {value:'Outros',label:'OUTROS'}
];
function fillAgreementSelect(select,placeholder){
 if(!select)return;
 const previous=select.value;select.innerHTML='';
 const empty=document.createElement('option');empty.value='';empty.textContent=placeholder;select.append(empty);
 agreementOptions.forEach(item=>{const option=document.createElement('option');option.value=typeof item==='string'?item:item.value;option.textContent=typeof item==='string'?item:item.label;select.append(option)});
 if([...select.options].some(option=>option.value===previous))select.value=previous;
}
function fillAgreementDatalist(list){
 if(!list)return;
 list.innerHTML='';agreementOptions.forEach(item=>{const option=document.createElement('option');option.value=typeof item==='string'?item:item.value;option.label=typeof item==='string'?item:item.label;list.append(option)});
}
fillAgreementSelect(document.querySelector('#agreementFilter'),'Todos');
fillAgreementDatalist(document.querySelector('#patientAgreementOptions'));
fillAgreementSelect(document.querySelector('#appointmentForm select[name="agreement"]'),'Selecione');

const professionOptions=[
 'Administrador(a)','Advogado(a)','Analista administrativo','Analista de sistemas','Arquiteto(a)','Assistente administrativo',
 'Atendente','Autônomo(a)','Auxiliar administrativo','Auxiliar de enfermagem','Bancário(a)','Cabeleireiro(a)','Comerciante',
 'Contador(a)','Costureiro(a)','Cozinheiro(a)','Cuidador(a)','Dentista','Desempregado(a)','Designer','Diarista','Doméstico(a)',
 'Eletricista','Empresário(a)','Enfermeiro(a)','Engenheiro(a)','Estudante','Farmacêutico(a)','Fisioterapeuta','Funcionário(a) público(a)',
 'Gerente','Jornalista','Maqueiro(a)','Mecânico(a)','Médico(a)','Motorista','Nutricionista','Operador(a) de máquinas',
 'Pedreiro(a)','Professor(a)','Psicólogo(a)','Recepcionista','Representante comercial','Secretário(a)','Segurança','Técnico(a) de enfermagem',
 'Técnico(a) em informática','Terapeuta ocupacional','Vendedor(a)','Aposentado(a)','Do lar','Outra'
];
function normalizedLookup(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
const professionSearch=document.querySelector('#patientProfessionSearch');
const professionDropdown=document.querySelector('#patientProfessionDropdown');
function hideProfessionDropdown(){if(!professionDropdown)return;professionDropdown.hidden=true;professionSearch?.setAttribute('aria-expanded','false')}
function renderProfessionDropdown(){
 if(!professionSearch||!professionDropdown)return;
 const term=normalizedLookup(professionSearch.value);const matches=professionOptions.filter(value=>!term||normalizedLookup(value).includes(term));
 professionDropdown.innerHTML='';
 if(!matches.length){const empty=document.createElement('p');empty.textContent='Nenhuma profissão encontrada.';professionDropdown.append(empty)}
 else matches.forEach(value=>{const button=document.createElement('button');button.type='button';button.role='option';button.textContent=value;button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>{professionSearch.value=value;hideProfessionDropdown()});professionDropdown.append(button)});
 professionDropdown.hidden=false;professionSearch.setAttribute('aria-expanded','true')
}
professionSearch?.addEventListener('focus',renderProfessionDropdown);
professionSearch?.addEventListener('click',renderProfessionDropdown);
professionSearch?.addEventListener('input',renderProfessionDropdown);
professionSearch?.addEventListener('keydown',event=>{if(event.key==='Escape')hideProfessionDropdown()});
document.addEventListener('click',event=>{if(!event.target.closest('.patient-profession-picker'))hideProfessionDropdown()});

const agreementSearch=document.querySelector('#patientAgreementSearch');
const agreementDropdown=document.querySelector('#patientAgreementDropdown');
function agreementValues(){return agreementOptions.map(item=>({value:typeof item==='string'?item:item.value,label:typeof item==='string'?item:item.label}))}
function hideAgreementDropdown(){if(!agreementDropdown)return;agreementDropdown.hidden=true;agreementSearch?.setAttribute('aria-expanded','false')}
function renderAgreementDropdown(){
 if(!agreementSearch||!agreementDropdown)return;
 const term=normalizedLookup(agreementSearch.value);const matches=agreementValues().filter(item=>!term||normalizedLookup(item.label).includes(term)||normalizedLookup(item.value).includes(term));
 agreementDropdown.innerHTML='';
 if(!matches.length){const empty=document.createElement('p');empty.textContent='Nenhum convênio encontrado.';agreementDropdown.append(empty)}
 else matches.forEach(item=>{const button=document.createElement('button');button.type='button';button.role='option';button.textContent=item.label;button.dataset.value=item.value;button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>{agreementSearch.value=item.value;agreementSearch.dataset.defaultParticular='false';agreementSearch.dispatchEvent(new Event('input',{bubbles:true}));hideAgreementDropdown();syncPatientInsuranceCard()});agreementDropdown.append(button)});
 agreementDropdown.hidden=false;agreementSearch.setAttribute('aria-expanded','true')
}
function openAgreementDropdown(){
 if(agreementSearch?.dataset.defaultParticular==='true'&&normalizedLookup(agreementSearch.value)==='particular'){
  agreementSearch.value='';agreementSearch.dataset.defaultParticular='false';syncPatientInsuranceCard()
 }
 renderAgreementDropdown()
}
agreementSearch?.addEventListener('focus',openAgreementDropdown);
agreementSearch?.addEventListener('click',openAgreementDropdown);
agreementSearch?.addEventListener('input',renderAgreementDropdown);
agreementSearch?.addEventListener('keydown',event=>{if(event.key==='Escape')hideAgreementDropdown()});
document.addEventListener('click',event=>{if(!event.target.closest('.patient-agreement-picker'))hideAgreementDropdown()});

let cepLookupController=null;
function maskCep(value){const digits=String(value||'').replace(/\D/g,'').slice(0,8);return digits.length>5?digits.slice(0,5)+'-'+digits.slice(5):digits}
function setCepStatus(message,state=''){const status=document.querySelector('#patientCepStatus');if(!status)return;status.textContent=message;status.dataset.state=state}
function googleComponent(components,...types){const item=(components||[]).find(component=>types.some(type=>component.types?.includes(type)));return item?.long_name||''}
async function lookupCepWithGoogle(cep,signal){
 const endpoint='https://maps.googleapis.com/maps/api/geocode/json?components=postal_code:'+encodeURIComponent(cep)+'|country:BR&language=pt-BR&key='+encodeURIComponent(firebaseConfig.apiKey);
 const response=await fetch(endpoint,{signal});if(!response.ok)throw new Error('google-http');
 const payload=await response.json();if(payload.status!=='OK'||!payload.results?.length)throw new Error('google-unavailable');
 const components=payload.results[0].address_components||[];
 return{
  address:googleComponent(components,'route'),
  district:googleComponent(components,'sublocality_level_1','sublocality','neighborhood'),
  city:googleComponent(components,'administrative_area_level_2','locality')
 }
}
async function lookupCepWithViaCep(cep,signal){
 const response=await fetch('https://viacep.com.br/ws/'+encodeURIComponent(cep)+'/json/',{signal});if(!response.ok)throw new Error('cep-http');
 const payload=await response.json();if(payload.erro)throw new Error('cep-not-found');
 return{address:payload.logradouro||'',district:payload.bairro||'',city:payload.localidade||''}
}
async function lookupPatientCep(){
 const cepField=patientRegistrationForm.elements.zipCode;const cep=String(cepField.value||'').replace(/\D/g,'');
 if(cep.length!==8){setCepStatus('Digite os 8 números do CEP.','warning');return}
 cepLookupController?.abort();cepLookupController=new AbortController();const signal=cepLookupController.signal;
 setCepStatus('Pesquisando endereço…','loading');
 try{
  let address;
  try{address=await lookupCepWithGoogle(cep,signal)}catch(error){if(error.name==='AbortError')throw error;address=await lookupCepWithViaCep(cep,signal)}
  patientRegistrationForm.elements.address.value=address.address||'';
  patientRegistrationForm.elements.district.value=address.district||'';
  patientRegistrationForm.elements.city.value=address.city||'';
  setCepStatus('Endereço preenchido. Você pode editar os campos.','success');
  if(!address.address)patientRegistrationForm.elements.address.focus()
 }catch(error){
  if(error.name==='AbortError')return;
  console.error(error);setCepStatus('CEP não localizado. Preencha o endereço manualmente.','error');showToast('Não foi possível localizar esse CEP. Os campos continuam disponíveis para preenchimento manual.','warning',5200)
 }
}
const patientCepField=document.querySelector('#patientRegistrationForm [name="zipCode"]');
let cepLookupTimer=null;
patientCepField?.addEventListener('input',event=>{event.target.value=maskCep(event.target.value);setCepStatus('');clearTimeout(cepLookupTimer);if(event.target.value.replace(/\D/g,'').length===8)cepLookupTimer=setTimeout(lookupPatientCep,450)});
patientCepField?.addEventListener('blur',()=>{if(patientCepField.value.replace(/\D/g,'').length===8&&!patientRegistrationForm.elements.city.value)lookupPatientCep()});
document.querySelector('#lookupPatientCep')?.addEventListener('click',lookupPatientCep);


function render(){
 Object.values(lists).forEach(list=>list.innerHTML='');
 const term=filters.search.value.trim().toLowerCase();const compactTerm=term.replace(/\D/g,'');
 const visible=reports.filter(r=>{const birthBr=r.birthDate?r.birthDate.split('-').reverse().join('/'):'';const textFields=[r.patient,r.code,r.birthDate,birthBr,r.phone,r.cpf,r.rg,r.insuranceCard].filter(Boolean).map(value=>String(value).toLowerCase());const textMatch=!term||textFields.some(value=>value.includes(term));const digitMatch=compactTerm&&textFields.some(value=>value.replace(/\D/g,'').includes(compactTerm));return(textMatch||digitMatch)&&(!filters.therapist.value||r.therapist===filters.therapist.value)&&(!filters.agreement.value||r.agreement===filters.agreement.value)});
 visible.filter(r=>lists[r.status]).forEach(r=>{
   const card=document.createElement('article'); card.className='report-card'; card.style.setProperty('--accent',colors[r.status]);
   card.innerHTML=`<div class="card-top"><div><h3>${r.patient}</h3><span class="code">Nº ${r.code}</span></div><span class="due ${r.due<='18/09/2026'?'urgent':''}">${r.due}</span></div><p>${r.agreement} • ${r.purpose}</p><div class="card-footer"><span class="badge">${labels[r.status]}</span><span class="therapist">${r.therapist}</span></div>`;
   const patientTitle=card.querySelector('h3');if(patientTitle)patientTitle.title=r.patient||'';
   card.tabIndex=0;card.setAttribute('role','button');
   const openReport=()=>{if(r.status==='pronto'||r.status==='entregue')openClinicalPreview(r);else if(canEditClinicalReport())openClinicalEditor(r);else showToast('Somente Admin, fisioterapeuta ou médico pode editar este relatório.')};
   card.addEventListener('click',openReport);card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openReport()}});lists[r.status].append(card);
 });
 document.querySelectorAll('.lane').forEach(lane=>lane.querySelector('.lane-count').textContent=visible.filter(r=>r.status===lane.dataset.status).length);
 ['aguardando','confeccao','pronto','entregue'].forEach((s,i)=>document.querySelectorAll('.metric strong')[i].textContent=reports.filter(r=>r.status===s).length);
 Object.entries(lists).forEach(([status,list])=>{if(!visible.some(r=>r.status===status))list.innerHTML='<p class="empty-state">Nenhum relatório nesta etapa.</p>'});
 document.querySelector('#footerSummary').textContent=`${reports.length} registros • ${reports.filter(r=>r.status==='aguardando').length} aguardando • ${reports.filter(r=>r.status==='pronto').length} prontos`;
 const homePending=document.querySelector('#homePending');if(homePending)homePending.textContent=reports.filter(r=>r.status==='aguardando').length;
 renderTherapistCounts();
}
function normalizedRole(){return String(currentUserRole||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function canEditClinicalReport(){const role=normalizedRole();return(currentUserIsAdmin&&adminFunctionsEnabled)||role==='fisioterapeuta'||role==='medico'}
function canCreateReportRequest(){return['admin','gerente','atendente'].includes(normalizedRole())}
function applyReportRolePermissions(){
 const allowed=canCreateReportRequest();
 document.querySelectorAll('#newRequest,#newRequestTop').forEach(button=>{button.hidden=!allowed;button.disabled=!allowed});
}
function localDateValue(date=new Date()){const offset=date.getTimezoneOffset();return new Date(date.getTime()-offset*60000).toISOString().slice(0,10)}
function reportBrDate(value){if(!value)return'';const parts=String(value).slice(0,10).split('-');return parts.length===3?`${parts[2]}/${parts[1]}/${parts[0]}`:value}
function updateClinicalEvolutionSummary(){
 const form=document.querySelector('#clinicalReportForm');if(!form)return;
 const sessions=String(form.elements.sessionCount?.value||'').trim();
 document.querySelector('#editorEvolutionSessions').textContent=sessions||'—';
 document.querySelector('#editorEvolutionStart').textContent=reportBrDate(form.elements.sessionStart?.value)||'—';
 document.querySelector('#editorEvolutionEnd').textContent=reportBrDate(form.elements.sessionEnd?.value)||'—';
}
function updateClinicalFinalizeState(){
 const form=document.querySelector('#clinicalReportForm');
 updateClinicalEvolutionSummary();
 const required=['patient','hd','clinicalItem','eva','treatmentProtocol','sessionCount','sessionStart','sessionEnd','evolution','reportDate'];
 document.querySelector('#finalizeClinicalReport').disabled=!required.every(name=>String(form.elements[name]?.value||'').trim());
}
function showClinicalEditor(report){
 activeClinicalReport={...report};const form=document.querySelector('#clinicalReportForm');form.reset();
 form.elements.reportId.value=report.id;form.elements.patient.value=report.patient||'';form.elements.hd.value=report.hd||'';
 form.elements.clinicalItem.value=report.clinicalItem||report.clinicalText||'';form.elements.eva.value=report.eva||'';
 form.elements.treatmentProtocol.value=report.treatmentProtocol||'';form.elements.sessionCount.value=report.sessionCount||'';
 form.elements.sessionStart.value=report.sessionStart||'';form.elements.sessionEnd.value=report.sessionEnd||'';
 form.elements.evolution.value=report.evolution||'';form.elements.reportDate.value=report.reportDate||localDateValue();
 document.querySelector('#clinicalEditorPatientMeta').textContent=`Código: ${report.code||'—'} • ${report.agreement||'Convênio não informado'} • Responsável: ${report.therapist||'—'}`;updateClinicalFinalizeState();
 document.querySelector('#clinicalReportDialog').showModal();setTimeout(()=>form.elements.hd.focus(),50)
}
function openClinicalEditor(report){
 if(!canEditClinicalReport()){showToast('Somente Admin, fisioterapeuta ou médico pode editar este relatório.');return}
 if(report.status==='aguardando'){
  pendingClinicalStart={...report};
  document.querySelector('#clinicalStartSummary').innerHTML=`<strong>${report.patient||'Paciente'}</strong><span>${report.purpose||'Relatório clínico'} • Responsável: ${report.therapist||'—'}</span>`;
  document.querySelector('#clinicalStartDialog').showModal();
  return;
 }
 showClinicalEditor(report)
}

function fillClinicalPreview(report){
 document.querySelector('#clinicalDocumentPatient').textContent=report.patient||'Paciente';
 document.querySelector('#clinicalDocumentHd').textContent=report.hd||'Não informado';
 document.querySelector('#clinicalDocumentClinicalItem').textContent=report.clinicalItem||report.clinicalText||'Não informado';
 document.querySelector('#clinicalDocumentEva').textContent=report.eva||'—';
 document.querySelector('#clinicalDocumentProtocol').textContent=report.treatmentProtocol||'Não informado';
 document.querySelector('#clinicalDocumentSessions').textContent=report.sessionCount||'—';
 document.querySelector('#clinicalDocumentSessionStart').textContent=reportBrDate(report.sessionStart)||'—';
 document.querySelector('#clinicalDocumentSessionEnd').textContent=reportBrDate(report.sessionEnd)||'—';
 const evolution=String(report.evolution||'').trim();document.querySelector('#clinicalDocumentEvolution').textContent=evolution?' '+evolution:'';
 document.querySelector('#clinicalDocumentDate').textContent=reportBrDate(report.reportDate)||report.finalizedDate||new Intl.DateTimeFormat('pt-BR').format(new Date());
}
function openClinicalPreview(report){
 activeClinicalReport={...report};fillClinicalPreview(report);const delivered=report.status==='entregue';document.querySelector('#markClinicalDelivered').hidden=report.status!=='pronto';document.querySelector('#archiveClinicalReport').hidden=!delivered;document.querySelector('#deleteClinicalReport').hidden=!delivered||!currentUserIsAdmin;document.querySelector('#clinicalPreviewDialog').showModal()
}
async function updateReportDelivery(action){
 if(!activeClinicalReport?.id)return;const id=activeClinicalReport.id;
 if(action==='delete'){if(!currentUserIsAdmin){showToast('Somente o administrador pode excluir relatórios.');return}if(!confirm(`Excluir definitivamente o relatório de ${activeClinicalReport.patient}? Esta ação não pode ser desfeita.`))return}
 const button=action==='delivered'?document.querySelector('#markClinicalDelivered'):action==='archive'?document.querySelector('#archiveClinicalReport'):document.querySelector('#deleteClinicalReport');button.disabled=true;
 try{
  if(action==='delete'){
   try{await deleteDoc(doc(db,'relatorios',id))}
   catch(deleteError){
    if(deleteError?.code!=='permission-denied')throw deleteError;
    await updateDoc(doc(db,'relatorios',id),{status:'excluido',deletedAt:serverTimestamp(),deletedBy:auth.currentUser?.uid||'',updatedAt:serverTimestamp()})
   }
   reports=reports.filter(report=>report.id!==id);render();showToast('Relatório excluído.')
  }
  else if(action==='archive'){await updateDoc(doc(db,'relatorios',id),{status:'arquivado',archivedAt:serverTimestamp(),archivedBy:auth.currentUser?.uid||'',updatedAt:serverTimestamp()});showToast('Relatório arquivado.')}
  else{await updateDoc(doc(db,'relatorios',id),{status:'entregue',deliveredAt:serverTimestamp(),deliveredBy:auth.currentUser?.uid||'',updatedAt:serverTimestamp()});showToast('Entrega registrada.')}
  document.querySelector('#clinicalPreviewDialog').close();activeClinicalReport=null
 }catch(error){console.error(error);showToast('Não foi possível concluir a ação.')}finally{button.disabled=false}
}
async function saveClinicalReport(finalize){
 const form=document.querySelector('#clinicalReportForm');const id=form.elements.reportId.value;if(!id)return;
 const payload={
  hd:form.elements.hd.value.trim(),clinicalItem:form.elements.clinicalItem.value.trim(),clinicalText:form.elements.clinicalItem.value.trim(),
  eva:form.elements.eva.value,treatmentProtocol:form.elements.treatmentProtocol.value,sessionCount:Number(form.elements.sessionCount.value),
  sessionStart:form.elements.sessionStart.value,sessionEnd:form.elements.sessionEnd.value,evolution:form.elements.evolution.value.trim(),reportDate:form.elements.reportDate.value,
  status:finalize?'pronto':'confeccao',updatedAt:serverTimestamp(),editedBy:auth.currentUser?.uid||''
 };
 if(finalize&&document.querySelector('#finalizeClinicalReport').disabled){showToast('Preencha todos os campos do relatório para finalizar.');return}
 if(payload.sessionStart&&payload.sessionEnd&&payload.sessionEnd<payload.sessionStart){showToast('A data final das sessões não pode ser anterior à data inicial.');return}
 const button=finalize?document.querySelector('#finalizeClinicalReport'):document.querySelector('#saveClinicalDraft');button.disabled=true;const original=button.textContent;button.textContent=finalize?'Finalizando...':'Salvando...';
 try{if(finalize){payload.finalizedAt=serverTimestamp();payload.finalizedDate=new Intl.DateTimeFormat('pt-BR').format(new Date());payload.finalizedByName=auth.currentUser?.displayName||activeClinicalReport?.therapist||'Profissional responsável'}await updateDoc(doc(db,'relatorios',id),payload);document.querySelector('#clinicalReportDialog').close();showToast(finalize?'Relatório finalizado e pronto para entrega.':'Rascunho salvo.');if(finalize)openClinicalPreview({...activeClinicalReport,...payload})}catch(error){console.error(error);showToast('Não foi possível salvar o relatório.')}finally{button.disabled=false;button.textContent=original;updateClinicalFinalizeState()}
}

function normalizePortalUrl(value){
 const url=new URL(value);
 if(url.protocol!=='https:')throw new Error('Somente endereços HTTPS são permitidos.');
 return url.href;
}
function renderPortals(){
 const root=document.querySelector('#portalList');if(!root)return;root.innerHTML='';
 if(!portals.length){root.innerHTML='<p class="authorization-empty">Nenhum portal cadastrado. O administrador pode adicionar os endereços oficiais dos convênios.</p>';return}
 portals.forEach(portal=>{
  const card=document.createElement('article');card.className='authorization-card';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`Abrir portal ${portal.name}`);
  if(portal.iconUrl){const image=document.createElement('img');image.src=portal.iconUrl;image.alt='';image.addEventListener('error',()=>{image.replaceWith(createPortalInitial(portal.name))});card.append(image)}else card.append(createPortalInitial(portal.name));
  const name=document.createElement('strong');name.textContent=portal.name;const mode=document.createElement('small');mode.textContent=portal.openMode==='external'?'Nova aba':'Abrir internamente';card.append(name,mode);
  const open=()=>openPortal(portal);card.addEventListener('click',open);card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}});
  const portalCount=document.querySelector('#adminPortalCount');if(portalCount)portalCount.textContent=`${portals.length} ${portals.length===1?'portal cadastrado':'portais cadastrados'}`;
 if(currentUserIsAdmin&&adminFunctionsEnabled){
  const edit=document.createElement('button');edit.type='button';edit.className='portal-edit';edit.title='Editar autorizador';edit.setAttribute('aria-label',`Editar ${portal.name}`);edit.textContent='✎';edit.addEventListener('click',event=>{event.stopPropagation();openPortalEditor(portal)});card.append(edit);
  if(!portal.isDefault){const remove=document.createElement('button');remove.type='button';remove.className='portal-delete';remove.title='Remover portal';remove.setAttribute('aria-label',`Remover ${portal.name}`);remove.textContent='×';remove.addEventListener('click',async event=>{event.stopPropagation();if(!confirm(`Remover o portal ${portal.name}?`))return;try{await deleteDoc(doc(db,'portais',portal.id));showToast('Portal removido.')}catch(error){console.error(error);showToast('Não foi possível remover o portal.')}});card.append(remove)}
 }
  root.append(card);
 });
}
function createPortalInitial(name){const initial=document.createElement('span');initial.className='portal-initial';initial.textContent=(name||'?').trim().charAt(0).toUpperCase();return initial}
function openPortal(portal){
 currentPortalUrl=portal.url;
 if(portal.openMode==='external'){window.open(portal.url,'_blank','noopener,noreferrer');return}
 document.querySelectorAll('.authorization-card').forEach(card=>card.classList.toggle('active',card.querySelector('strong')?.textContent===portal.name));
 document.querySelector('#browserTitle').textContent=portal.name;document.querySelector('#authorizationFrame').src=portal.url;document.querySelector('#internalBrowser').hidden=false;
 document.querySelector('#internalBrowser').scrollIntoView({behavior:'smooth',block:'start'});
}
function connectPortals(){
 if(portalsConnected)return;portalsConnected=true;
 onSnapshot(query(collection(db,'portais'),orderBy('order')),snapshot=>{const saved=snapshot.docs.map(item=>({id:item.id,...item.data()})).filter(item=>item.active!==false);const savedKeys=new Set(saved.flatMap(item=>[String(item.name||'').toLowerCase(),String(item.url||'').toLowerCase()]));const defaults=defaultAuthorizationPortals.filter(item=>!savedKeys.has(item.name.toLowerCase())&&!savedKeys.has(item.url.toLowerCase()));portals=[...defaults,...saved].sort((a,b)=>(a.order||0)-(b.order||0));renderPortals()},error=>{console.error(error);portals=[...defaultAuthorizationPortals];renderPortals();showToast('Portal padrão carregado; não foi possível sincronizar outros portais.')});
}
function renderTherapistCounts(){
 const groups=['Médico','Fisioterapeuta','Pilates','RPG'];
 groups.forEach(group=>{const list=document.querySelector(`[data-profession-list="${group}"]`);const people=therapists.filter(person=>(person.profession||'Fisioterapeuta')===group);list.innerHTML=people.length?'':'<p class="empty-mini">Nenhum profissional.</p>';if(group==='Fisioterapeuta'){['Cinesio Manhã','Eletro Manhã','Cinesio Tarde','Eletro Tarde'].forEach(scheduleGroup=>{const members=people.filter(person=>person.scheduleGroup===scheduleGroup);if(!members.length)return;const subgroup=document.createElement('details');subgroup.className='directory-subgroup';subgroup.open=true;const summary=document.createElement('summary');summary.innerHTML=`${scheduleGroup}<span>⌄</span>`;const memberList=document.createElement('div');members.forEach(person=>appendProfessionalLink(memberList,person));subgroup.append(summary,memberList);list.append(subgroup)});people.filter(person=>!person.scheduleGroup).forEach(person=>appendProfessionalLink(list,person))}else people.forEach(person=>appendProfessionalLink(list,person))});
}
function appendProfessionalLink(list,person){const link=document.createElement('button');link.type='button';link.className='professional-link';link.innerHTML=`<span>${person.name}</span><b>›</b>`;link.addEventListener('click',()=>openProfessionalAgenda(person.name));list.append(link)}
function renderTherapists(){
 const filter=document.querySelector('#therapistFilter');const request=document.querySelector('#requestTherapist');const agenda=document.querySelector('#agendaProfessional');
 const selectedFilter=filter.value;const selectedRequest=request.value;const selectedAgenda=agenda.value;
 filter.innerHTML='<option value="">Todas</option>'+therapists.map(t=>`<option>${t.name}</option>`).join('');
 request.innerHTML='<option value="">Selecione</option>'+therapists.filter(t=>(t.profession||'Fisioterapeuta')==='Fisioterapeuta').map(t=>`<option>${t.name}</option>`).join('');
 agenda.innerHTML='<option value="">Todos os profissionais</option>'+therapists.map(t=>`<option>${t.name}</option>`).join('');
 if(therapists.some(t=>t.name===selectedFilter))filter.value=selectedFilter;if(therapists.some(t=>t.name===selectedRequest))request.value=selectedRequest;if(therapists.some(t=>t.name===selectedAgenda))agenda.value=selectedAgenda;
 renderTherapistCounts();
 const adminList=document.querySelector('#adminTherapistList');const professionalCount=document.querySelector('#adminProfessionalCount');if(professionalCount)professionalCount.textContent=`${therapists.length} ${therapists.length===1?'profissional':'profissionais'}`;
 adminList.innerHTML=therapists.length?'':'<p class="empty-mini">Nenhum profissional cadastrado.</p>';
 therapists.forEach(person=>{const row=document.createElement('div');row.className='admin-row';row.innerHTML=`<div><strong>${person.name}</strong><small>${person.scheduleGroup||person.profession||'Fisioterapeuta'}</small></div><label class="column-setting">Agenda <select aria-label="Colunas da agenda de ${person.name}" ${person.isDefault?'disabled title="Profissional da lista inicial"':''}><option value="4" ${(person.agendaColumns||4)===4?'selected':''}>4 colunas</option><option value="5" ${person.agendaColumns===5?'selected':''}>5 colunas</option></select></label>`;const select=row.querySelector('select');if(!person.isDefault)select.addEventListener('change',async event=>{event.target.disabled=true;try{await updateDoc(doc(db,'profissionais',person.id),{agendaColumns:Number(event.target.value),updatedAt:serverTimestamp()});showToast('Formato da agenda atualizado.')}catch(error){console.error(error);showToast('Não foi possível atualizar a agenda.')}finally{event.target.disabled=false}});adminList.append(row)});
 renderAgenda();
}
function switchPage(view,persist=true){const available=[...document.querySelectorAll('.tool[data-view]')].filter(item=>!item.hidden).map(item=>item.dataset.view);const target=available.includes(view)?view:'inicio';document.querySelectorAll('.tool[data-view]').forEach(item=>item.classList.toggle('active',item.dataset.view===target));document.querySelectorAll('.page-view').forEach(page=>page.hidden=page.dataset.page!==target);if(persist)localStorage.setItem('apflow.activePage',target)}
function openProfessionalAgenda(name){switchPage('agendas');const agenda=document.querySelector('#agendaProfessional');agenda.value=name;connectAppointments();showToast(`Agenda de ${name}`)}
function setAgendaMode(mode){
 if((mode==='travar'||mode==='destravar')&&agendaMode===mode){resetAgendaMode();showToast('Modo Agendar reativado.');return}
 agendaMode=mode;if(agendaMode!=='remarcar')moveSource=null;
 document.querySelectorAll('[data-agenda-action]').forEach(button=>{const active=button.dataset.agendaAction===agendaMode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
 renderAgenda();
 const instructions={agendar:'Selecione uma célula vazia para abrir o agendamento.',desmarcar:'Selecione o paciente que deseja desmarcar.',remarcar:'Selecione o paciente que será transferido.',encaixar:'Selecione uma das células vazias exibidas.',confirmar:'Selecione o paciente que está no local.',cadastro:'Selecione o paciente para abrir o cadastro.',cobranca:'Selecione o paciente que deseja cobrar.',visualizacao:'Selecione o paciente para consultar seu histórico.',travar:'Selecione a célula que deseja bloquear.',destravar:'Selecione uma célula com horário travado.'};
 if(agendaMode)showToast(instructions[agendaMode]||'Selecione uma célula da agenda.');
}
function resetAgendaMode(){
 agendaMode='agendar';moveSource=null;
 document.querySelectorAll('[data-agenda-action]').forEach(button=>{const active=button.dataset.agendaAction==='agendar';button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
 renderAgenda();
}
async function handleSlotClick(slot,appointment){
 if(!agendaMode)return;
 if(appointment?.locked){
  if(agendaMode!=='destravar'){showToast('Este horário está travado. Use Destravar.');return}
  try{await updateDoc(doc(db,'agendamentos',appointment.id),{locked:false,updatedAt:serverTimestamp()});showToast('Horário destravado. Selecione outro horário ou outra função.')}catch(error){console.error(error);showToast('Não foi possível destravar o horário.')}return;
 }
 if(agendaMode==='destravar'){showToast('Selecione uma célula com cadeado.');return}
 if(agendaMode==='agendar'||agendaMode==='encaixar'){
  if(appointment){
   if(agendaMode==='encaixar'){showToast('Selecione uma célula vazia.');return}
   selectedAgendaAppointment={...appointment};renderAgenda();showToast('Paciente selecionado. Agora clique em Cadastro para abrir a ficha completa.');return
  }
  selectedAgendaAppointment=null;openAppointment(slot,null,agendaMode);return;
 }
 if(agendaMode==='travar'){
  if(appointment){showToast('Somente horários vazios podem ser travados.');return}
  try{await addDoc(collection(db,'agendamentos'),{professional:document.querySelector('#agendaProfessional').value,date:dateKey(selectedDate),time:slot.dataset.time,column:Number(slot.dataset.column),locked:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});showToast('Horário travado. Selecione outro horário ou outra função.')}catch(error){console.error(error);showToast('Não foi possível travar o horário.')}return;
 }
 if(agendaMode==='confirmar'){
  if(!appointment){showToast('Selecione um paciente agendado.');return}
  if(appointment.present){showToast('O paciente já está marcado como presente.');return}
  pendingScheduleAction={type:'confirmar',appointment};document.querySelector('#scheduleActionTitle').textContent='Confirmar presença';document.querySelector('#schedulePatientSummary').innerHTML=`<strong>${appointment.patient}</strong><span>${slot.dataset.time.replace(':','h')} • ${appointment.agreement||'Sem convênio'}</span><small>Nº ${appointment.code||'—'} • ${appointment.treatment||'Sem tratamento informado'}</small>`;document.querySelector('#scheduleActionMessage').textContent='Tem certeza de que este paciente está no local?';document.querySelector('#confirmScheduleAction').textContent='Confirmar presença';document.querySelector('#scheduleActionDialog').dataset.action='confirmar';document.querySelector('#scheduleActionDialog').showModal();return;
 }
 if(agendaMode==='desmarcar'){
  if(!appointment){showToast('Selecione um paciente agendado.');return}
  pendingScheduleAction={type:'desmarcar',appointment};document.querySelector('#scheduleActionTitle').textContent='Desmarcar paciente';document.querySelector('#confirmScheduleAction').textContent='Desmarcar';document.querySelector('#scheduleActionDialog').dataset.action='desmarcar';document.querySelector('#schedulePatientSummary').innerHTML=`<strong>${appointment.patient}</strong><span>${slot.dataset.time.replace(':','h')} • ${appointment.agreement||'Sem convênio'}</span><small>Nº ${appointment.code||'—'} • ${appointment.treatment||'Sem tratamento informado'}</small>`;document.querySelector('#scheduleActionMessage').textContent='Deseja cancelar este agendamento e liberar a célula?';document.querySelector('#scheduleActionDialog').showModal();return;
 }
 if(agendaMode==='cadastro'){
  if(!appointment){showToast('Selecione uma célula com paciente.');return}
  openPatientRecord(appointment);resetAgendaMode();return;
 }
 if(agendaMode==='visualizacao'){
  if(!appointment){showToast('Selecione uma célula com paciente.');return}
  openAppointmentHistory(appointment);resetAgendaMode();return;
 }
 if(agendaMode==='cobranca'){
  if(!appointment){showToast('Selecione uma célula com paciente.');return}
  pendingChargeAppointment=appointment;document.querySelector('#chargePatientName').textContent=appointment.patient;document.querySelector('#chargePatientSummary').innerHTML=`<strong>${appointment.patient}</strong><span>${slot.dataset.time.replace(':','h')} • ${appointment.agreement||'Sem convênio'}</span><small>Nº ${appointment.code||'—'} • ${appointment.treatment||'Sem tratamento informado'}</small>`;document.querySelector('#confirmCharge').disabled=appointment.billed===true;document.querySelector('#confirmCharge').textContent=appointment.billed?'✓ Atendimento já cobrado':'💼 Cobrar';document.querySelector('#chargeDialog').showModal();return;
 }
 if(agendaMode==='remarcar'){
  if(!moveSource){
   if(!appointment){showToast('Primeiro selecione o paciente que será remarcado.');return}
   if(appointment.present){showToast('Pacientes confirmados não podem ser remarcados.');return}
   moveSource={...appointment};renderAgenda();showToast('Agora selecione uma célula vazia em qualquer agenda.');return;
  }
  if(appointment){showToast('O novo destino precisa ser uma célula vazia.');return}
  try{await updateDoc(doc(db,'agendamentos',moveSource.id),{professional:document.querySelector('#agendaProfessional').value,date:dateKey(selectedDate),time:slot.dataset.time,column:Number(slot.dataset.column),updatedAt:serverTimestamp()});showToast('Paciente remarcado com sucesso.');resetAgendaMode();connectAppointments()}catch(error){console.error(error);showToast('Não foi possível remarcar o paciente.')}
 }
}
function createAgendaSlot(time,column,appointment,emptyLabel){
 const slot=document.createElement('button');slot.className=`appointment-slot column-${column}`;slot.type='button';slot.dataset.time=time;slot.dataset.column=column;
 if(appointment?.locked){slot.classList.add('locked');slot.innerHTML=`<span class="slot-time">${time.replace(':','h')}</span><span class="slot-empty"><b>🔒 HORÁRIO TRAVADO</b></span>`}
 else if(appointment){slot.classList.add('occupied');if(moveSource?.id===appointment.id)slot.classList.add('move-source');if(selectedAgendaAppointment?.id===appointment.id)slot.classList.add('selected-patient');slot.innerHTML=`<span class="slot-time">${time.replace(':','h')}</span><span class="patient-name">${appointment.patient}</span><small>${appointment.agreement||''}</small><small>${appointment.treatment||''}</small><small>Nº ${appointment.code||''}</small><span class="patient-actions">${appointment.billed?'💼':''} ${appointment.present?'✅':''}</span>`}
 else slot.innerHTML=`<span class="slot-time">${time.replace(':','h')}</span><span class="slot-empty">${emptyLabel}</span>`;
 slot.addEventListener('click',()=>handleSlotClick(slot,appointment));slot.addEventListener('dblclick',event=>{if(appointment?.locked)return;event.preventDefault();if(appointment)openPatientRecord(appointment);else openAppointment(slot,null,'agendar')});return slot;
}
function renderAgenda(){
 const root=document.querySelector('#agendaSchedule');const selectedName=document.querySelector('#agendaProfessional').value;const professional=therapists.find(person=>person.name===selectedName);const columns=professional?.agendaColumns===5?5:4;
 root.style.setProperty('--agenda-columns',columns);root.dataset.columns=String(columns);root.innerHTML='';
 if(!selectedName){root.innerHTML='<div class="agenda-welcome"><strong>Selecione um profissional</strong><p>Escolha uma agenda para visualizar os horários da manhã e da tarde.</p></div>';return}
 const allowedPeriods=professional?.scheduleGroup?.includes('Manhã')?['manha']:professional?.scheduleGroup?.includes('Tarde')?['tarde']:['manha','tarde'];
 const activeAppointments=appointments.filter(item=>item.cancelled!==true&&item.locked!==false);
 Object.entries(agendaSlots).filter(([period])=>allowedPeriods.includes(period)).forEach(([period,slots])=>{
  const divider=document.createElement('div');divider.className='period-divider';divider.textContent=period==='manha'?'Bloco da manhã':'Bloco da tarde';root.append(divider);
  const markers=document.createElement('div');markers.className='column-markers';markers.innerHTML=Array.from({length:columns},(_,index)=>`<span class="column-${index+1}"></span>`).join('');root.append(markers);
  if(agendaMode==='encaixar'){
   const fitGrid=document.createElement('div');fitGrid.className='fit-grid';let emptyCount=0;
   for(let column=1;column<=columns;column++){let compactRow=1;slots.forEach(time=>{const appointment=activeAppointments.find(item=>item.time===time&&Number(item.column)===column);if(appointment)return;const slot=createAgendaSlot(time,column,null,'Clique para encaixar');slot.style.gridColumn=column;slot.style.gridRow=compactRow++;fitGrid.append(slot);emptyCount++})}
   if(emptyCount)root.append(fitGrid);else{const empty=document.createElement('p');empty.className='fit-empty';empty.textContent='Não há células vazias neste período.';root.append(empty)}return;
  }
  slots.forEach(time=>{const row=document.createElement('div');row.className='schedule-row';for(let column=1;column<=columns;column++){const appointment=activeAppointments.find(item=>item.time===time&&Number(item.column)===column);row.append(createAgendaSlot(time,column,appointment,agendaMode?'Clique para selecionar':'Dois cliques para agendar'))}root.append(row)});
 });
}
function connectAppointments(){const professional=document.querySelector('#agendaProfessional').value;selectedAgendaAppointment=null;if(stopAppointments)stopAppointments();appointments=[];if(!professional){renderAgenda();return}const acceptedNames=new Set(professionalStoredNames(professional));stopAppointments=onSnapshot(query(collection(db,'agendamentos'),where('date','==',dateKey(selectedDate))),snapshot=>{appointments=snapshot.docs.map(item=>({id:item.id,...item.data()})).filter(item=>acceptedNames.has(item.professional));renderAgenda()},error=>{console.error(error);appointments=[];renderAgenda();showToast('Publique as regras do Firestore para usar a agenda.')})}
const appointmentDialog=document.querySelector('#appointmentDialog');const appointmentForm=document.querySelector('#appointmentForm');
let appointmentSelectedPatient=null;let appointmentCodeTimer=null;
function appointmentBirthDate(value){return value?String(value).split('-').reverse().join('/'):''}
function clearAppointmentPatient(message='Digite o código do paciente para preencher os dados automaticamente.'){
 appointmentSelectedPatient=null;
 ['patient','birthDate','agreement','patientId'].forEach(field=>{if(appointmentForm.elements[field])appointmentForm.elements[field].value=''});
 const status=document.querySelector('#appointmentPatientStatus');status.textContent=message;status.className='appointment-patient-status full';
}
function fillAppointmentPatient(patient){
 appointmentSelectedPatient=patient;
 appointmentForm.elements.patientId.value=patient.patientDocId||patient.id||'';
 appointmentForm.elements.patient.value=patient.patient||'';
 appointmentForm.elements.birthDate.value=appointmentBirthDate(patient.birthDate);
 appointmentForm.elements.agreement.value=patient.agreement||'Particular';
 const status=document.querySelector('#appointmentPatientStatus');status.textContent='Paciente localizado. Dados preenchidos pelo cadastro.';status.className='appointment-patient-status full found';
}
async function findAppointmentPatientByCode(showNotFound=true){
 const code=String(appointmentForm.elements.code.value||'').trim();clearTimeout(appointmentCodeTimer);
 if(!code){clearAppointmentPatient();return null}
 const status=document.querySelector('#appointmentPatientStatus');status.textContent='Localizando cadastro...';status.className='appointment-patient-status full searching';
 try{
  let snapshot=await getDocs(query(collection(db,'pacientes'),where('code','==',code)));
  let item=snapshot.docs[0];
  if(!item){
   const all=await getDocs(collection(db,'pacientes'));
   item=all.docs.find(entry=>String(entry.data().code||'').trim()===code);
  }
  if(!item){clearAppointmentPatient(showNotFound?'Código não encontrado. Cadastre ou localize o paciente antes de agendar.':'');status.classList.add('not-found');return null}
  const patient={patientDocId:item.id,id:item.id,...item.data()};fillAppointmentPatient(patient);return patient
 }catch(error){console.error(error);clearAppointmentPatient('Não foi possível consultar o cadastro agora.');status.classList.add('not-found');return null}
}
function openAppointment(slot,appointment,context='agendar'){
 appointmentContext=context;appointmentForm.reset();appointmentSelectedPatient=null;
 appointmentForm.elements.appointmentId.value=appointment?.id||'';appointmentForm.elements.time.value=slot.dataset.time;appointmentForm.elements.column.value=slot.dataset.column;
 document.querySelector('#appointmentTitle').textContent=appointment?'Cadastro do paciente':context==='encaixar'?'Encaixar às '+slot.dataset.time:'Agendar às '+slot.dataset.time;
 if(appointment){
  ['patient','code','birthDate','agreement','treatment','patientId'].forEach(field=>{if(appointmentForm.elements[field])appointmentForm.elements[field].value=field==='birthDate'?appointmentBirthDate(appointment[field]):appointment[field]||''});
  appointmentSelectedPatient={...appointment,patientDocId:appointment.patientId||''};
  const status=document.querySelector('#appointmentPatientStatus');status.textContent='Dados do paciente vinculados a este agendamento.';status.className='appointment-patient-status full found';
 }else clearAppointmentPatient();
 appointmentDialog.showModal();setTimeout(()=>appointmentForm.elements.code.focus(),50)
}
appointmentForm.elements.code.addEventListener('input',()=>{
 clearAppointmentPatient('Aguardando a conclusão do código...');
 clearTimeout(appointmentCodeTimer);appointmentCodeTimer=setTimeout(()=>findAppointmentPatientByCode(),450)
});
appointmentForm.elements.code.addEventListener('blur',()=>{if(appointmentForm.elements.code.value.trim()&&!appointmentSelectedPatient)findAppointmentPatientByCode()});
appointmentForm.elements.code.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();findAppointmentPatientByCode()}});
function sameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function longDate(date){const value=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date);return value.charAt(0).toUpperCase()+value.slice(1)}
function dateKey(date){const year=date.getFullYear();const month=String(date.getMonth()+1).padStart(2,'0');const day=String(date.getDate()).padStart(2,'0');return `${year}-${month}-${day}`}
function updateSelectedDate(){document.querySelectorAll('[data-selected-date]').forEach(element=>element.textContent=longDate(selectedDate))}
function renderCalendar(){
 const root=document.querySelector('#calendarDays');const title=document.querySelector('#calendarTitle');const today=new Date();
 title.textContent=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(calendarMonth).replace(/^./,letter=>letter.toUpperCase());root.innerHTML='';
 const firstCell=new Date(calendarMonth);firstCell.setDate(1-firstCell.getDay());
 const daysInMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,0).getDate();
 const visibleCells=Math.ceil((calendarMonth.getDay()+daysInMonth)/7)*7;
 for(let offset=0;offset<visibleCells;offset++){
  const date=new Date(firstCell);date.setDate(firstCell.getDate()+offset);const button=document.createElement('button');button.type='button';button.textContent=date.getDate();button.setAttribute('aria-label',longDate(date));
  if(date.getMonth()!==calendarMonth.getMonth())button.classList.add('muted');if(sameDay(date,today))button.classList.add('today');if(sameDay(date,selectedDate))button.classList.add('selected');
  button.addEventListener('click',()=>{selectedDate=new Date(date);calendarMonth=new Date(date.getFullYear(),date.getMonth(),1);updateSelectedDate();renderCalendar();connectAppointments()});root.append(button);
 }
}
function addBusinessDays(start,days){const date=new Date(start);let added=0;while(added<days){date.setDate(date.getDate()+1);if(date.getDay()!==0&&date.getDay()!==6)added++}return date}
function brDate(date){return new Intl.DateTimeFormat('pt-BR').format(date)}
function showToast(message,type='info',duration=4200){
 const toast=document.querySelector('#toast');toast.textContent=message;toast.className='toast '+type;
 try{if(typeof toast.showPopover==='function'&&!toast.matches(':popover-open'))toast.showPopover()}catch(error){}
 requestAnimationFrame(()=>toast.classList.add('show'));clearTimeout(showToast.timer);
 showToast.timer=setTimeout(()=>{toast.classList.remove('show');setTimeout(()=>{try{if(typeof toast.hidePopover==='function'&&toast.matches(':popover-open'))toast.hidePopover()}catch(error){}},220)},duration)
}
function firebasePatientError(error){
 const code=String(error?.code||'');
 if(code.includes('permission-denied'))return 'Cadastro não autorizado pelo Firebase. Publique as regras da coleção pacientes no Firestore.';
 if(code.includes('unavailable'))return 'Firebase indisponível no momento. Verifique a conexão e tente novamente.';
 if(code.includes('unauthenticated'))return 'Sua sessão expirou. Entre novamente para cadastrar o paciente.';
 return 'Não foi possível cadastrar o paciente'+(code?' ('+code.replace('firestore/','')+')':'')+'.'
}
function maskBirthDate(value){
 const digits=String(value||'').replace(/\D/g,'').slice(0,8);
 return [digits.slice(0,2),digits.slice(2,4),digits.slice(4,8)].filter(Boolean).join('/')
}
function birthDateToIso(value){
 const text=String(value||'').trim();if(!text)return '';
 const match=text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!match)return null;
 const day=Number(match[1]),month=Number(match[2]),year=Number(match[3]);const date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
 return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}
function setConnection(online,message){document.querySelector('#connectionStatus').textContent=message;document.querySelector('#connectionDot').style.background=online?'#20a36d':'#c88313'}
async function hashText(value){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
const dialog=document.querySelector('#requestDialog');
function normalizePatientRecord(item){return patientData(item)}
function requestPatientKey(item){return String(item.code||item.cpf||item.rg||item.patient||'').trim().toLowerCase()}
function patientSearchValues(item){return[item.patient,item.socialName,item.code,item.medicalRecord,item.birthDate,item.birthDate?.split('-').reverse().join('/'),item.phone,item.secondaryPhone,item.commercialPhone,item.additionalPhone,item.contactName,item.contactPhone,item.email,item.email2,item.email3,item.cpf,item.rg,item.cns,item.insuranceCard,item.agreement,item.insuranceDoctor,item.address,item.city].filter(Boolean).map(value=>String(value).toLowerCase())}
function renderRequestPatientResults(){
 const input=document.querySelector('#requestPatientSearch');const root=document.querySelector('#requestPatientResults');const term=input.value.trim().toLowerCase();const digits=term.replace(/\D/g,'');root.innerHTML='';
 if(!term){root.innerHTML='<p>Digite uma informação para localizar o paciente.</p>';return}
 const found=requestPatientPool.filter(item=>patientSearchValues(item).some(value=>value.includes(term)||(digits&&value.replace(/\D/g,'').includes(digits)))).slice(0,20);
 if(!found.length){root.innerHTML='<p>Nenhum paciente encontrado nos cadastros.</p>';return}
 found.forEach(patient=>{const button=document.createElement('button');button.type='button';const name=document.createElement('strong');name.textContent=patient.patient||'Paciente sem nome';const details=document.createElement('span');details.textContent=`Código: ${patient.code||'—'} • Nascimento: ${patient.birthDate?patient.birthDate.split('-').reverse().join('/'):'—'} • CPF: ${patient.cpf||'—'}`;button.append(name,details);button.addEventListener('click',()=>selectRequestPatient(patient));root.append(button)})
}
function selectRequestPatient(patient){
 const form=document.querySelector('#requestForm');['patient','code','birthDate','phone','cpf','rg','insuranceCard','agreement'].forEach(field=>{form.elements[field].value=patient[field]||''});
 document.querySelector('#requestPatientSearch').value='';document.querySelector('#requestPatientResults').innerHTML='';
 const selected=document.querySelector('#requestSelectedPatient');selected.hidden=false;selected.innerHTML='';const title=document.createElement('strong');title.textContent='Paciente selecionado: '+(patient.patient||'');const details=document.createElement('span');details.textContent=`Código: ${patient.code||'—'} • Convênio: ${patient.agreement||'—'} • Carteirinha: ${patient.insuranceCard||'—'}`;selected.append(title,details)
}
async function loadRequestPatients(){
 const root=document.querySelector('#requestPatientResults');root.innerHTML='<p>Carregando cadastros...</p>';
 try{
  const [patientSnapshot,appointmentSnapshot]=await Promise.all([getDocs(collection(db,'pacientes')),getDocs(collection(db,'agendamentos'))]);const map=new Map();
  [...patientSnapshot.docs.map(item=>({id:item.id,...item.data()})),...reports,...appointmentSnapshot.docs.map(item=>item.data()).filter(item=>item.patient)].forEach(item=>{const patient=normalizePatientRecord(item);const key=requestPatientKey(patient);if(key)map.set(key,{...(map.get(key)||{}),...patient})});
  requestPatientPool=[...map.values()].sort((a,b)=>(a.patient||'').localeCompare(b.patient||'','pt-BR'));renderRequestPatientResults()
 }catch(error){console.error(error);root.innerHTML='<p>Não foi possível carregar os cadastros.</p>'}
}
function openDialog(){
 if(!canCreateReportRequest()){showToast('Seu cargo pode confeccionar relatórios, mas não criar novos pedidos.');return}
 const form=document.querySelector('#requestForm');form.reset();document.querySelector('#requestSelectedPatient').hidden=true;document.querySelector('#requestSelectedPatient').innerHTML='';document.querySelector('#requestPatientSearch').value='';document.querySelector('#dueDate').value=brDate(addBusinessDays(selectedDate,3));dialog.showModal();loadRequestPatients();setTimeout(()=>document.querySelector('#requestPatientSearch').focus(),50)
}
document.querySelectorAll('#newRequest,#newRequestTop').forEach(b=>b.addEventListener('click',openDialog));
document.querySelectorAll('#closeDialog,#cancelDialog').forEach(b=>b.addEventListener('click',()=>dialog.close()));
document.querySelector('#requestPatientSearch').addEventListener('input',renderRequestPatientResults);
const patientRegistrationDialog=document.querySelector('#patientRegistrationDialog');
const patientRegistrationForm=document.querySelector('#patientRegistrationForm');
const patientAgreement=patientRegistrationForm.elements.agreement;
const patientInsuranceCard=patientRegistrationForm.elements.insuranceCard;
const patientInsuranceCardLabel=document.querySelector('#patientInsuranceCardLabel');
const patientProfileFields=['patient','code','socialName','medicalRecord','sex','sexualOrientation','maritalStatus','raceColor','referral','riskClassification','phoneType','phone','secondaryPhoneType','secondaryPhone','commercialPhoneType','commercialPhone','additionalPhoneType','additionalPhone','contactName','contactPhone','email','email2','email3','cpf','rg','zipCode','address','addressNumber','addressComplement','district','city','state','birthplace','nationality','profession','spouse','fatherName','motherName','patientType','agreement','insurancePlan','insuranceCard','insuranceValidity','insuranceDoctor','cns','company','lastVisit','lastVisitDescription','observations','additionalData','agreementsNotes'];
function formText(data,name){return String(data.get(name)||'').trim()}
function calculatePatientAge(iso){
 if(!iso)return'';const birth=new Date(iso+'T12:00:00');if(Number.isNaN(birth.getTime()))return'';
 const today=new Date();let age=today.getFullYear()-birth.getFullYear();const before=today.getMonth()<birth.getMonth()||(today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate());if(before)age--;return age>=0?String(age):''
}
function refreshPatientAge(){
 const iso=birthDateToIso(patientRegistrationForm.elements.birthDate.value);
 patientRegistrationForm.elements.age.value=iso?calculatePatientAge(iso):''
}
function syncPatientInsuranceCard(){
 const particular=patientAgreement.value.toUpperCase().startsWith('PARTICULAR');patientInsuranceCard.disabled=particular;
 patientInsuranceCardLabel.classList.toggle('field-disabled',particular);
 if(particular){patientInsuranceCard.value='';patientInsuranceCard.placeholder='Não se aplica a paciente particular'}else patientInsuranceCard.placeholder='Número da carteirinha'
}
function setPatientFormTab(tab='cadastro'){
 document.querySelectorAll('[data-patient-tab]').forEach(button=>{const active=button.dataset.patientTab===tab;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active))});
 document.querySelectorAll('[data-patient-panel]').forEach(panel=>{panel.hidden=panel.dataset.patientPanel!==tab})
}
document.querySelectorAll('[data-patient-tab]').forEach(button=>button.addEventListener('click',()=>setPatientFormTab(button.dataset.patientTab)));
function setPatientNoteTab(tab='observations'){
 document.querySelectorAll('[data-patient-note-tab]').forEach(button=>{const active=button.dataset.patientNoteTab===tab;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active))});
 document.querySelectorAll('[data-patient-note-panel]').forEach(panel=>{panel.hidden=panel.dataset.patientNotePanel!==tab})
}
document.querySelectorAll('[data-patient-note-tab]').forEach(button=>button.addEventListener('click',()=>setPatientNoteTab(button.dataset.patientNoteTab)));
function openPatientRegistration(patient=null,selectAfterSave=false){
 patientRegistrationForm.reset();setPatientFormTab('cadastro');setPatientNoteTab('observations');hideAgreementDropdown();setCepStatus('');selectPatientAfterRegistration=selectAfterSave;
 patientRegistrationForm.elements.patientId.value=patient?.patientDocId||patient?.id||'';
 patientProfileFields.forEach(field=>{if(patientRegistrationForm.elements[field])patientRegistrationForm.elements[field].value=patient?.[field]||''});
 patientRegistrationForm.elements.birthDate.value=patient?.birthDate?patient.birthDate.split('-').reverse().join('/'):'';
 if(!patient)patientRegistrationForm.elements.agreement.value='Particular';
 agreementSearch.dataset.defaultParticular=String(!patient);
 hideProfessionDropdown();
 refreshPatientAge();
 const editing=Boolean(patientRegistrationForm.elements.patientId.value);
 document.querySelector('#patientRegistrationTitle').textContent=editing?'Editar ficha do paciente':'Cadastrar paciente';
 document.querySelector('#patientRegistrationSubmit').textContent=editing?'Salvar alterações':'Salvar e selecionar';
 syncPatientInsuranceCard();patientRegistrationDialog.showModal();setTimeout(()=>patientRegistrationForm.elements.patient.focus(),50)
}
document.querySelector('#openPatientRegistration').addEventListener('click',()=>openPatientRegistration(null,true));
document.querySelectorAll('#closePatientRegistration,#cancelPatientRegistration').forEach(button=>button.addEventListener('click',()=>patientRegistrationDialog.close()));
patientAgreement.addEventListener('input',syncPatientInsuranceCard);
patientAgreement.addEventListener('change',syncPatientInsuranceCard);
patientAgreement.addEventListener('click',()=>{try{patientAgreement.showPicker?.()}catch(error){}});
patientRegistrationForm.elements.birthDate.addEventListener('input',event=>{event.target.value=maskBirthDate(event.target.value);refreshPatientAge()});
patientRegistrationForm.addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget;const data=new FormData(form);const submit=form.querySelector('[type="submit"]');const patientId=formText(data,'patientId');
 const birthDate=birthDateToIso(data.get('birthDate'));
 if(!birthDate){showToast('Digite uma data de nascimento válida no formato dd/mm/aaaa.','warning');form.elements.birthDate.focus();return}
 let code=formText(data,'code');
 if(!code)code=String(Date.now()).slice(-6);
 const patient={patient:formText(data,'patient'),code,birthDate};
 patientProfileFields.filter(field=>!['patient','code'].includes(field)).forEach(field=>{patient[field]=formText(data,field)});
 patient.agreement=patient.agreement||'Particular';
 patient.insuranceCard=patient.agreement.toUpperCase().startsWith('PARTICULAR')?'':patient.insuranceCard;
 if(!patient.patient||!patient.agreement){showToast('Preencha nome, data de nascimento e convênio.','warning');return}
 submit.disabled=true;submit.textContent='Verificando código...';
 try{
  let duplicateSnapshot=await getDocs(query(collection(db,'pacientes'),where('code','==',patient.code)));
  let duplicate=duplicateSnapshot.docs.find(item=>item.id!==patientId);
  if(duplicate&&formText(data,'code')){showToast('Paciente já possui cadastro com este código.','warning',5600);return}
  while(duplicate&&!formText(data,'code')){
   patient.code=String(Math.floor(100000+Math.random()*900000));
   duplicateSnapshot=await getDocs(query(collection(db,'pacientes'),where('code','==',patient.code)));duplicate=duplicateSnapshot.docs.find(item=>item.id!==patientId)
  }
  submit.textContent='Salvando...';
  let referenceId=patientId;
  if(patientId)await updateDoc(doc(db,'pacientes',patientId),{...patient,active:true,updatedAt:serverTimestamp(),updatedBy:auth.currentUser?.uid||''});
  else{const reference=await addDoc(collection(db,'pacientes'),{...patient,active:true,createdAt:serverTimestamp(),createdBy:auth.currentUser?.uid||'',updatedAt:serverTimestamp()});referenceId=reference.id}
  const saved={patientDocId:referenceId,id:referenceId,...patient};
  requestPatientPool=requestPatientPool.filter(item=>(item.patientDocId||item.id)!==referenceId);requestPatientPool.push(saved);requestPatientPool.sort((a,b)=>(a.patient||'').localeCompare(b.patient||'','pt-BR'));
  patientDirectoryPool=patientDirectoryPool.filter(item=>item.patientDocId!==referenceId);patientDirectoryPool.push(saved);patientDirectoryPool.sort((a,b)=>(a.patient||'').localeCompare(b.patient||'','pt-BR'));
  activePatientRecord=saved;patientRegistrationDialog.close();
  if(selectPatientAfterRegistration)selectRequestPatient(saved);else renderPatientSearch();
  showToast(patientId?'Ficha do paciente atualizada.':'Paciente cadastrado com o código '+patient.code+'.','success')
 }catch(error){console.error(error);showToast(firebasePatientError(error),'error',7200)}
 finally{submit.disabled=false;submit.textContent=patientId?'Salvar alterações':'Salvar e selecionar'}
});
document.querySelectorAll('[name="purpose"]').forEach(r=>r.addEventListener('change',()=>{const field=document.querySelector('#otherPurpose');field.disabled=r.value!=='Outro';if(!field.disabled)field.focus()}));
document.querySelector('#requestForm').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget;const data=new FormData(form);const submit=form.querySelector('[type="submit"]');
 if(!String(data.get('patient')||'').trim()){showToast('Pesquise e selecione o cadastro do paciente.');document.querySelector('#requestPatientSearch').focus();return}
 const report={patient:data.get('patient').trim(),code:data.get('code').trim(),birthDate:data.get('birthDate'),phone:data.get('phone').trim(),cpf:data.get('cpf').trim(),rg:data.get('rg').trim(),insuranceCard:data.get('insuranceCard').trim(),agreement:data.get('agreement'),purpose:data.get('purpose')==='Outro'?(data.get('otherPurpose').trim()||'Outro'):data.get('purpose'),therapist:data.get('therapist'),requestDate:dateKey(selectedDate),due:data.get('dueDate'),status:'aguardando',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
 submit.disabled=true;submit.textContent='Enviando...';
 try{await addDoc(collection(db,'relatorios'),report);form.reset();dialog.close();showToast('Solicitação salva no APFlow.')}catch(error){console.error(error);showToast('Não foi possível salvar. Ative o Firestore e confira as regras.')}finally{submit.disabled=false;submit.textContent='Enviar pedido'}
});
Object.values(filters).forEach(el=>el.addEventListener('input',render));
filters.therapist.addEventListener('change',()=>{if(document.querySelector('.tool[data-view].active')?.dataset.view==='agendas')document.querySelector('#agendaProfessional').value=filters.therapist.value});
document.querySelector('#clearFilters').addEventListener('click',()=>{Object.values(filters).forEach(el=>el.value='');render()});
document.querySelectorAll('.metric').forEach(metric=>metric.addEventListener('click',()=>{document.querySelectorAll('.metric').forEach(m=>m.classList.remove('selected'));metric.classList.add('selected');const lane=document.querySelector(`.lane[data-status="${metric.dataset.filter}"]`);if(lane)lane.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})}));
document.querySelectorAll('.tool[data-view]').forEach(tool=>tool.addEventListener('click',()=>switchPage(tool.dataset.view)));
const filterDialog=document.querySelector('#filterDialog');
document.querySelectorAll('.header-filter').forEach(button=>button.addEventListener('click',()=>{const current=document.querySelector('.tool[data-view].active')?.dataset.view||'relatorio';const titles={inicio:'Filtrar visão geral',agendas:'Filtrar agendas',relatorio:'Filtrar relatórios',financeiro:'Filtrar financeiro'};document.querySelector('#filterTitle').textContent=titles[current];filterDialog.showModal()}));
document.querySelector('#previousMonth').addEventListener('click',()=>{calendarMonth.setMonth(calendarMonth.getMonth()-1);renderCalendar()});
document.querySelector('#nextMonth').addEventListener('click',()=>{calendarMonth.setMonth(calendarMonth.getMonth()+1);renderCalendar()});
document.querySelector('#todayButton').addEventListener('click',()=>{selectedDate=new Date();calendarMonth=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);updateSelectedDate();renderCalendar();connectAppointments()});
document.querySelector('#agendaProfessional').addEventListener('change',connectAppointments);
document.querySelectorAll('[data-agenda-action]').forEach(button=>button.addEventListener('click',()=>{
 const action=button.dataset.agendaAction;
 if(action==='imprimir'){showToast('A impressão da ficha do paciente será adicionada futuramente.');return}
 if(action==='localizar'){openPatientSearch();return}
 if(action==='cadastro'&&selectedAgendaAppointment){
  const patient={...selectedAgendaAppointment};selectedAgendaAppointment=null;openPatientRecord(patient);resetAgendaMode();return
 }
 if(action==='travar-dia'){
  if(!document.querySelector('#agendaProfessional').value){showToast('Selecione primeiro um profissional.');return}
  const locked=appointments.filter(item=>item.locked===true&&item.locked!==false).length;document.querySelector('#dayLockDescription').textContent='Agenda de '+document.querySelector('#agendaProfessional').value+': '+locked+' célula(s) travada(s).';document.querySelector('#dayLockDialog').showModal();return
 }
 if(['agendar','desmarcar','remarcar','encaixar','confirmar','travar','destravar','cadastro','visualizacao','cobranca'].includes(action)){
  if(!document.querySelector('#agendaProfessional').value){showToast('Selecione primeiro um profissional.');return}
  setAgendaMode(action);return
 }
 showToast(button.textContent.trim()+': função em preparação.')
}));
const portalDialog=document.querySelector('#portalDialog');
function openPortalEditor(portal=null){
 const form=document.querySelector('#portalForm');form.reset();
 form.elements.portalId.value=portal&&!portal.isDefault?portal.id:'';
 form.elements.sourceDefault.value=portal?.isDefault?'true':'';
 form.elements.name.value=portal?.name||'';
 form.elements.url.value=portal?.url||'';
 form.elements.iconUrl.value=portal?.iconUrl||'';
 form.elements.openMode.value=portal?.openMode||'internal';
 const editing=Boolean(portal);
 document.querySelector('#portalDialogTitle').textContent=editing?'Editar portal de autorização':'Adicionar portal de autorização';
 document.querySelector('#portalSubmitButton').textContent=editing?'Salvar alterações':'Salvar portal';
 portalDialog.showModal();
 setTimeout(()=>form.elements[editing?'openMode':'name'].focus(),40)
}
document.querySelector('#addPortalButton').addEventListener('click',()=>openPortalEditor());
document.querySelectorAll('#closePortalDialog,#cancelPortal').forEach(button=>button.addEventListener('click',()=>portalDialog.close()));
document.querySelector('#portalForm').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget;const data=new FormData(form);const button=form.querySelector('[type="submit"]');const portalId=String(data.get('portalId')||'');const editing=Boolean(portalId||data.get('sourceDefault'));button.disabled=true;
 try{
  const url=normalizePortalUrl(data.get('url').trim());const rawIcon=data.get('iconUrl').trim();const iconUrl=rawIcon?normalizePortalUrl(rawIcon):'';
  const payload={name:data.get('name').trim(),url,iconUrl,openMode:data.get('openMode'),active:true,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid};
  if(portalId)await updateDoc(doc(db,'portais',portalId),payload);
  else await addDoc(collection(db,'portais'),{...payload,order:Date.now(),createdAt:serverTimestamp(),createdBy:auth.currentUser.uid});
  form.reset();portalDialog.close();showToast(editing?'Autorizador atualizado.':'Portal adicionado às Autorizações.');
 }catch(error){console.error(error);showToast(error.message||'Não foi possível salvar o portal.')}finally{button.disabled=false;button.textContent=editing?'Salvar alterações':'Salvar portal'}
});
document.querySelector('#openPortalExternal').addEventListener('click',()=>{if(currentPortalUrl)window.open(currentPortalUrl,'_blank','noopener,noreferrer')});
document.querySelector('#closeInternalBrowser').addEventListener('click',()=>{document.querySelector('#authorizationFrame').src='about:blank';document.querySelector('#internalBrowser').hidden=true;currentPortalUrl='';document.querySelectorAll('.authorization-card').forEach(card=>card.classList.remove('active'))});
function patientData(record){
 const match=reports.find(item=>(record.code&&String(item.code)===String(record.code))||(!record.code&&item.patient?.toLowerCase()===record.patient?.toLowerCase()));return{...(match||{}),...record};
}
async function resolvePatientRecord(record){
 const patientDocumentId=record.patientDocId||record.patientId||'';
 if(patientDocumentId){
  const snapshot=await getDoc(doc(db,'pacientes',patientDocumentId));
  if(snapshot.exists())return patientData({...record,...snapshot.data(),patientDocId:snapshot.id,id:snapshot.id})
 }
 const code=String(record.code||'').trim();
 if(code){
  let snapshot=await getDocs(query(collection(db,'pacientes'),where('code','==',code)));
  let item=snapshot.docs[0];
  if(!item){
   const all=await getDocs(collection(db,'pacientes'));
   item=all.docs.find(entry=>String(entry.data().code||'').trim()===code)
  }
  if(item)return patientData({...record,...item.data(),patientDocId:item.id,id:item.id})
 }
 return patientData(record)
}
function patientRecordDate(value){return value?String(value).slice(0,10).split('-').reverse().join('/'):''}
function appendPatientRecordSection(root,title,fields){
 const heading=document.createElement('h3');heading.className='patient-record-section-title';heading.textContent=title;root.append(heading);
 fields.forEach(([label,value])=>{const item=document.createElement('div');const fieldTitle=document.createElement('span');fieldTitle.textContent=label;const content=document.createElement('strong');content.textContent=value||'Não informado';item.append(fieldTitle,content);root.append(item)})
}
function renderFullPatientRecord(patient){
 document.querySelector('#patientRecordTitle').textContent=patient.patient||'Paciente';
 const root=document.querySelector('#patientRecordContent');root.innerHTML='';
 const source=document.querySelector('#patientRegistrationForm .legacy-patient-sheet');
 if(!source){root.innerHTML='<p class="patient-record-loading">Não foi possível montar a ficha do paciente.</p>';return}
 const sheet=source.cloneNode(true);sheet.classList.add('patient-record-readonly-sheet');
 sheet.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));
 sheet.querySelectorAll('.patient-agreement-dropdown,.patient-profession-dropdown,datalist,.legacy-cep-control button,.legacy-cep-field small').forEach(element=>element.remove());
 const dateValue=value=>value?String(value).slice(0,10):'';
 sheet.querySelectorAll('input,select,textarea').forEach(control=>{
  const name=control.name;let value=patient?.[name]??'';
  if(name==='birthDate')value=patientRecordDate(patient.birthDate);
  if(name==='age')value=calculatePatientAge(patient.birthDate);
  if(name==='insuranceValidity'||name==='lastVisit')value=dateValue(patient?.[name]);
  if(control.tagName==='SELECT'&&value&&![...control.options].some(option=>option.value===String(value))){const option=document.createElement('option');option.value=String(value);option.textContent=String(value);control.append(option)}
  if(control.tagName==='SELECT'&&!value){const option=document.createElement('option');option.value='';option.textContent='Não informado';control.prepend(option)}
  control.value=String(value||'');
  if(!value&&control.tagName!=='SELECT')control.placeholder='Não informado';
  control.disabled=true;control.removeAttribute('required')
 });
 const noteTabs=[...sheet.querySelectorAll('[data-patient-note-tab]')];const notePanels=[...sheet.querySelectorAll('[data-patient-note-panel]')];
 const activateNote=tab=>{noteTabs.forEach(button=>{const active=button.dataset.patientNoteTab===tab;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active))});notePanels.forEach(panel=>{panel.hidden=panel.dataset.patientNotePanel!==tab})};
 noteTabs.forEach(button=>{button.disabled=false;button.addEventListener('click',()=>activateNote(button.dataset.patientNoteTab))});
 notePanels.forEach(panel=>{panel.disabled=!patient.patientDocId;panel.addEventListener('input',()=>{patientRecordNotesDirty=true;const save=document.querySelector('#savePatientQuickNotes');save.disabled=false;save.textContent='Salvar ficha *'})});
 activateNote('observations');
 root.append(sheet);
 patientRecordNotesDirty=false;
 const save=document.querySelector('#savePatientQuickNotes');save.disabled=!patient.patientDocId;save.textContent='Salvar ficha';
 const edit=document.querySelector('#editPatientRecord');edit.disabled=!patient.patientDocId;edit.textContent=patient.patientDocId?'Editar cadastro':'Cadastro completo não localizado'
}
async function openPatientRecord(record){
 const root=document.querySelector('#patientRecordContent');document.querySelector('#patientRecordTitle').textContent=record.patient||'Paciente';
 root.innerHTML='<p class="patient-record-loading">Carregando ficha completa...</p>';const edit=document.querySelector('#editPatientRecord');edit.disabled=true;edit.textContent='Carregando...';
 document.querySelector('#patientRecordDialog').showModal();
 try{
  const patient=await resolvePatientRecord(record);activePatientRecord={...patient};renderFullPatientRecord(patient);
  if(!patient.patientDocId)showToast('O agendamento foi encontrado, mas não há uma ficha completa vinculada a este código.','warning',5600)
 }catch(error){
  console.error(error);activePatientRecord=patientData(record);renderFullPatientRecord(activePatientRecord);showToast('Não foi possível carregar a ficha completa do paciente.','error')
 }
}
function appointmentMoment(item){return new Date(`${item.date||'1970-01-01'}T${item.time||'00:00'}:00`)}
function formatAppointmentDate(item){const date=new Date(`${item.date||'1970-01-01'}T12:00:00`);return new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(date)}
function appendHistoryItems(root,items,emptyMessage){
 root.innerHTML='';if(!items.length){const empty=document.createElement('p');empty.className='history-empty';empty.textContent=emptyMessage;root.append(empty);return}
 items.forEach(item=>{const card=document.createElement('article');card.className='history-item';const main=document.createElement('div');const title=document.createElement('strong');title.textContent=`${formatAppointmentDate(item)} às ${String(item.time||'--:--').replace(':','h')}`;const detail=document.createElement('span');detail.textContent=`${item.professional||'Profissional não informado'} • ${item.treatment||'Tratamento não informado'}`;main.append(title,detail);const status=document.createElement('small');status.className=item.cancelled?'cancelled':item.present?'present':'scheduled';status.textContent=item.cancelled?'Cancelado':item.present?'Compareceu':'Agendado';card.append(main,status);root.append(card)})
}
async function openAppointmentHistory(record){
 const patient=patientData(record);const dialog=document.querySelector('#appointmentHistoryDialog');document.querySelector('#historyPatientTitle').textContent=patient.patient||'Paciente';document.querySelector('#historyPatientMeta').textContent=`Código: ${patient.code||'não informado'}`;
 ['historyPast','historyMissed','historyFuture'].forEach(id=>document.querySelector('#'+id).innerHTML='<p class="history-empty">Carregando...</p>');dialog.showModal();
 try{
  const searches=[];if(patient.code)searches.push(getDocs(query(collection(db,'agendamentos'),where('code','==',String(patient.code)))));
  if(patient.patient)searches.push(getDocs(query(collection(db,'agendamentos'),where('patient','==',patient.patient))));
  const snapshots=await Promise.all(searches);const records=new Map();snapshots.forEach(snapshot=>snapshot.docs.forEach(item=>records.set(item.id,{id:item.id,...item.data()})));
  const now=new Date();const all=[...records.values()].filter(item=>!item.locked).sort((a,b)=>appointmentMoment(b)-appointmentMoment(a));
  const missed=all.filter(item=>appointmentMoment(item)<now&&!item.present&&!item.cancelled);
  const past=all.filter(item=>appointmentMoment(item)<now&&!missed.includes(item));
  const future=all.filter(item=>appointmentMoment(item)>=now&&!item.cancelled).sort((a,b)=>appointmentMoment(a)-appointmentMoment(b));
  appendHistoryItems(document.querySelector('#historyPast'),past,'Nenhum agendamento passado.');
  appendHistoryItems(document.querySelector('#historyMissed'),missed,'Nenhuma falta registrada.');
  appendHistoryItems(document.querySelector('#historyFuture'),future,'Nenhum agendamento futuro.');
  document.querySelector('#historyPastCount').textContent=past.length;document.querySelector('#historyMissedCount').textContent=missed.length;document.querySelector('#historyFutureCount').textContent=future.length;
 }catch(error){console.error(error);['historyPast','historyMissed','historyFuture'].forEach(id=>document.querySelector('#'+id).innerHTML='<p class="history-empty history-error">Não foi possível carregar os agendamentos.</p>');showToast('Não foi possível carregar o histórico do paciente.')}
}
function patientCandidates(){return patientDirectoryPool}
function renderPatientSearch(){
 const term=document.querySelector('#patientGlobalSearch').value.trim().toLowerCase();const digits=term.replace(/\D/g,'');const root=document.querySelector('#patientSearchResults');root.innerHTML='';
 if(!term){root.innerHTML='<p class="empty-state">Digite o código, nome ou outro dado para pesquisar.</p>';return}
 const found=patientCandidates().filter(item=>{const p=patientData(item);return patientSearchValues(p).some(value=>value.includes(term)||(digits&&value.replace(/\D/g,'').includes(digits)))}).slice(0,50);
 if(!found.length){root.innerHTML='<p class="empty-state">Nenhum paciente encontrado.</p>';return}
 found.forEach(item=>{const p=patientData(item);const button=document.createElement('button');button.type='button';button.className='patient-result';const main=document.createElement('strong');main.textContent=p.patient||'Paciente sem nome';const detail=document.createElement('span');detail.textContent='Código: '+(p.code||'—')+' • CPF: '+(p.cpf||'—')+' • Telefone: '+(p.phone||'—');button.append(main,detail);button.addEventListener('click',()=>{document.querySelector('#patientSearchDialog').close();openPatientRecord(p)});root.append(button)});
}
async function loadPatientDirectory(){
 const snapshot=await getDocs(collection(db,'pacientes'));const map=new Map();
 snapshot.docs.forEach(item=>{const patient={patientDocId:item.id,...item.data()};const key=requestPatientKey(patient);if(key)map.set(key,patient)});
 [...reports,...appointments.filter(item=>item.patient)].forEach(item=>{const patient=normalizePatientRecord(item);const key=requestPatientKey(patient);if(key&&!map.has(key))map.set(key,patient)});
 patientDirectoryPool=[...map.values()].sort((a,b)=>(a.patient||'').localeCompare(b.patient||'','pt-BR'))
}
async function openPatientSearch(){
 const dialog=document.querySelector('#patientSearchDialog');const root=document.querySelector('#patientSearchResults');document.querySelector('#patientGlobalSearch').value='';root.innerHTML='<p class="empty-state">Carregando cadastros...</p>';dialog.showModal();
 try{await loadPatientDirectory();renderPatientSearch()}catch(error){console.error(error);root.innerHTML='<p class="empty-state">Não foi possível carregar os cadastros.</p>';showToast('Não foi possível carregar os pacientes.','error')}
 setTimeout(()=>document.querySelector('#patientGlobalSearch').focus(),50)
}
async function setWholeDayLock(lock){
 const professionalName=document.querySelector('#agendaProfessional').value;const professional=therapists.find(item=>item.name===professionalName);if(!professional)return;
 const columns=professional.agendaColumns===5?5:4;const periods=professional.scheduleGroup?.includes('Manhã')?['manha']:professional.scheduleGroup?.includes('Tarde')?['tarde']:['manha','tarde'];const times=periods.flatMap(period=>agendaSlots[period]);const active=appointments.filter(item=>item.cancelled!==true&&item.locked!==false);const batch=writeBatch(db);let changes=0;
 if(lock){for(const time of times)for(let column=1;column<=columns;column++){if(active.some(item=>item.time===time&&Number(item.column)===column))continue;const ref=doc(collection(db,'agendamentos'));batch.set(ref,{professional:professionalName,date:dateKey(selectedDate),time,column,locked:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});changes++}}
 else active.filter(item=>item.locked===true).forEach(item=>{batch.update(doc(db,'agendamentos',item.id),{locked:false,updatedAt:serverTimestamp()});changes++});
 if(!changes){showToast(lock?'Não há células vazias para travar.':'Não há células travadas.');return}
 await batch.commit();document.querySelector('#dayLockDialog').close();resetAgendaMode();showToast(lock?'Todas as células vazias foram travadas.':'Todas as células foram destravadas.');
}
document.querySelector('#scheduleActionForm').addEventListener('submit',async event=>{
 event.preventDefault();if(event.submitter?.id!=='confirmScheduleAction'){document.querySelector('#scheduleActionDialog').close();return}
 const action=pendingScheduleAction;const button=document.querySelector('#confirmScheduleAction');if(!action)return;button.disabled=true;
 try{if(action.type==='desmarcar'){await updateDoc(doc(db,'agendamentos',action.appointment.id),{cancelled:true,cancelledAt:serverTimestamp(),updatedAt:serverTimestamp()});showToast('Agendamento desmarcado e célula liberada.');resetAgendaMode()}else if(action.type==='confirmar'){await updateDoc(doc(db,'agendamentos',action.appointment.id),{present:true,updatedAt:serverTimestamp()});showToast('Presença do paciente confirmada.');resetAgendaMode()}document.querySelector('#scheduleActionDialog').close();pendingScheduleAction=null}catch(error){console.error(error);showToast('Não foi possível concluir a ação.')}finally{button.disabled=false}
});
document.querySelector('[data-report-action="localizar"]').addEventListener('click',openPatientSearch);
function patientQuickNotesValues(){
 const root=document.querySelector('#patientRecordContent');
 return{
  observations:root.querySelector('[name="observations"]')?.value.trim()||'',
  additionalData:root.querySelector('[name="additionalData"]')?.value.trim()||'',
  agreementsNotes:root.querySelector('[name="agreementsNotes"]')?.value.trim()||''
 }
}
async function savePatientQuickNotes(closeAfter=false){
 if(!activePatientRecord?.patientDocId){showToast('Cadastro-base do paciente não localizado.','warning');return false}
 const button=document.querySelector('#savePatientQuickNotes');const original=button.textContent;button.disabled=true;button.textContent='Salvando...';
 try{
  const notes=patientQuickNotesValues();
  await updateDoc(doc(db,'pacientes',activePatientRecord.patientDocId),{...notes,updatedAt:serverTimestamp(),updatedBy:auth.currentUser?.uid||''});
  activePatientRecord={...activePatientRecord,...notes};patientRecordNotesDirty=false;button.textContent='Ficha salva';showToast('Anotações da ficha salvas.','success');
  if(closeAfter)document.querySelector('#patientRecordDialog').close();
  else setTimeout(()=>{button.textContent='Salvar ficha';button.disabled=false},900);
  return true
 }catch(error){
  console.error(error);showToast('Não foi possível salvar as anotações da ficha.','error');button.disabled=false;button.textContent=original;return false
 }
}
async function closePatientRecordWithCheck(){
 const dialog=document.querySelector('#patientRecordDialog');
 if(!patientRecordNotesDirty){dialog.close();return}
 const saveBeforeClose=confirm('Foram feitas alterações nas anotações da ficha.\n\nClique em OK para salvar antes de fechar.\nClique em Cancelar para fechar sem salvar.');
 if(saveBeforeClose)await savePatientQuickNotes(true);
 else{patientRecordNotesDirty=false;dialog.close()}
}
document.querySelector('#savePatientQuickNotes').addEventListener('click',()=>savePatientQuickNotes(false));
document.querySelector('#editPatientRecord').addEventListener('click',()=>{if(!activePatientRecord?.patientDocId){showToast('Este paciente ainda não possui cadastro-base para editar.','warning');return}document.querySelector('#patientRecordDialog').close();openPatientRegistration(activePatientRecord,false)});
document.querySelector('#patientGlobalSearch').addEventListener('input',renderPatientSearch);
document.querySelector('#closePatientSearch').addEventListener('click',()=>document.querySelector('#patientSearchDialog').close());
document.querySelector('#closePatientRecord').addEventListener('click',closePatientRecordWithCheck);
document.querySelector('#closeAppointmentHistory').addEventListener('click',()=>document.querySelector('#appointmentHistoryDialog').close());
document.querySelectorAll('#closeChargeDialog,#cancelCharge').forEach(button=>button.addEventListener('click',()=>document.querySelector('#chargeDialog').close()));
document.querySelector('#confirmCharge').addEventListener('click',async()=>{if(!pendingChargeAppointment||pendingChargeAppointment.billed)return;const button=document.querySelector('#confirmCharge');button.disabled=true;try{await updateDoc(doc(db,'agendamentos',pendingChargeAppointment.id),{billed:true,billedAt:serverTimestamp(),updatedAt:serverTimestamp()});document.querySelector('#chargeDialog').close();pendingChargeAppointment=null;resetAgendaMode();showToast('Atendimento marcado como cobrado/faturado.')}catch(error){console.error(error);showToast('Não foi possível registrar a cobrança.')}finally{button.disabled=false}});
document.querySelector('#lockWholeDay').addEventListener('click',async()=>{try{await setWholeDayLock(true)}catch(error){console.error(error);showToast('Não foi possível travar o dia.')}});
document.querySelector('#unlockWholeDay').addEventListener('click',async()=>{try{await setWholeDayLock(false)}catch(error){console.error(error);showToast('Não foi possível destravar o dia.')}});
document.querySelectorAll('#closeAppointment,#cancelAppointment').forEach(button=>button.addEventListener('click',()=>appointmentDialog.close()));
appointmentForm.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!appointmentSelectedPatient){const found=await findAppointmentPatientByCode();if(!found){showToast('Localize um paciente cadastrado pelo código antes de salvar.','warning');appointmentForm.elements.code.focus();return}}
 const data=new FormData(appointmentForm);const id=data.get('appointmentId');const previous=appointments.find(item=>item.id===id);
 const payload={professional:document.querySelector('#agendaProfessional').value,date:dateKey(selectedDate),time:data.get('time'),column:Number(data.get('column')),patient:data.get('patient').trim(),patientId:data.get('patientId')||appointmentSelectedPatient?.patientDocId||appointmentSelectedPatient?.id||'',code:data.get('code').trim(),birthDate:appointmentSelectedPatient?.birthDate||'',agreement:data.get('agreement')||'Particular',treatment:data.get('treatment').trim(),billed:previous?.billed===true,present:previous?.present===true,fit:appointmentContext==='encaixar'||previous?.fit===true,updatedAt:serverTimestamp()};
 const button=appointmentForm.querySelector('[type="submit"]');button.disabled=true;
 try{if(id)await updateDoc(doc(db,'agendamentos',id),payload);else await addDoc(collection(db,'agendamentos'),{...payload,createdAt:serverTimestamp()});appointmentDialog.close();showToast(appointmentContext==='encaixar'?'Encaixe salvo.':'Agendamento salvo.');resetAgendaMode()}
 catch(error){console.error(error);showToast('Não foi possível salvar. Publique as regras do Firestore.')}
 finally{button.disabled=false}
});
function connectFirestore(){
 const reportsQuery=query(collection(db,'relatorios'),orderBy('createdAt','desc'));
 onSnapshot(reportsQuery,snapshot=>{
   reports=snapshot.docs.map(item=>({id:item.id,...item.data()})).filter(report=>report.status!=='excluido');
   setConnection(true,'Firebase conectado');render();
 },error=>{console.error(error);reports=[];setConnection(false,'Firebase requer configuração');render();showToast('Não foi possível carregar os relatórios.')});
}
const loginScreen=document.querySelector('#loginScreen');
const loginForm=document.querySelector('#loginForm');
const registerForm=document.querySelector('#registerForm');
const switchAuth=document.querySelector('#switchAuth');
const codeInputs=[...document.querySelectorAll('.code-inputs input')];
document.querySelectorAll('.password-toggle').forEach(button=>{
 button.addEventListener('click',()=>{
  const input=button.closest('.password-field')?.querySelector('input');
  if(!input)return;
  const reveal=input.type==='password';input.type=reveal?'text':'password';
  button.classList.toggle('is-hidden',!reveal);
  button.setAttribute('aria-label',reveal?'Ocultar senha':'Mostrar senha');
  button.title=reveal?'Ocultar senha':'Mostrar senha';
 });
});
let firestoreConnected=false;
let therapistsConnected=false;
let usersConnected=false;

function normalizeEmail(value){return String(value||'').trim().toLowerCase().replace(/[.,;:]+$/,'')}
function internalEmail(username){return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g,'')}@apflow.local`}
function loginEmail(identifier){
 const value=normalizeEmail(identifier);
 if(value.includes('@'))return value;
 return internalEmail(value);
}
function passwordCandidates(password){
 const value=String(password||'');
 return [`AP:${value}`,value].filter((candidate,index,list)=>candidate&&list.indexOf(candidate)===index);
}
async function signInCompatible(identifier,password){
 const email=loginEmail(identifier);let lastError;
 for(const candidate of passwordCandidates(password)){
  try{return await signInWithEmailAndPassword(auth,email,candidate)}
  catch(error){lastError=error;if(error?.code!=='auth/invalid-credential'&&error?.code!=='auth/wrong-password')throw error}
 }
 throw lastError;
}
function firebaseMessage(reason){
 const messages={
  'auth/email-already-in-use':'Este usuário já existe. Volte ao login para entrar.',
  'auth/invalid-credential':'Usuário ou senha incorretos.',
  'auth/weak-password':'A senha precisa ter pelo menos 4 caracteres.',
  'auth/invalid-email':'Use um nome de usuário válido.',
  'auth/operation-not-allowed':'Ative o método E-mail/senha no Firebase Authentication.',
  'auth/configuration-not-found':'O Firebase Authentication ainda não foi configurado.',
  'auth/unauthorized-domain':'Este endereço do APFlow precisa ser adicionado aos domínios autorizados do Firebase.',
  'auth/network-request-failed':'Falha de conexão com o Firebase. Confira a internet e tente novamente.',
  'auth/too-many-requests':'Muitas tentativas seguidas. Aguarde alguns minutos.',
  'permission-denied':'A conta foi criada, mas as regras do Firestore precisam ser publicadas.',
  'firestore/permission-denied':'A conta foi criada, mas as regras do Firestore precisam ser publicadas.'
 };
 return messages[reason.code]||`Erro no cadastro (${reason.code||'desconhecido'}).`;
}
function applyAdminPreviewMode(preview){
 if(!currentUserIsAdmin)return;
 adminFunctionsEnabled=!preview;localStorage.setItem('apflow.adminPreview',String(preview));
 document.querySelectorAll('.admin-only').forEach(element=>element.hidden=preview);
 const toggle=document.querySelector('#adminModeToggle');toggle.hidden=false;toggle.textContent=preview?'Retornar ao modo Admin':'Visualizar como usuário comum';toggle.classList.toggle('preview-active',preview);
 const panelButton=document.querySelector('#adminPreviewButton');if(panelButton)panelButton.textContent=preview?'Retornar ao modo Admin':'Ativar modo usuário comum';
 renderPortals();
 if(preview&&document.querySelector('.tool[data-view="administracao"]')?.classList.contains('active'))switchPage('inicio');
 showToast(preview?'Funções administrativas ocultadas.':'Funções administrativas reativadas.');
}
async function revealApp(user){
 loginScreen.classList.add('hidden');document.querySelector('.user-area strong').textContent=user.displayName||'Equipe APFlow';setConnection(true,'Firebase conectado');
 if(!firestoreConnected){firestoreConnected=true;connectFirestore()}
 if(!therapistsConnected){therapistsConnected=true;connectTherapists()}
 connectPortals();
 try{const profile=await getDoc(doc(db,'usuarios',user.uid));if(profile.exists()){currentUserRole=profile.data().role||'equipe';if(currentUserRole==='admin'){currentUserIsAdmin=true;document.querySelector('#adminModeToggle').hidden=false;connectAdminUsers();applyAdminPreviewMode(localStorage.getItem('apflow.adminPreview')==='true');if(adminFunctionsEnabled)switchPage(localStorage.getItem('apflow.activePage')||'inicio',false)}}}catch(error){console.error('Perfil indisponível:',error)}
 applyReportRolePermissions();
}
function showLogin(){loginScreen.classList.remove('hidden');setConnection(false,'Aguardando acesso');setTimeout(()=>loginForm.elements.username.focus(),50)}

codeInputs.forEach((input,index)=>{
 input.addEventListener('input',()=>{input.value=input.value.replace(/[^a-z]/gi,'').toUpperCase();if(input.value&&codeInputs[index+1])codeInputs[index+1].focus()});
 input.addEventListener('keydown',event=>{if(event.key==='Backspace'&&!input.value&&codeInputs[index-1])codeInputs[index-1].focus()});
 input.addEventListener('paste',event=>{event.preventDefault();const pasted=event.clipboardData.getData('text').replace(/[^a-z]/gi,'').toUpperCase().slice(0,6);[...pasted].forEach((char,i)=>{if(codeInputs[i])codeInputs[i].value=char});codeInputs[Math.min(pasted.length,5)].focus()});
});

loginForm.addEventListener('submit',async event=>{
 event.preventDefault();const data=new FormData(loginForm);const button=loginForm.querySelector('button');const error=document.querySelector('#loginError');
 error.textContent='';button.disabled=true;button.textContent='Entrando...';
 try{
   await setPersistence(auth,data.get('remember')?browserLocalPersistence:browserSessionPersistence);
   await signInCompatible(data.get('username'),data.get('password'));
 }catch(reason){error.textContent=firebaseMessage(reason)}
 finally{button.disabled=false;button.textContent='Entrar'}
});

registerForm.addEventListener('submit',async event=>{
 event.preventDefault();const data=new FormData(registerForm);const button=registerForm.querySelector('button');const error=document.querySelector('#registerError');const code=codeInputs.map(input=>input.value).join('').toUpperCase();
 error.textContent='';button.disabled=true;button.textContent='Criando conta...';
 try{
   if(await hashText(code)!==accessCodeHash)throw new Error('invalid-code');
   const username=data.get('username').trim();if(internalEmail(username)==='@apflow.local')throw new Error('invalid-username');
   const recoveryEmail=normalizeEmail(data.get('email'));if(!recoveryEmail||!recoveryEmail.includes('@'))throw new Error('invalid-recovery-email');
   const credential=await createUserWithEmailAndPassword(auth,recoveryEmail,`AP:${String(data.get('password'))}`);
   await updateProfile(credential.user,{displayName:data.get('fullName').trim()});
   const role=username.toLowerCase()==='admin'?'admin':'equipe';
   await setDoc(doc(db,'usuarios',credential.user.uid),{name:data.get('fullName').trim(),username:username.toLowerCase(),email:recoveryEmail,recoveryEmail,role,createdAt:serverTimestamp()});
   document.querySelector('.user-area strong').textContent=data.get('fullName').trim();
   registerForm.reset();showToast('Conta criada com sucesso.');
 }catch(reason){console.error('Falha ao criar conta:',reason);error.textContent=reason.message==='invalid-code'?'Código de cadastro incorreto.':reason.message==='invalid-username'?'Digite um usuário válido.':reason.message==='invalid-recovery-email'?'Digite um e-mail válido para recuperação.':firebaseMessage(reason);codeInputs.forEach(input=>input.value='');codeInputs[0].focus()}
 finally{button.disabled=false;button.textContent='Criar conta'}
});

switchAuth.addEventListener('click',()=>{const registering=registerForm.classList.toggle('hidden')===false;loginForm.classList.toggle('hidden',registering);document.querySelector('#loginTitle').textContent=registering?'Criar nova conta':'Acesso ao sistema';switchAuth.textContent=registering?'Voltar para o login':'Criar uma nova conta';document.querySelector('#forgotPassword').hidden=registering;document.querySelector('#loginError').textContent='';document.querySelector('#registerError').textContent='';setTimeout(()=>registering?registerForm.elements.fullName.focus():loginForm.elements.username.focus(),50)});
document.querySelector('#forgotPassword').addEventListener('click',async()=>{
 const identifier=loginForm.elements.username.value.trim();
 if(!identifier){document.querySelector('#loginError').textContent='Digite o usuário ou e-mail antes de recuperar a senha.';loginForm.elements.username.focus();return}
 if(!identifier.includes('@')){document.querySelector('#loginError').textContent='Digite o e-mail cadastrado para receber a recuperação da senha.';loginForm.elements.username.focus();return}
 const email=normalizeEmail(identifier);
 const button=document.querySelector('#forgotPassword');button.disabled=true;
 try{await sendPasswordResetEmail(auth,email);showToast(`Enviamos o link de troca de senha para ${email}`,'success',7000)}
 catch(error){console.error(error);document.querySelector('#loginError').textContent=error?.code==='auth/user-not-found'?'Conta não encontrada com este e-mail.':firebaseMessage(error)}
 finally{button.disabled=false}
});
document.querySelector('#refreshAppButton')?.addEventListener('click',()=>location.reload());
document.querySelector('#logoutButton').addEventListener('click',async()=>{await signOut(auth);location.reload()});
onAuthStateChanged(auth,user=>{if(user)revealApp(user);else showLogin()});

function connectTherapists(){
 onSnapshot(query(collection(db,'profissionais'),orderBy('name')),snapshot=>{const saved=snapshot.docs.map(item=>{const data=item.data();return{id:item.id,...data,name:currentProfessionalName(data.name)}}).filter(item=>item.active!==false);const savedByName=new Map(saved.map(person=>[person.name.toLowerCase(),person]));const defaultsMerged=defaultProfessionals.map(defaultPerson=>{const savedPerson=savedByName.get(defaultPerson.name.toLowerCase());if(!savedPerson)return defaultPerson;savedByName.delete(defaultPerson.name.toLowerCase());return{...defaultPerson,...savedPerson,scheduleGroup:savedPerson.scheduleGroup||defaultPerson.scheduleGroup,agendaColumns:savedPerson.agendaColumns||defaultPerson.agendaColumns,isDefault:false}});therapists=[...defaultsMerged,...savedByName.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));renderTherapists()},error=>{console.error(error);therapists=[...defaultProfessionals];renderTherapists();showToast('Lista padrão carregada; Firebase indisponível.')});
}
function openAdminAccessDialog(uid,user){
 const form=document.querySelector('#adminAccessForm');form.reset();
 form.elements.targetUid.value=uid;form.elements.account.value=user.name||user.username||uid;form.elements.email.value=user.email||'';
 document.querySelector('#adminAccessError').textContent='';document.querySelector('#adminAccessDialog').showModal();
}
function connectAdminUsers(){
 if(usersConnected)return;usersConnected=true;
 onSnapshot(query(collection(db,'usuarios'),orderBy('name')),snapshot=>{
  const list=document.querySelector('#userRoleList');const userCount=document.querySelector('#adminUserCount');if(userCount)userCount.textContent=`${snapshot.size} ${snapshot.size===1?'usuário cadastrado':'usuários cadastrados'}`;
  list.innerHTML=snapshot.empty?'<p class="empty-mini">Nenhum usuário cadastrado.</p>':'';
  snapshot.docs.forEach(item=>{
   const user=item.data();const row=document.createElement('div');row.className='admin-row';
   row.innerHTML=`<div class="admin-user-identity"><strong>${user.name||user.username}</strong><small>@${user.username}${user.email?` • ${user.email}`:''}</small></div><div class="admin-user-actions"><select aria-label="Cargo de ${user.name||user.username}">${roles.map(role=>`<option value="${role.toLowerCase()}" ${user.role===role.toLowerCase()?'selected':''}>${role}</option>`).join('')}</select><button class="secondary admin-access-button" type="button">Alterar acesso</button></div>`;
   const select=row.querySelector('select');
   select.addEventListener('change',async()=>{const previous=user.role||'equipe';const next=select.value;if(next==='admin'&&previous!=='admin'&&!confirm(`Tornar ${user.name||user.username} administrador? Esta conta terá acesso a todas as configurações do APFlow.`)){select.value=previous;return}select.disabled=true;try{await updateDoc(doc(db,'usuarios',item.id),{role:next,updatedAt:serverTimestamp()});showToast(next==='admin'?'Usuário promovido a administrador.':'Cargo atualizado.')}catch(error){console.error(error);select.value=previous;showToast('Não foi possível atualizar o cargo.')}finally{select.disabled=false}});
   row.querySelector('.admin-access-button').addEventListener('click',()=>openAdminAccessDialog(item.id,user));list.append(row);
  });
 },error=>{console.error(error);document.querySelector('#userRoleList').innerHTML='<p class="empty-mini">Sem permissão para visualizar usuários.</p>'});
}

const demoPatients=[
 ['Ana Paula Ribeiro','10231','IAMSPE','Fisioterapia'],['Bruno Henrique Lima','10245','Outros','Ortopedia'],['Carla Mendes Silva','10258','IAMSPE','Cinesioterapia'],['Daniel Oliveira Santos','10264','IAMSPE','Reabilitação'],
 ['Eliane Costa Souza','10277','Outros','Pós-operatório'],['Fábio Martins Rocha','10283','IAMSPE','Fisioterapia'],['Gabriela Nunes Alves','10296','IAMSPE','Traumatologia'],['Henrique Ferreira Reis','10302','Outros','Fortalecimento'],
 ['Isabela Moraes Pinto','10315','IAMSPE','Cinesioterapia'],['João Carlos Barros','10329','IAMSPE','Ortopedia'],['Larissa Gomes Freitas','10334','Outros','Reabilitação'],['Marcos Vinícius Dias','10348','IAMSPE','Fisioterapia'],
 ['Natália Rodrigues Melo','10351','IAMSPE','Pós-operatório'],['Otávio Almeida Cruz','10367','Outros','Traumatologia'],['Patrícia Lopes Vieira','10372','IAMSPE','Cinesioterapia'],['Rafael Teixeira Campos','10389','IAMSPE','Fortalecimento'],
 ['Sandra Regina Moura','10395','Outros','Fisioterapia'],['Tiago Cardoso Neves','10407','IAMSPE','Reabilitação'],['Valéria Cristina Prado','10412','IAMSPE','Ortopedia'],['Wesley Araújo Farias','10426','Outros','Cinesioterapia']
];
function demoSlotsFor(person){
 const periods=person.scheduleGroup?.includes('Manhã')?['manha']:person.scheduleGroup?.includes('Tarde')?['tarde']:['manha','tarde'];return periods.flatMap(period=>agendaSlots[period])
}
async function commitBatches(operations){
 for(let start=0;start<operations.length;start+=400){const batch=writeBatch(db);operations.slice(start,start+400).forEach(operation=>operation(batch));await batch.commit()}
}
async function generateDemoSchedule(event){
 if(!currentUserIsAdmin||!adminFunctionsEnabled){showToast('Somente o administrador pode gerar a demonstração.');return}
 const button=event?.currentTarget||document.querySelector('#generateDemoSchedule');const date=dateKey(selectedDate);
 if(!confirm(`Criar pacientes fictícios nas células vazias de ${longDate(selectedDate)}?`))return;
 button.disabled=true;button.textContent='Gerando...';
 try{
  const existingSnapshot=await getDocs(query(collection(db,'agendamentos'),where('date','==',date)));const occupied=new Set(existingSnapshot.docs.map(item=>{const value=item.data();return `${value.professional}|${value.time}|${value.column}`}));
  const people=therapists.filter(person=>person.active!==false);const operations=[];let patientIndex=Math.floor(Math.random()*demoPatients.length);
  people.forEach(person=>{const columns=person.agendaColumns===5?5:4;demoSlotsFor(person).forEach(time=>{for(let column=1;column<=columns;column++){const key=`${person.name}|${time}|${column}`;if(occupied.has(key)||Math.random()>0.42)continue;const fake=demoPatients[patientIndex++%demoPatients.length];const reference=doc(collection(db,'agendamentos'));operations.push(batch=>batch.set(reference,{professional:person.name,date,time,column,patient:fake[0],code:fake[1],agreement:fake[2],treatment:fake[3],present:Math.random()<0.22,billed:Math.random()<0.18,cancelled:false,demo:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}))}})});
  await commitBatches(operations);showToast(`${operations.length} agendamentos fictícios criados.`);adminDialog.close();connectAppointments()
 }catch(error){console.error(error);showToast('Não foi possível gerar a agenda de demonstração.')}finally{button.disabled=false;button.textContent='Gerar demonstração'}
}
async function clearAllSchedules(event){
 if(!currentUserIsAdmin||!adminFunctionsEnabled){showToast('Somente o administrador pode limpar as agendas.');return}
 const confirmation=prompt('Esta ação apagará TODAS as agendas e seus históricos. Digite LIMPAR para confirmar:');if(confirmation!=='LIMPAR')return;
 const button=event?.currentTarget||document.querySelector('#clearAllSchedules');button.disabled=true;button.textContent='Limpando...';
 try{const snapshot=await getDocs(collection(db,'agendamentos'));const operations=snapshot.docs.map(item=>batch=>batch.delete(item.ref));await commitBatches(operations);showToast(`${snapshot.size} registros de agenda removidos.`);adminDialog.close();appointments=[];connectAppointments()}catch(error){console.error(error);showToast('Não foi possível limpar as agendas. Confira as permissões.')}finally{button.disabled=false;button.textContent='Limpar sistema'}
}

const adminAccessDialog=document.querySelector('#adminAccessDialog');
document.querySelectorAll('#closeAdminAccess,#cancelAdminAccess').forEach(button=>button.addEventListener('click',()=>adminAccessDialog.close()));
document.querySelector('#adminAccessForm').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget;const error=document.querySelector('#adminAccessError');const button=form.querySelector('button[type="submit"]');
 const targetUid=form.elements.targetUid.value;const email=normalizeEmail(form.elements.email.value);const password=form.elements.password.value;error.textContent='';
 if(!email&&!password){error.textContent='Informe um novo e-mail ou uma nova senha.';return}
 if(password&&password.length<4){error.textContent='A senha precisa ter pelo menos 4 caracteres.';return}
 button.disabled=true;const original=button.textContent;button.textContent='Salvando...';
 try{const result=await adminUpdateUserAccess({targetUid,email:email||null,password:password||null});adminAccessDialog.close();showToast(result.data?.message||'Acesso atualizado com sucesso.')}
 catch(reason){console.error(reason);const code=String(reason?.code||'');error.textContent=code.includes('permission-denied')?'Somente administradores podem alterar acessos.':code.includes('not-found')?'Conta não encontrada no Firebase.':code.includes('already-exists')?'Este e-mail já pertence a outra conta.':'Não foi possível alterar o acesso. Verifique se a Cloud Function foi publicada.'}
 finally{button.disabled=false;button.textContent=original}
});

const clinicalStartDialog=document.querySelector('#clinicalStartDialog');
function cancelClinicalStart(){pendingClinicalStart=null;clinicalStartDialog.close()}
document.querySelectorAll('#closeClinicalStart,#cancelClinicalStart').forEach(button=>button.addEventListener('click',cancelClinicalStart));
clinicalStartDialog.addEventListener('cancel',()=>{pendingClinicalStart=null});
document.querySelector('#confirmClinicalStart').addEventListener('click',async event=>{
 if(!pendingClinicalStart)return;
 const button=event.currentTarget;button.disabled=true;const original=button.textContent;button.textContent='Iniciando...';
 try{
  const report={...pendingClinicalStart};
  await updateDoc(doc(db,'relatorios',report.id),{status:'confeccao',startedAt:serverTimestamp(),startedBy:auth.currentUser?.uid||'',updatedAt:serverTimestamp()});
  report.status='confeccao';pendingClinicalStart=null;clinicalStartDialog.close();showClinicalEditor(report);
 }catch(error){console.error(error);showToast('Não foi possível iniciar a confecção. O pedido continua aguardando.')}
 finally{button.disabled=false;button.textContent=original}
});

const clinicalReportDialog=document.querySelector('#clinicalReportDialog');
document.querySelectorAll('#closeClinicalReport,#cancelClinicalReport').forEach(button=>button.addEventListener('click',()=>clinicalReportDialog.close()));
document.querySelector('#clinicalReportForm').addEventListener('input',updateClinicalFinalizeState);
document.querySelector('#clinicalReportForm').addEventListener('submit',event=>{event.preventDefault();saveClinicalReport(true)});
document.querySelector('#saveClinicalDraft').addEventListener('click',()=>saveClinicalReport(false));
document.querySelector('#closeClinicalPreview').addEventListener('click',()=>document.querySelector('#clinicalPreviewDialog').close());
document.querySelector('#printClinicalReport').addEventListener('click',()=>{
 const dialog=document.querySelector('#clinicalPreviewDialog');const page=dialog.querySelector('.clinical-document');
 document.body.classList.add('clinical-printing');dialog.style.setProperty('box-shadow','none','important');dialog.style.setProperty('border-radius','0','important');page.style.setProperty('box-shadow','none','important');page.style.setProperty('border-radius','0','important');page.style.setProperty('filter','none','important');
 requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()))
});
document.querySelector('#markClinicalDelivered').addEventListener('click',()=>updateReportDelivery('delivered'));
document.querySelector('#archiveClinicalReport').addEventListener('click',()=>updateReportDelivery('archive'));
document.querySelector('#deleteClinicalReport').addEventListener('click',()=>updateReportDelivery('delete'));
window.addEventListener('afterprint',()=>document.body.classList.remove('clinical-printing'));

const adminDialog=document.querySelector('#adminDialog');
document.querySelector('#adminModeToggle').addEventListener('click',()=>applyAdminPreviewMode(adminFunctionsEnabled));
document.querySelector('#adminPreviewButton').addEventListener('click',()=>applyAdminPreviewMode(adminFunctionsEnabled));
document.querySelectorAll('[data-admin-open]').forEach(button=>button.addEventListener('click',()=>{
 const action=button.dataset.adminOpen;
 if(action==='portals'){switchPage('autorizacoes');showToast('Use “Adicionar portal” para cadastrar um novo acesso.');return}
 adminDialog.showModal();
 adminDialog.scrollTop=0;
 if(action==='users'||action==='permissions')setTimeout(()=>document.querySelector('#adminUsersSection')?.scrollIntoView({behavior:'smooth',block:'start'}),60);
 else if(action==='professionals')setTimeout(()=>document.querySelector('#adminProfessionalsSection')?.scrollIntoView({behavior:'smooth',block:'start'}),60);
 if(action==='permissions')showToast('Selecione o cargo desejado para cada usuário.');
}));
document.querySelector('#sidebarAddProfessional').addEventListener('click',()=>adminDialog.showModal());
document.querySelector('#closeAdmin').addEventListener('click',()=>adminDialog.close());
document.querySelectorAll('#generateDemoSchedule,#generateDemoSchedulePage').forEach(button=>button.addEventListener('click',generateDemoSchedule));
document.querySelectorAll('#clearAllSchedules,#clearAllSchedulesPage').forEach(button=>button.addEventListener('click',clearAllSchedules));
document.querySelector('#therapistForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const data=new FormData(form);const name=data.get('name').trim();const profession=data.get('profession');const agendaColumns=Number(data.get('agendaColumns'));const button=form.querySelector('button');if(!name)return;button.disabled=true;try{await addDoc(collection(db,'profissionais'),{name,profession,agendaColumns,active:true,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid});form.reset();showToast(`${profession} adicionado.`)}catch(error){console.error(error);showToast('Não foi possível adicionar o profissional.')}finally{button.disabled=false}});

updateSelectedDate();renderCalendar();resetAgendaMode();render();switchPage(localStorage.getItem('apflow.activePage')||'inicio',false);
