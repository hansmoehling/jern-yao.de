(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JYStandardFamilies=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  // Shape references only. Nominal threads never supply wire or blank diameters.
  // Public ISO descriptions checked 2026-11-25; no dimensional norm tables copied.
  const families=[
    {id:'ISO4014',kind:'screw',label:'ISO 4014 · Sechskantschraube mit Teilgewinde',headForm:'sechskant',driveFamily:'none',edition:2022,source:'https://www.iso.org/fr/standard/72579.html'},
    {id:'ISO4017',kind:'screw',label:'ISO 4017 · Sechskantschraube mit Vollgewinde',headForm:'sechskant',driveFamily:'none',edition:2022,source:'https://www.iso.org/standard/72585.html'},
    {id:'ISO4762',kind:'screw',label:'ISO 4762 · Zylinderkopf mit Innensechskant',headForm:'rund',driveFamily:'hex',edition:2004,source:'https://knowledge.bsigroup.com/products/hexagon-socket-head-cap-screws'},
    {id:'ISO14579',kind:'screw',label:'ISO 14579 · Zylinderkopf mit Innensechsrund',headForm:'rund',driveFamily:'torx',edition:2011,source:'https://www.iso.org/standard/56455.html'},
    {id:'ISO4026',kind:'headless',label:'ISO 4026 · Gewindestift mit Innensechskant und flachem Ende',headForm:'none',driveFamily:'hex',edition:2026,source:'https://www.iso.org/standard/88194.html'},
    {id:'ISO4032',kind:'nut',label:'ISO 4032 · Sechskantmutter, Typ 1',edition:2023,source:'https://www.iso.org/committee/626540/x/catalogue/'},
    {id:'ISO4033',kind:'nut',label:'ISO 4033 · Hohe Sechskantmutter, Typ 2',edition:2023,source:'https://www.iso.org/standard/75017.html'},
    {id:'ISO4035',kind:'nut',label:'ISO 4035 · Niedrige Sechskantmutter, Typ 0',edition:2023,source:'https://shop.standards.ie/en-ie/standards/i-s-en-iso-4035-2023-856982_saig_nsai_nsai_3322111/'},
    {id:'ISO4161',kind:'nut',label:'ISO 4161 · Sechskantmutter mit Bund',edition:2012,source:'https://committee.iso.org/ics/21.060.20/x/'}
  ].map(Object.freeze);
  return Object.freeze({getFamilies:kind=>families.filter(f=>f.kind===kind),get:id=>families.find(f=>f.id===id)||null});
});
