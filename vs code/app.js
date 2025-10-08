// Simple frontend-only document chat
// Features:
// - Login (username/password) stored in localStorage
// - Upload PDFs or images; extract text using PDF.js and Tesseract.js
// - Chat box that searches extracted document text for relevant sentences
// - Per-user chat history persisted in localStorage

const elements = {
  loginSection: document.getElementById('login-section'),
  uploadSection: document.getElementById('upload-section'),
  chatSection: document.getElementById('chat-section'),
  loginForm: document.getElementById('login-form'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  loginBtn: document.getElementById('login-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  fileInput: document.getElementById('file-input'),
  uploadStatus: document.getElementById('upload-status'),
  clearDoc: document.getElementById('clear-doc'),
  docPreview: document.getElementById('doc-preview'),
  chatWindow: document.getElementById('chat-window'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  userInfo: document.getElementById('user-info')
};

let state = {
  currentUser: null,
  docText: '', // aggregated extracted text
  chats: []
};

function saveUsers(users){
  localStorage.setItem('sd_users_v1', JSON.stringify(users));
}
function loadUsers(){
  return JSON.parse(localStorage.getItem('sd_users_v1')||'{}');
}

function setUserUI(){
  if(!state.currentUser){
    elements.loginSection.classList.remove('hidden');
    elements.uploadSection.classList.add('hidden');
    elements.chatSection.classList.add('hidden');
    elements.logoutBtn.classList.add('hidden');
    elements.userInfo.textContent = '';
  } else {
    elements.loginSection.classList.add('hidden');
    elements.uploadSection.classList.remove('hidden');
    elements.chatSection.classList.remove('hidden');
    elements.logoutBtn.classList.remove('hidden');
    elements.userInfo.textContent = `Logged in: ${state.currentUser}`;
    loadUserState();
  }
}

function loadUserState(){
  const users = loadUsers();
  const u = users[state.currentUser] || {chats: [], docText: ''};
  state.chats = u.chats || [];
  state.docText = u.docText || '';
  elements.docPreview.textContent = state.docText ? state.docText.slice(0,2000) : 'No extracted text yet.';
  renderChats();
}

function persistUser(){
  const users = loadUsers();
  const existing = users[state.currentUser] || {};
  users[state.currentUser] = Object.assign({}, existing, {chats: state.chats, docText: state.docText});
  saveUsers(users);
}

elements.loginForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const user = elements.username.value.trim();
  const pass = elements.password.value;
  if(!user) return alert('Please enter a username');
  const users = loadUsers();
  if(!users[user]){
    // create
    users[user] = {password: pass, chats: [], docText: ''};
    saveUsers(users);
  } else {
    if(users[user].password !== pass){
      return alert('Incorrect password for user');
    }
  }
  state.currentUser = user;
  // persist current session for tab reloads
  sessionStorage.setItem('sd_current_user', user);
  setUserUI();
});

elements.logoutBtn.addEventListener('click', ()=>{
  state.currentUser = null;
  state.chats = [];
  state.docText = '';
  elements.username.value = '';
  elements.password.value = '';
  sessionStorage.removeItem('sd_current_user');
  setUserUI();
});

elements.fileInput.addEventListener('change', async (e)=>{
  const files = Array.from(e.target.files);
  if(files.length===0) return;
  elements.uploadStatus.textContent = 'Processing... this may take a moment for images.';
  let aggregated = '';
  for(const file of files){
    if(file.type === 'application/pdf'){
      const text = await extractTextFromPDF(file);
      aggregated += '\n' + text;
    } else if(file.type.startsWith('image/')){
      const text = await extractTextFromImage(file);
      aggregated += '\n' + text;
    } else {
      // try reading as text
      const t = await file.text();
      aggregated += '\n' + t;
    }
  }
  state.docText = aggregated.trim();
  elements.docPreview.textContent = state.docText ? state.docText.slice(0,2000) : 'No extracted text.';
  elements.uploadStatus.textContent = 'Document loaded. You can now ask questions.';
  elements.clearDoc.classList.remove('hidden');
  persistUser();
});

elements.clearDoc.addEventListener('click', ()=>{
  state.docText = '';
  elements.docPreview.textContent = 'No extracted text yet.';
  elements.uploadStatus.textContent = 'No document loaded.';
  elements.clearDoc.classList.add('hidden');
  persistUser();
});

async function extractTextFromPDF(file){
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
  let fullText = '';
  for(let i=1;i<=pdf.numPages;i++){
    try{
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(i=>i.str);
      fullText += '\n' + strings.join(' ');
    }catch(err){console.error('page read err',err)}
  }
  return fullText;
}

async function extractTextFromImage(file){
  const imgURL = URL.createObjectURL(file);
  // Use Tesseract.js
  const worker = Tesseract.createWorker({logger: m=>console.log(m)});
  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  const { data: { text } } = await worker.recognize(imgURL);
  await worker.terminate();
  URL.revokeObjectURL(imgURL);
  return text;
}

function renderChats(){
  elements.chatWindow.innerHTML = '';
  state.chats.forEach(msg=>{
    const div = document.createElement('div');
    div.className = 'chat-message ' + (msg.role==='user'?'msg-user':'msg-bot');
    div.textContent = msg.text;
    elements.chatWindow.appendChild(div);
  });
  elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
}

elements.chatForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const q = elements.chatInput.value.trim();
  if(!q) return;
  addChat('user', q);
  elements.chatInput.value = '';
  // compute reply by searching document text for relevant sentences
  const reply = answerFromDocument(q);
  addChat('bot', reply);
  persistUser();
});

function addChat(role, text){
  state.chats.push({role, text, time: Date.now()});
  renderChats();
}

// Very simple keyword-based matching: find sentences containing query words or close variants
function answerFromDocument(query){
  if(!state.docText) return 'No document loaded. Please upload a PDF or image so I can search it.';
  const q = query.toLowerCase();
  // split document into sentences
  const sents = state.docText.split(/[\.\n\?\!]+/).map(s=>s.trim()).filter(Boolean);
  // exact word hits
  const qWords = q.split(/\s+/).filter(Boolean);
  const scored = sents.map(s=>{
    const lower = s.toLowerCase();
    let score = 0;
    qWords.forEach(w=>{
      if(!w) return;
      if(lower.includes(w)) score += 2;
      // simple fuzzy: substring match without vowels
      const noV = w.replace(/[aeiou]/g,'');
      if(noV && lower.replace(/[aeiou]/g,'').includes(noV)) score += 1;
    });
    return {s,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);

  if(scored.length===0){
    // fallback: show top sentences even if no direct match
    const top = sents.slice(0,3).join('\n\n');
    return `I couldn't find direct matches for "${query}". Here are some document excerpts you may find helpful:\n\n${top}`;
  }

  // return top 3 unique sentences
  const top = Array.from(new Set(scored.slice(0,3).map(x=>x.s))).join('\n\n');
  return `Here are the most relevant excerpts for "${query}":\n\n${top}`;
}

// Init UI
(function init(){
  // wire elements that didn't exist at top-level
  elements.clearDoc = document.getElementById('clear-doc');
  elements.chatForm = document.getElementById('chat-form');
  elements.chatInput = document.getElementById('chat-input');
  // check for existing logged-in user in session
  const last = sessionStorage.getItem('sd_current_user');
  if(last){
    state.currentUser = last;
  }
  setUserUI();
})();
