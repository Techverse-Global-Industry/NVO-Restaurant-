import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3002';
if(!base.includes(':3002'))throw new Error('Use the isolated experience test server on port 3002.');
const env=Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});
await context.addInitScript(()=>{localStorage.setItem('nvo-analytics','no');sessionStorage.setItem('nvo-welcomed','yes');});
const page=await context.newPage();page.setDefaultTimeout(30000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function post(route,data){const r=await context.request.post(base+'/api/'+route,{headers:{Origin:base},data});const b=await r.json();assert.ok(r.ok(),route+': '+JSON.stringify(b));return b;}
const checks=[];
async function axe(label){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();checks.push({label,violations:result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});assert.equal(result.violations.length,0,JSON.stringify(checks.at(-1)));}
mkdirSync('artifacts',{recursive:true});
try{
 await page.goto(base+'/admin');await page.getByLabel('Email',{exact:true}).fill(env.ADMIN_EMAIL);await page.getByLabel('Password',{exact:true}).fill(env.ADMIN_PASSWORD);await page.getByRole('button',{name:'Open my restaurant desk'}).click();await page.getByRole('heading',{name:'Restaurant desk',exact:true}).waitFor();
 const campaign={id:'experience-'+Date.now(),kind:'campaigns',title:'A royal lunch privilege',titleFr:'Un privilège gourmand NVO',description:'Enjoy 10% off your meal. Minimum spend 2000 FCFA; maximum discount 700 FCFA. One use.',descriptionFr:'Profitez de 10 % de remise. Achat minimum 2000 FCFA ; remise maximale 700 FCFA. Usage unique.',active:true,status:'published',sort:1,discountType:'percent',discountValue:10,minOrder:2000,maxDiscount:700,claimLimit:2,perCustomerLimit:1,activationDays:0,validityDays:7};
 await post('admin/entry',campaign);
 await page.goto(base+'/offers');await page.getByRole('button',{name:'Claim my card'}).last().click();await page.getByLabel('Your name, as shown on the card').fill('Amina NVO Guest');await page.getByRole('button',{name:'Save my coupon'}).click();await page.waitForFunction(() => !document.querySelector('.coupon-name-form')); 
 const wallet=await(await context.request.get(base+'/api/wallet')).json();const coupon=wallet.find(r=>r.campaign_id===campaign.id);assert.equal(coupon.claimant_name,'Amina NVO Guest');
 const download=page.waitForEvent('download');await page.locator('.nvo-ticket').filter({hasText:coupon.code}).getByRole('button',{name:'Download card'}).click();await(await download).saveAs('artifacts/nvo-coupon-card.png');
 await page.waitForTimeout(500);const admin=await(await context.request.get(base+'/api/admin/data')).json();assert.ok(admin.rewards.find(r=>r.id===coupon.id).saved_at);
 await page.screenshot({path:'artifacts/coupons-desktop.png',fullPage:true});await axe('coupons desktop');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'coupon overflow '+width);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/coupons-mobile.png',fullPage:true});await axe('coupons mobile');
 const stranger=await browser.newContext();const duplicate=await stranger.request.post(base+'/api/claim',{headers:{Origin:base,'X-Forwarded-For':'198.51.100.99','x-real-ip':'198.51.100.99','x-nvo-client-ip':'198.51.100.99'},data:{campaignId:campaign.id,name:'New Browser Guest'}});assert.equal(duplicate.status(),400);assert.match((await duplicate.json()).error,/network/);assert.deepEqual(await(await stranger.request.get(base+'/api/wallet')).json(),[]);await stranger.close();
 console.log('PASS: named coupon, PNG download, admin record, strict IP across browsers and private wallet.');
 await page.setViewportSize({width:1440,height:1050});await page.goto(base+'/admin?coupon='+coupon.code);await page.getByRole('heading',{name:'The guest’s sale'}).waitFor();
 await page.locator('.sale-line select').first().selectOption('banga');await page.getByLabel('Qty',{exact:true}).fill('2');await page.getByLabel('Unit price · FCFA').fill('5000');await page.getByRole('button',{name:'Calculate the guest’s discount'}).click();await page.getByText('9,300 FCFA',{exact:true}).waitFor();
 await page.screenshot({path:'artifacts/coupon-staff-check.png',fullPage:true});await axe('coupon verification');await page.getByRole('checkbox',{name:'I checked the guest’s name and received the amount shown.'}).check();await page.getByRole('button',{name:'Record paid sale & use coupon'}).click();await page.getByRole('heading',{name:'Paid sale recorded'}).waitFor();assert.match(await page.locator('.counter-receipt>strong').innerText(),/^NVO-SALE-/);await page.reload();await page.getByRole('heading',{name:'Paid sale recorded'}).waitFor();
 console.log('PASS: staff checks guest, capped discount, generated receipt, saved redemption.');
 await page.getByRole('button',{name:'Stories & journal',exact:true}).click();await page.getByRole('button',{name:'Add a story'}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Title · English',{exact:true}).fill('Welcome to NVO Restaurant');await dialog.getByLabel('Description · English',{exact:true}).fill('Discover our menu and reserve your table.');
 await page.waitForFunction(()=>document.querySelector('.bilingual-editor textarea:nth-of-type(1)')!==null);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.bilingual-editor textarea')).some(t=>t.value.includes('couvr')),{},{timeout:120000});
 const fr=await dialog.getByLabel('Description · French',{exact:true}).inputValue();assert.match(fr,/menu|carte/);
 await dialog.getByLabel('Description · French',{exact:true}).fill('Bienvenue chez NVO. Découvrez notre carte et réservez votre table.');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.bilingual-editor textarea')).some(t=>t.value.includes('Welcome')&&t.value.includes('menu')),{},{timeout:120000});
 assert.match(await dialog.getByLabel('Description · English',{exact:true}).inputValue(),/menu/);
 await page.waitForFunction(()=>document.querySelector('[role=tabpanel] textarea')?.value.includes('utm_source=facebook'));
 const captions=[];for(const platform of ['Facebook','Instagram','TikTok','WhatsApp']){await dialog.getByRole('tab',{name:platform,exact:true}).click();captions.push(await dialog.locator('[role=tabpanel] textarea').inputValue());assert.ok(await dialog.locator('[role=tabpanel] textarea').getAttribute('readonly')!==null);}
 assert.equal(new Set(captions).size,4);assert.match(captions[3],/STOP/);await page.screenshot({path:'artifacts/bilingual-automatic-captions.png',fullPage:true});await axe('bilingual editor');
 await dialog.getByRole('button',{name:'Save draft',exact:true}).click();await dialog.waitFor({state:'hidden'});
 const saved=await(await context.request.get(base+'/api/admin/data')).json();assert.ok(saved.entries.some(e=>e.title==='Welcome to NVO Restaurant'&&e.descriptionFr.includes('notre carte')));
 console.log('PASS: real local translation both ways, automatic platform captions and persisted bilingual post.');
 await page.goto(base);const first=await page.locator('.royal-main-photo img').getAttribute('src');await page.getByRole('button',{name:'Something to share',exact:true}).click();assert.notEqual(await page.locator('.royal-main-photo img').getAttribute('src'),first);await page.getByRole('button',{name:'Pause animations'}).click();assert.equal(await page.locator('html').getAttribute('data-motion'),'off');await page.reload();assert.equal(await page.locator('html').getAttribute('data-motion'),'off');
 await page.screenshot({path:'artifacts/experience-home.png',fullPage:true});
 const reduced=await browser.newContext({reducedMotion:'reduce'});const reducedPage=await reduced.newPage();await reducedPage.goto(base+'/offers');await reducedPage.waitForFunction(()=>document.documentElement.dataset.motion==='off');await reduced.close();
 assert.deepEqual(errors,[]);writeFileSync('artifacts/experience-checks.json',JSON.stringify({checks,errors,passed:true},null,2));console.log('PASS: interactive hero, motion preference persistence, reduced motion and zero browser errors.');
}catch(e){await page.screenshot({path:'artifacts/experience-failure.png',fullPage:true}).catch(()=>{});writeFileSync('artifacts/experience-failure.txt',await page.locator('body').innerText());throw e;}finally{await browser.close();}
