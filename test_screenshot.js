import puppeteer from 'puppeteer';
import fs from 'node:fs';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.setViewport({ width: 414, height: 896 }); // Mobile size
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
  
  // mock the login by running the login logic or setting localStorage
  await page.evaluate(() => {
    // we don't have the password, so let's mock the user in localStorage
    localStorage.setItem('user', JSON.stringify({
      id: 'doctor-1',
      role: 'doctor',
      name: 'Test Doctor'
    }));
  });
  
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle0' });
  
  // wait for something to render
  await new Promise(r => setTimeout(r, 2000));
  
  const text = await page.evaluate(() => {
    return {
      mainText: document.querySelector('main')?.innerText || 'No main',
      sidebarText: document.querySelector('.sidebar')?.innerText || 'No sidebar',
      html: document.querySelector('main')?.innerHTML || 'No main HTML',
    };
  });
  
  console.log("MOBILE MAIN TEXT:\n", text.mainText);
  console.log("\n\nMOBILE SIDEBAR TEXT:\n", text.sidebarText);
  
  fs.writeFileSync('mobile_html.txt', text.html);
  
  await browser.close();
})();
