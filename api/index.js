const express = require('express')
const cors = require('cors')
const puppeteer = require("puppeteer");

const app = express()
const PORT = 3000

const home = require("../routes/home.js");

app.use(cors()); // Enable CORS for all routes
app.use("/home", home);

/**
 * Scrapes product data from a given URL using Puppeteer.
 *
 * @param {string} url - The URL to scrape.
 * @param {string} mail - The email for login.
 * @param {string} password - The password for login.
 * @param {string} year - The year to filter data.
 * @param {string} round - The round to filter data.
 */
async function scrapeProduct(url, mail, password, year, round) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(url);

    // Login process
    await loginToSite(page, mail, password);

    // Navigate and scrape desired data
    const collectedData = await navigateAndScrapeData(page, year, round);

    // Logoff and close browser
    await page.goto("https://waliye.men.gov.ma/moutamadris/Account/LogOff");
    browser.close();

    // Output scraped data
    const jsonDataString = JSON.stringify(collectedData, null, 2);
    console.log(jsonDataString);
    return jsonDataString
    //const jsonData = collectedData.map(entry => `${entry.subject.replace(/\s/g, '-')}:${entry.grade.replace(',', '.')}`).join('/');
}

async function loginToSite(page, mail, password) {
    let loggedIn = false;
    while (!loggedIn) {
        await page.waitForSelector(".item");
        await page.click(".item");
        await page.type("#UserName", mail, { delay: 50 });
        await page.click(".item");
        await page.type("#Password", password, { delay: 50 });
        await page.click(".item");
        await page.click("#btnSubmit");
        await page.goto("https://waliye.men.gov.ma/moutamadris/General/Home");

        try {
            await Promise.race([
                page.waitForNavigation({ timeout: 5000 }),
                page.waitForSelector("#NoteDiv", { timeout: 5000 }),
            ]);
            loggedIn = true;
        } catch (error) {
            console.error("Login attempt failed. Retrying...");
        }
    }
}

async function navigateAndScrapeData(page, year, round) {
    await page.goto("https://waliye.men.gov.ma/moutamadris/TuteurEleves/GetNotesEleve");
    await page.select("#SelectedAnnee", year);
    await page.select("#SelectedSession", round);
    await page.click("#btnSearchNotes");
    await page.waitForSelector("#tab_notes_exam");
    await page.click("#ResultBulletin > div > div > div.widgetCont > div.nav-tabs-custom > ul > li:nth-child(2) > a");

    const collectedData = [];

    for (let index = 1; index < 20; index++) {
        try {
            const subjectElement = await page.$x(`//*[@id="tab_notes_exam"]/div[1]/div/table/tbody/tr[${index}]/td[1]`);
            const gradeElement = await page.$x(`//*[@id="tab_notes_exam"]/div[1]/div/table/tbody/tr[${index}]/td[2]`);
            
            if (subjectElement.length > 0 && gradeElement.length > 0) {
                const subject = await subjectElement[0].getProperty("textContent").then(content => content.jsonValue());
                const grade = await gradeElement[0].getProperty("textContent").then(content => content.jsonValue());
                collectedData.push({ subject, grade });
            }
        } catch (error) {
            console.error(`Error at index ${index}`);
        }
    }

    for (let index = 1; index < 3; index++) {
        try {
            const subjectElement = await page.$x(`//*[@id="tab_notes_exam"]/div[2]/div[${index}]/label`);
            const gradeElement = await page.$x(`//*[@id="tab_notes_exam"]/div[2]/div[${index}]/span`);
            
            if (subjectElement.length > 0 && gradeElement.length > 0) {
                const subject = await subjectElement[0].getProperty("textContent").then(content => content.jsonValue());
                const grade = await gradeElement[0].getProperty("textContent").then(content => content.jsonValue());
                collectedData.push({ subject, grade });
            }
        } catch (error) {
            console.error(`Error at index ${index}`);
        }
    }

    return collectedData;
}




let mail = "R130001518@taalim.ma";
let password = "130569Akram";
let year = "2022";
let round = "2";


app.get('/api/data', async(req, res) =>{
    try{
        const message = await scrapeProduct("https://waliye.men.gov.ma/moutamadris/Account", mail, password, year, round);
        res.json({message})
    }catch{
        console.error("Error in scraping", error);
        res.status(500).json({error:"Failed to scrape data"})
    }
})

app.listen(PORT, ()=>{
    console.log(`Server is running on http://localhost: ${PORT} `);
})