// v19: 新服务商（千问 Qwen-Image、xAI 官方、Grok 会员网页 Cookie）+ 每家独立密钥 + 提示词助手（DeepSeek/MiMo）——全部 mock，不真调
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),FX=path.join(__dirname,'fixtures')+'/';
const PNG=fs.readFileSync(FX+'mk1.png');
(async()=>{const U=process.env.U||'http://localhost:8787';const b=await chromium.launch({executablePath:process.env.CHROME_PATH});const errs=[],R=[];let hits=[];
 const H={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
 const setup=async(cfg,native)=>{const c=await b.newContext({viewport:{width:1366,height:900}});const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.route(/\/api\/proxy/,async route=>{const q=route.request();if(q.method()=='OPTIONS')return route.fulfill({status:204,headers:H});const target=q.headers()['x-target-url']||'';let body=null;try{body=JSON.parse(q.postData()||'null')}catch(e){}hits.push({target,body});
   if(/multimodal-generation/.test(target))return route.fulfill({status:200,headers:H,body:JSON.stringify({output:{choices:[{finish_reason:'stop',message:{role:'assistant',content:[{image:'https://dashscope-result.oss-cn-beijing.aliyuncs.com/x.png'}]}}]},request_id:'r1'})});
   if(/x\.png/.test(target))return route.fulfill({status:200,headers:{'content-type':'image/png','access-control-allow-origin':'*'},body:PNG});
   return route.fulfill({status:404,headers:H,body:'{}'})});
  await p.route(/dashscope-result/,r=>r.fulfill({status:403,body:''}));
  await p.route(/grok\.com\//,async route=>{const q=route.request();if(q.method()=='OPTIONS')return route.fulfill({status:204,headers:H});const u=q.url();hits.push({target:u,body:q.postData()});
   if(/upload-file-v2/.test(u))return route.fulfill({status:200,headers:H,body:JSON.stringify({uploadId:'u1',fileMetadata:{fileMetadataId:'fm-'+hits.length}})});
   if(/conversations\/new/.test(u))return route.fulfill({status:200,headers:H,body:[{result:{response:{streamingImageGenerationResponse:{imageUrl:'users/a/generated/b/image-part-0.jpg',progress:50}}}},{result:{response:{streamingImageGenerationResponse:{imageUrl:'users/a/generated/b/image.jpg',progress:100}}}}].map(JSON.stringify).join('\n')});
   if(/assets\.grok\.com/.test(u))return route.fulfill({status:200,headers:{'content-type':'image/jpeg','access-control-allow-origin':'*'},body:PNG});
   return route.fulfill({status:404,headers:H,body:'{}'})});
  await p.route(/api\.deepseek\.com/,async route=>{const q=route.request();if(q.method()=='OPTIONS')return route.fulfill({status:204,headers:H});hits.push({target:q.url(),body:JSON.parse(q.postData()||'null')});return route.fulfill({status:200,headers:H,body:JSON.stringify({choices:[{message:{content:'POLISHED PROMPT'}}]})})});
  await p.addInitScript(([cf,nat])=>{if(!sessionStorage.x){sessionStorage.x=1;localStorage.setItem('wbCfg',JSON.stringify(cf));localStorage.setItem('introX','1')}window.__TMO=8000;if(nat)window.__TAURI__={http:{fetch:(u,o)=>fetch(u,o)}}},[cfg,native]);
  await p.goto(U+'/#studio');await p.waitForFunction(()=>window.WB&&window.APP,null,{timeout:15000});
  await p.setInputFiles('#wbFile',FX+'person.png');
  await p.evaluate(async()=>{await APP.load('costume');const k=Object.keys(APP.ITEMS).find(k=>APP.ITEMS[k].type=='costume');await WB.pick(APP.ITEMS[k])});
  await p.waitForFunction(()=>!document.querySelector('#wbGo').disabled,null,{timeout:15000});return{c,p}};
 const go=async p=>{await p.click('#wbGo');await p.waitForFunction(()=>document.querySelector('#wbBusy').hidden,null,{timeout:20000}).catch(()=>{});await p.waitForTimeout(300)};
 const st=p=>p.evaluate(()=>({res:(document.querySelector('#wbAfter').src||'').slice(0,5),err:document.querySelector('#wbErr').hidden?'':document.querySelector('#wbErr').innerText.replace(/\s+/g,' ').slice(0,300)}));
 // 1) 千问：multimodal-generation，content=[{image},{image},{text}]，结果 URL 下载（直连失败→代理）
 hits=[];{const{c,p}=await setup({prov:'qwen',key:'sk-qwen',proxy:true});await go(p);const s=await st(p);const h=hits.find(x=>/multimodal/.test(x.target))||{},bd=h.body||{};
  R.push(['qwen success',s.res=='blob:'&&!s.err,JSON.stringify(s)]);
  R.push(['qwen endpoint',h.target=='https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',h.target]);
  const ct=(((bd.input||{}).messages||[])[0]||{}).content||[];R.push(['qwen content shape',bd.model=='qwen-image-2.0'&&ct.length==3&&/^data:image\//.test(ct[0].image)&&typeof ct[2].text=='string',JSON.stringify(ct.map(x=>Object.keys(x)))]);
  R.push(['qwen params',bd.parameters&&bd.parameters.n==1&&bd.parameters.watermark===false,JSON.stringify(bd.parameters)]);await c.close()}
 // 2) Grok 会员（模拟客户端原生 fetch）：上传 2 张 → imagine-image-edit → 取 progress 100 的图
 hits=[];{const{c,p}=await setup({prov:'grokweb',key:'abc123'},true);await go(p);const s=await st(p);
  const up=hits.filter(x=>/upload-file-v2/.test(x.target)),cv=hits.find(x=>/conversations\/new/.test(x.target)),dl=hits.find(x=>/assets\.grok\.com/.test(x.target));let bd={};try{bd=JSON.parse(cv&&cv.body||'{}')}catch(e){}
  R.push(['grokweb success',s.res=='blob:'&&!s.err,JSON.stringify(s)]);R.push(['grokweb uploads 2',up.length==2,String(up.length)]);
  R.push(['grokweb edit payload',bd.modelName=='imagine-image-edit'&&bd.mediaGenInput&&bd.mediaGenInput.imageToImage.inputAssets.length==2,JSON.stringify(bd).slice(0,200)]);
  R.push(['grokweb final not part',dl&&/image\.jpg$/.test(dl.target),dl&&dl.target]);await c.close()}
 // 3) Grok 会员在浏览器（非客户端）里给出明确提示
 hits=[];{const{c,p}=await setup({prov:'grokweb',key:'abc123'},false);await go(p);const s=await st(p);R.push(['grokweb web refused',/客户端/.test(s.err)&&!hits.length,s.err]);await c.close()}
 // 4) 每家独立密钥：切换服务商后再切回，密钥还在
 {const{c,p}=await setup({prov:'xai',key:'xai-111'});await p.evaluate(()=>WB.cfgOpen());await p.check('[name=prov][value=qwen]',{force:true});const k1=await p.inputValue('#cfKey');await p.fill('#cfKey','sk-222');await p.check('[name=prov][value=xai]',{force:true});const k2=await p.inputValue('#cfKey');await p.check('[name=prov][value=qwen]',{force:true});const k3=await p.inputValue('#cfKey');
  R.push(['per-provider keys',k1==''&&k2=='xai-111'&&k3=='sk-222',[k1,k2,k3].join('|')]);await c.close()}
 // 5) 提示词助手 DeepSeek
 hits=[];{const{c,p}=await setup({prov:'xai',key:'xai-1',helper:{prov:'deepseek',key:'sk-ds',model:'',base:''}});await p.evaluate(()=>{document.querySelector('details.adv').open=true;document.querySelector('#wbPrompt').value='a woman in a red dress'});await p.click('[data-polish=wbPrompt]');await p.waitForTimeout(800);
  const v=await p.inputValue('#wbPrompt'),h=hits.find(x=>/deepseek/.test(x.target))||{};R.push(['helper polish',v=='POLISHED PROMPT'&&h.target=='https://api.deepseek.com/chat/completions'&&h.body.model=='deepseek-flash',v+' '+h.target]);await c.close()}
 for(const [n,ok,d] of R)console.log((ok?'PASS':'FAIL')+' '+n+(ok?'':' — '+d));console.log('errors',JSON.stringify(errs));console.log(`v19: ${R.filter(x=>x[1]).length}/${R.length} passed`);await b.close();process.exit(R.every(x=>x[1])&&!errs.length?0:1)})();
