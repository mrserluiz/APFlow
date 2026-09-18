import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAnalytics, isSupported } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js';
import { browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, getAuth, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import { addDoc, collection, doc, getDoc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

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
const accessCodeHash='aa856b786ce69faea3a86585ad904714bf6e3ff66ac9c5e139b1396e5dc7bebe';
isSupported().then(supported=>{if(supported)getAnalytics(firebaseApp)}).catch(()=>{});

let reports=[];
let therapists=[];
let appointments=[];let stopAppointments=null;
const defaultProfessionals=[
 {id:'vanessa',name:'Dra. Vanessa',profession:'Fisioterapeuta',scheduleGroup:'Cinesio Manhã',agendaColumns:5,isDefault:true},
 {id:'camila',name:'Dra. Camila',profession:'Fisioterapeuta',scheduleGroup:'Cinesio Manhã',agendaColumns:5,isDefault:true},
 {id:'tamires',name:'Dra. Tamires',profession:'Fisioterapeuta',scheduleGroup:'Eletro Manhã',agendaColumns:4,isDefault:true},
 {id:'fernanda',name:'Dra. Fernanda',profession:'Fisioterapeuta',scheduleGroup:'Eletro Manhã',agendaColumns:4,isDefault:true},
 {id:'nadia',name:'Dra. Nadia',profession:'Fisioterapeuta',scheduleGroup:'Eletro Manhã',agendaColumns:4,isDefault:true},
 {id:'mirian',name:'Dra. Mirian',profession:'Fisioterapeuta',scheduleGroup:'Cinesio Tarde',agendaColumns:5,isDefault:true},
 {id:'julliane',name:'Dra. Julliane',profession:'Fisioterapeuta',scheduleGroup:'Cinesio Tarde',agendaColumns:5,isDefault:true},
 {id:'alex',name:'Dr. Alex',profession:'Fisioterapeuta',scheduleGroup:'Eletro Tarde',agendaColumns:4,isDefault:true},
 {id:'larissa',name:'Dra. Larissa',profession:'Fisioterapeuta',scheduleGroup:'Eletro Tarde',agendaColumns:4,isDefault:true},
 {id:'marcia',name:'Dra. Marcia',profession:'Fisioterapeuta',scheduleGroup:'Eletro Tarde',agendaColumns:4,isDefault:true}
];
let selectedDate=new Date();
let calendarMonth=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);
const agendaSlots={manha:['08:00','08:40','09:20','10:00','10:40','11:20'],tarde:['13:00','13:40','14:20','15:00','15:40','16:20','17:00','17:40','18:20']};
const roles=['Admin','Financeiro','Gerente','Atendente','Fisioterapeuta','Médico','Enfermagem','Técnico'];
const colors={aguardando:'#c88313',confeccao:'#377ea7',pronto:'#2f8a68'};
const labels={aguardando:'Aguardando',confeccao:'Em confecção',pronto:'Pronto'};
const lists={aguardando:document.querySelector('#waitingList'),confeccao:document.querySelector('#draftList'),pronto:document.querySelector('#readyList')};
const filters={search:document.querySelector('#searchInput'),therapist:document.querySelector('#therapistFilter'),agreement:document.querySelector('#agreementFilter')};

function render(){
 Object.values(lists).forEach(list=>list.innerHTML='');
 const term=filters.search.value.trim().toLowerCase();const compactTerm=term.replace(/\D/g,'');
 const visible=reports.filter(r=>{const birthBr=r.birthDate?r.birthDate.split('-').reverse().join('/'):'';const textFields=[r.patient,r.code,r.birthDate,birthBr,r.phone,r.cpf,r.rg,r.insuranceCard].filter(Boolean).map(value=>String(value).toLowerCase());const textMatch=!term||textFields.some(value=>value.includes(term));const digitMatch=compactTerm&&textFields.some(value=>value.replace(/\D/g,'').includes(compactTerm));return(textMatch||digitMatch)&&(!filters.therapist.value||r.therapist===filters.therapist.value)&&(!filters.agreement.value||r.agreement===filters.agreement.value)});
 visible.filter(r=>lists[r.status]).forEach(r=>{
   const card=document.createElement('article'); card.className='report-card'; card.style.setProperty('--accent',colors[r.status]);
   card.innerHTML=`<div class="card-top"><div><h3>${r.patient}</h3><span class="code">Nº ${r.code}</span></div><span class="due ${r.due<='18/09/2026'?'urgent':''}">${r.due}</span></div><p>${r.agreement} • ${r.purpose}</p><div class="card-footer"><span class="badge">${labels[r.status]}</span><span class="therapist">${r.therapist}</span></div>`;
   card.addEventListener('click',()=>showToast(`${r.patient} — ${labels[r.status]}`)); lists[r.status].append(card);
 });
 document.querySelectorAll('.lane').forEach(lane=>lane.querySelector('.lane-count').textContent=visible.filter(r=>r.status===lane.dataset.status).length);
 ['aguardando','confeccao','pronto','entregue'].forEach((s,i)=>document.querySelectorAll('.metric strong')[i].textContent=reports.filter(r=>r.status===s).length);
 Object.entries(lists).forEach(([status,list])=>{if(!visible.some(r=>r.status===status))list.innerHTML='<p class="empty-state">Nenhum relatório nesta etapa.</p>'});
 document.querySelector('#footerSummary').textContent=`${reports.length} registros • ${reports.filter(r=>r.status==='aguardando').length} aguardando • ${reports.filter(r=>r.status==='pronto').length} prontos`;
 const homePending=document.querySelector('#homePending');if(homePending)homePending.textContent=reports.filter(r=>r.status==='aguardando').length;
 renderTherapistCounts();
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
 const adminList=document.querySelector('#adminTherapistList');
 adminList.innerHTML=therapists.length?'':'<p class="empty-mini">Nenhum profissional cadastrado.</p>';
 therapists.forEach(person=>{const row=document.createElement('div');row.className='admin-row';row.innerHTML=`<div><strong>${person.name}</strong><small>${person.scheduleGroup||person.profession||'Fisioterapeuta'}</small></div><label class="column-setting">Agenda <select aria-label="Colunas da agenda de ${person.name}" ${person.isDefault?'disabled title="Profissional da lista inicial"':''}><option value="4" ${(person.agendaColumns||4)===4?'selected':''}>4 colunas</option><option value="5" ${person.agendaColumns===5?'selected':''}>5 colunas</option></select></label>`;const select=row.querySelector('select');if(!person.isDefault)select.addEventListener('change',async event=>{event.target.disabled=true;try{await updateDoc(doc(db,'profissionais',person.id),{agendaColumns:Number(event.target.value),updatedAt:serverTimestamp()});showToast('Formato da agenda atualizado.')}catch(error){console.error(error);showToast('Não foi possível atualizar a agenda.')}finally{event.target.disabled=false}});adminList.append(row)});
 renderAgenda();
}
function switchPage(view){document.querySelectorAll('.tool[data-view]').forEach(item=>item.classList.toggle('active',item.dataset.view===view));document.querySelectorAll('.page-view').forEach(page=>page.hidden=page.dataset.page!==view)}
function openProfessionalAgenda(name){switchPage('agendas');const agenda=document.querySelector('#agendaProfessional');agenda.value=name;connectAppointments();showToast(`Agenda de ${name}`)}
function renderAgenda(){
 const root=document.querySelector('#agendaSchedule');const selectedName=document.querySelector('#agendaProfessional').value;const professional=therapists.find(person=>person.name===selectedName);const columns=professional?.agendaColumns===5?5:4;
 root.style.setProperty('--agenda-columns',columns);root.innerHTML='';
 if(!selectedName){root.innerHTML='<div class="agenda-welcome"><strong>Selecione um profissional</strong><p>Escolha uma agenda para visualizar os horários da manhã e da tarde.</p></div>';return}
 const allowedPeriods=professional?.scheduleGroup?.includes('Manhã')?['manha']:professional?.scheduleGroup?.includes('Tarde')?['tarde']:['manha','tarde'];
 Object.entries(agendaSlots).filter(([period])=>allowedPeriods.includes(period)).forEach(([period,slots])=>{const divider=document.createElement('div');divider.className='period-divider';divider.textContent=period==='manha'?'Bloco da manhã.':'Bloco da tarde';root.append(divider);const markers=document.createElement('div');markers.className='column-markers';markers.innerHTML=Array.from({length:columns},(_,index)=>`<span class="column-${index+1}"></span>`).join('');root.append(markers);slots.forEach(time=>{const row=document.createElement('div');row.className='schedule-row';for(let column=1;column<=columns;column++){const appointment=appointments.find(item=>item.time===time&&Number(item.column)===column);const slot=document.createElement('button');slot.className=`appointment-slot column-${column}`;slot.type='button';slot.dataset.time=time;slot.dataset.column=column;if(appointment){slot.classList.add('occupied');slot.innerHTML=`<span class="slot-time">${time.replace(':','h')}</span><span class="patient-name">${appointment.patient}</span><small>${appointment.agreement||''}</small><small>${appointment.treatment||''}</small><small>Nº ${appointment.code||''}</small><span class="patient-actions">${appointment.billed?'💼':''} ${appointment.present?'✅':''}</span>`}else slot.innerHTML=`<span class="slot-time">${time.replace(':','h')}</span><span class="slot-empty">Dois cliques para agendar</span>`;slot.addEventListener('dblclick',()=>openAppointment(slot,appointment));row.append(slot)}root.append(row)})});
}
function connectAppointments(){const professional=document.querySelector('#agendaProfessional').value;if(stopAppointments)stopAppointments();appointments=[];if(!professional){renderAgenda();return}stopAppointments=onSnapshot(query(collection(db,'agendamentos'),where('professional','==',professional),where('date','==',dateKey(selectedDate))),snapshot=>{appointments=snapshot.docs.map(item=>({id:item.id,...item.data()}));renderAgenda()},error=>{console.error(error);appointments=[];renderAgenda();showToast('Publique as regras do Firestore para usar a agenda.')})}
const appointmentDialog=document.querySelector('#appointmentDialog');const appointmentForm=document.querySelector('#appointmentForm');
function openAppointment(slot,appointment){appointmentForm.reset();appointmentForm.elements.appointmentId.value=appointment?.id||'';appointmentForm.elements.time.value=slot.dataset.time;appointmentForm.elements.column.value=slot.dataset.column;document.querySelector('#appointmentTitle').textContent=appointment?'Cadastro do paciente':`Agendar às ${slot.dataset.time}`;if(appointment){['patient','code','agreement','treatment','billed','present'].forEach(field=>{const input=appointmentForm.elements[field];if(input.type==='checkbox')input.checked=Boolean(appointment[field]);else input.value=appointment[field]||''})}appointmentDialog.showModal()}
function sameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function longDate(date){const value=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date);return value.charAt(0).toUpperCase()+value.slice(1)}
function dateKey(date){const year=date.getFullYear();const month=String(date.getMonth()+1).padStart(2,'0');const day=String(date.getDate()).padStart(2,'0');return `${year}-${month}-${day}`}
function updateSelectedDate(){document.querySelectorAll('[data-selected-date]').forEach(element=>element.textContent=longDate(selectedDate))}
function renderCalendar(){
 const root=document.querySelector('#calendarDays');const title=document.querySelector('#calendarTitle');const today=new Date();
 title.textContent=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(calendarMonth).replace(/^./,letter=>letter.toUpperCase());root.innerHTML='';
 const firstCell=new Date(calendarMonth);firstCell.setDate(1-firstCell.getDay());
 for(let offset=0;offset<42;offset++){
  const date=new Date(firstCell);date.setDate(firstCell.getDate()+offset);const button=document.createElement('button');button.type='button';button.textContent=date.getDate();button.setAttribute('aria-label',longDate(date));
  if(date.getMonth()!==calendarMonth.getMonth())button.classList.add('muted');if(sameDay(date,today))button.classList.add('today');if(sameDay(date,selectedDate))button.classList.add('selected');
  button.addEventListener('click',()=>{selectedDate=new Date(date);calendarMonth=new Date(date.getFullYear(),date.getMonth(),1);updateSelectedDate();renderCalendar();connectAppointments()});root.append(button);
 }
}
function addBusinessDays(start,days){const date=new Date(start);let added=0;while(added<days){date.setDate(date.getDate()+1);if(date.getDay()!==0&&date.getDay()!==6)added++}return date}
function brDate(date){return new Intl.DateTimeFormat('pt-BR').format(date)}
function showToast(message){const toast=document.querySelector('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),2600)}
function setConnection(online,message){document.querySelector('#connectionStatus').textContent=message;document.querySelector('#connectionDot').style.background=online?'#20a36d':'#c88313'}
async function hashText(value){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
const dialog=document.querySelector('#requestDialog');
function openDialog(){document.querySelector('#dueDate').value=brDate(addBusinessDays(selectedDate,3));dialog.showModal();setTimeout(()=>document.querySelector('[name="patient"]').focus(),50)}
document.querySelectorAll('#newRequest,#newRequestTop').forEach(b=>b.addEventListener('click',openDialog));
document.querySelectorAll('#closeDialog,#cancelDialog').forEach(b=>b.addEventListener('click',()=>dialog.close()));
document.querySelectorAll('[name="purpose"]').forEach(r=>r.addEventListener('change',()=>{const field=document.querySelector('#otherPurpose');field.disabled=r.value!=='Outro';if(!field.disabled)field.focus()}));
document.querySelector('#requestForm').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget;const data=new FormData(form);const submit=form.querySelector('[type="submit"]');
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
document.querySelectorAll('[data-agenda-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.agendaAction;if(action==='agendar'){const empty=document.querySelector('.appointment-slot:not(.occupied)');if(empty){empty.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});empty.classList.add('attention');setTimeout(()=>empty.classList.remove('attention'),1500);showToast('Dê dois cliques no horário desejado.')}else showToast('Selecione primeiro um profissional.')}else if(action==='imprimir')window.print();else showToast(`${button.textContent.trim()}: selecione um paciente na agenda.`)}));
document.querySelectorAll('#closeAppointment,#cancelAppointment').forEach(button=>button.addEventListener('click',()=>appointmentDialog.close()));
appointmentForm.addEventListener('submit',async event=>{event.preventDefault();const data=new FormData(appointmentForm);const payload={professional:document.querySelector('#agendaProfessional').value,date:dateKey(selectedDate),time:data.get('time'),column:Number(data.get('column')),patient:data.get('patient').trim(),code:data.get('code').trim(),agreement:data.get('agreement'),treatment:data.get('treatment').trim(),billed:data.get('billed')==='on',present:data.get('present')==='on',updatedAt:serverTimestamp()};const id=data.get('appointmentId');const button=appointmentForm.querySelector('[type="submit"]');button.disabled=true;try{if(id)await updateDoc(doc(db,'agendamentos',id),payload);else await addDoc(collection(db,'agendamentos'),{...payload,createdAt:serverTimestamp()});appointmentDialog.close();showToast('Agendamento salvo.')}catch(error){console.error(error);showToast('Não foi possível salvar. Publique as regras do Firestore.')}finally{button.disabled=false}});
function connectFirestore(){
 const reportsQuery=query(collection(db,'relatorios'),orderBy('createdAt','desc'));
 onSnapshot(reportsQuery,snapshot=>{
   reports=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
   setConnection(true,'Firebase conectado');render();
 },error=>{console.error(error);reports=[];setConnection(false,'Firebase requer configuração');render();showToast('Não foi possível carregar os relatórios.')});
}
const loginScreen=document.querySelector('#loginScreen');
const loginForm=document.querySelector('#loginForm');
const registerForm=document.querySelector('#registerForm');
const switchAuth=document.querySelector('#switchAuth');
const codeInputs=[...document.querySelectorAll('.code-inputs input')];
let firestoreConnected=false;
let therapistsConnected=false;
let usersConnected=false;

function internalEmail(username){return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g,'')}@apflow.local`}
function firebasePassword(password){return `AP:${password}`}
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
async function revealApp(user){
 loginScreen.classList.add('hidden');document.querySelector('.user-area strong').textContent=user.displayName||'Equipe APFlow';setConnection(true,'Firebase conectado');
 if(!firestoreConnected){firestoreConnected=true;connectFirestore()}
 if(!therapistsConnected){therapistsConnected=true;connectTherapists()}
 try{const profile=await getDoc(doc(db,'usuarios',user.uid));if(profile.exists()&&profile.data().role==='admin'){document.querySelectorAll('.admin-only').forEach(element=>element.hidden=false);connectAdminUsers()}}catch(error){console.error('Perfil indisponível:',error)}
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
   await signInWithEmailAndPassword(auth,internalEmail(data.get('username')),firebasePassword(data.get('password')));
 }catch(reason){error.textContent=firebaseMessage(reason)}
 finally{button.disabled=false;button.textContent='Entrar'}
});

registerForm.addEventListener('submit',async event=>{
 event.preventDefault();const data=new FormData(registerForm);const button=registerForm.querySelector('button');const error=document.querySelector('#registerError');const code=codeInputs.map(input=>input.value).join('').toUpperCase();
 error.textContent='';button.disabled=true;button.textContent='Criando conta...';
 try{
   if(await hashText(code)!==accessCodeHash)throw new Error('invalid-code');
   const username=data.get('username').trim();if(internalEmail(username)==='@apflow.local')throw new Error('invalid-username');
   const credential=await createUserWithEmailAndPassword(auth,internalEmail(username),firebasePassword(data.get('password')));
   await updateProfile(credential.user,{displayName:data.get('fullName').trim()});
   const role=username.toLowerCase()==='admin'?'admin':'equipe';
   await setDoc(doc(db,'usuarios',credential.user.uid),{name:data.get('fullName').trim(),username:username.toLowerCase(),role,createdAt:serverTimestamp()});
   document.querySelector('.user-area strong').textContent=data.get('fullName').trim();
   registerForm.reset();showToast('Conta criada com sucesso.');
 }catch(reason){console.error('Falha ao criar conta:',reason);error.textContent=reason.message==='invalid-code'?'Código de cadastro incorreto.':reason.message==='invalid-username'?'Digite um usuário válido.':firebaseMessage(reason);codeInputs.forEach(input=>input.value='');codeInputs[0].focus()}
 finally{button.disabled=false;button.textContent='Criar conta'}
});

switchAuth.addEventListener('click',()=>{const registering=registerForm.classList.toggle('hidden')===false;loginForm.classList.toggle('hidden',registering);document.querySelector('#loginTitle').textContent=registering?'Criar nova conta':'Acesso ao sistema';switchAuth.textContent=registering?'Voltar para o login':'Criar uma nova conta';document.querySelector('#forgotPassword').hidden=registering;document.querySelector('#loginError').textContent='';document.querySelector('#registerError').textContent='';setTimeout(()=>registering?registerForm.elements.fullName.focus():loginForm.elements.username.focus(),50)});
document.querySelector('#forgotPassword').addEventListener('click',()=>showToast('Procure o administrador da clínica para redefinir sua senha.'));
document.querySelector('#logoutButton').addEventListener('click',async()=>{await signOut(auth);location.reload()});
onAuthStateChanged(auth,user=>{if(user)revealApp(user);else showLogin()});

function connectTherapists(){
 onSnapshot(query(collection(db,'profissionais'),orderBy('name')),snapshot=>{const saved=snapshot.docs.map(item=>({id:item.id,...item.data()})).filter(item=>item.active!==false);const savedByName=new Map(saved.map(person=>[person.name.toLowerCase(),person]));const defaultsMerged=defaultProfessionals.map(defaultPerson=>{const savedPerson=savedByName.get(defaultPerson.name.toLowerCase());if(!savedPerson)return defaultPerson;savedByName.delete(defaultPerson.name.toLowerCase());return{...defaultPerson,...savedPerson,scheduleGroup:savedPerson.scheduleGroup||defaultPerson.scheduleGroup,agendaColumns:savedPerson.agendaColumns||defaultPerson.agendaColumns,isDefault:false}});therapists=[...defaultsMerged,...savedByName.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));renderTherapists()},error=>{console.error(error);therapists=[...defaultProfessionals];renderTherapists();showToast('Lista padrão carregada; Firebase indisponível.')});
}
function connectAdminUsers(){
 if(usersConnected)return;usersConnected=true;
 onSnapshot(query(collection(db,'usuarios'),orderBy('name')),snapshot=>{
  const list=document.querySelector('#userRoleList');
  list.innerHTML=snapshot.empty?'<p class="empty-mini">Nenhum usuário cadastrado.</p>':'';
  snapshot.docs.forEach(item=>{const user=item.data();const row=document.createElement('div');row.className='admin-row';row.innerHTML=`<div><strong>${user.name||user.username}</strong><small>@${user.username}</small></div><select aria-label="Cargo de ${user.name||user.username}">${roles.map(role=>`<option value="${role.toLowerCase()}" ${user.role===role.toLowerCase()?'selected':''}>${role}</option>`).join('')}</select>`;row.querySelector('select').addEventListener('change',async event=>{event.target.disabled=true;try{await updateDoc(doc(db,'usuarios',item.id),{role:event.target.value,updatedAt:serverTimestamp()});showToast('Cargo atualizado.')}catch(error){console.error(error);showToast('Não foi possível atualizar o cargo.')}finally{event.target.disabled=false}});list.append(row)});
 },error=>{console.error(error);document.querySelector('#userRoleList').innerHTML='<p class="empty-mini">Sem permissão para visualizar usuários.</p>'});
}
const adminDialog=document.querySelector('#adminDialog');
document.querySelector('#adminButton').addEventListener('click',()=>adminDialog.showModal());
document.querySelector('#sidebarAddProfessional').addEventListener('click',()=>adminDialog.showModal());
document.querySelector('#closeAdmin').addEventListener('click',()=>adminDialog.close());
document.querySelector('#therapistForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const data=new FormData(form);const name=data.get('name').trim();const profession=data.get('profession');const agendaColumns=Number(data.get('agendaColumns'));const button=form.querySelector('button');if(!name)return;button.disabled=true;try{await addDoc(collection(db,'profissionais'),{name,profession,agendaColumns,active:true,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid});form.reset();showToast(`${profession} adicionado.`)}catch(error){console.error(error);showToast('Não foi possível adicionar o profissional.')}finally{button.disabled=false}});

updateSelectedDate();renderCalendar();renderAgenda();render();
