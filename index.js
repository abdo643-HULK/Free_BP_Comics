const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const util = require('util');
const readline = require('readline');

const errorFile = path.join(__dirname, '/error.log');
const errorLog = fs.createWriteStream(errorFile, { flags: 'a' });

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

rl.question[util.promisify.custom] = (question) => {
	return new Promise((resolve) => {
		rl.question(question, resolve);
	});
};

main();

async function main() {
	try {
		const email = await util.promisify(rl.question)('Please type in your email: ');
		const password = await util.promisify(rl.question)('Please type in your password: ');
		console.log({ email, password });
		rl.close();
		await addToLibrary(email, password);
	} catch (err) {
		console.error(err);
		errorLog.write(util.format(err) + '\n');
	}
}

async function addToLibrary(email, password) {
	const browser = await puppeteer.launch({
		headless: false,
		defaultViewport: null,
	});

	const page = await browser.newPage();
	try {
		const login = 'https://www.comixology.eu/login';
		const url = 'https://www.comixology.eu/search/items?search=black+panther&subType=SINGLE_ISSUES';

		await page.goto(login);
		await page.waitFor(1000);
		await page.click(`[class="store-btn amazon-button"]`);
		await page.waitFor(1500);
		await page.type('[name=email]', email);
		await page.type('[name=password]', password);
		await page.click('[type=submit]');
		await page.waitFor(2000);
		await page.goto(url);
		await page.waitFor(1500);

		const pageCount = await page.evaluate(() => {
			return parseInt(document.querySelector('.pager-jump-container').innerText.split('/ ')[1]);
		});

		console.log(pageCount);

		for (let i = 0; i < pageCount; i++) {
			try {
				//Sync
				// const freeComics = await page.evaluate(() => {
				// 	function wait(ms) {
				// 		var start = Date.now(),
				// 			now = start;
				// 		while (now - start < ms) {
				// 			now = Date.now();
				// 		}
				// 	}

				// const comicsArray = Array.from(comics).forEach((comic, i) => {
				// 	console.log(comic);
				// 	const price =
				// 		comic.children[0].children[1].children[0].children[2].children[0].children[1].innerText;
				// 	const action = comic.children[0].children[1].children[0].children[3].children[0];
				// 	wait(500);
				// 	if (price === 'FREE' && action.dataset.action === 'add_to_cart') action.click();
				// });
				// });

				//Async
				const freeComics = await page.evaluate(async () => {
					const wait = (ms) => new Promise((r) => setTimeout(r, ms));

					async function asyncForEach(array, callback) {
						for (let index = 0; index < array.length; index++) {
							await callback(array[index], index, array);
						}
					}
					await wait(1500);
					const comics = document.getElementsByClassName('content-item');
					await asyncForEach(Array.from(comics), async (comic) => {
						console.log(comic);
						const price =
							comic.children[0].children[1].children[0].children[2].children[0].children[1].innerText;
						const action = comic.children[0].children[1].children[0].children[3].children[0];
						if (price === 'FREE' && action.dataset.action === 'add_to_cart') {
							action.click();
							await wait(200);
						}
					});
				});

				if (i < pageCount - 1) await page.click(`[class="pager-link next-page"]`);
				await page.waitFor(1000);
			} catch (err) {
				console.error(err);
				errorLog.write(util.format(err) + '\n');
			}
		}

		await page.goto('https://www.comixology.eu/cart');
		await page.waitFor(1500);
		if ((await page.$('.checkout-payment-btn')) == null) return await browser.close();
		await page.click('.checkout-payment-btn');
		await page.waitFor(1000);
		await page.waitForSelector('[type=submit]');
		await page.click(`[type=submit]`);
		await page.waitFor(5000);
	} catch (err) {
		console.error(err);
		errorLog.write(util.format(err) + '\n');
	}

	browser.on('disconnected', () => {
		console.log('disconnected');
		process.kill(process.pid);
	});

	browser.on('targetdestroyed', () => {
		console.log('targetdestroyed');
		process.kill(process.pid);
	});

	console.log('finished');
	browser.close();
}
