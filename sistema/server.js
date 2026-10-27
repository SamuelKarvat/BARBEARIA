const express=require('express'),session=require('express-session'),{Pool,types}=require('pg'),bcrypt=require('bcryptjs');
const KEY='saep_lgpd_key_2026';
types.setTypeParser(1082,v=>v); // DATE como texto
const pool=new Pool({host:'localhost',port:5432,user:'postgres',password:'postgres',database:'saep_db'}); // ajuste a senha do PostgreSQL
const db={query:async(sql,p)=>{const r=await pool.query(sql,p);return [r.rows]}};
const app=express();
app.use(express.urlencoded({extended:false}),express.static('public'));
app.use(session({secret:'saep_secret',resave:false,saveUninitialized:false,rolling:true,cookie:{maxAge:30*60*1000}})); // expira em 30 min
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=v=>'R$ '+Number(v).toFixed(2).replace('.',',');
const page=(req,t,b,m='')=>`<!doctype html><html lang="pt-br"><meta charset="utf-8"><title>${t}</title><link rel="stylesheet" href="/style.css"><nav><b>✂ Barbearia</b><a href="/">Painel</a><a href="/clientes">Clientes</a><a href="/barbeiros">Barbeiros/Serviços</a><a href="/agendamentos">Agendamentos</a><span>Olá, ${e(req.session.nome)}</span><a href="/logout">Sair</a></nav><main><h2>${t}</h2><p class="err">${e(m)}</p>${b}</main>`;
const auth=(q,s,n)=>q.session.uid?n():s.redirect('/login?exp=1');
const tryq=async(sql,p)=>{try{await db.query(sql,p);return ''}catch(x){return x.code=='23503'?'Não é possível excluir: registro em uso.':'Erro: '+x.message}};
const cpfOk=c=>c.replace(/\D/g,'').length==11, num=c=>c.replace(/\D/g,'');

// ---- LOGIN ----
const loginPg=m=>`<!doctype html><html lang="pt-br"><meta charset="utf-8"><title>Login</title><link rel="stylesheet" href="/style.css"><div class="box"><h2>✂ Barbearia</h2><form method="post" action="/login"><input name="login" placeholder="Usuário" style="width:95%"><input type="password" name="senha" placeholder="Senha" style="width:95%"><button style="width:100%">Entrar</button></form><p class="err">${e(m)}</p></div>`;
app.get('/login',(q,s)=>s.send(loginPg(q.query.exp?'Sessão expirada. Faça login novamente.':'')));
app.post('/login',async(q,s)=>{
  const l=(q.body.login||'').trim(),p=q.body.senha||'';
  if(!l||!p)return s.send(loginPg('Preencha usuário e senha.'));
  const [[u]]=await db.query('SELECT * FROM usuarios WHERE login=$1',[l]);
  if(!u||!bcrypt.compareSync(p,u.senha))return s.send(loginPg('Usuário ou senha inválidos.'));
  q.session.uid=u.id;q.session.nome=u.nome;s.redirect('/');
});
app.get('/logout',(q,s)=>q.session.destroy(()=>s.redirect('/login')));
app.use(auth);

// ---- PAINEL ----
app.get('/',async(q,s)=>{
  let b='';for(const [t,n] of [['clientes','Clientes'],['barbeiros','Barbeiros'],['servicos','Serviços'],['agendamentos','Agendamentos']]){
    const [[r]]=await db.query(`SELECT COUNT(*)::int c FROM ${t}`);b+=`<p><b>${n}:</b> ${r.c}</p>`}
  s.send(page(q,'Painel Principal',b+'<p>Use o menu acima para navegar.</p>'));
});

