/* Never cache private business responses or mutations. Offline writes are not queued. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>אין חיבור</title><body style="font-family:Arial;text-align:center;padding:64px 24px;background:#f5f7f4;color:#244638"><h1>נחזור מיד כשיהיה חיבור</h1><p>כדי לצפות בנתונים ולשמור שינויים, נדרש חיבור לאינטרנט.</p><button onclick="location.reload()" style="padding:16px 28px">ניסיון נוסף</button></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}})));
});
