const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args:['--no-sandbox'] });
  for (const [w,h,name] of [[1366,900,'desk'],[390,844,'mobil']]) {
    const p = await b.newPage({ viewport:{width:w,height:h} });
    const errs=[]; p.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); }); p.on('pageerror', e=>errs.push('PAGEERR '+e.message));
    await p.route(/^https?:\/\//, r => r.abort());
    await p.goto('file://'+require('path').resolve(__dirname,'../../index.html'));
    await p.click('[data-bsp=m8]'); await p.waitForTimeout(300);
    await p.screenshot({ path:require('path').resolve(__dirname,name+'_m8.png'), fullPage:true });
    await p.click('[data-bsp=mu]'); await p.waitForTimeout(300);
    await p.screenshot({ path:require('path').resolve(__dirname,name+'_mu.png'), fullPage:false, clip: name==='desk'?{x:0,y:250,width:1366,height:1300}:undefined });
    const txt = await p.$eval('#karten', el=>el.innerText.slice(0,300));
    console.log(name, 'Fehler:', errs.filter(e=>!/ERR_FAILED|net::/.test(e)), '\n', txt.replace(/\n+/g,' | '));
    const scrollW = await p.evaluate(()=>document.documentElement.scrollWidth);
    console.log(name,'scrollWidth',scrollW);
  }
  await b.close();
})();
