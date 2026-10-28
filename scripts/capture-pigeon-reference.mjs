import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const base=process.env.REVIEW_BASE_URL || 'http://127.0.0.1:5173';
const output=resolve(process.env.REFERENCE_REVIEW_OUTPUT || 'docs/pigeon/reference-v4');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],records=[];
try {
  const page=await browser.newPage({viewport:{width:1200,height:850},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const target=page.getByTestId('pigeon-scene');
  async function open(query=''){
    await page.goto(`${base}/pigeon${query}`);
    await page.waitForSelector('[data-testid="pigeon-scene"][data-ready="true"][data-model-revision="4"]',{timeout:90000});
  }
  async function seek(time){
    const before=Number(await target.getAttribute('data-frame'));
    await page.locator('#pigeon-time').evaluate((element,time)=>{
      element.step='any';element.value=time;element.dispatchEvent(new Event('input',{bubbles:true}));
    },time);
    await page.waitForFunction(({before,time})=>{
      const data=document.querySelector('[data-testid="pigeon-scene"]').dataset;
      return Number(data.frame)>before&&Math.abs(Number(data.time)-time)<.002;
    },{before,time});
  }
  async function capture(name,{full=false,...context}={}){
    if(full)await page.screenshot({path:join(output,`${name}-page.png`)});
    const style=await page.addStyleTag({content:'.pigeon-title-block,.pigeon-observation,.pigeon-scene-caption,.pigeon-bottom-bar,.pigeon-model-credit{visibility:hidden!important}.pigeon-world::after{display:none!important}'});
    const clip=name.startsWith('flight-')?{x:100,y:76,width:740,height:720}:{x:100,y:230,width:740,height:430};
    await page.screenshot({path:join(output,`${name}.png`),clip});
    await style.evaluate(element=>element.remove());
    records.push({name,...context,clip,metrics:await target.evaluate(element=>({...element.dataset}))});
    process.stdout.write(`Captured ${name}\n`);
  }
  async function view(name){await page.getByRole('button',{name,exact:true}).click();}
  async function motion(name){await page.getByRole('button',{name,exact:true}).click();}
  await open('?pigeon-review=clay');
  for(const [name,label]of[['side','측면 비교'],['front','정면 비교'],['threequarter','모델 보기']]){
    await view(label);await seek(0);await capture(`clay-${name}`,{pass:'clay'});
  }
  await open();
  for(const [name,label]of[['side','측면 비교'],['front','정면 비교'],['threequarter','모델 보기']]){
    await view(label);await seek(0);await capture(name,{full:true,pass:'final'});
  }
  for(const amount of ['0','100','82']){
    const before=Number(await target.getAttribute('data-frame'));
    await page.getByRole('slider',{name:'비둘기 가슴과 배 볼륨'}).fill(amount);
    await page.waitForFunction(before=>Number(document.querySelector('[data-testid="pigeon-scene"]').dataset.frame)>before,before);
    await capture(`roundness-${amount}`,{roundness:Number(amount)});
  }
  await motion('먹기');
  for(const [name,label]of[['side','측면 비교'],['threequarter','모델 보기']]){
    await view(label);await seek(.9);await capture(`eat-${name}`,{time:.9});
  }
  await motion('날기');await view('모델 보기');
  for(const time of [0,.10,.20,.35,.50,.75,1.15,2.4,6.5,6.8,7.1]){
    await seek(time);await capture(`flight-${time.toFixed(2).replace('.','-')}`,{time});
  }
  for(const [camera,pass]of[['top','final'],['back','final'],['top','flow']]){
    await open(`?pigeon-camera=${camera}&pigeon-review=${pass}`);await seek(0);await capture(pass==='flow'?'flow':camera,{camera,pass});
  }
  const record={viewport:{width:1200,height:850},base,browser:await browser.version(),renderer:'Chromium/SwiftShader; sampled actual WebGL frames, not a real-time FPS measurement',records,errors};
  await writeFile(join(output,'review-record.json'),JSON.stringify(record,null,2)+'\n');
  if(errors.length)throw new Error(JSON.stringify(errors));
} finally { await browser.close(); }