// ---- CLIENTES ----
const CPF=`pgp_sym_decrypt(cpf,'${KEY}') AS cpf`;
app.post('/clientes',async(q,s)=>{
  const {id,nome,cpf,telefone}=q.body;let m='';
  if(!nome.trim()||!cpfOk(cpf))m='Nome e CPF (11 dígitos) são obrigatórios.';
  else m=id?await tryq('UPDATE clientes SET nome=$1,cpf=pgp_sym_encrypt($2,$3),telefone=$4 WHERE id=$5',[nome.trim(),num(cpf),KEY,telefone,id])
           :await tryq('INSERT INTO clientes(nome,cpf,telefone) VALUES($1,pgp_sym_encrypt($2,$3),$4)',[nome.trim(),num(cpf),KEY,telefone]);
  s.redirect('/clientes?m='+encodeURIComponent(m));
});
app.get('/clientes',async(q,s)=>{
  let m=q.query.m||'';
  if(q.query.del)m=await tryq('DELETE FROM clientes WHERE id=$1',[q.query.del]);
  let ed={id:'',nome:'',cpf:'',telefone:''};
  if(q.query.edit){const [[r]]=await db.query(`SELECT id,nome,${CPF},telefone FROM clientes WHERE id=$1`,[q.query.edit]);ed=r||ed}
  const b=(q.query.q||'').trim(),l=`%${b}%`;
  const [rows]=await db.query(`SELECT id,nome,${CPF},telefone FROM clientes WHERE nome ILIKE $1 OR telefone ILIKE $1 OR pgp_sym_decrypt(cpf,$2::text) ILIKE $1 ORDER BY nome`,[l,KEY]);
  s.send(page(q,'Clientes',`<form><input name="q" placeholder="Buscar por nome, CPF ou telefone" value="${e(b)}" size="35"><button>Buscar</button> <a href="/clientes">Limpar</a></form>
  <form method="post" action="/clientes"><input type="hidden" name="id" value="${e(ed.id)}"><input name="nome" placeholder="Nome" value="${e(ed.nome)}"><input name="cpf" placeholder="CPF" value="${e(ed.cpf)}"><input name="telefone" placeholder="Telefone" value="${e(ed.telefone)}"><button>${ed.id?'Atualizar':'Cadastrar'}</button></form>
  <table><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Ações</th></tr>${rows.map(r=>`<tr><td>${e(r.nome)}</td><td>${e(r.cpf)}</td><td>${e(r.telefone)}</td><td><a href="?edit=${r.id}">Editar</a> | <a href="?del=${r.id}" onclick="return confirm('Excluir?')">Excluir</a></td></tr>`).join('')}</table>`,m));
});

// ---- BARBEIROS / SERVIÇOS ----
app.post('/barbeiros',async(q,s)=>{
  const {tipo,nome,cpf,telefone,preco,barbeiro_id}=q.body;let m='';
  if(tipo=='b'){ if(!nome.trim()||!cpfOk(cpf))m='Nome e CPF (11 dígitos) são obrigatórios.';
    else m=await tryq('INSERT INTO barbeiros(nome,cpf,telefone) VALUES($1,pgp_sym_encrypt($2,$3),$4)',[nome.trim(),num(cpf),KEY,telefone]);}
  else{ if(!nome.trim()||!barbeiro_id||preco==='')m='Informe nome, preço e barbeiro responsável.';
    else m=await tryq('INSERT INTO servicos(nome,preco,barbeiro_id) VALUES($1,$2,$3)',[nome.trim(),preco,barbeiro_id]);}
  s.redirect('/barbeiros?m='+encodeURIComponent(m));
});
app.get('/barbeiros',async(q,s)=>{
  let m=q.query.m||'';
  if(q.query.delb)m=await tryq('DELETE FROM barbeiros WHERE id=$1',[q.query.delb]);
  if(q.query.dels)m=await tryq('DELETE FROM servicos WHERE id=$1',[q.query.dels]);
  const [bs]=await db.query(`SELECT id,nome,${CPF},telefone FROM barbeiros ORDER BY nome`);
  const [sv]=await db.query('SELECT s.id,s.nome,s.preco,b.nome barbeiro FROM servicos s JOIN barbeiros b ON b.id=s.barbeiro_id ORDER BY s.nome');
  s.send(page(q,'Barbeiros / Serviços',`<h3>Barbeiros</h3>
  <form method="post"><input type="hidden" name="tipo" value="b"><input name="nome" placeholder="Nome"><input name="cpf" placeholder="CPF"><input name="telefone" placeholder="Telefone"><button>Cadastrar</button></form>
  <table><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th></th></tr>${bs.map(r=>`<tr><td>${e(r.nome)}</td><td>${e(r.cpf)}</td><td>${e(r.telefone)}</td><td><a href="?delb=${r.id}">Excluir</a></td></tr>`).join('')}</table>
  <h3>Serviços</h3>
  <form method="post"><input type="hidden" name="tipo" value="s"><input name="nome" placeholder="Serviço"><input name="preco" type="number" step="0.01" placeholder="Preço"><select name="barbeiro_id" required><option value="">Barbeiro responsável</option>${bs.map(r=>`<option value="${r.id}">${e(r.nome)}</option>`).join('')}</select><button>Cadastrar</button></form>
  <table><tr><th>Serviço</th><th>Preço</th><th>Barbeiro</th><th></th></tr>${sv.map(r=>`<tr><td>${e(r.nome)}</td><td>${brl(r.preco)}</td><td>${e(r.barbeiro)}</td><td><a href="?dels=${r.id}">Excluir</a></td></tr>`).join('')}</table>`,m));
});

