const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');

initializeApp();

exports.adminUpdateUserAccess=onCall({region:'southamerica-east1'},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Faça login para continuar.');

 const db=getFirestore();
 const callerProfile=await db.doc(`usuarios/${request.auth.uid}`).get();
 if(!callerProfile.exists||callerProfile.data().role!=='admin'){
  throw new HttpsError('permission-denied','Somente administradores podem alterar acessos.');
 }

 const targetUid=String(request.data?.targetUid||'').trim();
 const email=request.data?.email?String(request.data.email).trim().toLowerCase():'';
 const password=request.data?.password?String(request.data.password):'';

 if(!targetUid)throw new HttpsError('invalid-argument','Usuário não informado.');
 if(!email&&!password)throw new HttpsError('invalid-argument','Informe um novo e-mail ou uma nova senha.');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpsError('invalid-argument','E-mail inválido.');
 if(password&&password.length<4)throw new HttpsError('invalid-argument','A senha precisa ter pelo menos 4 caracteres.');
 if(password&&password.length>128)throw new HttpsError('invalid-argument','A senha excede o limite permitido.');

 const changes={};
 if(email)changes.email=email;
 if(password)changes.password=`AP:${password}`;

 try{
  await getAuth().updateUser(targetUid,changes);
  const profileChanges={updatedAt:FieldValue.serverTimestamp(),accessUpdatedBy:request.auth.uid};
  if(email)profileChanges.email=email;
  await db.doc(`usuarios/${targetUid}`).set(profileChanges,{merge:true});
  return{ok:true,message:'E-mail e/ou senha atualizados com sucesso.'};
 }catch(error){
  if(error?.code==='auth/user-not-found')throw new HttpsError('not-found','Conta não encontrada no Firebase.');
  if(error?.code==='auth/email-already-exists')throw new HttpsError('already-exists','Este e-mail já está em uso.');
  console.error('adminUpdateUserAccess',error);
  throw new HttpsError('internal','Não foi possível atualizar o acesso.');
 }
});
