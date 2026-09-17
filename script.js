const reports=[
 {id:1,patient:'Rosimeire Aparecida Mota',code:'42780',agreement:'IAMSPE',purpose:'Retorno médico',therapist:'Alex Sandro',due:'21/09/2026',status:'aguardando'},
 {id:2,patient:'Jennifer Barbosa Calirio Okawa',code:'104598',agreement:'Outros',purpose:'Perícia do INSS',therapist:'Camila',due:'21/09/2026',status:'aguardando'},
 {id:3,patient:'Maria das Graças Barbosa Godoy',code:'89369',agreement:'IAMSPE',purpose:'Perícia de seguro',therapist:'Fernanda',due:'22/09/2026',status:'aguardando'},
 {id:4,patient:'Claudia Regina Gonçalves',code:'35525',agreement:'IAMSPE',purpose:'Retorno médico',therapist:'Vanessa',due:'18/09/2026',status:'confeccao'},
 {id:5,patient:'Wellington da Silva Cabral',code:'78399',agreement:'Outros',purpose:'Perícia do INSS',therapist:'Fernanda',due:'21/09/2026',status:'confeccao'},
 {id:6,patient:'Marcelo Buim',code:'2973',agreement:'IAMSPE',purpose:'Retorno médico',therapist:'Alex Sandro',due:'17/09/2026',status:'pronto'},
 {id:7,patient:'Elisabete Lopes Pereira',code:'103119',agreement:'Outros',purpose:'Perícia de seguro',therapist:'Camila',due:'18/09/2026',status:'pronto'},
 {id:8,patient:'Alice Budim Oliveira',code:'104448',agreement:'IAMSPE',purpose:'Retorno médico',therapist:'Vanessa',due:'16/09/2026',status:'entregue'}
];
const colors={aguardando:'#c88313',confeccao:'#377ea7',pronto:'#2f8a68'};
const labels={aguardando:'Aguardando',confeccao:'Em confecção',pronto:'Pronto'};
const lists={aguardando:document.querySelector('#waitingList'),confeccao:document.querySelector('#draftList'),pronto:document.querySelector('#readyList')};
const filters={search:document.querySelector('#searchInput'),therapist:document.querySelector('#therapistFilter'),agreement:document.querySelector('#agreementFilter')};

function render(){
 Object.values(lists).forEach(list=>list.innerHTML='');
 const term=filters.search.value.trim().toLowerCase();
 const visible=reports.filter(r=>(!term||r.patient.toLowerCase().includes(term)||r.code.includes(term))&&(!filters.therapist.value||r.therapist===filters.therapist.value)&&(!filters.agreement.value||r.agreement===filters.agreement.value));
 visible.filter(r=>lists[r.status]).forEach(r=>{
   const card=document.createElement('article'); card.className='report-card'; card.style.setProperty('--accent',colors[r.status]);
   card.innerHTML=`<div class="card-top"><div><h3>${r.patient}</h3><span class="code">Nº ${r.code}</span></div><span class="due ${r.due<='18/09/2026'?'urgent':''}">${r.due}</span></div><p>${r.agreement} • ${r.purpose}</p><div class="card-footer"><span class="badge">${labels[r.status]}</span><span class="therapist">${r.therapist}</span></div>`;
   card.addEventListener('click',()=>showToast(`${r.patient} — ${labels[r.status]}`)); lists[r.status].append(card);
 });
 document.querySelectorAll('.lane').forEach(lane=>lane.querySelector('.lane-count').textContent=visible.filter(r=>r.status===lane.dataset.status).length);
 ['aguardando','confeccao','pronto','entregue'].forEach((s,i)=>document.querySelectorAll('.metric strong')[i].textContent=reports.filter(r=>r.status===s).length);
}
function buildCalendar(){const root=document.querySelector('#calendarDays');for(let i=0;i<2;i++)root.insertAdjacentHTML('beforeend','<button class="muted">'+(30+i)+'</button>');for(let d=1;d<=30;d++)root.insertAdjacentHTML('beforeend',`<button class="${d===17?'today':''}">${d}</button>`)}
function addBusinessDays(start,days){const date=new Date(start);let added=0;while(added<days){date.setDate(date.getDate()+1);if(date.getDay()!==0&&date.getDay()!==6)added++}return date}
function brDate(date){return new Intl.DateTimeFormat('pt-BR').format(date)}
function showToast(message){const toast=document.querySelector('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),2600)}
const dialog=document.querySelector('#requestDialog');
function openDialog(){document.querySelector('#dueDate').value=brDate(addBusinessDays(new Date(),3));dialog.showModal();setTimeout(()=>document.querySelector('[name="patient"]').focus(),50)}
document.querySelectorAll('#newRequest,#newRequestTop').forEach(b=>b.addEventListener('click',openDialog));
document.querySelectorAll('#closeDialog,#cancelDialog').forEach(b=>b.addEventListener('click',()=>dialog.close()));
document.querySelectorAll('[name="purpose"]').forEach(r=>r.addEventListener('change',()=>{const field=document.querySelector('#otherPurpose');field.disabled=r.value!=='Outro';if(!field.disabled)field.focus()}));
document.querySelector('#requestForm').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.currentTarget);reports.unshift({id:Date.now(),patient:data.get('patient'),code:data.get('code'),agreement:data.get('agreement'),purpose:data.get('purpose')==='Outro'?(data.get('otherPurpose')||'Outro'):data.get('purpose'),therapist:data.get('therapist'),due:data.get('dueDate'),status:'aguardando'});e.currentTarget.reset();dialog.close();render();showToast('Solicitação enviada para a fisioterapeuta.')});
Object.values(filters).forEach(el=>el.addEventListener('input',render));
document.querySelector('#clearFilters').addEventListener('click',()=>{Object.values(filters).forEach(el=>el.value='');render()});
document.querySelectorAll('.metric').forEach(metric=>metric.addEventListener('click',()=>{document.querySelectorAll('.metric').forEach(m=>m.classList.remove('selected'));metric.classList.add('selected');const lane=document.querySelector(`.lane[data-status="${metric.dataset.filter}"]`);if(lane)lane.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})}));
document.querySelectorAll('.tool[data-view]').forEach(tool=>tool.addEventListener('click',()=>{document.querySelectorAll('.tool').forEach(t=>t.classList.remove('active'));tool.classList.add('active');showToast(`${tool.textContent.trim()} selecionado`)}));
buildCalendar();render();