// ---- AGENDAMENTOS ----
app.post('/agendamentos',async(q,s)=>{
  const {cliente_id:c,servico_id:sv,data:d,hora:h}=q.body;let m='';
  if(!c||!sv||!d||!h)m='Preencha todos os campos.';
  else{const [[r]]=await db.query('SELECT COUNT(*)::int n FROM agendamentos a JOIN servicos s ON s.id=a.servico_id WHERE a.data=$1 AND a.hora=$2 AND s.barbeiro_id=(SELECT barbeiro_id FROM servicos WHERE id=$3)',[d,h,sv]);
    m=r.n?'Conflito: o barbeiro já tem atendimento nesse horário.':(await tryq('INSERT INTO agendamentos(cliente_id,servico_id,data,hora) VALUES($1,$2,$3,$4)',[c,sv,d,h]))||'Agendado!';}
  s.redirect('/agendamentos?m='+encodeURIComponent(m));
});
app.get('/agendamentos',async(q,s)=>{
  let m=q.query.m||'';
  if(q.query.del)m=await tryq('DELETE FROM agendamentos WHERE id=$1',[q.query.del]);
  const [cl]=await db.query('SELECT id,nome FROM clientes ORDER BY nome');
  const [sv]=await db.query('SELECT s.id,s.nome,b.nome b FROM servicos s JOIN barbeiros b ON b.id=s.barbeiro_id ORDER BY s.nome');
  const [ag]=await db.query('SELECT a.id,a.data,a.hora,c.nome cliente,c.telefone,s.nome serv,s.preco,b.nome barbeiro FROM agendamentos a JOIN clientes c ON c.id=a.cliente_id JOIN servicos s ON s.id=a.servico_id JOIN barbeiros b ON b.id=s.barbeiro_id ORDER BY a.data,a.hora');
  s.send(page(q,'Agendamentos',`<form method="post"><select name="cliente_id" required><option value="">Cliente</option>${cl.map(r=>`<option value="${r.id}">${e(r.nome)}</option>`).join('')}</select>
  <select name="servico_id" required><option value="">Serviço (barbeiro)</option>${sv.map(r=>`<option value="${r.id}">${e(r.nome+' — '+r.b)}</option>`).join('')}</select>
  <input type="date" name="data" required><input type="time" name="hora" required><button>Agendar</button></form>
  <table><tr><th>Data</th><th>Hora</th><th>Cliente</th><th>Telefone</th><th>Serviço</th><th>Preço</th><th>Barbeiro</th><th></th></tr>${ag.map(r=>`<tr><td>${r.data.split('-').reverse().join('/')}</td><td>${r.hora.slice(0,5)}</td><td>${e(r.cliente)}</td><td>${e(r.telefone)}</td><td>${e(r.serv)}</td><td>${brl(r.preco)}</td><td>${e(r.barbeiro)}</td><td><a href="?del=${r.id}">Cancelar</a></td></tr>`).join('')}</table>`,m));
});
app.listen(3000,()=>console.log('http://localhost:3000/login'));
