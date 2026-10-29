const {test,expect}=require('/workspace/Dungeon-Hack-Mobile/node_modules/@playwright/test');
const {startOfflineServer}=require('/workspace/Dungeon-Hack-Mobile/test/offline-server.cjs');
const {artReady}=require('/workspace/Dungeon-Hack-Mobile/test/browser/helpers');
test('missing mandatory painted asset must not claim offline readiness',async({page})=>{
 const server=await startOfflineServer({failPath:'/img/ui/equipment-mannequin.webp'});
 try{await page.addInitScript(()=>{for(const[k,v]of Object.entries({firstSeen:'1',tipsOff:'1',sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});await page.goto(server.url);await artReady(page);await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));await expect(page.locator('#offline-status')).toHaveAttribute('data-core','true');}
 finally{await server.close();}
});
